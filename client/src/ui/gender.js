import * as THREE from 'three';
import { Avatar } from '../game/avatar.js';
import { radialTexture } from '../game/props.js';
import { api } from '../api.js';
import { store } from '../store.js';
import { $, $$ } from './dom.js';
import { toast } from './toast.js';
import { openModal } from './modal.js';

let renderer = null;
let raf = 0;
let cleanupFns = [];

export function openGenderScreen({ user, onDone }) {
  const screen = $('#screen-gender');
  const canvas = $('#gender-canvas');

  let selected = user.gender || null;
  let disposed = false;

  /* ── dựng cảnh xem trước ── */
  renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60);
  camera.position.set(0, 1.42, 6.0);
  camera.lookAt(0, 0.84, 0);

  scene.add(new THREE.HemisphereLight(0xfff8ea, 0x6b7560, 1.5));

  const key = new THREE.DirectionalLight(0xfff2da, 1.9);
  key.position.set(3.5, 5.5, 5);
  scene.add(key);

  const rim = new THREE.DirectionalLight(0xcfe2ff, 1.1);
  rim.position.set(-4, 3, -4);
  scene.add(rim);

  const fill = new THREE.PointLight(0xffd9a0, 8, 12, 2);
  fill.position.set(0, 2.4, 3.4);
  scene.add(fill);

  // sàn mờ
  const floorTex = radialTexture('rgba(58,74,56,0.5)', 'rgba(58,74,56,0)');
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(9, 9),
    new THREE.MeshBasicMaterial({ map: floorTex, transparent: true, depthWrite: false, opacity: 0.55 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0;
  scene.add(floor);

  const shadowTex = radialTexture('rgba(0,0,0,0.42)', 'rgba(0,0,0,0)');
  const makeShadow = (x) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(1.5, 0.9),
      new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.7 }),
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.012, 0);
    scene.add(m);
  };
  makeShadow(-0.92);
  makeShadow(0.92);

  const male = new Avatar({ gender: 'male', name: 'Nam', isSelf: true });
  male.root.position.set(-0.92, 0, 0);
  male.root.rotation.y = 0.18;
  scene.add(male.root);

  const female = new Avatar({ gender: 'female', name: 'Nữ', isSelf: true });
  female.root.position.set(0.92, 0, 0);
  female.root.rotation.y = -0.18;
  scene.add(female.root);

  const ringGeo = new THREE.RingGeometry(0.52, 0.72, 48);
  const rings = {};
  for (const [g, x] of [
    ['male', -0.92],
    ['female', 0.92],
  ]) {
    const ring = new THREE.Mesh(
      ringGeo,
      new THREE.MeshBasicMaterial({
        color: 0xc9a86a,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, 0.02, 0);
    scene.add(ring);
    rings[g] = ring;
  }

  /* ── chọn ── */
  const cards = $$('.gender-card');
  const sides = $$('.gender-side');
  const caption = $('#stage-caption');
  const nextBtn = $('#gender-next');

  function select(g) {
    selected = g;
    cards.forEach((c) => c.classList.toggle('is-on', c.dataset.gender === g));
    sides.forEach((s) => s.classList.toggle('is-on', s.dataset.gender === g));
    nextBtn.disabled = !selected;
    caption.textContent = g === 'male' ? 'Nam · đầu trọc, áo nâu sòng' : 'Nữ · nón ni cô, áo lam nhạt';
  }

  const onCard = (e) => {
    const g = e.currentTarget.dataset.gender;
    if (g) select(g);
  };
  cards.forEach((c) => c.addEventListener('click', onCard));
  sides.forEach((s) => s.addEventListener('click', onCard));

  if (selected) select(selected);

  /* ── vòng lặp render ── */
  const clock = new THREE.Clock();
  let t = 0;

  function resize() {
    const parent = canvas.parentElement;
    const w = parent.clientWidth;
    const h = parent.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // giữ hai nhân vật vừa khung
    const spread = w / h < 0.9 ? 4.6 : w / h < 1.5 ? 5.8 : 5.6;
    camera.position.z = spread;
    camera.updateProjectionMatrix();
  }

  const ro = new ResizeObserver(resize);
  ro.observe(canvas.parentElement);
  resize();

  function tick() {
    if (disposed) return;
    raf = requestAnimationFrame(tick);
    const dt = Math.min(0.05, clock.getDelta());
    t += dt;

    male.update(dt, t);
    female.update(dt, t);

    male.root.rotation.y = 0.18 + Math.sin(t * 0.35) * 0.12;
    female.root.rotation.y = -0.18 - Math.sin(t * 0.35) * 0.12;
    male.root.position.y = 0;
    female.root.position.y = 0;

    for (const g of ['male', 'female']) {
      const on = selected === g;
      rings[g].material.opacity += ((on ? 0.55 : 0.0) - rings[g].material.opacity) * Math.min(1, dt * 8);
      rings[g].scale.setScalar(1 + Math.sin(t * 2.2) * 0.02);
    }

    renderer.render(scene, camera);
  }
  tick();

  /* ── xác nhận ── */
  function onNext() {
    if (!selected) return;
    const isMale = selected === 'male';
    const title = isMale ? 'Khoác áo tăng sĩ?' : 'Khoác áo ni cô?';
    const message = isMale
      ? 'Bạn sẽ bước vào chùa với hình hài Nam — đầu trọc, áo nâu sòng. Hình hài này sẽ theo bạn trong suốt hành trình tu tập.'
      : 'Bạn sẽ bước vào chùa với hình hài Nữ — nón ni cô, áo lam nhạt. Hình hài này sẽ theo bạn trong suốt hành trình tu tập.';

    openModal({
      title: 'Xác nhận hình hài',
      message: `${message}\n\nBạn có chắc chắn muốn tiếp tục?`,
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 3.6 4.8 6.5v5.2c0 4.4 3 7.9 7.2 9.1 4.2-1.2 7.2-4.7 7.2-9.1V6.5L12 3.6Z"/><path d="m8.7 12.1 2.2 2.2 4.4-4.4"/></svg>',
      actions: [
        { label: 'Chọn lại', variant: 'ghost' },
        {
          label: 'Có, bước vào',
          variant: 'primary',
          onClick: async (close) => {
            close();
            try {
              nextBtn.disabled = true;
              const res = await api('/api/auth/gender', {
                method: 'POST',
                body: { gender: selected },
                auth: true,
              });
              store.patchUser(res.user);
              toast('Hình hài đã được ghi nhận. Bước tiếp vào chùa nhé.', 'ok');
              teardown();
              onDone(res.user);
            } catch (err) {
              nextBtn.disabled = false;
              toast(err.message || 'Không lưu được lựa chọn.', 'err');
            }
          },
        },
      ],
    });
  }

  nextBtn.onclick = onNext;

  function teardown() {
    disposed = true;
    cancelAnimationFrame(raf);
    ro.disconnect();
    nextBtn.onclick = null;
    cards.forEach((c) => c.removeEventListener('click', onCard));
    sides.forEach((s) => s.removeEventListener('click', onCard));
    scene.traverse((o) => {
      o.geometry?.dispose?.();
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => {
          m.map?.dispose?.();
          m.dispose?.();
        });
      }
    });
    renderer.dispose();
    renderer.forceContextLoss();
    renderer = null;
    cleanupFns = [];
  }

  cleanupFns.push(teardown);
}

/** Dọn dẹp khi rời màn hình giữa chừng. */
export function closeGenderScreen() {
  cleanupFns.forEach((fn) => fn());
  cleanupFns = [];
}
