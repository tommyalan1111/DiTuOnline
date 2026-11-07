import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Avatar } from './avatar.js';

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

function createBroom() {
  const geos = [];

  const handle = new THREE.CylinderGeometry(0.018, 0.022, 0.52, 6);
  handle.translate(0, -0.14, 0);
  geos.push(tint(handle, '#a06a3c'));

  const bristles = new THREE.CylinderGeometry(0.03, 0.14, 0.17, 9);
  bristles.translate(0, -0.47, 0);
  geos.push(tint(bristles, '#c9a86a'));

  const band = new THREE.TorusGeometry(0.045, 0.009, 5, 12);
  band.rotateX(Math.PI / 2);
  band.translate(0, -0.385, 0);
  geos.push(tint(band, '#6d4a2a'));

  const mesh = new THREE.Mesh(
    mergeGeometries(geos),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 }),
  );
  mesh.castShadow = true;
  mesh.position.set(0.52, -0.28, 0.12);
  mesh.rotation.set(0.12, 0, -0.22);
  return mesh;
}

/**
 * NPC quét sân: đi qua đi lại giữa hai điểm, dừng lại quét vài nhịp rồi đi tiếp.
 * Dùng lại Avatar chibi để đồng bộ phong cách.
 */
export class NPC {
  constructor({ gender = 'male', from = [-4, 6], to = [4, 6], speed = 0.42, pause = 3.6 } = {}) {
    this.avatar = new Avatar({ gender, name: '', isSelf: true });
    this.avatar.setPose({ moving: false, speed: 0 });

    this.broom = createBroom();
    this.avatar.arms.add(this.broom);

    this.from = new THREE.Vector2(from[0], from[1]);
    this.to = new THREE.Vector2(to[0], to[1]);
    this.speed = speed;
    this.pause = pause;
    this.pauseT = 0;
    this.dir = 1;
    this.state = 'walk';

    this.x = from[0];
    this.z = from[1];
    this.heading = Math.atan2(to[0] - from[0], to[1] - from[1]);
    this.avatar.root.position.set(this.x, 0, this.z);
    this.avatar.root.rotation.y = this.heading;

    this.broomBase = { x: 0.12, z: -0.22 };
  }

  get object3d() {
    return this.avatar.root;
  }

  update(dt, time) {
    if (this.state === 'walk') {
      const target = this.dir > 0 ? this.to : this.from;
      const dx = target.x - this.x;
      const dz = target.y - this.z;
      const d = Math.hypot(dx, dz);

      if (d < 0.12) {
        this.state = 'sweep';
        this.pauseT = this.pause;
      } else {
        const vx = dx / d;
        const vz = dz / d;
        this.x += vx * this.speed * dt;
        this.z += vz * this.speed * dt;
        this.heading = Math.atan2(vx, vz);
        this.avatar.setPose({ moving: true, speed: 0.7 });
      }
    } else {
      this.pauseT -= dt;
      this.avatar.setPose({ moving: false, speed: 0 });
      const s = Math.sin(time * 3.2);
      this.broom.rotation.x = this.broomBase.x + s * 0.16;
      this.broom.rotation.z = this.broomBase.z + s * 0.22;
      if (this.pauseT <= 0) {
        this.state = 'walk';
        this.dir *= -1;
        this.broom.rotation.x = this.broomBase.x;
        this.broom.rotation.z = this.broomBase.z;
      }
    }

    this.avatar.root.position.set(this.x, 0, this.z);
    this.avatar.root.rotation.y = this.heading;
    this.avatar.update(dt);
  }
}
