import * as THREE from 'three';
import { themeOf } from './theme.js';
import {
  createHall,
  createGate,
  createBellPavilion,
  createPagoda,
  createStoneLantern,
  createIncenseBurner,
  createTree,
  createBush,
  mat,
  radialTexture,
} from './props.js';

/* ------------------------------------------------------------------ */
/* tiện ích                                                            */
/* ------------------------------------------------------------------ */

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvasTexture(draw, size = 128) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const TEX = {};

function petalTexture() {
  if (TEX.petal) return TEX.petal;
  TEX.petal = canvasTexture((ctx, s) => {
    ctx.translate(s / 2, s / 2);
    ctx.rotate(-0.35);
    const g = ctx.createLinearGradient(-s / 3, -s / 3, s / 3, s / 3);
    g.addColorStop(0, '#fbe3e6');
    g.addColorStop(1, '#e8a7b3');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.34, s * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
  }, 96);
  return TEX.petal;
}

function leafTexture() {
  if (TEX.leaf) return TEX.leaf;
  TEX.leaf = canvasTexture((ctx, s) => {
    ctx.translate(s / 2, s / 2);
    ctx.rotate(0.5);
    const g = ctx.createLinearGradient(-s / 3, -s / 3, s / 3, s / 3);
    g.addColorStop(0, '#f0c471');
    g.addColorStop(1, '#c9762f');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.36, s * 0.17, 0, 0, Math.PI * 2);
    ctx.fill();
  }, 96);
  return TEX.leaf;
}

function dotTexture() {
  if (TEX.dot) return TEX.dot;
  TEX.dot = radialTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)');
  return TEX.dot;
}

function rainTexture() {
  if (TEX.rain) return TEX.rain;
  const c = document.createElement('canvas');
  c.width = 16;
  c.height = 96;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 96);
  g.addColorStop(0, 'rgba(220,235,240,0)');
  g.addColorStop(0.5, 'rgba(220,235,240,0.55)');
  g.addColorStop(1, 'rgba(220,235,240,0)');
  ctx.fillStyle = g;
  ctx.fillRect(6, 0, 4, 96);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return (TEX.rain = t);
}

/* ------------------------------------------------------------------ */
/* Texture mặt đất                                                     */
/* ------------------------------------------------------------------ */

const GROUND_SIZE = 130;

function groundTexture(theme, rng) {
  const S = 1024;
  const half = GROUND_SIZE / 2;
  const toC = (x, z) => [((x + half) / GROUND_SIZE) * S, ((z + half) / GROUND_SIZE) * S];

  return canvasTexture((ctx) => {
    ctx.fillStyle = theme.ground;
    ctx.fillRect(0, 0, S, S);

    // nhiễu cỏ
    for (let i = 0; i < 14000; i++) {
      const x = rng() * S;
      const y = rng() * S;
      const a = 0.03 + rng() * 0.07;
      ctx.fillStyle = rng() > 0.5 ? `rgba(255,255,240,${a})` : `rgba(20,40,25,${a})`;
      const r = 1 + rng() * 3;
      ctx.fillRect(x, y, r, r);
    }

    // mảng rêu
    for (let i = 0; i < 26; i++) {
      const x = rng() * S;
      const y = rng() * S;
      const r = 40 + rng() * 130;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      const dark = rng() > 0.5;
      g.addColorStop(0, dark ? 'rgba(45,70,45,0.22)' : 'rgba(150,170,110,0.16)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // sân đá trước chính điện
    const [px, py] = toC(-8.2, -20.2);
    const [px2, py2] = toC(8.2, -8.6);
    ctx.fillStyle = 'rgba(139,134,120,0.88)';
    ctx.fillRect(px, py, px2 - px, py2 - py);

    // đường đá uốn từ cổng vào
    const [ax, ay] = toC(-2.6, 33);
    const [bx, by] = toC(2.6, -9);
    ctx.fillStyle = 'rgba(136,132,118,0.9)';
    ctx.fillRect(ax, ay, bx - ax, by - ay);

    // viền mềm cho sân
    ctx.strokeStyle = 'rgba(90,90,78,0.25)';
    ctx.lineWidth = 3;
    ctx.strokeRect(px, py, px2 - px, py2 - py);

    // lát đá
    const drawSlabs = (x0, z0, x1, z1, size) => {
      for (let z = z0; z < z1; z += size) {
        for (let x = x0; x < x1; x += size) {
          const [cx, cy] = toC(x + (rng() - 0.5) * 0.16, z + (rng() - 0.5) * 0.16);
          const [cx2, cy2] = toC(x + size - 0.12, z + size - 0.12);
          const tone = 128 + Math.floor(rng() * 24);
          ctx.fillStyle = `rgba(${tone},${tone - 4},${tone - 16},${0.32 + rng() * 0.2})`;
          ctx.fillRect(cx, cy, cx2 - cx, cy2 - cy);
        }
      }
    };
    drawSlabs(-2.55, -9, 2.55, 33, 1.9);
    drawSlabs(-8, -20, 8, -8.6, 2.5);

    // vệt mòn hai bên lối đi
    for (let i = 0; i < 90; i++) {
      const [x, y] = toC((rng() - 0.5) * 14, rng() * 36 - 10);
      ctx.fillStyle = `rgba(90,100,70,${0.04 + rng() * 0.05})`;
      ctx.beginPath();
      ctx.ellipse(x, y, 8 + rng() * 30, 4 + rng() * 12, rng() * 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // vài phiến đá lẻ
    for (let i = 0; i < 22; i++) {
      const [x, y] = toC((rng() - 0.5) * 46, (rng() - 0.5) * 46);
      ctx.fillStyle = 'rgba(150,146,132,0.35)';
      ctx.beginPath();
      ctx.ellipse(x, y, 4 + rng() * 9, 3 + rng() * 6, rng() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }, S);
}

/* ------------------------------------------------------------------ */
/* hạt thời tiết                                                       */
/* ------------------------------------------------------------------ */

function makePoints({ count, size, color, map, opacity = 0.9, blending = THREE.NormalBlending, opacityMap = false }) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 56;
    pos[i * 3 + 1] = Math.random() * 16;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 56;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const m = new THREE.PointsMaterial({
    size,
    map,
    color: new THREE.Color(color),
    transparent: true,
    opacity,
    depthWrite: false,
    sizeAttenuation: true,
    blending,
    alphaTest: 0.02,
  });
  const p = new THREE.Points(geo, m);
  p.frustumCulled = false;
  p.userData.count = count;
  p.userData.pos = pos;
  return p;
}

function createWeather(theme, rng) {
  const group = new THREE.Group();
  const type = theme.weather;
  const clock = { t: 0 };

  if (type === 'petals' || type === 'leaves') {
    const isPetal = type === 'petals';
    const points = makePoints({
      count: isPetal ? 150 : 120,
      size: isPetal ? 0.2 : 0.26,
      color: '#ffffff',
      map: isPetal ? petalTexture() : leafTexture(),
      opacity: 0.95,
    });
    const speed = new Float32Array(points.userData.count);
    const sway = new Float32Array(points.userData.count);
    for (let i = 0; i < speed.length; i++) {
      speed[i] = 0.5 + rng() * 0.7;
      sway[i] = rng() * Math.PI * 2;
    }
    group.add(points);
    group.userData.update = (dt, t) => {
      const pos = points.userData.pos;
      for (let i = 0; i < speed.length; i++) {
        const i3 = i * 3;
        pos[i3 + 1] -= speed[i] * dt;
        pos[i3] += Math.sin(t * 0.6 + sway[i]) * dt * 0.55;
        pos[i3 + 2] += Math.cos(t * 0.4 + sway[i]) * dt * 0.3;
        if (pos[i3 + 1] < -0.2) {
          pos[i3 + 1] = 15 + rng() * 2;
          pos[i3] = (rng() - 0.5) * 54;
          pos[i3 + 2] = (rng() - 0.5) * 54;
        }
      }
      points.geometry.attributes.position.needsUpdate = true;
      points.material.opacity = 0.95;
    };
  } else if (type === 'snow') {
    const points = makePoints({ count: 650, size: 0.13, color: '#ffffff', map: dotTexture(), opacity: 0.85 });
    const speed = new Float32Array(650);
    for (let i = 0; i < 650; i++) speed[i] = 0.8 + rng() * 0.9;
    group.add(points);
    group.userData.update = (dt, t) => {
      const pos = points.userData.pos;
      for (let i = 0; i < 650; i++) {
        const i3 = i * 3;
        pos[i3 + 1] -= speed[i] * dt;
        pos[i3] += Math.sin(t * 0.5 + i) * dt * 0.35;
        if (pos[i3 + 1] < 0) {
          pos[i3 + 1] = 15 + rng() * 3;
          pos[i3] = (rng() - 0.5) * 54;
          pos[i3 + 2] = (rng() - 0.5) * 54;
        }
      }
      points.geometry.attributes.position.needsUpdate = true;
    };
  } else if (type === 'rain') {
    const points = makePoints({ count: 900, size: 0.42, color: '#d7e6ea', map: rainTexture(), opacity: 0.5 });
    const speed = new Float32Array(900);
    for (let i = 0; i < 900; i++) speed[i] = 16 + rng() * 9;
    group.add(points);
    group.userData.update = (dt) => {
      const pos = points.userData.pos;
      for (let i = 0; i < 900; i++) {
        const i3 = i * 3;
        pos[i3 + 1] -= speed[i] * dt;
        if (pos[i3 + 1] < 0) {
          pos[i3 + 1] = 15 + rng() * 4;
          pos[i3] = (rng() - 0.5) * 54;
          pos[i3 + 2] = (rng() - 0.5) * 54;
        }
      }
      points.geometry.attributes.position.needsUpdate = true;
    };
  } else if (type === 'fireflies') {
    const points = makePoints({
      count: 70,
      size: 0.2,
      color: '#ffe6a3',
      map: dotTexture(),
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
    });
    const base = new Float32Array(70 * 3);
    for (let i = 0; i < 70; i++) {
      base[i * 3] = (rng() - 0.5) * 44;
      base[i * 3 + 1] = 0.6 + rng() * 3.4;
      base[i * 3 + 2] = (rng() - 0.5) * 44;
    }
    group.add(points);
    group.userData.update = (dt, t) => {
      const pos = points.userData.pos;
      for (let i = 0; i < 70; i++) {
        const i3 = i * 3;
        pos[i3] = base[i3] + Math.sin(t * 0.5 + i) * 0.9;
        pos[i3 + 1] = base[i3 + 1] + Math.sin(t * 0.9 + i * 1.7) * 0.45;
        pos[i3 + 2] = base[i3 + 2] + Math.cos(t * 0.4 + i * 0.9) * 0.9;
      }
      points.geometry.attributes.position.needsUpdate = true;
      points.material.opacity = 0.6 + Math.sin(t * 1.7) * 0.25;
    };
  } else if (type === 'mist') {
    const sprites = [];
    for (let i = 0; i < 14; i++) {
      const m = new THREE.SpriteMaterial({
        map: radialTexture('rgba(255,255,255,0.55)', 'rgba(255,255,255,0)'),
        transparent: true,
        opacity: 0.07 + rng() * 0.06,
        depthWrite: false,
        fog: true,
      });
      const s = new THREE.Sprite(m);
      s.scale.set(9 + rng() * 8, 2.2 + rng() * 1.6, 1);
      const ang = rng() * Math.PI * 2;
      const rad = 22 + rng() * 16;
      s.position.set(Math.cos(ang) * rad, 0.5 + rng() * 1.2, Math.sin(ang) * rad);
      s.userData.baseX = s.position.x;
      s.userData.sway = rng() * Math.PI * 2;
      group.add(s);
      sprites.push(s);
    }
    group.userData.update = (dt, t) => {
      for (const s of sprites) {
        s.position.x = s.userData.baseX + Math.sin(t * 0.08 + s.userData.sway) * 6;
      }
    };
  } else {
    // motes: bụi nắng lơ lửng
    const points = makePoints({
      count: 130,
      size: 0.075,
      color: '#fff3c9',
      map: dotTexture(),
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
    });
    group.add(points);
    group.userData.update = (dt, t) => {
      const pos = points.userData.pos;
      for (let i = 0; i < 130; i++) {
        const i3 = i * 3;
        pos[i3 + 1] += Math.sin(t * 0.3 + i) * dt * 0.08;
        pos[i3] += Math.cos(t * 0.22 + i * 1.3) * dt * 0.12;
        if (pos[i3 + 1] > 10) pos[i3 + 1] = 0.3;
      }
      points.geometry.attributes.position.needsUpdate = true;
    };
  }

  group.userData.type = type;
  return group;
}

/* ------------------------------------------------------------------ */
/* Thế giới                                                            */
/* ------------------------------------------------------------------ */

export class World {
  constructor(themeKey = 'mist', { anisotropy = 4, mobile = false } = {}) {
    this.theme = themeOf(themeKey);
    this.themeKey = themeKey;
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(new THREE.Color(this.theme.fog), this.theme.fogNear + 6, this.theme.fogFar + 25);
    this.obstacles = [];
    this.time = 0;
    this.mobile = mobile;

    const rng = mulberry32(themeKey.length * 7717 + 13);

    this.buildSky();
    this.buildLights();
    this.buildGround(rng, anisotropy);
    this.buildMountains(rng);
    this.buildTemple(rng);
    this.buildTrees(rng);

    this.weather = createWeather(this.theme, rng);
    this.scene.add(this.weather);

    this.buildSmoke();
    this.buildDust();

    this.scene.updateMatrixWorld(true);
  }

  /* ── bầu trời ── */
  buildSky() {
    const t = this.theme;
    const sunDir = new THREE.Vector3(...t.sunDir).normalize();

    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        topColor: { value: new THREE.Color(t.skyTop) },
        bottomColor: { value: new THREE.Color(t.skyBottom) },
        sunColor: { value: new THREE.Color(t.sun) },
        sunDir: { value: sunDir },
        horizon: { value: 0.02 },
      },
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vDir = normalize(wp.xyz);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        uniform vec3 sunColor;
        uniform vec3 sunDir;
        varying vec3 vDir;
        void main() {
          vec3 d = normalize(vDir);
          float h = clamp(d.y * 0.5 + 0.5, 0.0, 1.0);
          vec3 col = mix(bottomColor, topColor, pow(h, 0.9));
          float s = max(dot(d, sunDir), 0.0);
          col += sunColor * pow(s, 320.0) * 1.6;
          col += sunColor * pow(s, 10.0) * 0.16;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(190, 32, 20), skyMat);
    sky.frustumCulled = false;
    this.scene.add(sky);
    this.sky = sky;

    if (t.night) {
      const count = 420;
      const pos = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(Math.random() * 0.9 + 0.05);
        const r = 170;
        pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        pos[i * 3 + 1] = r * Math.cos(phi) * 0.7 + 8;
        pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const stars = new THREE.Points(
        geo,
        new THREE.PointsMaterial({
          size: 0.9,
          map: dotTexture(),
          color: 0xdfe8ff,
          transparent: true,
          opacity: 0.85,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          fog: false,
        }),
      );
      stars.frustumCulled = false;
      this.scene.add(stars);
      this.stars = stars;
    }
  }

  /* ── ánh sáng ── */
  buildLights() {
    const t = this.theme;
    const ambient = new THREE.AmbientLight(new THREE.Color(t.hemiSky), 0.3);
    this.scene.add(ambient);

    const hemi = new THREE.HemisphereLight(new THREE.Color(t.hemiSky), new THREE.Color(t.hemiGround), t.hemiIntensity);
    this.scene.add(hemi);
    this.hemi = hemi;

    const dir = new THREE.DirectionalLight(new THREE.Color(t.dirColor), t.dirIntensity);
    dir.position.set(...t.dirPos);
    dir.castShadow = true;
    dir.shadow.mapSize.set(this.mobile ? 1024 : 2048, this.mobile ? 1024 : 2048);
    dir.shadow.camera.left = -34;
    dir.shadow.camera.right = 34;
    dir.shadow.camera.top = 34;
    dir.shadow.camera.bottom = -34;
    dir.shadow.camera.near = 1;
    dir.shadow.camera.far = 120;
    dir.shadow.bias = -0.0008;
    dir.shadow.normalBias = 0.035;
    this.scene.add(dir);
    this.scene.add(dir.target);
    this.sun = dir;

    if (t.night) {
      const moonFill = new THREE.PointLight('#9db9e8', 8, 60, 2);
      moonFill.position.set(-18, 24, -10);
      this.scene.add(moonFill);
    }
  }

  /* ── mặt đất ── */
  buildGround(rng, anisotropy) {
    const tex = groundTexture(this.theme, rng);
    tex.anisotropy = anisotropy;
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;

    const geo = new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE);
    const mesh = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.98, metalness: 0 }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    this.ground = mesh;
  }

  /* ── núi xa ── */
  buildMountains(rng) {
    const group = new THREE.Group();
    const base = new THREE.Color(this.theme.fog).lerp(new THREE.Color('#22372c'), 0.3);
    for (let layer = 0; layer < 2; layer++) {
      const color = base.clone().lerp(new THREE.Color(this.theme.fog), layer * 0.45);
      const material = new THREE.MeshStandardMaterial({
        color,
        roughness: 1,
        flatShading: true,
        fog: true,
      });
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2 + rng() * 0.22 + layer * 0.18;
        const r = 74 + layer * 20 + rng() * 12;
        const h = 8 + rng() * 9 + layer * 3;
        const w = h * (2.6 + rng() * 1.4);
        const m = new THREE.Mesh(new THREE.ConeGeometry(w, h, 5), material);
        m.position.set(Math.cos(a) * r, h / 2 - 4, Math.sin(a) * r);
        m.rotation.y = rng() * Math.PI;
        group.add(m);
      }
    }
    this.scene.add(group);
  }

  /* ── chùa ── */
  buildTemple(rng) {
    const t = this.theme;

    const hall = createHall(t);
    hall.position.set(0, 0, -14.5);
    this.scene.add(hall);
    this.hall = hall;

    // tường chắn (va chạm)
    this.obstacles.push(
      { type: 'rect', x: 0, z: -18.95, w: 13.2, d: 0.8 },
      { type: 'rect', x: -6.45, z: -14.5, w: 0.8, d: 8.8 },
      { type: 'rect', x: 6.45, z: -14.5, w: 0.8, d: 8.8 },
      { type: 'circle', x: 0, z: -17.2, r: 2.0 },
    );

    const gate = createGate(t);
    gate.position.set(0, 0, 33);
    gate.rotation.y = Math.PI;
    this.scene.add(gate);

    const pagoda = createPagoda(t);
    pagoda.position.set(12.5, 0, -13);
    this.scene.add(pagoda);
    this.obstacles.push({ type: 'circle', x: 12.5, z: -13, r: 2.9 });

    const bell = createBellPavilion(t);
    bell.position.set(-12.5, 0, 1.5);
    this.scene.add(bell);
    this.bell = bell;
    this.obstacles.push({ type: 'circle', x: -12.5, z: 1.5, r: 3.1 });

    // đèn đá hai bên lối đi
    this.lanterns = [];
    for (const z of [17, 9, 1, -7]) {
      for (const x of [-4.4, 4.4]) {
        const l = createStoneLantern(t.stone, '#ffd08a', t.night);
        l.position.set(x, 0, z);
        this.scene.add(l);
        this.lanterns.push(l);
        this.obstacles.push({ type: 'circle', x, z, r: 0.62 });
      }
    }

    // lư hương
    const burner = createIncenseBurner(t);
    burner.position.set(0, 0, -5.2);
    this.scene.add(burner);
    this.burner = burner;
    this.obstacles.push({ type: 'circle', x: 0, z: -5.2, r: 0.95 });

    // hai đèn sáng thật gần lối vào
    for (const x of [-4.4, 4.4]) {
      const light = new THREE.PointLight('#ffc47a', this.theme.night ? 9 : 4, 9, 2);
      light.position.set(x, 1.6, 9);
      this.scene.add(light);
    }

    // tượng đá nhỏ hai bên sân
    for (const sx of [-1, 1]) {
      const lion = new THREE.Group();
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), mat(t.stone, { roughness: 0.95 }));
      body.scale.set(0.8, 1.05, 0.9);
      body.position.y = 0.5;
      lion.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), mat(t.stone, { roughness: 0.95 }));
      head.position.set(0, 1.0, 0.12);
      lion.add(head);
      const plinth = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.28, 1.0), mat(t.stone, { roughness: 0.95 }));
      plinth.position.y = 0.14;
      lion.add(plinth);
      lion.position.set(sx * 7.6, 0, -2.5);
      lion.rotation.y = sx * -0.4;
      this.scene.add(lion);
      this.obstacles.push({ type: 'circle', x: sx * 7.6, z: -2.5, r: 0.75 });
    }

    // tường đá thấp bao quanh sân
    const wallMat = mat(t.stone, { roughness: 0.96 });
    const capMat = mat(t.roof, { roughness: 0.85 });
    for (const sx of [-1, 1]) {
      for (let z = -6; z <= 22; z += 7) {
        const wall = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.1, 6.4), wallMat);
        wall.position.set(sx * 15.5, 0.55, z);
        wall.castShadow = true;
        wall.receiveShadow = true;
        this.scene.add(wall);

        const cap = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.14, 6.7), capMat);
        cap.position.set(sx * 15.5, 1.17, z);
        this.scene.add(cap);

        this.obstacles.push({ type: 'rect', x: sx * 15.5, z, w: 0.5, d: 6.4 });
      }
    }

    // bụi cây dọc tường
    const bushColors = ['#3d5a36', '#456540', '#37502f'];
    for (const sx of [-1, 1]) {
      for (let i = 0; i < 5; i++) {
        const b = createBush(0.8 + rng() * 0.7, bushColors[i % 3]);
        b.position.set(sx * (13.6 + rng() * 0.9), 0, -4 + i * 6 + rng() * 2);
        this.scene.add(b);
      }
    }

    // vài tảng đá ven sân (tránh lối đi)
    const rocks = [
      [-9.5, 14], [10.2, 11], [-11.5, 4], [11.8, -2],
      [-8.2, 7], [8.8, 17], [-13.2, 18], [13.4, 6],
    ];
    for (const [x, z] of rocks) {
      const rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.18 + rng() * 0.18, 0),
        mat('#8d8f83', { roughness: 1, flatShading: true }),
      );
      rock.position.set(x + (rng() - 0.5) * 1.2, 0.12, z + (rng() - 0.5) * 1.2);
      rock.rotation.set(rng(), rng(), rng());
      rock.castShadow = true;
      this.scene.add(rock);
    }

    this.hallLight = new THREE.PointLight('#ffb066', 0, 14, 2);
    this.hallLight.position.set(0, 3.2, -16);
    this.scene.add(this.hallLight);
  }

  /* ── cây ── */
  buildTrees(rng) {
    const kindMap = {
      pine: 'pine',
      bamboo: 'bamboo',
      autumn: 'maple',
      lotus: 'cherry',
      snow: 'bare',
      golden: 'ginkgo',
      rain: 'green',
      mist: 'pine',
      dusk: 'green',
      night: 'pine',
    };
    const kind = kindMap[this.themeKey] || 'green';
    const spots = [];
    for (let i = 0; i < 9; i++) {
      const z = -24 + i * 5.6;
      spots.push([-19.5 - rng() * 4.5, z + (rng() - 0.5) * 2]);
      spots.push([19.5 + rng() * 4.5, z + (rng() - 0.5) * 2]);
    }
    for (let i = 0; i < 5; i++) {
      spots.push([-11 + i * 5.5, -26 - rng() * 3]);
    }
    for (const [x, z] of [[-11, 24], [11.5, 24], [-15, 14], [15.5, 15]]) spots.push([x, z]);

    for (const [x, z] of spots) {
      if (Math.abs(x) < 8 && z > -24 && z < 24) continue;
      const scale = 0.7 + rng() * 0.45;
      const tree = createTree(kind, scale, rng);
      tree.position.set(x, 0, z);
      tree.rotation.y = rng() * Math.PI * 2;
      this.scene.add(tree);
      this.obstacles.push({ type: 'circle', x, z, r: 0.55 * scale });
    }
  }

  /* ── khói hương ── */
  buildSmoke() {
    const count = 40;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const seed = [];
    for (let i = 0; i < count; i++) {
      seed.push({ y: Math.random() * 3, x: (Math.random() - 0.5) * 0.1, z: (Math.random() - 0.5) * 0.1, s: 0.3 + Math.random() * 0.5 });
      pos[i * 3] = 0;
      pos[i * 3 + 1] = seed[i].y;
      pos[i * 3 + 2] = 0;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const points = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        size: 0.36,
        map: radialTexture('rgba(255,255,255,0.55)', 'rgba(255,255,255,0)'),
        color: 0xd8d2c4,
        transparent: true,
        opacity: 0.25,
        depthWrite: false,
        blending: THREE.NormalBlending,
      }),
    );
    points.position.set(0, 1.35, -5.2);
    points.frustumCulled = false;
    this.scene.add(points);
    this.smoke = { points, seed, pos };
  }

  buildDust() {
    const count = 60;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 40;
      pos[i * 3 + 1] = 0.5 + Math.random() * 5;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 40;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.dust = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        size: 0.06,
        map: dotTexture(),
        color: 0xfff0cc,
        transparent: true,
        opacity: this.theme.night ? 0.5 : 0.3,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
      }),
    );
    this.dust.frustumCulled = false;
    this.scene.add(this.dust);
  }

  ringBell() {
    this.bellSwing = 2.6;
  }

  /* ── độ cao mặt đất (để bước lên thềm chùa) ── */
  groundHeightAt(x, z) {
    if (Math.abs(x) > 8.4) return 0;
    if (z <= -19.4 || z >= -7.2) return 0;
    if (z < -9.4) {
      const xFade = Math.min(1, Math.max(0, (8.4 - Math.abs(x)) / 1.2));
      return 0.9 * xFade;
    }
    const t = (-7.2 - z) / 2.2;
    return 0.9 * Math.min(1, Math.max(0, t));
  }

  update(dt) {
    this.time += dt;
    const t = this.time;

    this.weather.userData.update?.(dt, t);

    // khói hương
    if (this.smoke) {
      const { pos, seed, points } = this.smoke;
      for (let i = 0; i < seed.length; i++) {
        const s = seed[i];
        s.y += dt * s.s;
        if (s.y > 3.4) {
          s.y = 0;
          s.x = (Math.random() - 0.5) * 0.1;
          s.z = (Math.random() - 0.5) * 0.1;
        }
        pos[i * 3] = s.x + Math.sin(t * 0.9 + i) * 0.22 * (s.y / 3.4);
        pos[i * 3 + 1] = s.y;
        pos[i * 3 + 2] = s.z + Math.cos(t * 0.7 + i * 0.6) * 0.18 * (s.y / 3.4);
      }
      points.geometry.attributes.position.needsUpdate = true;
      points.material.opacity = 0.22;
    }

    // bụi lơ lửng
    if (this.dust) {
      const arr = this.dust.geometry.attributes.position.array;
      for (let i = 0; i < arr.length; i += 3) {
        arr[i + 1] += Math.sin(t * 0.4 + i) * dt * 0.06;
        arr[i] += Math.cos(t * 0.3 + i) * dt * 0.05;
        if (arr[i + 1] > 6.5) arr[i + 1] = 0.4;
      }
      this.dust.geometry.attributes.position.needsUpdate = true;
    }

    // đèn đá nhấp nháy
    if (this.lanterns) {
      for (let i = 0; i < this.lanterns.length; i++) {
        const f = this.lanterns[i].userData.flame;
        const g = this.lanterns[i].userData.glow;
        const flick = 0.9 + Math.sin(t * 6 + i * 2.1) * 0.06 + Math.sin(t * 13 + i) * 0.03;
        f.material.emissiveIntensity = (this.theme.night ? 2.4 : 0.5) * flick;
        g.material.opacity = (this.theme.night ? 0.42 : 0.1) * flick;
      }
    }

    // chuông đung đưa
    if (this.bell?.userData.bell) {
      if (this.bellSwing > 0) {
        this.bellSwing = Math.max(0, this.bellSwing - dt);
        const k = this.bellSwing / 2.6;
        this.bell.userData.bell.rotation.z = Math.sin(t * 5.2) * 0.1 * k;
        this.bell.userData.bell.rotation.x = Math.cos(t * 4.1) * 0.03 * k;
      } else {
        this.bell.userData.bell.rotation.z = Math.sin(t * 0.5) * 0.008;
        this.bell.userData.bell.rotation.x = 0;
      }
    }
  }
}
