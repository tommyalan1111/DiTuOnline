/**
 * Kiểm thử giới hạn 50 người/chùa.
 * Chạy: node scripts/test-capacity.mjs   (server phải đang chạy)
 */
import { DatabaseSync } from 'node:sqlite';
import { io } from 'socket.io-client';
import { hashPassword, signToken } from '../server/auth.js';

const SERVER = process.env.SERVER || 'http://localhost:3000';
const TEMPLE = Number(process.env.TEMPLE || 1);
const N = 51;

const db = new DatabaseSync('data/ditu.db');
const { hash, salt } = hashPassword('matkhau123');
const now = Date.now();

function createUser(i) {
  const name = `captest_${Date.now()}_${i}`;
  const info = db
    .prepare(
      `INSERT INTO users (username, email, pass_hash, pass_salt, gender, merit, created_at)
       VALUES (?, ?, ?, ?, 'male', 0, ?)`,
    )
    .run(name, `${name}@example.com`, hash, salt, now);
  return { id: Number(info.lastInsertRowid), name };
}

function connect(token) {
  return new Promise((resolve, reject) => {
    const s = io(SERVER, { auth: { token }, transports: ['websocket'], reconnection: false });
    s.on('connect', () => resolve(s));
    s.on('connect_error', reject);
    setTimeout(() => reject(new Error('connect timeout')), 8000);
  });
}

function join(s, templeId) {
  return new Promise((resolve) => {
    s.timeout(8000).emit('join', { templeId }, (err, res) => resolve(err ? { ok: false, code: 'TIMEOUT' } : res));
  });
}

const users = [];
for (let i = 0; i < N; i++) users.push(createUser(i));

const sockets = [];
let ok = 0;
let last = null;
for (const u of users) {
  const s = await connect(signToken(u.id));
  const res = await join(s, TEMPLE);
  if (res.ok) {
    ok++;
    sockets.push(s);
  } else {
    last = res;
    s.disconnect();
    break;
  }
}

const count = (await (await fetch(`${SERVER}/api/temples`)).json()).temples.find((t) => t.id === TEMPLE);
console.log(`Vào được        : ${ok}`);
console.log(`Người thứ ${ok + 1}     : ${last?.code} — ${last?.message}`);
console.log(`API báo online  : ${count.online}/${count.capacity} (full=${count.full})`);

for (const s of sockets) s.disconnect();
await new Promise((r) => setTimeout(r, 800));

const after = (await (await fetch(`${SERVER}/api/temples`)).json()).temples.find((t) => t.id === TEMPLE);
console.log(`Sau khi rời     : ${after.online}/${after.capacity}`);

// dọn dữ liệu test
db.prepare("DELETE FROM users WHERE username LIKE 'captest_%'").run();
db.close();

const pass = ok === 50 && last?.code === 'TEMPLE_FULL' && count.online === 50 && after.online === 0;
console.log(pass ? '\n✅ ĐẠT: giới hạn 50 người/chùa hoạt động đúng.' : '\n❌ KHÔNG ĐẠT');
process.exit(pass ? 0 : 1);
