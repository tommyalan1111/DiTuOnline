import { Server } from 'socket.io';
import db from './db.js';
import { verifyToken } from './auth.js';
import { TEMPLE_CAPACITY, IS_DEV } from './config.js';
import { TEMPLES, templeById } from '../shared/temples.js';

/** Ranh giới thế giới — server kẹp vị trí để chống gian lận đơn giản. */
export const WORLD = { minX: -30, maxX: 30, minZ: -28, maxZ: 28 };

const players = new Map(); // socketId -> player
const byTemple = new Map(); // templeId -> Map<socketId, player>
const byUser = new Map(); // userId -> socketId

for (const t of TEMPLES) byTemple.set(t.id, new Map());

const MAX_CHAT = 220;

export function templeCounts() {
  const out = {};
  for (const t of TEMPLES) out[t.id] = byTemple.get(t.id).size;
  return out;
}

function publicPlayer(p) {
  return {
    id: p.userId,
    username: p.username,
    gender: p.gender,
    x: p.x,
    z: p.z,
    rot: p.rot,
    action: p.action,
    merit: p.merit,
  };
}

function roomOf(templeId) {
  return `temple:${templeId}`;
}

function recentMessages(templeId, limit = 40) {
  const rows = db
    .prepare(
      `SELECT id, user_id, username, gender, text, created_at
         FROM chat_messages WHERE temple_id = ? ORDER BY id DESC LIMIT ?`,
    )
    .all(templeId, limit);
  return rows
    .reverse()
    .map((r) => ({
      id: r.id,
      userId: r.user_id,
      username: r.username,
      gender: r.gender,
      text: r.text,
      ts: r.created_at,
    }));
}

function detach(io, player, { silent = false } = {}) {
  const room = roomOf(player.templeId);
  byTemple.get(player.templeId)?.delete(player.socketId);
  if (byUser.get(player.userId) === player.socketId) byUser.delete(player.userId);
  players.delete(player.socketId);

  if (!silent) {
    io.to(room).emit('player:leave', { id: player.userId });
    io.to(room).emit('temple:count', { templeId: player.templeId, count: byTemple.get(player.templeId).size });
  }
  io.emit('temple:counts', templeCounts());
}

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

function num(v) {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

export function setupSocket(httpServer, { logger = console } = {}) {
  const io = new Server(httpServer, {
    cors: { origin: true, credentials: true },
    maxHttpBufferSize: 64 * 1024,
    pingInterval: 20_000,
    pingTimeout: 25_000,
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    const payload = verifyToken(token);
    if (!payload) return next(new Error('UNAUTHORIZED'));
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.uid);
    if (!user) return next(new Error('UNAUTHORIZED'));
    socket.data.user = user;
    socket.data.chatTimes = [];
    socket.data.lastMove = 0;
    socket.data.meritTimes = {};
    next();
  });

  io.on('connection', (socket) => {
    let user = socket.data.user;

    socket.on('join', (payload = {}, ack = () => {}) => {
      try {
        // đọc lại user: giới tính có thể vừa được cập nhật sau khi socket kết nối
        user = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id) || user;
        socket.data.user = user;

        const templeId = Number(payload.templeId);
        const temple = templeById(templeId);
        if (!temple) return ack({ ok: false, code: 'BAD_TEMPLE', message: 'Chùa không tồn tại.' });
        if (!user.gender)
          return ack({ ok: false, code: 'NO_GENDER', message: 'Bạn cần chọn giới tính trước.' });

        const room = byTemple.get(templeId);

        // Một tài khoản chỉ có một phiên trong chùa.
        const existingId = byUser.get(user.id);
        if (existingId && existingId !== socket.id) {
          const old = players.get(existingId);
          if (old) {
            detach(io, old);
            const oldSocket = io.sockets.sockets.get(existingId);
            oldSocket?.emit('session:replaced', { message: 'Tài khoản đã đăng nhập ở nơi khác.' });
            oldSocket?.disconnect(true);
          }
        }

        if (room.size >= TEMPLE_CAPACITY && !room.has(socket.id)) {
          return ack({
            ok: false,
            code: 'TEMPLE_FULL',
            message: `${temple.name} đã đủ ${TEMPLE_CAPACITY} người. Vui lòng chọn chùa khác.`,
          });
        }

        const spawn = {
          x: clamp(num(payload.x) ?? (Math.random() * 8 - 4), WORLD.minX, WORLD.maxX),
          z: clamp(num(payload.z) ?? 15 + Math.random() * 3, WORLD.minZ, WORLD.maxZ),
          rot: num(payload.rot) ?? Math.PI,
        };

        const player = {
          socketId: socket.id,
          userId: user.id,
          username: user.username,
          gender: user.gender,
          templeId,
          x: spawn.x,
          z: spawn.z,
          rot: spawn.rot,
          action: null,
          merit: user.merit || 0,
        };

        players.set(socket.id, player);
        room.set(socket.id, player);
        byUser.set(user.id, socket.id);
        socket.data.templeId = templeId;
        socket.data.player = player;

        db.prepare('UPDATE users SET temple_id = ?, last_login_at = ? WHERE id = ?').run(
          templeId,
          Date.now(),
          user.id,
        );

        socket.join(roomOf(templeId));

        const others = [...room.values()].filter((p) => p.socketId !== socket.id).map(publicPlayer);

        ack({
          ok: true,
          temple: { id: temple.id, name: temple.name, theme: temple.theme },
          self: publicPlayer(player),
          players: others,
          messages: recentMessages(templeId),
          capacity: TEMPLE_CAPACITY,
          count: room.size,
          serverTime: Date.now(),
        });

        socket.to(roomOf(templeId)).emit('player:join', publicPlayer(player));
        io.to(roomOf(templeId)).emit('temple:count', { templeId, count: room.size });
        io.emit('temple:counts', templeCounts());
        logger.log(`[join] ${user.username} → ${temple.name} (${room.size}/${TEMPLE_CAPACITY})`);
      } catch (err) {
        logger.error('[join] failed', err);
        ack({ ok: false, code: 'SERVER_ERROR', message: 'Không thể vào chùa, vui lòng thử lại.' });
      }
    });

    socket.on('leave', () => {
      const player = players.get(socket.id);
      if (!player) return;
      detach(io, player);
      socket.leave(roomOf(player.templeId));
      socket.data.player = null;
      socket.data.templeId = null;
    });

    socket.on('move', (payload = {}) => {
      const player = players.get(socket.id);
      if (!player) return;
      const now = Date.now();
      if (now - socket.data.lastMove < 40) return; // ~25 updates/s tối đa
      socket.data.lastMove = now;

      const x = num(payload.x);
      const z = num(payload.z);
      const rot = num(payload.rot);
      if (x === null || z === null || rot === null) return;

      player.x = clamp(x, WORLD.minX, WORLD.maxX);
      player.z = clamp(z, WORLD.minZ, WORLD.maxZ);
      player.rot = rot;

      socket.to(roomOf(player.templeId)).emit('player:move', {
        id: player.userId,
        x: player.x,
        z: player.z,
        rot: player.rot,
      });
    });

    socket.on('action', (payload = {}, ack = () => {}) => {
      const player = players.get(socket.id);
      if (!player) return ack({ ok: false });
      const type = String(payload.type || '');
      const now = Date.now();
      const cooldown = { bow: 1200, incense: 20000, bell: 15000, meditate: 600, stand: 400 }[type];
      if (!cooldown) return ack({ ok: false, code: 'BAD_ACTION' });
      if (now - (socket.data.meritTimes[type] || 0) < cooldown) return ack({ ok: false, code: 'COOLDOWN' });
      socket.data.meritTimes[type] = now;

      const gains = { bow: 1, incense: 3, bell: 2, meditate: 0, stand: 0 };
      if (gains[type]) {
        player.merit += gains[type];
        db.prepare('UPDATE users SET merit = merit + ? WHERE id = ?').run(gains[type], player.userId);
        socket.emit('merit', { merit: player.merit });
      }

      if (type === 'meditate') player.action = 'meditate';
      else if (type === 'stand') player.action = null;

      socket.to(roomOf(player.templeId)).emit('player:action', {
        id: player.userId,
        action: player.action,
        type,
      });
      socket.emit('player:action', { id: player.userId, action: player.action, type });
      ack({ ok: true, merit: player.merit });
    });

    socket.on('chat', (payload = {}, ack = () => {}) => {
      const player = players.get(socket.id);
      if (!player) return ack({ ok: false, code: 'NOT_IN_TEMPLE' });

      const text = String(payload.text ?? '')
        .replace(/[\r\n\t]+/g, ' ')
        .replace(/\s{2,}/g, ' ')
        .trim()
        .slice(0, MAX_CHAT);
      if (!text) return ack({ ok: false, code: 'EMPTY' });

      const now = Date.now();
      socket.data.chatTimes = socket.data.chatTimes.filter((t) => now - t < 10_000);
      if (socket.data.chatTimes.length >= 6)
        return ack({ ok: false, code: 'SLOW', message: 'Bạn gửi tin nhắn hơi nhanh, chậm lại chút nhé.' });
      if (now - (socket.data.lastChat || 0) < 900)
        return ack({ ok: false, code: 'SLOW', message: 'Chờ một chút rồi hãy gửi tiếp nhé.' });
      socket.data.lastChat = now;
      socket.data.chatTimes.push(now);

      const info = db
        .prepare(
          `INSERT INTO chat_messages (temple_id, user_id, username, gender, text, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(player.templeId, player.userId, player.username, player.gender, text, now);

      const message = {
        id: Number(info.lastInsertRowid),
        userId: player.userId,
        username: player.username,
        gender: player.gender,
        text,
        ts: now,
      };
      io.to(roomOf(player.templeId)).emit('chat:message', message);
      ack({ ok: true, id: message.id });
    });

    socket.on('typing', () => {
      const player = players.get(socket.id);
      if (!player) return;
      socket.to(roomOf(player.templeId)).emit('player:typing', { id: player.userId });
    });

    socket.on('disconnect', () => {
      const player = players.get(socket.id);
      if (player) detach(io, player);
    });
  });

  return io;
}
