import * as THREE from 'three';

/**
 * Điều khiển: joystick cảm ứng, WASD, kéo để xoay camera, pinch để zoom.
 */
export class Controls {
  constructor({ canvas, joystick, stick, camera }) {
    this.canvas = canvas;
    this.camera = camera;
    this.joystick = joystick;
    this.stick = stick;

    this.yaw = 0;
    this.pitch = 0.36;
    this.dist = 8.2;
    this.minDist = 5.2;
    this.maxDist = 16;
    this.speed = 3.15;

    this.joy = new THREE.Vector2();
    this.joyActive = false;
    this.keys = new Set();
    this.enabled = true;

    this.pointers = new Map();
    this.pinchStart = 0;
    this.pinchDist = 0;

    this.cameraPos = new THREE.Vector3();
    this.lookAt = new THREE.Vector3();
    this.initialized = false;

    this.ac = new AbortController();
    this.bind();
  }

  bind() {
    const c = this.canvas;
    const signal = this.ac.signal;
    const add = (el, evt, fn, opts = {}) => el.addEventListener(evt, fn, { ...opts, signal });

    add(c, 'pointerdown', (e) => {
      if (!this.enabled) return;
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        this.pinchStart = Math.hypot(a.x - b.x, a.y - b.y);
        this.pinchDist = this.dist;
      }
      c.setPointerCapture?.(e.pointerId);
    });

    add(c, 'pointermove', (e) => {
      const p = this.pointers.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x;
      const dy = e.clientY - p.y;
      p.x = e.clientX;
      p.y = e.clientY;

      if (this.pointers.size >= 2) {
        const [a, b] = [...this.pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (this.pinchStart > 0) {
          this.dist = THREE.MathUtils.clamp(
            this.pinchDist * (this.pinchStart / d),
            this.minDist,
            this.maxDist,
          );
        }
        return;
      }

      this.yaw -= dx * 0.0045;
      this.pitch = THREE.MathUtils.clamp(this.pitch + dy * 0.0035, 0.06, 1.15);
    });

    const end = (e) => {
      this.pointers.delete(e.pointerId);
      if (this.pointers.size < 2) this.pinchStart = 0;
    };
    add(c, 'pointerup', end);
    add(c, 'pointercancel', end);
    add(c, 'lostpointercapture', end);

    add(
      c,
      'wheel',
      (e) => {
        if (!this.enabled) return;
        e.preventDefault();
        this.dist = THREE.MathUtils.clamp(this.dist + e.deltaY * 0.006, this.minDist, this.maxDist);
      },
      { passive: false },
    );

    if (this.joystick) {
      const radius = 46;
      const setFrom = (e) => {
        const r = this.joystick.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        let dx = e.clientX - cx;
        let dy = e.clientY - cy;
        const len = Math.hypot(dx, dy);
        if (len > radius) {
          dx = (dx / len) * radius;
          dy = (dy / len) * radius;
        }
        this.joy.set(dx / radius, dy / radius);
        this.stick.style.transform = `translate(${dx}px, ${dy}px)`;
      };

      add(this.joystick, 'pointerdown', (e) => {
        if (!this.enabled) return;
        this.joyActive = true;
        this.joystick.classList.add('is-active');
        this.joystick.setPointerCapture(e.pointerId);
        setFrom(e);
      });
      add(this.joystick, 'pointermove', (e) => {
        if (!this.joyActive) return;
        setFrom(e);
      });
      const release = () => {
        this.joyActive = false;
        this.joy.set(0, 0);
        this.joystick.classList.remove('is-active');
        if (this.stick) this.stick.style.transform = 'translate(0px, 0px)';
      };
      add(this.joystick, 'pointerup', release);
      add(this.joystick, 'pointercancel', release);
      add(this.joystick, 'lostpointercapture', release);
    }

    add(window, 'keydown', (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      this.keys.add(e.code);
    });
    add(window, 'keyup', (e) => this.keys.delete(e.code));
    add(window, 'blur', () => this.keys.clear());
  }

  get moveVector() {
    if (!this.enabled) return new THREE.Vector2(0, 0);

    let ix = this.joy.x;
    let iy = this.joy.y;

    const k = this.keys;
    if (k.has('KeyW') || k.has('ArrowUp')) iy -= 1;
    if (k.has('KeyS') || k.has('ArrowDown')) iy += 1;
    if (k.has('KeyA') || k.has('ArrowLeft')) ix -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) ix += 1;

    const len = Math.hypot(ix, iy);
    if (len > 1) {
      ix /= len;
      iy /= len;
    }
    return new THREE.Vector2(ix, iy);
  }

  /** Vector di chuyển trong không gian thế giới (độ dài ≤ 1). */
  getWorldMove() {
    const v = this.moveVector;
    if (v.lengthSq() < 0.0016) return new THREE.Vector2(0, 0);

    const f = -v.y; // tiến về phía trước
    const r = v.x;
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    const x = -sin * f + cos * r;
    const z = -cos * f - sin * r;
    return new THREE.Vector2(x, z).multiplyScalar(Math.min(1, v.length()));
  }

  updateCamera(dt, target, immediate = false) {
    const desired = new THREE.Vector3(
      target.x + Math.sin(this.yaw) * Math.cos(this.pitch) * this.dist,
      target.y + Math.sin(this.pitch) * this.dist,
      target.z + Math.cos(this.yaw) * Math.cos(this.pitch) * this.dist,
    );
    if (desired.y < 1.1) desired.y = 1.1;

    if (!this.initialized || immediate) {
      this.cameraPos.copy(desired);
      this.lookAt.copy(target);
      this.initialized = true;
    } else {
      const k = 1 - Math.exp(-dt * 9);
      this.cameraPos.lerp(desired, k);
      this.lookAt.lerp(target, 1 - Math.exp(-dt * 12));
    }

    this.camera.position.copy(this.cameraPos);
    this.camera.lookAt(this.lookAt);
  }

  dispose() {
    this.ac.abort();
    this.enabled = false;
    this.keys.clear();
  }
}
