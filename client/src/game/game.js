import * as THREE from 'three';
import { World } from './world.js';
import { Avatar } from './avatar.js';
import { Controls } from './controls.js';
import { AudioEngine } from './audio.js';
import { net } from '../net.js';
import { store } from '../store.js';
import { toast } from '../ui/toast.js';
import { openModal, confirmDialog } from '../ui/modal.js';
import { $, $$, formatTime } from '../ui/dom.js';

const ACTION_COOLDOWNS = { bow: 1200, incense: 20000, bell: 15000, meditate: 0, stand: 0 };

function angleLerp(a, b, t) {
  const d = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  return a + d * t;
}

export class Game {
  constructor({ temple, user, onLeave, onSessionReplaced, spawn }) {
    this.temple = temple;
    this.user = user;
    this.onLeave = onLeave;
    this.onSessionReplaced = onSessionReplaced;

    this.destroyed = false;
    this.ready = false;
    this.subs = [];
    this.remote = new Map();
    this.cooling = new Map();
    this.meditating = false;
    this.unread = 0;
    this.lastSend = 0;
    this.lastSent = { x: NaN, z: NaN, rot: NaN };
    this.stepTimer = 0;
    this.hintTimer = 9;

    this.spawn = spawn || { x: 0, z: 13.5, rot: Math.PI };
    this.self = { x: this.spawn.x, z: this.spawn.z, y: 0, rot: this.spawn.rot, moving: false, merit: 0 };

    // Mỗi lần vào chùa dùng một canvas WebGL mới — tránh tái sử dụng context đã bị
    // giải phóng khi đổi chùa (nguyên nhân màn hình đen / kẹt ở màn hình chờ).
    const oldCanvas = $('#game-canvas');
    const canvas = document.createElement('canvas');
    canvas.id = 'game-canvas';
    if (oldCanvas) oldCanvas.replaceWith(canvas);
    else $('#screen-game')?.appendChild(canvas);
    this.canvas = canvas;
    this.mobile =
      /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
      window.matchMedia?.('(pointer: coarse)').matches;

    /* ── renderer ── */
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: !this.mobile,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.mobile ? 2 : 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.camera = new THREE.PerspectiveCamera(54, 1, 0.1, 320);

    this.world = new World(temple.theme, {
      anisotropy: this.renderer.capabilities.getMaxAnisotropy(),
      mobile: this.mobile,
    });
    this.renderer.toneMappingExposure = this.world.theme.exposure * 0.94;
    this.scene = this.world.scene;

    /* ── nhân vật của mình ── */
    this.avatar = new Avatar({ gender: user.gender, name: user.username, isSelf: true });
    this.avatar.root.position.set(this.self.x, 0, this.self.z);
    this.avatar.root.rotation.y = this.self.rot;
    this.scene.add(this.avatar.root);

    /* ── điều khiển & âm thanh ── */
    this.controls = new Controls({
      canvas: this.canvas,
      joystick: $('#joystick'),
      stick: $('#joystick-stick'),
      camera: this.camera,
    });
    this.controls.yaw = 0;
    this.controls.pitch = this.mobile ? 0.38 : 0.3;
    if (this.mobile) this.controls.dist = 9.6;

    this.audio = new AudioEngine();
    if (store.soundEnabled) this.audio.start();

    this.clock = new THREE.Clock();
    this.resize();
    this.onResize = () => this.resize();
    window.addEventListener('resize', this.onResize);
    window.visualViewport?.addEventListener('resize', this.onResize);

    this.bindNet();
    this.initHud();

    this.tick();
    this.join();
  }

  /* ───────────────────────── hạ tầng ───────────────────────── */

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.fov = w / h < 0.8 ? 62 : 54;
    this.camera.updateProjectionMatrix();
  }

  join() {
    net
      .join(this.temple.id, this.spawn)
      .then((res) => {
        if (this.destroyed) return;
        this.applySnapshot(res);
        this.ready = true;
        setTimeout(() => $('#game-loading')?.classList.add('is-hidden'), 220);
        this.pushSystem(`Bạn đã bước vào ${this.temple.name}. Nguyện cầu một ngày an lạc.`);
        if (!this._welcomed) {
          this._welcomed = true;
          setTimeout(() => toast('Chạm và kéo joystick để bước đi. Chạm "Lạy" để đảnh lễ.', '', 'toast-root-game'), 1800);
        }
      })
      .catch((err) => {
        console.error('[join]', err);
        if (this.destroyed) return;
        toast(err.message || 'Không thể vào chùa.', 'err', 'toast-root-game');
        $('#game-loading')?.classList.add('is-hidden');
        this.destroy();
        net.leave();
        this.onLeave?.();
      });
  }

  applySnapshot(res) {
    // vị trí của mình
    if (res.self) {
      this.self.x = res.self.x;
      this.self.z = res.self.z;
      this.self.rot = res.self.rot;
      this.self.y = this.world.groundHeightAt(res.self.x, res.self.z);
      this.avatar.root.position.set(this.self.x, this.self.y, this.self.z);
      this.avatar.root.rotation.y = this.self.rot;
      this.avatar.setMeditating(res.self.action === 'meditate');
      this.meditating = res.self.action === 'meditate';
      this.setMerit(res.self.merit ?? 0);
      this.syncMeditateButton();
    }

    // xoá người chơi cũ rồi dựng lại
    for (const [, r] of this.remote) this.scene.remove(r.avatar.root);
    this.remote.clear();
    for (const p of res.players || []) this.addRemote(p);

    // chat
    const body = $('#chat-body');
    body.innerHTML = '';
    this.unread = 0;
    this.updateBadge();
    for (const m of res.messages || []) this.appendMessage(m, { animate: false });

    this.setOnline(res.count ?? (res.players?.length || 0) + 1);

    // camera đặt ngay sau lưng
    this.controls.updateCamera(0, new THREE.Vector3(this.self.x, this.self.y + 1.42, this.self.z), true);
  }

  /* ───────────────────────── mạng ───────────────────────── */

  bindNet() {
    const sub = (evt, fn) => this.subs.push(net.on(evt, fn));

    sub('playerJoin', (p) => {
      this.addRemote(p);
      this.pushSystem(`${p.username} vừa bước vào chùa.`);
    });

    sub('playerLeave', (p) => {
      const r = this.remote.get(p.id);
      if (!r) return;
      this.scene.remove(r.avatar.root);
      this.remote.delete(p.id);
      this.pushSystem(`${r.avatar.name} đã rời chùa.`);
    });

    sub('playerMove', (p) => {
      const r = this.remote.get(p.id);
      if (!r) return;
      r.tx = p.x;
      r.tz = p.z;
      r.trot = p.rot;
      r.lastSeen = performance.now();
    });

    sub('playerAction', (p) => {
      const r = this.remote.get(p.id);
      if (!r) return;
      r.avatar.playAction(p.type || p.action);
      if (p.action === 'meditate') r.avatar.setMeditating(true);
      else if (p.action === 'stand' || p.type === 'stand') r.avatar.setMeditating(false);
    });

    sub('playerTyping', (p) => {
      const r = this.remote.get(p.id);
      if (!r) return;
      this.typingWho = r.avatar.name;
      this.typingUntil = performance.now() + 2600;
      $('#chat-typing').textContent = `${this.typingWho} đang nhập…`;
      clearTimeout(this.typingClear);
      this.typingClear = setTimeout(() => {
        if (performance.now() >= this.typingUntil) $('#chat-typing').textContent = '';
      }, 2700);
      this.updateTyping();
    });

    sub('chat', (m) => this.onChat(m));

    sub('count', (d) => {
      if (d.templeId === this.temple.id) this.setOnline(d.count);
    });

    sub('merit', (d) => this.setMerit(d.merit));

    sub('replaced', (m) => {
      this.destroy();
      this.onSessionReplaced?.(m?.message || 'Tài khoản đã đăng nhập ở thiết bị khác.');
    });

    sub('disconnect', () => {
      if (this.destroyed) return;
      toast('Mất kết nối. Đang thử nối lại…', 'err', 'toast-root-game');
    });

    sub('connect', () => {
      if (this.destroyed || !this.ready) return;
      toast('Đã kết nối lại với chùa.', 'ok', 'toast-root-game');
    });

    sub('rejoined', (res) => {
      if (this.destroyed) return;
      this.applySnapshot(res);
      toast('Đã trở lại chùa.', 'ok', 'toast-root-game');
    });

    sub('rejoinFailed', (err) => {
      if (this.destroyed) return;
      toast(err.message || 'Không thể trở lại chùa.', 'err', 'toast-root-game');
    });
  }

  addRemote(p) {
    if (!p || p.id === this.user.id) return;
    let r = this.remote.get(p.id);
    if (!r) {
      const avatar = new Avatar({ gender: p.gender, name: p.username });
      avatar.root.position.set(p.x, this.world.groundHeightAt(p.x, p.z), p.z);
      avatar.root.rotation.y = p.rot;
      avatar.setMeditating(p.action === 'meditate');
      this.scene.add(avatar.root);
      r = { avatar, tx: p.x, tz: p.z, trot: p.rot, lastSeen: performance.now(), target: new THREE.Vector3() };
      this.remote.set(p.id, r);
    } else {
      r.tx = p.x;
      r.tz = p.z;
      r.trot = p.rot;
      r.avatar.setMeditating(p.action === 'meditate');
    }
  }

  onChat(m) {
    this.appendMessage(m, { animate: true });
    const isSelf = m.userId === this.user.id;
    if (!isSelf) {
      for (const [, r] of this.remote) {
        if (r.avatar.name === m.username) {
          r.avatar.say(m.text);
          break;
        }
      }
      if ($('#chat-panel').hidden) {
        this.unread++;
        this.updateBadge();
      }
    } else {
      this.avatar.say(m.text);
    }
    if (!$('#chat-panel').hidden) this.scrollChat();
  }

  /* ───────────────────────── HUD ───────────────────────── */

  initHud() {
    $('#hud-temple').textContent = this.temple.name;
    $('#hud-weather').textContent = this.temple.tagline || '';
    $('#chat-title').textContent = this.temple.name;
    $('#chat-sub').textContent = '0 người đang tu';

    const soundBtn = $('#btn-sound');
    soundBtn.classList.toggle('is-muted', !store.soundEnabled);
    soundBtn.onclick = () => {
      const on = soundBtn.classList.contains('is-muted');
      this.audio.setEnabled(on);
      soundBtn.classList.toggle('is-muted', !on);
      toast(on ? 'Đã bật âm thanh.' : 'Đã tắt âm thanh.', '', 'toast-root-game');
    };

    $('#btn-menu').onclick = () => this.openMenu();
    $('#btn-temple-info').onclick = () => this.openTempleInfo();
    $('#btn-back-temples').onclick = () => this.leaveTemple();

    $('#btn-chat').onclick = () => this.toggleChat();
    $('#chat-close').onclick = () => this.toggleChat(false);
    $('#chat-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.sendChat();
    });
    $('#chat-input').addEventListener('input', () => {
      const now = performance.now();
      if (now - (this._lastTyping || 0) > 1800) {
        this._lastTyping = now;
        net.typing();
      }
    });

    for (const btn of $$('.act[data-act]')) {
      btn.addEventListener('click', () => this.doAction(btn.dataset.act, btn));
    }

    window.addEventListener('keydown', this.onKey = (e) => {
      if (this.destroyed) return;
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.code === 'KeyC') {
        e.preventDefault();
        this.toggleChat();
      } else if (e.code === 'Space') {
        e.preventDefault();
        this.doAction('bow', $('.act[data-act="bow"]'));
      } else if (e.code === 'KeyM') {
        this.doAction('meditate', $('.act[data-act="meditate"]'));
      } else if (e.code === 'Escape') {
        this.toggleChat(false);
      }
    });

    setTimeout(() => $('#hud-hint')?.classList.add('is-hidden'), 9000);
  }

  setOnline(n) {
    $('#hud-online').textContent = n;
    $('#chat-sub').textContent = `${n} người đang tu`;
  }

  setMerit(n) {
    this.self.merit = n;
    $('#hud-merit').textContent = n;
    const el = $('#hud-merit');
    el.animate?.(
      [
        { transform: 'scale(1)', color: '#fff' },
        { transform: 'scale(1.35)', color: '#f2d79a' },
        { transform: 'scale(1)', color: '#fff' },
      ],
      { duration: 520, easing: 'ease-out' },
    );
  }

  updateBadge() {
    const b = $('#chat-badge');
    b.hidden = this.unread <= 0;
    b.textContent = this.unread > 9 ? '9+' : String(this.unread);
  }

  updateTyping() {
    const el = $('#chat-typing');
    if (!el) return;
    if (performance.now() < (this.typingUntil || 0)) el.textContent = `${this.typingWho} đang nhập…`;
    else el.textContent = '';
  }

  /* ───────────────────────── chat ───────────────────────── */

  toggleChat(force) {
    const panel = $('#chat-panel');
    const open = force === undefined ? panel.hidden : force;
    panel.hidden = !open;
    if (open) {
      this.unread = 0;
      this.updateBadge();
      this.scrollChat();
      if (!this.mobile) setTimeout(() => $('#chat-input')?.focus(), 80);
    }
  }

  appendMessage(m, { animate = true } = {}) {
    const body = $('#chat-body');
    const line = document.createElement('div');
    line.className = 'chat-line';
    if (m.userId === this.user.id) line.classList.add('is-self');

    const who = document.createElement('span');
    who.className = 'who';
    who.textContent = (m.username || 'Tu sĩ') + (m.userId === this.user.id ? ' · bạn' : '');

    const msg = document.createElement('span');
    msg.className = 'msg';
    msg.textContent = m.text;

    line.append(who, msg);
    if (!animate) line.style.animation = 'none';
    body.appendChild(line);

    while (body.children.length > 200) body.firstChild.remove();
  }

  pushSystem(text) {
    const body = $('#chat-body');
    const line = document.createElement('div');
    line.className = 'chat-line is-system';
    const msg = document.createElement('span');
    msg.className = 'msg';
    msg.textContent = text;
    line.appendChild(msg);
    body.appendChild(line);
    if (!$('#chat-panel').hidden) this.scrollChat();
  }

  scrollChat() {
    const body = $('#chat-body');
    requestAnimationFrame(() => {
      body.scrollTop = body.scrollHeight;
    });
  }

  async sendChat() {
    const input = $('#chat-input');
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    const res = await net.chat(text);
    if (!res.ok) {
      toast(res.message || 'Không gửi được tin nhắn.', 'err', 'toast-root-game');
      input.value = text;
      return;
    }
    this.scrollChat();
  }

  /* ───────────────────────── hành động ───────────────────────── */

  async doAction(type, btn) {
    if (type === 'meditate') {
      this.meditating = !this.meditating;
      this.avatar.setMeditating(this.meditating);
      this.syncMeditateButton();
      await net.action(this.meditating ? 'meditate' : 'stand');
      if (this.meditating) this.audio.bow();
      return;
    }
    if (type === 'stand') {
      this.meditating = false;
      this.avatar.setMeditating(false);
      this.syncMeditateButton();
      await net.action('stand');
      return;
    }

    const now = Date.now();
    if ((this.cooling.get(type) || 0) > now) return;
    this.cooling.set(type, now + (ACTION_COOLDOWNS[type] || 1000));
    if (btn) {
      btn.classList.add('is-cool');
      setTimeout(() => btn.classList.remove('is-cool'), ACTION_COOLDOWNS[type] || 1000);
    }

    if (this.meditating) {
      this.meditating = false;
      this.avatar.setMeditating(false);
      this.syncMeditateButton();
    }

    this.avatar.playAction(type);
    if (type === 'bow') this.audio.bow();
    else if (type === 'incense') this.audio.incense();
    else if (type === 'bell') {
      this.audio.bell();
      this.world.ringBell?.();
      setTimeout(() => this.audio.bell(6), 900);
    }

    await net.action(type);
  }

  syncMeditateButton() {
    $('.act[data-act="meditate"]')?.classList.toggle('is-on', this.meditating);
  }

  /* ───────────────────────── modal ───────────────────────── */

  openTempleInfo() {
    const info = document.createElement('div');
    info.className = 'modal-note';
    info.style.background = 'rgba(45,106,79,.07)';
    info.style.borderColor = 'rgba(45,106,79,.18)';
    info.style.color = 'var(--ink-2)';
    info.textContent = this.temple.description || '';

    openModal({
      title: this.temple.name,
      message: this.temple.tagline,
      body: info,
      actions: [{ label: 'Đóng', variant: 'primary' }],
    });
  }

  openMenu() {
    const rows = [
      ['Tu sĩ', this.user.username],
      ['Chùa đang trú', this.temple.name],
      ['Công đức', `${this.self.merit}`],
      ['Âm thanh', store.soundEnabled ? 'Đang bật' : 'Đang tắt'],
    ];
    const body = document.createElement('div');
    body.style.marginBottom = '18px';
    for (const [k, v] of rows) {
      const row = document.createElement('div');
      row.style.cssText =
        'display:flex;justify-content:space-between;gap:10px;padding:9px 0;border-bottom:1px solid rgba(31,74,54,.09);font-size:13px';
      const a = document.createElement('span');
      a.style.color = 'var(--ink-3)';
      a.textContent = k;
      const b = document.createElement('strong');
      b.style.color = 'var(--ink)';
      b.textContent = v;
      row.append(a, b);
      body.appendChild(row);
    }

    openModal({
      title: 'Tĩnh tâm',
      body,
      actions: [
        {
          label: 'Rời chùa',
          variant: 'ghost',
          onClick: (close) => {
            close();
            this.leaveTemple();
          },
        },
        {
          label: 'Đăng xuất',
          variant: 'ghost',
          onClick: (close) => {
            close();
            this.logout();
          },
        },
        { label: 'Ở lại', variant: 'primary' },
      ],
    });
  }

  async leaveTemple() {
    const ok = await confirmDialog({
      title: 'Rời chùa?',
      message: 'Bạn sẽ trở về danh sách 10 ngôi chùa. Công đức vẫn được giữ lại.',
      confirmText: 'Rời chùa',
      cancelText: 'Ở lại',
    });
    if (!ok) return;
    this.destroy();
    net.leave();
    this.onLeave?.();
  }

  async logout() {
    const ok = await confirmDialog({
      title: 'Đăng xuất?',
      message: 'Bạn sẽ cần đăng nhập lại để tiếp tục tu tập.',
      confirmText: 'Đăng xuất',
      cancelText: 'Ở lại',
    });
    if (!ok) return;
    this.destroy();
    net.disconnect();
    store.clear();
    window.location.reload();
  }

  /* ───────────────────────── vòng lặp ───────────────────────── */

  tick = () => {
    if (this.destroyed) return;
    this.raf = requestAnimationFrame(this.tick);

    const dt = Math.min(0.05, this.clock.getDelta());
    const now = performance.now();

    this.updateSelf(dt, now);
    this.updateRemotes(dt, now);

    this.world.update(dt);
    this.avatar.update(dt, now / 1000);
    for (const [, r] of this.remote) {
      r.avatar.setCameraPos(this.camera.position);
      r.avatar.update(dt, now / 1000);
    }

    this.controls.updateCamera(dt, new THREE.Vector3(this.self.x, this.self.y + 1.42, this.self.z), false);
    this.renderer.render(this.scene, this.camera);

    if (this.hintTimer > 0) {
      this.hintTimer -= dt;
      if (this.hintTimer <= 0) $('#hud-hint')?.classList.add('is-hidden');
    }
    this.updateTyping();
  };

  updateSelf(dt, now) {
    const dir = this.controls.getWorldMove();
    const len = dir.length();

    if (len > 0.04 && this.meditating) {
      this.meditating = false;
      this.avatar.setMeditating(false);
      this.syncMeditateButton();
      net.action('stand');
    }

    let moved = false;
    if (len > 0.04 && !this.meditating) {
      const speed = 3.25 * Math.min(1, len);
      const nx = this.self.x + dir.x * speed * dt;
      const nz = this.self.z + dir.y * speed * dt;
      const solved = this.solveCollisions(nx, nz);
      this.self.x = THREE.MathUtils.clamp(solved.x, -27, 27);
      this.self.z = THREE.MathUtils.clamp(solved.z, -26.5, 30);
      this.self.rot = angleLerp(this.self.rot, Math.atan2(dir.x, dir.y), Math.min(1, dt * 12));
      moved = true;

      this.stepTimer -= dt;
      if (this.stepTimer <= 0) {
        this.audio.step();
        this.stepTimer = 0.44;
      }
    }

    this.self.moving = moved;
    const targetY = this.world.groundHeightAt(this.self.x, this.self.z);
    this.self.y += (targetY - this.self.y) * Math.min(1, dt * 12);

    this.avatar.root.position.set(this.self.x, this.self.y, this.self.z);
    this.avatar.root.rotation.y = this.self.rot;
    this.avatar.setPose({ moving: moved, speed: 1 });

    if (now - this.lastSend > 90) {
      this.lastSend = now;
      if (
        moved ||
        Math.abs(this.self.x - this.lastSent.x) > 0.02 ||
        Math.abs(this.self.z - this.lastSent.z) > 0.02 ||
        Math.abs(this.self.rot - this.lastSent.rot) > 0.05
      ) {
        this.lastSent = { x: this.self.x, z: this.self.z, rot: this.self.rot };
        net.move(this.self.x, this.self.z, this.self.rot);
      }
    }
  }

  updateRemotes(dt, now) {
    for (const [, r] of this.remote) {
      r.target.set(r.tx, this.world.groundHeightAt(r.tx, r.tz), r.tz);
      const k = 1 - Math.exp(-dt * 11);
      r.avatar.root.position.lerp(r.target, k);
      r.avatar.root.rotation.y = angleLerp(r.avatar.root.rotation.y, r.trot, Math.min(1, dt * 10));
      r.avatar.setPose({ moving: r.avatar.root.position.distanceTo(r.target) > 0.06, speed: 1 });
      r.avatar.setCameraPos(this.camera.position);
    }
  }

  solveCollisions(x, z) {
    const R = 0.4;
    for (const o of this.world.obstacles) {
      if (o.type === 'circle') {
        const dx = x - o.x;
        const dz = z - o.z;
        const d = Math.hypot(dx, dz);
        const min = o.r + R;
        if (d < min && d > 1e-4) {
          x = o.x + (dx / d) * min;
          z = o.z + (dz / d) * min;
        }
      } else {
        const hw = o.w / 2 + R;
        const hd = o.d / 2 + R;
        const dx = x - o.x;
        const dz = z - o.z;
        if (Math.abs(dx) < hw && Math.abs(dz) < hd) {
          const px = hw - Math.abs(dx);
          const pz = hd - Math.abs(dz);
          if (px < pz) x = o.x + Math.sign(dx || 1) * hw;
          else z = o.z + Math.sign(dz || 1) * hd;
        }
      }
    }
    return { x, z };
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.subs.forEach((off) => off());
    this.subs = [];
    window.removeEventListener('resize', this.onResize);
    window.visualViewport?.removeEventListener('resize', this.onResize);
    if (this.onKey) window.removeEventListener('keydown', this.onKey);
    this.controls.dispose?.();
    this.audio.dispose();

    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.width = 1;
    this.renderer.domElement.height = 1;

    $('#game-loading')?.classList.add('is-hidden');
    $('#chat-panel').hidden = true;
    $('#chat-body').innerHTML = '';
    $('#chat-input').value = '';
    $('#hud-hint')?.classList.remove('is-hidden');
    this.remote.clear();
  }
}
