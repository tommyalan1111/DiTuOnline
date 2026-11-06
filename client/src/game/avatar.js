import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const LOOKS = {
  male: {
    label: 'Nam',
    robe: '#8a5733',
    robeDark: '#6d4126',
    trim: '#c39a62',
    skin: '#d5a57b',
    sash: '#5a3520',
  },
  female: {
    label: 'Nữ',
    robe: '#7b8a85',
    robeDark: '#63716d',
    trim: '#ece7d9',
    skin: '#dfb08a',
    sash: '#586763',
  },
};

const EYE_COLOR = '#2a1f19';

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
    const robeMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(look.robe),
      roughness: 0.94,
      metalness: 0,
    });
    const darkMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(look.robeDark),
      roughness: 0.94,
      side: THREE.DoubleSide,
    });
    const skinMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(look.skin), roughness: 0.82 });
    this.robeMat = robeMat;

    this.root = new THREE.Group();
    this.root.userData.avatar = this;

    this.body = new THREE.Group();
    this.root.add(this.body);

    // thân áo
    const robeGeo = new THREE.CylinderGeometry(0.255, 0.425, 1.08, 18, 1);
    robeGeo.translate(0, 0.54, 0);
    this.robe = new THREE.Mesh(robeGeo, robeMat);
    this.robe.castShadow = isSelf;
    this.body.add(this.robe);

    // gấu áo
    const hem = new THREE.Mesh(new THREE.CylinderGeometry(0.418, 0.432, 0.075, 18, 1, true), darkMat);
    hem.position.y = 0.045;
    this.body.add(hem);

    // vạt trước
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.72, 0.05), darkMat);
    panel.position.set(0, 0.62, 0.235);
    panel.rotation.x = -0.06;
    this.body.add(panel);

    // choàng vai
    const mantle = new THREE.Mesh(new THREE.CylinderGeometry(0.262, 0.35, 0.34, 18, 1, true), darkMat);
    mantle.position.y = 0.9;
    this.body.add(mantle);

    // thắt lưng
    const sash = new THREE.Mesh(
      new THREE.CylinderGeometry(0.29, 0.3, 0.1, 18),
      new THREE.MeshStandardMaterial({ color: new THREE.Color(look.sash), roughness: 0.9 }),
    );
    sash.position.y = 0.75;
    this.body.add(sash);

    // vai
    const shoulders = new THREE.Mesh(new THREE.SphereGeometry(0.31, 16, 12), darkMat);
    shoulders.scale.set(1.02, 0.58, 0.72);
    shoulders.position.y = 1.02;
    this.body.add(shoulders);

    // ── thân trên (cúi lạy) ──
    this.spine = new THREE.Group();
    this.spine.position.y = 1.01;
    this.body.add(this.spine);

    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.073, 0.088, 0.16, 10), skinMat);
    neck.position.y = 0.07;
    this.spine.add(neck);

    const headGeo = new THREE.SphereGeometry(0.185, 22, 18);
    this.head = new THREE.Mesh(headGeo, skinMat);
    this.head.position.y = 0.295;
    this.head.scale.set(0.96, 1.02, 0.95);
    this.head.castShadow = isSelf;
    this.spine.add(this.head);

    // mắt
    const eyePositions = [-1, 1];
    const eyeGeos = eyePositions.map((sx) => {
      const g = new THREE.SphereGeometry(0.02, 8, 6);
      g.translate(sx * 0.066, 0.305, 0.163);
      return g;
    });
    this.spine.add(new THREE.Mesh(mergeGeometries(eyeGeos), new THREE.MeshBasicMaterial({ color: new THREE.Color(EYE_COLOR) })));

    if (gender === 'female') {
      // nón ni cô: chỏm trùm kín tóc, chừa khuôn mặt
      const cloth = new THREE.MeshStandardMaterial({
        color: new THREE.Color(look.trim),
        roughness: 0.9,
        side: THREE.DoubleSide,
      });
      const cap = new THREE.Mesh(
        new THREE.SphereGeometry(0.2, 26, 18, Math.PI * 0.78, Math.PI * 1.44, 0, Math.PI * 0.6),
        cloth,
      );
      cap.position.y = 0.3;
      cap.scale.set(1.0, 1.02, 1.02);
      this.spine.add(cap);
      this.hood = cap;

      // vành khăn quanh mặt
      const brim = new THREE.Mesh(new THREE.TorusGeometry(0.196, 0.018, 6, 26, Math.PI * 0.92), cloth);
      brim.position.set(0, 0.378, 0.012);
      brim.rotation.x = Math.PI / 2;
      brim.rotation.z = Math.PI * 0.04;
      this.spine.add(brim);

      // khăn trùm xuống vai
      const drape = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.315, 0.3, 20, 1, true), cloth);
      drape.position.y = -0.015;
      this.spine.add(drape);
    } else {
      // ba chấm giới trên đỉnh đầu
      const dotGeos = [];
      for (let i = 0; i < 3; i++) {
        const g = new THREE.SphereGeometry(0.013, 6, 5);
        g.translate(0, 0.452, 0.048 + i * 0.034);
        dotGeos.push(g);
      }
      this.spine.add(new THREE.Mesh(mergeGeometries(dotGeos), new THREE.MeshBasicMaterial({ color: 0xb08262 })));
    }

    // ── tay ──
    this.arms = new THREE.Group();
    this.arms.position.y = 0.19;
    this.spine.add(this.arms);

    const sleeveGeos = [];
    const handGeos = [];
    for (const sx of [-1, 1]) {
      const sleeve = new THREE.CapsuleGeometry(0.068, 0.42, 4, 10);
      sleeve.rotateZ(sx * 0.1);
      sleeve.translate(sx * 0.292, -0.24, 0.015);
      sleeveGeos.push(sleeve);

      const hand = new THREE.SphereGeometry(0.058, 9, 7);
      hand.translate(sx * 0.318, -0.48, 0.03);
      handGeos.push(hand);
    }
    const sleeveMesh = new THREE.Mesh(mergeGeometries(sleeveGeos), robeMat);
    sleeveMesh.castShadow = isSelf;
    this.arms.add(sleeveMesh);
    this.arms.add(new THREE.Mesh(mergeGeometries(handGeos), skinMat));

    // đệm ngồi thiền
    this.cushion = new THREE.Mesh(
      new THREE.CylinderGeometry(0.48, 0.52, 0.09, 20),
      new THREE.MeshStandardMaterial({ color: 0x6b5a3e, roughness: 0.95 }),
    );
    this.cushion.position.y = 0.045;
    this.cushion.visible = false;
    this.body.add(this.cushion);

    // vòng hào quang khi thiền
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

    // ── tên ──
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

    // ── bong bóng chat ──
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

  update(dt, time) {
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
