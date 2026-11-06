import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/* ------------------------------------------------------------------ */
/* vật liệu & texture dùng chung                                       */
/* ------------------------------------------------------------------ */

const matCache = new Map();

export function mat(color, opts = {}) {
  const key = `${color}|${opts.roughness ?? 0.9}|${opts.metalness ?? 0}|${opts.emissive ?? ''}|${opts.emissiveIntensity ?? 0}|${opts.transparent ?? false}|${opts.opacity ?? 1}|${opts.side ?? 0}|${opts.flatShading ?? false}`;
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color: new THREE.Color(color),
      roughness: opts.roughness ?? 0.9,
      metalness: opts.metalness ?? 0,
      emissive: opts.emissive ? new THREE.Color(opts.emissive) : 0x000000,
      emissiveIntensity: opts.emissiveIntensity ?? 0,
      transparent: opts.transparent ?? false,
      opacity: opts.opacity ?? 1,
      side: opts.side ?? THREE.FrontSide,
      flatShading: opts.flatShading ?? false,
    });
    matCache.set(key, m);
  }
  return m;
}

const texCache = new Map();

export function radialTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const key = inner + outer;
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, inner);
  g.addColorStop(0.35, inner.replace(/[\d.]+\)$/, '0.55)'));
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  texCache.set(key, t);
  return t;
}

export function glowSprite(color = '#ffcf8a', size = 2.4, opacity = 0.55) {
  const material = new THREE.SpriteMaterial({
    map: radialTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)'),
    color: new THREE.Color(color),
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
  });
  const s = new THREE.Sprite(material);
  s.scale.set(size, size, 1);
  return s;
}

export const roofTexCache = new Map();

export function roofTileTexture(color = '#333b36') {
  if (roofTexCache.has(color)) return roofTexCache.get(color);
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 128, 128);

  // hàng ngói
  for (let row = 0; row < 8; row++) {
    const y = row * 16;
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.fillRect(0, y, 128, 3);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, y + 13, 128, 3);
    for (let col = 0; col < 8; col++) {
      const x = col * 16 + (row % 2 ? 8 : 0);
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.fillRect(x, y, 2, 16);
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fillRect(x + 2, y + 4, 3, 9);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(9, 4);
  roofTexCache.set(color, t);
  return t;
}

function latticeTexture(base = '#5e3a29', line = '#c9a86a') {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = line;
  ctx.lineWidth = 4;
  for (let i = 0; i <= 4; i++) {
    const p = (i / 4) * 256;
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, 256);
    ctx.moveTo(0, p);
    ctx.lineTo(256, p);
    ctx.stroke();
  }
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(256, 256);
  ctx.moveTo(256, 0);
  ctx.lineTo(0, 256);
  ctx.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/* ------------------------------------------------------------------ */
/* mái chùa — mặt cong võng lên ở bốn góc                              */
/* ------------------------------------------------------------------ */

export function createRoof({
  width = 18,
  depth = 12,
  eaveY = 4.4,
  rise = 2.6,
  lift = 1.0,
  color = '#2f3733',
  segX = 18,
  segZ = 7,
} = {}) {
  const group = new THREE.Group();
  const ridgeY = eaveY + rise;

  for (const side of [1, -1]) {
    const positions = [];
    const uvs = [];
    const indices = [];
    for (let iz = 0; iz <= segZ; iz++) {
      const v = iz / segZ;
      for (let ix = 0; ix <= segX; ix++) {
        const u = ix / segX;
        const edge = Math.pow(Math.abs(u * 2 - 1), 3);
        const t = Math.pow(v, 0.72);
        const y = ridgeY + (eaveY + lift * edge - ridgeY) * t;
        positions.push((u - 0.5) * width, y, side * v * (depth / 2));
        uvs.push(u, v);
      }
    }
    for (let iz = 0; iz < segZ; iz++) {
      for (let ix = 0; ix < segX; ix++) {
        const a = iz * (segX + 1) + ix;
        const b = a + 1;
        const c = a + segX + 1;
        const d = c + 1;
        if (side > 0) indices.push(a, c, b, b, c, d);
        else indices.push(a, b, c, b, d, c);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    const roofMat = new THREE.MeshStandardMaterial({
      map: roofTileTexture(color),
      color: 0xffffff,
      roughness: 0.86,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, roofMat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  // nóc mái
  const ridge = new THREE.Mesh(
    new THREE.BoxGeometry(width * 1.01, 0.22, 0.46),
    mat(color, { roughness: 0.8 }),
  );
  ridge.position.y = ridgeY + 0.06;
  ridge.castShadow = true;
  group.add(ridge);

  // đầu đao hai đầu nóc
  for (const sx of [-1, 1]) {
    const finial = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.2, 0.9, 6),
      mat('#8d7245', { roughness: 0.6, metalness: 0.25 }),
    );
    finial.position.set(sx * width * 0.505, ridgeY + 0.42, 0);
    finial.rotation.z = sx * 0.45;
    group.add(finial);
  }

  // diềm mái phía trước & sau
  for (const side of [1, -1]) {
    const fascia = new THREE.Mesh(
      new THREE.BoxGeometry(width, 0.18, 0.16),
      mat('#7a5a38', { roughness: 0.8 }),
    );
    fascia.position.set(0, eaveY + 0.04, side * (depth / 2 - 0.02));
    group.add(fascia);
  }

  return group;
}

/* ------------------------------------------------------------------ */
/* đèn đá                                                              */
/* ------------------------------------------------------------------ */

export function createStoneLantern(color = '#9b988b', light = '#ffd08a', night = false) {
  const g = new THREE.Group();
  const stone = mat(color, { roughness: 0.95 });

  const parts = [];
  const add = (geo, x = 0, y = 0, z = 0) => {
    geo.translate(x, y, z);
    parts.push(geo);
  };

  add(new THREE.CylinderGeometry(0.46, 0.54, 0.18, 6), 0, 0.09, 0);
  add(new THREE.CylinderGeometry(0.14, 0.17, 0.95, 6), 0, 0.65, 0);
  add(new THREE.CylinderGeometry(0.34, 0.26, 0.12, 6), 0, 1.18, 0);
  for (const [sx, sz] of [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ]) {
    add(new THREE.BoxGeometry(0.07, 0.5, 0.07), (sx * 0.26) / 2, 1.46, (sz * 0.26) / 2);
  }
  add(new THREE.ConeGeometry(0.52, 0.3, 6), 0, 1.82, 0);
  add(new THREE.SphereGeometry(0.09, 8, 6), 0, 2.02, 0);

  const body = new THREE.Mesh(mergeGeometries(parts), stone);
  body.castShadow = true;
  g.add(body);

  const fire = new THREE.Mesh(
    new THREE.BoxGeometry(0.46, 0.46, 0.46),
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(light),
      emissive: new THREE.Color(light),
      emissiveIntensity: night ? 2.6 : 0.55,
      roughness: 0.5,
      transparent: true,
      opacity: 0.95,
    }),
  );
  fire.position.y = 1.46;
  g.add(fire);

  const glow = glowSprite(light, 2.8, night ? 0.5 : 0.12);
  glow.position.y = 1.46;
  g.add(glow);

  g.userData.flame = fire;
  g.userData.glow = glow;
  return g;
}

/* ------------------------------------------------------------------ */
/* tượng Phật                                                          */
/* ------------------------------------------------------------------ */

export function createBuddha() {
  const g = new THREE.Group();

  const gold = new THREE.MeshStandardMaterial({
    color: '#d9a83c',
    metalness: 0.72,
    roughness: 0.32,
    emissive: '#6a4a12',
    emissiveIntensity: 0.22,
  });

  const lotus = new THREE.Group();
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.15, 0.34, 20), mat('#8a5a46', { roughness: 0.9 }));
  bowl.position.y = 0.17;
  lotus.add(bowl);

  const petalGeo = new THREE.ConeGeometry(0.3, 0.7, 5);
  for (let ring = 0; ring < 2; ring++) {
    const count = ring ? 12 : 16;
    const r = ring ? 1.42 : 1.15;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + ring * 0.26;
      const p = new THREE.Mesh(petalGeo, mat('#b06a52', { roughness: 0.85 }));
      p.position.set(Math.cos(a) * r, 0.36 + (ring ? 0.08 : 0), Math.sin(a) * r);
      p.rotation.set(Math.cos(a) * 0.6, 0, -Math.sin(a) * 0.6);
      p.scale.set(1, 0.85, 0.55);
      lotus.add(p);
    }
  }
  g.add(lotus);

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.95, 24, 18), gold);
  body.scale.set(1.02, 1.12, 0.74);
  body.position.y = 1.75;
  g.add(body);

  const shoulders = new THREE.Mesh(new THREE.SphereGeometry(0.75, 18, 12), gold);
  shoulders.scale.set(1.35, 0.55, 0.6);
  shoulders.position.y = 2.28;
  g.add(shoulders);

  const arms = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.13, 8, 20, Math.PI), gold);
  arms.rotation.set(0, 0, 0);
  arms.position.set(0, 1.12, 0.36);
  g.add(arms);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.22, 10), gold);
  neck.position.y = 2.62;
  g.add(neck);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.4, 22, 16), gold);
  head.scale.set(0.92, 1.05, 0.95);
  head.position.y = 2.95;
  g.add(head);

  const bun = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 10), gold);
  bun.position.y = 3.3;
  g.add(bun);

  const halo = new THREE.Mesh(
    new THREE.CircleGeometry(1.75, 40),
    new THREE.MeshBasicMaterial({
      map: radialTexture('rgba(255,214,140,1)', 'rgba(255,190,110,0)'),
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: false,
    }),
  );
  halo.position.set(0, 2.55, -0.85);
  halo.material.opacity = 0.5;
  g.add(halo);

  const warm = glowSprite('#ffb968', 2.6, 0.22);
  warm.position.set(0, 2.2, 0.4);
  g.add(warm);

  g.userData.halo = halo;
  return g;
}

/* ------------------------------------------------------------------ */
/* chánh điện                                                          */
/* ------------------------------------------------------------------ */

export function createHall(theme, { withBuddha = true } = {}) {
  const g = new THREE.Group();
  const stone = mat(theme.stone, { roughness: 0.96 });
  const wood = mat(theme.wood, { roughness: 0.82 });
  const roofColor = theme.roof;

  const base = new THREE.Mesh(new THREE.BoxGeometry(16, 0.9, 10.2), stone);
  base.position.y = 0.45;
  base.receiveShadow = true;
  base.castShadow = true;
  g.add(base);

  // bậc thang phía trước (z+)
  const steps = [
    [7.2, 0.3, 2.6, 0.15, 6.9],
    [7.2, 0.6, 1.7, 0.3, 6.2],
    [7.2, 0.9, 0.9, 0.45, 5.55],
  ];
  for (const [w, h, d, y, z] of steps) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), stone);
    s.position.set(0, y, z);
    s.receiveShadow = true;
    g.add(s);
  }

  // cột
  const colGeo = new THREE.CylinderGeometry(0.27, 0.31, 3.7, 12);
  const colPositions = [];
  for (const x of [-6.2, -2.1, 2.1, 6.2]) for (const z of [-3.4, 3.4]) colPositions.push([x, z]);
  for (const [x, z] of colPositions) {
    const c = new THREE.Mesh(colGeo, wood);
    c.position.set(x, 0.9 + 1.85, z);
    c.castShadow = true;
    g.add(c);

    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.5, 0.26, 10), stone);
    foot.position.set(x, 1.03, z);
    g.add(foot);
  }

  // vách sau & hai bên
  const wallMat = mat('#7a5238', { roughness: 0.9 });
  const back = new THREE.Mesh(new THREE.BoxGeometry(12.6, 3.4, 0.24), wallMat);
  back.position.set(0, 2.6, -4.4);
  back.castShadow = true;
  g.add(back);

  for (const sx of [-1, 1]) {
    const side = new THREE.Mesh(new THREE.BoxGeometry(0.24, 3.4, 8.6), wallMat);
    side.position.set(sx * 6.4, 2.6, 0);
    g.add(side);
  }

  // vách gỗ chạm lưới hai bên cửa
  const lattice = latticeTexture('#6b4331', theme.accent);
  for (const sx of [-1, 1]) {
    const panel = new THREE.Mesh(
      new THREE.BoxGeometry(2.6, 3.3, 0.16),
      new THREE.MeshStandardMaterial({ map: lattice, roughness: 0.85 }),
    );
    panel.position.set(sx * 4.65, 2.55, 4.28);
    panel.castShadow = true;
    g.add(panel);
  }

  // xà ngang
  const beam = new THREE.Mesh(new THREE.BoxGeometry(13, 0.34, 0.4), wood);
  beam.position.set(0, 4.32, 4.3);
  g.add(beam);
  const beam2 = beam.clone();
  beam2.position.z = -4.3;
  g.add(beam2);

  // mái
  const roof = createRoof({
    width: 17.8,
    depth: 11.9,
    eaveY: 4.45,
    rise: 2.7,
    lift: 1.15,
    color: roofColor,
  });
  roof.position.y = 0.02;
  g.add(roof);

  // đèn lồng đỏ dưới hiên
  for (const sx of [-1, 1]) {
    const lantern = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 14, 10),
      new THREE.MeshStandardMaterial({
        color: '#c0392b',
        emissive: '#ff6a3d',
        emissiveIntensity: 1.6,
        roughness: 0.6,
      }),
    );
    body.scale.y = 1.15;
    lantern.add(body);
    const capGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.06, 8);
    const cap = new THREE.Mesh(capGeo, mat('#c9a86a', { metalness: 0.6, roughness: 0.4 }));
    cap.position.y = 0.35;
    lantern.add(cap);
    const tassel = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.3, 4), mat('#e0c68c', { metalness: 0.4, roughness: 0.6 }));
    tassel.position.y = -0.44;
    lantern.add(tassel);
    const glow = glowSprite('#ff9a5c', 1.9, 0.4);
    lantern.add(glow);
    lantern.position.set(sx * 5.4, 3.55, 4.7);
    g.add(lantern);
  }

  // tượng Phật bên trong
  if (withBuddha) {
    const buddha = createBuddha();
    buddha.position.set(0, 0.9, -2.7);
    buddha.scale.setScalar(1.05);
    g.add(buddha);

    const light = new THREE.PointLight('#ffb066', 12, 14, 1.8);
    light.position.set(0, 3.4, -1.2);
    g.add(light);
  }

  return g;
}

/* ------------------------------------------------------------------ */
/* gác chuông                                                          */
/* ------------------------------------------------------------------ */

export function createBellPavilion(theme) {
  const g = new THREE.Group();
  const stone = mat(theme.stone, { roughness: 0.95 });
  const wood = mat(theme.wood, { roughness: 0.85 });

  const base = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.4, 5.2), stone);
  base.position.y = 0.2;
  base.receiveShadow = true;
  g.add(base);

  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 3.4, 8), wood);
      post.position.set(sx * 2.05, 2.1, sz * 2.05);
      post.castShadow = true;
      g.add(post);
    }
  }

  const beam = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.26, 0.3), wood);
  beam.position.y = 3.7;
  g.add(beam);

  const roof = createRoof({ width: 6.4, depth: 6.4, eaveY: 3.95, rise: 1.5, lift: 0.7, color: theme.roof });
  g.add(roof);

  // quả chuông
  const profile = [];
  const pts = [
    [0.02, 0],
    [0.46, 0.04],
    [0.62, 0.28],
    [0.66, 0.78],
    [0.56, 1.18],
    [0.34, 1.42],
    [0.3, 1.55],
  ];
  for (const [r, y] of pts) profile.push(new THREE.Vector2(r, y));
  const bellGeo = new THREE.LatheGeometry(profile, 24);
  const bell = new THREE.Mesh(
    bellGeo,
    new THREE.MeshStandardMaterial({ color: '#8a6a34', metalness: 0.85, roughness: 0.38 }),
  );
  bell.position.set(0, 1.5, 0);
  bell.scale.setScalar(1.15);
  g.add(bell);

  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.045, 6, 24), mat('#6d5326', { metalness: 0.8, roughness: 0.4 }));
  rim.rotation.x = Math.PI / 2;
  rim.position.set(0, 1.5, 0);
  g.add(rim);

  const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.5, 5), mat('#8c6a45'));
  rope.position.set(0, 0.5, 0);
  g.add(rope);

  g.userData.bell = bell;
  return g;
}

/* ------------------------------------------------------------------ */
/* tháp                                                                */
/* ------------------------------------------------------------------ */

export function createPagoda(theme) {
  const g = new THREE.Group();
  const stone = mat(theme.stone, { roughness: 0.94 });

  const base = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.6, 0.6, 8), stone);
  base.position.y = 0.3;
  base.receiveShadow = true;
  g.add(base);

  const tiers = 5;
  let y = 0.6;
  for (let i = 0; i < tiers; i++) {
    const k = 1 - i * 0.13;
    const bodyH = 0.95;
    const bodyR = 1.5 * k;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(bodyR * 0.92, bodyR, bodyH, 8), stone);
    body.position.y = y + bodyH / 2;
    body.castShadow = true;
    g.add(body);

    const eave = new THREE.Mesh(
      new THREE.ConeGeometry(bodyR * 1.42, 0.42, 8),
      mat(theme.roof, { roughness: 0.85 }),
    );
    eave.position.y = y + bodyH + 0.16;
    eave.castShadow = true;
    g.add(eave);

    y += bodyH + 0.3;
  }

  const spire = new THREE.Mesh(new THREE.ConeGeometry(0.24, 1.3, 8), mat('#c9a86a', { metalness: 0.5, roughness: 0.45 }));
  spire.position.y = y + 0.5;
  g.add(spire);

  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), mat('#c9a86a', { metalness: 0.6, roughness: 0.35 }));
  orb.position.y = y + 1.2;
  g.add(orb);

  return g;
}

/* ------------------------------------------------------------------ */
/* cổng tam quan                                                       */
/* ------------------------------------------------------------------ */

export function createGate(theme) {
  const g = new THREE.Group();
  const stone = mat(theme.stone, { roughness: 0.95 });

  for (const sx of [-1, 1]) {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 4.6, 1.1), stone);
    pillar.position.set(sx * 3.6, 2.3, 0);
    pillar.castShadow = true;
    g.add(pillar);

    const cap = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.24, 1.5), mat(theme.roof, { roughness: 0.85 }));
    cap.position.set(sx * 3.6, 4.7, 0);
    g.add(cap);
  }

  const lintel = new THREE.Mesh(new THREE.BoxGeometry(9.4, 0.5, 1.0), mat(theme.wood, { roughness: 0.85 }));
  lintel.position.y = 4.2;
  g.add(lintel);

  const roof = createRoof({ width: 10.4, depth: 3.4, eaveY: 4.5, rise: 1.15, lift: 0.55, color: theme.roof, segX: 12, segZ: 4 });
  g.add(roof);

  return g;
}

/* ------------------------------------------------------------------ */
/* lư hương                                                            */
/* ------------------------------------------------------------------ */

export function createIncenseBurner(theme) {
  const g = new THREE.Group();
  const bronze = new THREE.MeshStandardMaterial({
    color: '#7a5a33',
    metalness: 0.78,
    roughness: 0.42,
  });

  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.48, 0.62, 16), bronze);
  pot.position.y = 0.62;
  pot.castShadow = true;
  g.add(pot);

  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.06, 8, 20), bronze);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.94;
  g.add(rim);

  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.05, 0.36, 6), bronze);
    leg.position.set(Math.cos(a) * 0.3, 0.18, Math.sin(a) * 0.3);
    leg.rotation.z = Math.cos(a) * 0.16;
    leg.rotation.x = -Math.sin(a) * 0.16;
    g.add(leg);
  }

  // hương đang cháy
  for (let i = 0; i < 3; i++) {
    const stick = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.012, 0.7, 4),
      mat('#8a4a35'),
    );
    stick.position.set((i - 1) * 0.1, 1.2, (i % 2) * 0.06);
    stick.rotation.z = (i - 1) * 0.06;
    g.add(stick);

    const ember = new THREE.Mesh(
      new THREE.SphereGeometry(0.025, 6, 5),
      new THREE.MeshBasicMaterial({ color: '#ff8a4a' }),
    );
    ember.position.set((i - 1) * 0.1 + (i - 1) * 0.02, 1.56, (i % 2) * 0.06);
    g.add(ember);
  }

  const glow = glowSprite('#ff9550', 2.4, 0.35);
  glow.position.y = 1.05;
  g.add(glow);

  return g;
}

/* ------------------------------------------------------------------ */
/* cây cối                                                             */
/* ------------------------------------------------------------------ */

const treeCache = new Map();

function coneGeo() {
  if (!treeCache.has('cone')) treeCache.set('cone', new THREE.ConeGeometry(1, 1, 7));
  return treeCache.get('cone');
}
function blobGeo() {
  if (!treeCache.has('blob')) treeCache.set('blob', new THREE.IcosahedronGeometry(1, 1));
  return treeCache.get('blob');
}
function trunkGeo() {
  if (!treeCache.has('trunk')) treeCache.set('trunk', new THREE.CylinderGeometry(0.12, 0.22, 1, 6));
  return treeCache.get('trunk');
}

export function createTree(kind, scale = 1, rng = Math.random) {
  const g = new THREE.Group();
  const trunkMat = mat('#4e3826', { roughness: 1 });
  const trunkH = 2.2 * scale;
  const trunk = new THREE.Mesh(trunkGeo(), trunkMat);
  trunk.scale.set(scale, trunkH, scale);
  trunk.position.y = trunkH / 2;
  trunk.castShadow = true;
  g.add(trunk);

  if (kind === 'pine') {
    const needle = mat('#2f4a35', { roughness: 0.95, flatShading: true });
    const geos = [];
    for (let i = 0; i < 4; i++) {
      const k = 1 - i * 0.19;
      const c = coneGeo().clone();
      c.scale(1.5 * scale * k, 1.5 * scale, 1.5 * scale * k);
      c.translate(0, trunkH - 0.2 + i * 0.85 * scale, 0);
      geos.push(c);
    }
    const foliage = new THREE.Mesh(mergeGeometries(geos), needle);
    foliage.castShadow = true;
    g.add(foliage);
  } else if (kind === 'bamboo') {
    const leafMat = mat('#79975a', { roughness: 0.9, flatShading: true, side: THREE.DoubleSide });
    const stalkGeos = [];
    const leafGeos = [];
    for (let i = 0; i < 5; i++) {
      const sx = (rng() - 0.5) * 1.2;
      const sz = (rng() - 0.5) * 1.2;
      const stalk = new THREE.CylinderGeometry(0.06, 0.08, 5.2 * scale, 5);
      stalk.rotateZ((rng() - 0.5) * 0.12);
      stalk.translate(sx, 2.6 * scale, sz);
      stalkGeos.push(stalk);

      const leaves = blobGeo().clone();
      leaves.scale(0.5 * scale, 0.28 * scale, 0.5 * scale);
      leaves.translate(sx, (4.3 + rng() * 0.8) * scale, sz);
      leafGeos.push(leaves);
    }
    g.add(new THREE.Mesh(mergeGeometries(stalkGeos), mat('#7c9455')));
    g.add(new THREE.Mesh(mergeGeometries(leafGeos), leafMat));
  } else if (kind === 'bare') {
    const branchMat = mat('#4a3627', { roughness: 1 });
    const geos = [];
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const b = new THREE.CylinderGeometry(0.03, 0.07, 1.8 * scale, 4);
      b.rotateZ(Math.cos(a) * 0.9);
      b.rotateX(-Math.sin(a) * 0.9);
      b.translate(Math.cos(a) * 0.4 * scale, trunkH + 0.5 * scale, Math.sin(a) * 0.4 * scale);
      geos.push(b);
    }
    g.add(new THREE.Mesh(mergeGeometries(geos), branchMat));

    const snow = new THREE.Mesh(blobGeo(), mat('#eef4f6', { roughness: 0.9, flatShading: true }));
    snow.scale.set(1.3 * scale, 0.35 * scale, 1.3 * scale);
    snow.position.y = trunkH + 1.4 * scale;
    g.add(snow);
  } else {
    const palette = {
      cherry: ['#e3bcc4', '#eccdd3', '#d9aeb8'],
      maple: ['#c9722f', '#d98a3c', '#b45a26'],
      green: ['#4d6e42', '#5b7c48', '#42603a'],
      ginkgo: ['#d9b64a', '#e3c45f', '#c9a43c'],
    }[kind] || ['#4d6e42', '#5b7c48', '#42603a'];

    const geos = [];
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + rng();
      const r = i === 0 ? 0 : 0.75 * scale;
      const blob = blobGeo().clone();
      const bs = (1.35 - i * 0.16) * scale;
      blob.scale(bs, bs, bs);
      blob.translate(Math.cos(a) * r, trunkH + 0.55 * scale + i * 0.28 * scale, Math.sin(a) * r);
      const col = new THREE.Color(palette[i % palette.length]);
      const colors = new Float32Array(blob.attributes.position.count * 3);
      for (let k = 0; k < blob.attributes.position.count; k++) {
        colors[k * 3] = col.r;
        colors[k * 3 + 1] = col.g;
        colors[k * 3 + 2] = col.b;
      }
      blob.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      geos.push(blob);
    }
    const foliage = new THREE.Mesh(
      mergeGeometries(geos),
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true }),
    );
    foliage.castShadow = true;
    g.add(foliage);
  }

  return g;
}

export function createBush(scale = 1, color = '#3f5f3a') {
  const g = new THREE.Group();
  const geos = [];
  for (let i = 0; i < 3; i++) {
    const b = blobGeo().clone();
    const bs = 0.45 * scale * (1 - i * 0.15);
    b.scale(bs, bs, bs);
    b.translate((i - 1) * 0.35 * scale, 0.34 * scale, (i % 2 ? 0.18 : -0.12) * scale);
    const col = new THREE.Color(color).offsetHSL(0, 0, i * 0.03);
    const colors = new Float32Array(b.attributes.position.count * 3);
    for (let k = 0; k < b.attributes.position.count; k++) {
      colors[k * 3] = col.r;
      colors[k * 3 + 1] = col.g;
      colors[k * 3 + 2] = col.b;
    }
    b.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geos.push(b);
  }
  const mesh = new THREE.Mesh(
    mergeGeometries(geos),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.98, flatShading: true }),
  );
  mesh.castShadow = true;
  g.add(mesh);
  return g;
}
