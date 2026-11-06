import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const LOOKS = {
  male: {
    label: 'Nam',
    robe: '#9e322b',
    robeDark: '#7a241f',
    trim: '#d4af37',
    skin: '#d5a57b',
    sash: '#c9a227',
    beads: '#3f2a1a',
    sleeve: '#c9a36c',
    cap: '#d4af37',
  },
  female: {
    label: 'Nữ',
    robe: '#8f857a',
    robeDark: '#776e64',
    trim: '#d9cebb',
    skin: '#dfb08a',
    sash: '#6b5b4a',
    beads: '#4a3020',
    sleeve: '#8f857a',
    cap: '#6d4b38',
  },
};

const EYE_COLOR = '#2a1f19';
const BROW_COLOR = '#6b5136';

/* ------------------------------------------------------------------ */
/* tiện ích                                                            */
/* ------------------------------------------------------------------ */

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
/* Avatar                                                              */
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

    /* ── thân áo: gộp 1 mesh, nhiều màu bằng vertex color ── */

    const bodyGeos = [];

    // áo dài: hẹp ở eo, xoè ở gấu
    const robeProfile = [
      new THREE.Vector2(0.168, 1.12),
      new THREE.Vector2(0.205, 1.04),
      new THREE.Vector2(0.216, 0.9),
      new THREE.Vector2(0.236, 0.74),
      new THREE.Vector2(0.278, 0.42),
      new THREE.Vector2(0.338, 0.11),
      new THREE.Vector2(0.358, 0.005),
    ];
    bodyGeos.push(colorize(new THREE.LatheGeometry(robeProfile, 26), look.robe));


    // đáy áo (tránh nhìn thấy khoang rỗng từ góc thấp)
    const sole = new THREE.CircleGeometry(0.357, 26);
    sole.rotateX(Math.PI / 2);
    sole.translate(0, 0.007, 0);
    bodyGeos.push(colorize(sole, look.robeDark));

    // vai (cùng màu áo để không tạo mảng tối)
    const shoulders = new THREE.SphereGeometry(0.232, 18, 12);
    shoulders.scale(gender === 'female' ? 0.96 : 1.04, 0.56, 0.8);
    shoulders.translate(0, 1.045, 0);
    bodyGeos.push(colorize(shoulders, look.robe));

    // cổ áo tròn
    const collar = new THREE.CylinderGeometry(0.18, 0.19, 0.05, 24, 1, true);
    collar.translate(0, 1.094, 0);
    bodyGeos.push(colorize(collar, look.trim));

    // thắt lưng (dưới lớp choàng)
    const sash = new THREE.TorusGeometry(0.25, 0.026, 8, 30);
    sash.rotateX(Math.PI / 2);
    sash.translate(0, 0.72, 0);
    bodyGeos.push(colorize(sash, look.sash));

    // nút thắt + hai dải buông
    const knot = new THREE.SphereGeometry(0.038, 8, 6);
    knot.translate(0.045, 0.715, 0.245);
    bodyGeos.push(colorize(knot, look.sash));

    for (const [dx, rot] of [
      [0.02, 0.16],
      [0.09, -0.1],
    ]) {
      const tail = new THREE.BoxGeometry(0.04, 0.22, 0.02);
      tail.rotateZ(rot);
      tail.translate(dx, 0.6, 0.235);
      bodyGeos.push(colorize(tail, look.sash));
    }

    this.bodyMesh = new THREE.Mesh(
      mergeGeometries(bodyGeos),
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.93, metalness: 0 }),
    );
    this.bodyMesh.castShadow = isSelf;
    this.body.add(this.bodyMesh);

    /* ── thân trên: đầu, cổ, tràng hạt, khăn trùm ── */

    this.spine = new THREE.Group();
    this.spine.position.y = 1.01;
    this.body.add(this.spine);

    const spineGeos = [];

    const neck = new THREE.CylinderGeometry(0.075, 0.09, 0.16, 10);
    neck.translate(0, 0.07, 0);
    spineGeos.push(colorize(neck, look.skin));

    const head = new THREE.SphereGeometry(0.175, 24, 18);
    head.scale(0.96, 1.03, 0.95);
    head.translate(0, 0.29, 0);
    spineGeos.push(colorize(head, look.skin));

    // tai
    for (const sx of [-1, 1]) {
      const ear = new THREE.SphereGeometry(0.045, 8, 6);
      ear.scale(0.55, 1, 0.8);
      ear.translate(sx * 0.167, 0.285, 0.005);
      spineGeos.push(colorize(ear, look.skin));
    }

    // lông mày
    for (const sx of [-1, 1]) {
      const brow = new THREE.BoxGeometry(0.052, 0.009, 0.015);
      brow.rotateZ(-sx * 0.07);
      brow.translate(sx * 0.063, 0.345, 0.158);
      spineGeos.push(colorize(brow, BROW_COLOR));
    }

    if (gender === 'female') {
      // nón ni cô: chỏm trùm kín tóc, chừa khuôn mặt
      const cap = new THREE.SphereGeometry(0.19, 26, 18, Math.PI * 0.78, Math.PI * 1.44, 0, Math.PI * 0.6);
      cap.scale(1, 1.02, 1.03);
      cap.translate(0, 0.295, 0);
      spineGeos.push(colorize(cap, look.cap));

      // đỉnh khăn: phủ phần trên trán (vá chỗ hở của chỏm)
      const crown = new THREE.SphereGeometry(0.192, 24, 10, 0, Math.PI * 2, 0, Math.PI * 0.38);
      crown.translate(0, 0.295, 0);
      spineGeos.push(colorize(crown, look.cap));

      // vành khăn quanh mặt
      const brim = new THREE.TorusGeometry(0.187, 0.017, 6, 26, Math.PI * 0.92);
      brim.rotateX(Math.PI / 2);
      brim.rotateZ(Math.PI * 0.04);
      brim.translate(0, 0.37, 0.01);
      spineGeos.push(colorize(brim, '#7d5842'));

    } else {
      // mũ Tỳ Lư (5 lá) — nét đặc trưng của tăng sĩ mặc lễ phục
      const band = new THREE.CylinderGeometry(0.146, 0.152, 0.07, 22);
      band.translate(0, 0.405, 0);
      spineGeos.push(colorize(band, look.cap));

      for (let i = 0; i < 5; i++) {
        const a = -0.75 + (i / 4) * 1.5;
        const petal = new THREE.BoxGeometry(0.072, 0.17, 0.02);
        petal.translate(0, 0.085, 0);
        petal.rotateX(-0.22);
        petal.rotateY(a);
        petal.translate(Math.sin(a) * 0.148, 0.43, Math.cos(a) * 0.148);
        spineGeos.push(colorize(petal, look.cap));
      }

      const top = new THREE.SphereGeometry(0.028, 8, 6);
      top.translate(0, 0.625, 0);
      spineGeos.push(colorize(top, look.cap));

      // hai dải lụa vàng buông trước ngực
      for (const sx of [-1, 1]) {
        const ribbon = new THREE.BoxGeometry(0.026, 0.42, 0.008);
        ribbon.rotateZ(sx * 0.05);
        ribbon.translate(sx * 0.118, 0.19, 0.215);
        spineGeos.push(colorize(ribbon, '#e8c25a'));
      }
    }

    // tràng hạt: chuỗi hạt tròn treo trước ngực
    const beadCount = 14;
    for (let i = 0; i < beadCount; i++) {
      const a = (i / beadCount) * Math.PI * 2;
      const b = new THREE.SphereGeometry(0.0135, 6, 5);
      b.translate(Math.cos(a) * 0.078, -0.12 + Math.sin(a) * 0.078, 0.262);
      spineGeos.push(colorize(b, look.beads));
    }
    for (let i = 0; i < 2; i++) {
      const b = new THREE.SphereGeometry(0.016, 6, 5);
      b.translate(0, -0.215 - i * 0.036, 0.262);
      spineGeos.push(colorize(b, look.beads));
    }

    this.spineMesh = new THREE.Mesh(
      mergeGeometries(spineGeos),
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.82,
        metalness: 0,
        side: THREE.DoubleSide,
      }),
    );
    this.spineMesh.castShadow = isSelf;
    this.spine.add(this.spineMesh);

    // mắt
    const eyeGeos = [-1, 1].map((sx) => {
      const g = new THREE.SphereGeometry(0.02, 8, 6);
      g.translate(sx * 0.062, 0.3, 0.155);
      return g;
    });
    this.spine.add(
      new THREE.Mesh(mergeGeometries(eyeGeos), new THREE.MeshBasicMaterial({ color: new THREE.Color(EYE_COLOR) })),
    );

    /* ── tay: gộp 1 mesh ── */

    this.arms = new THREE.Group();
    this.arms.position.y = 0.19;
    this.spine.add(this.arms);

    const armGeos = [];
    for (const sx of [-1, 1]) {
      const sleeve = new THREE.CylinderGeometry(0.076, 0.1, 0.46, 12);
      sleeve.rotateZ(sx * 0.06);
      sleeve.translate(sx * 0.238, -0.23, 0.012);
      armGeos.push(colorize(sleeve, look.sleeve));

      const hand = new THREE.SphereGeometry(0.058, 10, 8);
      hand.scale(0.9, 1.05, 0.9);
      hand.translate(sx * 0.265, -0.485, 0.03);
      armGeos.push(colorize(hand, look.skin));
    }
    const armMesh = new THREE.Mesh(
      mergeGeometries(armGeos),
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 }),
    );
    armMesh.castShadow = isSelf;
    this.arms.add(armMesh);

    /* ── phụ kiện ngồi thiền ── */

    this.cushion = new THREE.Mesh(
      new THREE.CylinderGeometry(0.48, 0.52, 0.09, 20),
      new THREE.MeshStandardMaterial({ color: 0x6b5a3e, roughness: 0.95 }),
    );
    this.cushion.position.y = 0.045;
    this.cushion.visible = false;
    this.body.add(this.cushion);

    this.aura = new THREE.Mesh(
      new THREE.RingGeometry(0.62, 0.8, 36),
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
      this.label.position.y = 1.98;
      this.root.add(this.label);
    }

    /* ── bong bóng chat ── */

    this.bubble = new THREE.Sprite(
      new THREE.SpriteMaterial({ transparent: true, depthWrite: false, depthTest: false, fog: false }),
    );
    this.bubble.scale.set(2.1, 1.05, 1);
    this.bubble.position.y = 2.2;
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

    const armSwing = walk ? Math.sin(this.phase) * 0.35 * (1 - med) : Math.sin(t * 1.2) * 0.02;
    this.arms.rotation.x = armSwing - prayPhase * 1.15 - med * 0.3;
    this.arms.rotation.z = med * 0.16;

    const bob = walk ? Math.abs(Math.sin(this.phase)) * 0.035 : Math.sin(t * 1.6) * 0.008;
    this.body.position.y = bob - med * 0.33;
    this.body.scale.set(1 + med * 0.12, 1 - med * 0.3, 1 + med * 0.12);

    if (!this.moving && med < 0.4) this.spine.rotation.y = Math.sin(t * 0.5) * 0.08;
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
