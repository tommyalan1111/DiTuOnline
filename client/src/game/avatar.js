import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const LOOKS = {
  male: {
    label: 'Nam',
    robe: '#9fb3ba',
    robeDark: '#8ba0a7',
    apron: '#e9c35b',
    skin: '#e8b98e',
    sleeve: '#9fb3ba',
    cap: null,
    beads: '#5a4030',
    shoe: '#efe9dc',
  },
  female: {
    label: 'Nữ',
    robe: '#a99a8c',
    robeDark: '#94867a',
    apron: '#dcc9a6',
    skin: '#efc39c',
    sleeve: '#a99a8c',
    cap: '#6d4b38',
    beads: '#5a4030',
    shoe: '#efe9dc',
  },
};

/* ------------------------------------------------------------------ */
/* texture mặt cười (dùng chung, 1 lần duy nhất)                       */
/* ------------------------------------------------------------------ */

let _faceTex = null;

function faceTexture() {
  if (_faceTex) return _faceTex;
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 512, 512);

  // má hồng
  for (const x of [120, 392]) {
    const g = ctx.createRadialGradient(x, 348, 0, x, 348, 84);
    g.addColorStop(0, 'rgba(230,120,110,0.62)');
    g.addColorStop(0.6, 'rgba(230,128,118,0.22)');
    g.addColorStop(1, 'rgba(230,128,118,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, 350, 70, 0, Math.PI * 2);
    ctx.fill();
  }

  // mắt cười khép
  ctx.strokeStyle = '#4a3327';
  ctx.lineWidth = 17;
  ctx.lineCap = 'round';
  for (const x of [168, 344]) {
    ctx.beginPath();
    ctx.arc(x, 300, 40, Math.PI * 1.12, Math.PI * 1.88);
    ctx.stroke();
  }

  // miệng
  ctx.strokeStyle = '#7a4b3a';
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.arc(256, 378, 30, Math.PI * 0.18, Math.PI * 0.82);
  ctx.stroke();

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.flipY = false;
  _faceTex = t;
  return t;
}

function colorize(geo, hex) {
  const c = new THREE.Color(hex);
  const count = geo.attributes.position.count;
  const arr = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    arr[i * 3] = c.r;
    arr[i * 3 + 1] = c.g;
    arr[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}

function makeLabelTexture(text) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 512, 128);
  ctx.font = '600 44px "Be Vietnam Pro", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const w = Math.min(478, ctx.measureText(text).width + 56);
  const x = (512 - w) / 2;
  const r = 34;
  ctx.fillStyle = 'rgba(12, 24, 17, 0.55)';
  ctx.beginPath();
  ctx.moveTo(x + r, 24);
  ctx.arcTo(x + w, 24, x + w, 104, r);
  ctx.arcTo(x + w, 104, x, 104, r);
  ctx.arcTo(x, 104, x, 24, r);
  ctx.arcTo(x, 24, x + w, 24, r);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#f3f7ef';
  ctx.fillText(text, 256, 66);

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function wrapText(ctx, text, maxWidth, maxLines = 3) {
  const words = String(text).split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
      if (lines.length === maxLines) break;
    } else {
      line = test;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  return lines;
}

function makeBubbleTexture(text) {
  const c = document.createElement('canvas');
  c.width = 640;
  c.height = 320;
  const ctx = c.getContext('2d');
  ctx.font = '500 34px "Be Vietnam Pro", system-ui, sans-serif';

  const lines = wrapText(ctx, text, 540, 3);
  const lineH = 46;
  const w = Math.min(600, Math.max(...lines.map((l) => ctx.measureText(l).width)) + 64);
  const h = lines.length * lineH + 56;
  const x = (640 - w) / 2;
  const y = 20;

  ctx.fillStyle = 'rgba(255, 253, 246, 0.94)';
  ctx.strokeStyle = 'rgba(43, 80, 60, 0.22)';
  ctx.lineWidth = 3;
  const r = 28;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(320 - 14, y + h - 2);
  ctx.lineTo(320, y + h + 22);
  ctx.lineTo(320 + 14, y + h - 2);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#22382c';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  lines.forEach((l, i) => ctx.fillText(l, 320, y + 38 + i * lineH));

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* ------------------------------------------------------------------ */
/* Avatar chibi                                                        */
/* ------------------------------------------------------------------ */

export class Avatar {
  constructor({ gender = 'male', name = '', isSelf = false } = {}) {
    this.gender = gender;
    this.name = name;
    this.isSelf = isSelf;
    this.time = Math.random() * 10;
    this.phase = 0;
    this.bowT = 0;
    this.prayT = 0;
    this.meditate = 0;
    this.meditateTarget = 0;
    this.moving = false;
    this.speed = 0;
    this.bubbleTimer = 0;

    const look = LOOKS[gender] || LOOKS.male;

    this.root = new THREE.Group();
    this.root.userData.avatar = this;

    this.body = new THREE.Group();
    this.root.add(this.body);

    /* ── thân: áo choàng tròn + tạp dề vàng + giày ── */

    const bodyGeos = [];

    const smock = new THREE.SphereGeometry(0.36, 26, 20);
    smock.scale(1, 1.2, 0.95);
    smock.translate(0, 0.6, 0);
    bodyGeos.push(colorize(smock, look.robe));

    // tạp dề trước bụng
    const apron = new THREE.SphereGeometry(0.368, 26, 20, Math.PI / 2 - 0.75, 1.5, Math.PI * 0.44, Math.PI * 0.5);
    apron.scale(1, 1.2, 0.95);
    apron.translate(0, 0.6, 0);
    bodyGeos.push(colorize(apron, look.apron));

    // giày
    for (const sx of [-1, 1]) {
      const shoe = new THREE.SphereGeometry(0.088, 12, 9);
      shoe.scale(1.1, 0.7, 1.45);
      shoe.translate(sx * 0.1, 0.062, 0.15);
      bodyGeos.push(colorize(shoe, look.shoe));
    }

    this.bodyMesh = new THREE.Mesh(
      mergeGeometries(bodyGeos),
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 }),
    );
    this.bodyMesh.castShadow = isSelf;
    this.body.add(this.bodyMesh);

    /* ── đầu to ── */

    this.spine = new THREE.Group();
    this.spine.position.y = 0.88;
    this.body.add(this.spine);

    const headGeos = [];

    const head = new THREE.SphereGeometry(0.3, 30, 22);
    head.scale(1, 0.98, 0.96);
    head.translate(0, 0.24, 0);
    headGeos.push(colorize(head, look.skin));

    if (gender === 'female') {
      // khăn trùm nâu ôm đầu, chừa mặt
      const cap = new THREE.SphereGeometry(0.313, 28, 20, Math.PI * 0.78, Math.PI * 1.44, 0, Math.PI * 0.7);
      cap.scale(1, 0.99, 0.97);
      cap.translate(0, 0.24, 0);
      headGeos.push(colorize(cap, look.cap));

      const crown = new THREE.SphereGeometry(0.313, 28, 12, 0, Math.PI * 2, 0, Math.PI * 0.4);
      crown.scale(1, 0.99, 0.97);
      crown.translate(0, 0.24, 0);
      headGeos.push(colorize(crown, look.cap));

      const brim = new THREE.TorusGeometry(0.305, 0.03, 8, 26, Math.PI * 0.92);
      brim.rotateX(Math.PI / 2);
      brim.rotateZ(Math.PI * 0.04);
      brim.translate(0, 0.305, 0.012);
      headGeos.push(colorize(brim, '#7d5842'));
    } else {
      // ba chấm giới
      for (let i = 0; i < 3; i++) {
        const dot = new THREE.SphereGeometry(0.016, 6, 5);
        dot.translate(0, 0.5, 0.055 + i * 0.036);
        headGeos.push(colorize(dot, '#b08262'));
      }
    }

    const headMesh = new THREE.Mesh(
      mergeGeometries(headGeos),
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 }),
    );
    headMesh.castShadow = isSelf;
    this.spine.add(headMesh);

    // khuôn mặt: decal cầu, texture trong suốt
    const faceGeo = new THREE.SphereGeometry(0.304, 28, 22, Math.PI / 2 - 0.7, 1.4, Math.PI * 0.36, Math.PI * 0.38);
    faceGeo.scale(1, 0.98, 0.96);
    faceGeo.translate(0, 0.24, 0);
    const faceMesh = new THREE.Mesh(
      faceGeo,
      new THREE.MeshBasicMaterial({ map: faceTexture(), transparent: true, depthWrite: false, fog: false }),
    );
    faceMesh.renderOrder = 2;
    this.spine.add(faceMesh);

    /* ── tay ngắn ── */

    this.arms = new THREE.Group();
    this.arms.position.y = 0;
    this.spine.add(this.arms);

    const armGeos = [];
    for (const sx of [-1, 1]) {
      const sleeve = new THREE.CapsuleGeometry(0.1, 0.15, 6, 12);
      sleeve.rotateZ(sx * 0.26);
      sleeve.translate(sx * 0.385, -0.15, 0.02);
      armGeos.push(colorize(sleeve, look.sleeve));

      const hand = new THREE.SphereGeometry(0.075, 12, 9);
      hand.scale(0.92, 0.95, 0.92);
      hand.translate(sx * 0.43, -0.3, 0.03);
      armGeos.push(colorize(hand, look.skin));
    }
    const armMesh = new THREE.Mesh(
      mergeGeometries(armGeos),
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 }),
    );
    armMesh.castShadow = isSelf;
    this.arms.add(armMesh);

    /* ── phụ kiện thiền ── */

    this.cushion = new THREE.Mesh(
      new THREE.CylinderGeometry(0.56, 0.6, 0.09, 22),
      new THREE.MeshStandardMaterial({ color: 0x6b5a3e, roughness: 0.95 }),
    );
    this.cushion.position.y = 0.04;
    this.cushion.visible = false;
    this.body.add(this.cushion);

    this.aura = new THREE.Mesh(
      new THREE.RingGeometry(0.66, 0.84, 36),
      new THREE.MeshBasicMaterial({
        color: 0xffd799,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    this.aura.rotation.x = -Math.PI / 2;
    this.aura.position.y = 0.03;
    this.root.add(this.aura);

    /* ── tên ── */

    if (!isSelf) {
      this.label = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: makeLabelTexture(name || 'Tu sĩ'),
          transparent: true,
          depthWrite: false,
          depthTest: true,
          fog: false,
        }),
      );
      this.label.scale.set(1.6, 0.4, 1);
      this.label.position.y = 1.78;
      this.root.add(this.label);
    }

    /* ── bong bóng chat ── */

    this.bubble = new THREE.Sprite(
      new THREE.SpriteMaterial({ transparent: true, depthWrite: false, depthTest: false, fog: false }),
    );
    this.bubble.scale.set(2.1, 1.05, 1);
    this.bubble.position.y = 2.02;
    this.bubble.visible = false;
    this.bubble.renderOrder = 999;
    this.root.add(this.bubble);
  }

  get position() {
    return this.root.position;
  }

  setPose({ moving, speed }) {
    this.moving = moving;
    this.speed = speed;
  }

  playAction(type) {
    if (type === 'bow') this.bowT = 2.3;
    else if (type === 'incense' || type === 'bell') this.prayT = 2.2;
    else if (type === 'meditate') this.meditateTarget = 1;
    else if (type === 'stand') this.meditateTarget = 0;
  }

  setMeditating(on) {
    this.meditateTarget = on ? 1 : 0;
  }

  say(text) {
    if (this.bubble.material.map) this.bubble.material.map.dispose();
    this.bubble.material.map = makeBubbleTexture(text);
    this.bubble.material.needsUpdate = true;
    this.bubble.visible = true;
    this.bubbleTimer = 8;
    this.bubble.material.opacity = 1;
  }

  update(dt) {
    this.time += dt;
    const t = this.time;

    this.meditate += (this.meditateTarget - this.meditate) * Math.min(1, dt * 6);
    const med = this.meditate;

    const walk = this.moving && med < 0.3 ? 1 : 0;
    this.phase += dt * (this.moving ? 9 * Math.max(0.6, this.speed) : 1.6) * (1 - med * 0.85);

    if (this.bowT > 0) this.bowT = Math.max(0, this.bowT - dt);
    if (this.prayT > 0) this.prayT = Math.max(0, this.prayT - dt);

    const bowPhase = this.bowT > 0 ? Math.sin((1 - this.bowT / 2.3) * Math.PI) : 0;
    const prayPhase = this.prayT > 0 ? Math.sin((1 - this.prayT / 2.2) * Math.PI) : 0;

    const bow = bowPhase * 0.95 + prayPhase * 0.1 + med * 0.04;
    this.spine.rotation.x = bow + (walk ? Math.sin(this.phase * 0.5) * 0.015 : 0);

    const armSwing = walk ? Math.sin(this.phase) * 0.3 * (1 - med) : Math.sin(t * 1.2) * 0.02;
    this.arms.rotation.x = armSwing - prayPhase * 1.1 - med * 0.3;
    this.arms.rotation.z = med * 0.14;

    const bob = walk ? Math.abs(Math.sin(this.phase)) * 0.03 : Math.sin(t * 1.6) * 0.008;
    this.body.position.y = bob - med * 0.3;
    this.body.scale.set(1 + med * 0.12, 1 - med * 0.28, 1 + med * 0.12);

    if (!this.moving && med < 0.4) this.spine.rotation.y = Math.sin(t * 0.5) * 0.09;
    else this.spine.rotation.y *= 0.94;

    this.cushion.visible = med > 0.25;
    this.cushion.scale.setScalar(0.9 + med * 0.12);

    this.aura.material.opacity = med * (0.22 + Math.sin(t * 2) * 0.08);
    this.aura.scale.setScalar(1 + med * 0.15 + Math.sin(t * 1.4) * 0.02);

    if (this.bubbleTimer > 0) {
      this.bubbleTimer -= dt;
      this.bubble.material.opacity = Math.min(1, this.bubbleTimer / 0.8);
      if (this.bubbleTimer <= 0) this.bubble.visible = false;
    }

    if (this.label) {
      this.label.visible = !this._camPos || this.root.position.distanceTo(this._camPos) < 30;
    }
  }

  setCameraPos(v) {
    this._camPos = v;
  }
}

export function createAvatar(opts) {
  return new Avatar(opts);
}
