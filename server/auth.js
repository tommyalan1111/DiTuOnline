import crypto from 'node:crypto';
import { AUTH_SECRET, TOKEN_TTL_DAYS } from './config.js';

const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const KEYLEN = 64;

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto
    .scryptSync(String(password).normalize('NFKC'), salt, KEYLEN, SCRYPT)
    .toString('hex');
  return { hash, salt };
}

export function verifyPassword(password, salt, expectedHash) {
  try {
    const actual = crypto
      .scryptSync(String(password).normalize('NFKC'), salt, KEYLEN, SCRYPT)
      .toString('hex');
    const a = Buffer.from(actual, 'hex');
    const b = Buffer.from(expectedHash, 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function signToken(userId, days = TOKEN_TTL_DAYS) {
  const payload = { uid: userId, exp: Date.now() + days * 24 * 60 * 60 * 1000 };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', AUTH_SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyToken(token) {
  if (typeof token !== 'string' || token.length > 512) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = crypto.createHmac('sha256', AUTH_SECRET).update(body).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!payload?.uid || !payload?.exp || Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export function newResetToken() {
  const token = crypto.randomBytes(32).toString('base64url');
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  return { token, hash };
}

export function hashResetToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
const USERNAME_RE = /^[\p{L}\p{N}_.-]{3,20}$/u;

export function validateUsername(value) {
  const username = String(value ?? '').trim();
  if (!username) return { error: 'Vui lòng nhập tên hiển thị.', field: 'username' };
  if (username.length < 3) return { error: 'Tên hiển thị phải có ít nhất 3 ký tự.', field: 'username' };
  if (username.length > 20) return { error: 'Tên hiển thị tối đa 20 ký tự.', field: 'username' };
  if (!USERNAME_RE.test(username))
    return { error: 'Tên chỉ được chứa chữ, số, dấu chấm, gạch ngang hoặc gạch dưới.', field: 'username' };
  return { value: username };
}

export function validateEmail(value) {
  const email = String(value ?? '').trim().toLowerCase();
  if (!email) return { error: 'Vui lòng nhập email.', field: 'email' };
  if (email.length > 120 || !EMAIL_RE.test(email))
    return { error: 'Email không hợp lệ.', field: 'email' };
  return { value: email };
}

export function validatePassword(value, { username } = {}) {
  const password = String(value ?? '');
  if (!password) return { error: 'Vui lòng nhập mật khẩu.', field: 'password' };
  if (password.length < 8) return { error: 'Mật khẩu phải có ít nhất 8 ký tự.', field: 'password' };
  if (password.length > 72) return { error: 'Mật khẩu tối đa 72 ký tự.', field: 'password' };
  if (!/[a-zA-ZÀ-ỹ]/.test(password) || !/[0-9]/.test(password))
    return { error: 'Mật khẩu cần có cả chữ và số.', field: 'password' };
  if (username && password.toLowerCase().includes(String(username).toLowerCase()))
    return { error: 'Mật khẩu không được chứa tên hiển thị.', field: 'password' };
  return { value: password };
}

export function validateConfirm(password, confirm) {
  if (!confirm) return { error: 'Vui lòng nhập lại mật khẩu.', field: 'confirmPassword' };
  if (password !== confirm) return { error: 'Mật khẩu nhập lại không khớp.', field: 'confirmPassword' };
  return { value: confirm };
}

export function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    gender: row.gender,
    templeId: row.temple_id,
    merit: row.merit,
    createdAt: row.created_at,
  };
}
