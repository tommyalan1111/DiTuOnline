import { io } from 'socket.io-client';
import { SERVER_URL } from './config.js';

class Emitter {
  constructor() {
    this._handlers = new Map();
  }
  on(event, fn) {
    if (!this._handlers.has(event)) this._handlers.set(event, new Set());
    this._handlers.get(event).add(fn);
    return () => this.off(event, fn);
  }
  off(event, fn) {
    this._handlers.get(event)?.delete(fn);
  }
  emit(event, ...args) {
    for (const fn of [...(this._handlers.get(event) || [])]) {
      try {
        fn(...args);
      } catch (err) {
        console.error('[net]', event, err);
      }
    }
  }
}

class Net extends Emitter {
  constructor() {
    super();
    this.socket = null;
    this.templeId = null;
    this.lastJoin = null;
    this.connected = false;
    this.manualClose = false;
  }

  connect(token) {
    if (this.socket) this.disconnect();

    this.token = token;
    this.manualClose = false;

    const socket = io(SERVER_URL || undefined, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 800,
      reconnectionDelayMax: 5000,
      timeout: 12000,
    });
    this.socket = socket;

    socket.on('connect', () => {
      this.connected = true;
      this.emit('connect');
      if (this.templeId && this.lastJoin) {
        this.join(this.templeId, this.lastJoin, { silent: true })
          .then((res) => this.emit('rejoined', res))
          .catch((err) => this.emit('rejoinFailed', err));
      }
    });

    socket.on('disconnect', (reason) => {
      this.connected = false;
      this.emit('disconnect', reason);
    });

    socket.on('connect_error', (err) => {
      this.emit('error', err);
    });

    socket.on('temple:counts', (counts) => this.emit('counts', counts));
    socket.on('temple:count', (d) => this.emit('count', d));
    socket.on('player:join', (p) => this.emit('playerJoin', p));
    socket.on('player:leave', (p) => this.emit('playerLeave', p));
    socket.on('player:move', (p) => this.emit('playerMove', p));
    socket.on('player:action', (p) => this.emit('playerAction', p));
    socket.on('player:typing', (p) => this.emit('playerTyping', p));
    socket.on('chat:message', (m) => this.emit('chat', m));
    socket.on('merit', (m) => this.emit('merit', m));
    socket.on('session:replaced', (m) => this.emit('replaced', m));

    return socket;
  }

  join(templeId, spawn = {}, { silent = false } = {}) {
    return new Promise((resolve, reject) => {
      if (!this.socket) return reject(new Error('Chưa kết nối máy chủ.'));
      this.lastJoin = spawn;
      this.socket.timeout(9000).emit('join', { templeId, ...spawn }, (timeoutErr, res) => {
        if (timeoutErr) {
          if (!silent) this.templeId = null;
          return reject(Object.assign(new Error('Máy chủ không phản hồi. Thử lại nhé.'), { code: 'TIMEOUT' }));
        }
        if (!res?.ok) {
          if (!silent) this.templeId = null;
          return reject(Object.assign(new Error(res?.message || 'Không thể vào chùa.'), { code: res?.code }));
        }
        this.templeId = templeId;
        resolve(res);
      });
    });
  }

  leave() {
    this.templeId = null;
    this.lastJoin = null;
    this.socket?.emit('leave');
  }

  move(x, z, rot) {
    this.socket?.volatile.emit('move', { x, z, rot });
  }

  action(type) {
    return new Promise((resolve) => {
      if (!this.socket) return resolve({ ok: false });
      this.socket.timeout(4000).emit('action', { type }, (err, res) => resolve(err ? { ok: false } : res));
    });
  }

  chat(text) {
    return new Promise((resolve) => {
      if (!this.socket) return resolve({ ok: false, message: 'Chưa kết nối.' });
      this.socket.timeout(6000).emit('chat', { text }, (err, res) =>
        resolve(err ? { ok: false, message: 'Không gửi được tin nhắn.' } : res),
      );
    });
  }

  typing() {
    this.socket?.emit('typing');
  }

  disconnect() {
    this.manualClose = true;
    this.templeId = null;
    this.lastJoin = null;
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    this.connected = false;
  }
}

export const net = new Net();
