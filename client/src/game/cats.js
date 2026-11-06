import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Gán màu cho từng đỉnh để nhiều chi tiết chỉ tốn 1 draw call. */
function tint(geo, hex) {
  const c = new THREE.Color(hex);
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = c.r;
    arr[i * 3 + 1] = c.g;
    arr[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}

function lerpAngle(a, b, t) {
  const d = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  return a + d * t;
}

/**
 * Mèo đi dạo trong sân chùa.
 * Model hướng +Z, gốc ở mặt đất.
 */
export class Cat {
  constructor({ color = '#d9904f', belly = '#f1e7d4', stripe = '#b06f36', scale = 1 } = {}) {
    const geos = [];

    // thân
    const body = new THREE.SphereGeometry(0.15, 14, 10);
    body.scale(0.9, 0.85, 1.65);
    body.translate(0, 0.19, 0);
    geos.push(tint(body, color));

    // bụng sáng
    const bellyGeo = new THREE.SphereGeometry(0.142, 12, 8);
    bellyGeo.scale(0.66, 0.58, 1.25);
    bellyGeo.translate(0, 0.135, 0.02);
    geos.push(tint(bellyGeo, belly));

    // vệt lưng
    const stripeGeo = new THREE.SphereGeometry(0.149, 12, 6);
    stripeGeo.scale(0.5, 0.32, 1.2);
    stripeGeo.translate(0, 0.29, -0.02);
    geos.push(tint(stripeGeo, stripe));

    // đầu
    const head = new THREE.SphereGeometry(0.108, 14, 10);
    head.scale(1, 0.96, 0.98);
    head.translate(0, 0.26, 0.22);
    geos.push(tint(head, color));

    // tai
    for (const sx of [-1, 1]) {
      const ear = new THREE.ConeGeometry(0.048, 0.085, 5);
      ear.rotateZ(sx * 0.16);
      ear.translate(sx * 0.062, 0.345, 0.2);
      geos.push(tint(ear, color));
    }

    // mõm
    const muzzle = new THREE.SphereGeometry(0.058, 10, 8);
    muzzle.scale(1, 0.78, 0.75);
    muzzle.translate(0, 0.238, 0.3);
    geos.push(tint(muzzle, belly));

    // mũi
    const nose = new THREE.SphereGeometry(0.017, 6, 5);
    nose.translate(0, 0.252, 0.336);
    geos.push(tint(nose, '#c97a6a'));

    // mắt
    for (const sx of [-1, 1]) {
      const eye = new THREE.SphereGeometry(0.017, 8, 6);
      eye.translate(sx * 0.046, 0.285, 0.305);
      geos.push(tint(eye, '#2c2a25'));
    }

    // bốn chân
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const leg = new THREE.CylinderGeometry(0.021, 0.027, 0.13, 6);
        leg.translate(sx * 0.085, 0.065, sz * 0.14);
        geos.push(tint(leg, color));
      }
    }

    this.bodyMesh = new THREE.Mesh(
      mergeGeometries(geos),
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 }),
    );
    this.bodyMesh.castShadow = true;

    // đuôi (riêng để ve vẩy)
    const tailGeo = new THREE.CylinderGeometry(0.016, 0.026, 0.4, 6);
    tailGeo.translate(0, 0.2, 0);
    this.tail = new THREE.Mesh(
      tailGeo,
      new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: 0.95 }),
    );
    this.tail.position.set(0, 0.2, -0.22);
    this.tail.rotation.x = -0.75;
    this.tail.castShadow = true;

    this.group = new THREE.Group();
    this.group.add(this.bodyMesh, this.tail);
    this.group.scale.setScalar(scale);

    // trạng thái đi dạo
    this.x = 0;
    this.z = 0;
    this.heading = Math.random() * Math.PI * 2;
    this.speed = 0.55 + Math.random() * 0.2;
    this.phase = Math.random() * 10;
    this.state = 'idle';
    this.idleT = 1 + Math.random() * 3;
    this.tx = 0;
    this.tz = 0;
    this.bounds = { minX: -10, maxX: 10, minZ: 1, maxZ: 21 };
    this.pickTarget();
  }

  setPosition(x, z) {
    this.x = x;
    this.z = z;
    this.group.position.set(x, 0, z);
  }

  setBounds(b) {
    this.bounds = { ...this.bounds, ...b };
  }

  pickTarget() {
    const b = this.bounds;
    const px = this.x;
    const pz = this.z;
    for (let i = 0; i < 12; i++) {
      const x = b.minX + Math.random() * (b.maxX - b.minX);
      const z = b.minZ + Math.random() * (b.maxZ - b.minZ);
      // tránh chọn đích quá gần chỗ đang đứng
      if (Math.hypot(x - px, z - pz) > 2.5) {
        this.tx = x;
        this.tz = z;
        this.state = 'walk';
        return;
      }
    }
    this.tx = px + 2;
    this.tz = pz + 2;
    this.state = 'walk';
  }

  update(dt) {
    this.phase += dt;

    if (this.state === 'idle') {
      this.idleT -= dt;
      if (this.idleT <= 0) this.pickTarget();
    } else {
      const dx = this.tx - this.x;
      const dz = this.tz - this.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.3) {
        this.state = 'idle';
        this.idleT = 1.5 + Math.random() * 3.5;
      } else {
        const vx = dx / d;
        const vz = dz / d;
        const sp = this.speed * Math.min(1, d / 1.2);
        this.x += vx * sp * dt;
        this.z += vz * sp * dt;
        this.heading = lerpAngle(this.heading, Math.atan2(vx, vz), Math.min(1, dt * 4));
        this.walkPhase = (this.walkPhase || 0) + dt * 9 * sp;
      }
    }

    this.group.position.set(this.x, 0, this.z);
    this.group.rotation.y = this.heading;

    // nhún nhẹ khi đi, thở khi đứng
    const walking = this.state === 'walk';
    const bob = walking ? Math.abs(Math.sin(this.walkPhase || 0)) * 0.018 : Math.sin(this.phase * 1.8) * 0.005;
    this.bodyMesh.position.y = bob;
    this.tail.position.y = 0.2 + bob * 0.5;

    // ve vẩy đuôi
    const sway = Math.sin(this.phase * (walking ? 4 : 1.6)) * (walking ? 0.22 : 0.12);
    this.tail.rotation.z = sway;
    this.tail.rotation.x = -0.75 + Math.sin(this.phase * 1.3) * 0.06;
  }
}
