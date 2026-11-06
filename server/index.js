import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import db from './db.js';
import { setupSocket, templeCounts, WORLD } from './sockets.js';
import { sendResetEmail, mailEnabled } from './mailer.js';
import { createLimiter } from './ratelimit.js';
import {
  hashPassword,
  verifyPassword,
  signToken,
  verifyToken,
  newResetToken,
  hashResetToken,
  validateUsername,
  validateEmail,
  validatePassword,
  validateConfirm,
  publicUser,
} from './auth.js';
import {
  APP_NAME,
  IS_DEV,
  PORT,
  HOST,
  PUBLIC_DIR,
  RESET_TTL_MIN,
  TEMPLE_CAPACITY,
  baseUrl,
} from './config.js';
import { TEMPLES, templeById } from '../shared/temples.js';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

// Cho phép app Android (origin https://localhost) gọi API từ máy chủ khác gốc.
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Max-Age', '86400');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(express.json({ limit: '32kb' }));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  next();
});

/* ----------------------------- helpers ----------------------------- */

function fail(res, status, error, field) {
  return res.status(status).json({ ok: false, error, field });
}

function auth(req, res, next) {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : req.query.token;
  const payload = verifyToken(token);
  if (!payload) return fail(res, 401, 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.uid);
  if (!user) return fail(res, 401, 'Tài khoản không tồn tại.');
  req.user = user;
  next();
}

const loginLimiter = createLimiter({ windowMs: 10 * 60_000, max: 15 });
const registerLimiter = createLimiter({ windowMs: 60 * 60_000, max: 12 });
const forgotLimiter = createLimiter({ windowMs: 15 * 60_000, max: 6 });

/* ------------------------------ auth ------------------------------- */

app.post('/api/auth/register', registerLimiter, (req, res) => {
  const { username, email, password, confirmPassword } = req.body || {};

  const u = validateUsername(username);
  if (u.error) return fail(res, 400, u.error, u.field);
  const e = validateEmail(email);
  if (e.error) return fail(res, 400, e.error, e.field);
  const p = validatePassword(password, { username: u.value });
  if (p.error) return fail(res, 400, p.error, p.field);
  const c = validateConfirm(p.value, confirmPassword);
  if (c.error) return fail(res, 400, c.error, c.field);

  const takenName = db.prepare('SELECT id FROM users WHERE username = ?').get(u.value);
  if (takenName) return fail(res, 409, 'Tên hiển thị này đã có người dùng.', 'username');
  const takenEmail = db.prepare('SELECT id FROM users WHERE email = ?').get(e.value);
  if (takenEmail) return fail(res, 409, 'Email này đã được đăng ký.', 'email');

  const { hash, salt } = hashPassword(p.value);
  const now = Date.now();
  try {
    const info = db
      .prepare(
        `INSERT INTO users (username, email, pass_hash, pass_salt, gender, merit, created_at, last_login_at)
         VALUES (?, ?, ?, ?, NULL, 0, ?, ?)`,
      )
      .run(u.value, e.value, hash, salt, now, now);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(info.lastInsertRowid));
    return res.status(201).json({
      ok: true,
      token: signToken(user.id),
      user: publicUser(user),
      next: 'gender',
    });
  } catch (err) {
    console.error('[register]', err);
    return fail(res, 500, 'Không thể tạo tài khoản, vui lòng thử lại.');
  }
});

app.post('/api/auth/login', loginLimiter, (req, res) => {
  const { identifier, password } = req.body || {};
  if (!identifier || !password) return fail(res, 400, 'Vui lòng nhập email/tên và mật khẩu.');

  const key = String(identifier).trim();
  const user = db
    .prepare('SELECT * FROM users WHERE email = ? OR username = ? LIMIT 1')
    .get(key, key);
  if (!user || !verifyPassword(password, user.pass_salt, user.pass_hash)) {
    return fail(res, 401, 'Email/tên hoặc mật khẩu không đúng.');
  }

  db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(Date.now(), user.id);
  return res.json({
    ok: true,
    token: signToken(user.id),
    user: publicUser(user),
    next: !user.gender ? 'gender' : 'temples',
  });
});

app.get('/api/auth/me', auth, (req, res) => {
  res.json({ ok: true, user: publicUser(req.user) });
});

app.post('/api/auth/gender', auth, (req, res) => {
  const gender = String(req.body?.gender || '');
  if (!['male', 'female'].includes(gender)) return fail(res, 400, 'Giới tính không hợp lệ.', 'gender');
  db.prepare('UPDATE users SET gender = ? WHERE id = ?').run(gender, req.user.id);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  res.json({ ok: true, user: publicUser(user) });
});

app.post('/api/auth/forgot', forgotLimiter, async (req, res) => {
  const e = validateEmail(req.body?.email);
  if (e.error) return fail(res, 400, e.error, e.field);

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(e.value);
  // Không tiết lộ email có tồn tại hay không.
  if (!user) {
    return res.json({
      ok: true,
      message: 'Nếu email này đã đăng ký, bạn sẽ nhận được liên kết đặt lại mật khẩu trong ít phút.',
    });
  }

  db.prepare('DELETE FROM reset_tokens WHERE user_id = ? AND used_at IS NULL').run(user.id);
  const { token, hash } = newResetToken();
  const now = Date.now();
  db.prepare(
    'INSERT INTO reset_tokens (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)',
  ).run(hash, user.id, now + RESET_TTL_MIN * 60_000, now);

  const link = `${baseUrl(req)}/?reset=${encodeURIComponent(token)}`;
  let delivered = false;
  try {
    const result = await sendResetEmail({
      to: user.email,
      username: user.username,
      link,
      minutes: RESET_TTL_MIN,
    });
    delivered = Boolean(result.delivered);
  } catch (err) {
    console.error('[forgot] gửi email thất bại:', err.message);
  }

  return res.json({
    ok: true,
    message: delivered
      ? 'Đã gửi liên kết đặt lại mật khẩu tới email của bạn.'
      : 'Yêu cầu đã được ghi nhận. Liên kết đặt lại mật khẩu đã được gửi tới email đăng ký.',
    // Chỉ trả link khi chạy dev và chưa cấu hình SMTP, để tiện thử nghiệm.
    devResetUrl: IS_DEV && !delivered && !mailEnabled ? link : undefined,
  });
});

app.post('/api/auth/reset', loginLimiter, (req, res) => {
  const { token, password, confirmPassword } = req.body || {};
  if (!token) return fail(res, 400, 'Liên kết đặt lại mật khẩu không hợp lệ.');

  const row = db
    .prepare('SELECT * FROM reset_tokens WHERE token_hash = ? AND used_at IS NULL')
    .get(hashResetToken(token));
  if (!row) return fail(res, 400, 'Liên kết không hợp lệ hoặc đã được sử dụng.');
  if (Date.now() > row.expires_at) return fail(res, 400, 'Liên kết đã hết hạn. Vui lòng yêu cầu lại.');

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(row.user_id);
  const p = validatePassword(password, { username: user?.username });
  if (p.error) return fail(res, 400, p.error, p.field);
  const c = validateConfirm(p.value, confirmPassword);
  if (c.error) return fail(res, 400, c.error, c.field);

  const { hash, salt } = hashPassword(p.value);
  const tx = db.prepare('UPDATE users SET pass_hash = ?, pass_salt = ? WHERE id = ?');
  tx.run(hash, salt, row.user_id);
  db.prepare('UPDATE reset_tokens SET used_at = ? WHERE token_hash = ?').run(Date.now(), row.token_hash);
  db.prepare('DELETE FROM reset_tokens WHERE user_id = ? AND used_at IS NULL').run(row.user_id);

  res.json({ ok: true, message: 'Mật khẩu đã được đổi. Bạn có thể đăng nhập lại.' });
});

/* ----------------------------- temples ----------------------------- */

app.get('/api/temples', (req, res) => {
  const counts = templeCounts();
  const list = TEMPLES.map((t) => ({
    id: t.id,
    slug: t.slug,
    name: t.name,
    tagline: t.tagline,
    description: t.description,
    theme: t.theme,
    seal: t.seal,
    accent: t.accent,
    accentSoft: t.accentSoft,
    online: counts[t.id] || 0,
    capacity: TEMPLE_CAPACITY,
    full: (counts[t.id] || 0) >= TEMPLE_CAPACITY,
  }));
  res.json({ ok: true, temples: list, capacity: TEMPLE_CAPACITY });
});

app.get('/api/temples/:id/history', (req, res) => {
  const temple = templeById(req.params.id);
  if (!temple) return fail(res, 404, 'Chùa không tồn tại.');
  const rows = db
    .prepare('SELECT username, gender, text, created_at FROM chat_messages WHERE temple_id = ? ORDER BY id DESC LIMIT 50')
    .all(temple.id)
    .reverse();
  res.json({ ok: true, messages: rows.map((r) => ({ ...r, ts: r.created_at })) });
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true, app: APP_NAME, temples: TEMPLES.length, capacity: TEMPLE_CAPACITY, world: WORLD });
});

/* --------------------------- static app ---------------------------- */

const indexPath = path.join(PUBLIC_DIR, 'index.html');
if (fs.existsSync(PUBLIC_DIR)) {
  app.use(
    express.static(PUBLIC_DIR, {
      index: false,
      setHeaders(res, file) {
        if (file.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      },
    }),
  );
}

app.get(/^(?!\/(api|socket\.io)\/).*/, (req, res, next) => {
  if (!fs.existsSync(indexPath)) {
    return res
      .status(503)
      .type('html')
      .send('<h1>Chưa build giao diện</h1><p>Chạy <code>npm run build</code> rồi khởi động lại server.</p>');
  }
  res.sendFile(indexPath, (err) => (err ? next(err) : undefined));
});

app.use((err, req, res, next) => {
  if (err?.type === 'entity.parse.failed') return fail(res, 400, 'Dữ liệu gửi lên không hợp lệ.');
  console.error('[error]', err);
  if (res.headersSent) return next(err);
  return fail(res, 500, 'Máy chủ gặp sự cố, vui lòng thử lại.');
});

/* ----------------------------- startup ----------------------------- */

const server = http.createServer(app);
const io = setupSocket(server);

server.listen(PORT, HOST, () => {
  console.log(`\n  ${APP_NAME}  ·  http://localhost:${PORT}`);
  console.log(`  ${TEMPLES.length} chùa · ${TEMPLE_CAPACITY} người/chùa · ${IS_DEV ? 'dev' : 'production'}\n`);
});

function shutdown(signal) {
  console.log(`\n${signal} — đang đóng máy chủ...`);
  io.close();
  server.close(() => {
    try {
      db.close();
    } catch {}
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 3000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
