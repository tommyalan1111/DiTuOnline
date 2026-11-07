import './styles.css';
import { api } from './api.js';
import { store } from './store.js';
import { net } from './net.js';
import { initAuth, switchTab, openReset } from './ui/auth.js';
import { openGenderScreen, closeGenderScreen } from './ui/gender.js';
import { openTemples, closeTemples } from './ui/temples.js';
import { Game } from './game/game.js';
import { toast } from './ui/toast.js';
import { openModal, confirmDialog } from './ui/modal.js';
import { $, show } from './ui/dom.js';
import { IS_NATIVE, serverLabel, setServerUrl, SERVER_URL } from './config.js';
import { initAds, syncAdBanner } from './ads.js';

const SCREENS = ['auth', 'gender', 'temples', 'game'];

let user = store.user;
let game = null;
let currentScreen = null;

/* ------------------------------------------------------------------ */
/* điều hướng                                                          */
/* ------------------------------------------------------------------ */

function showScreen(name) {
  currentScreen = name;
  for (const n of SCREENS) {
    const el = document.getElementById(`screen-${n}`);
    if (!el) continue;
    if (n === name) {
      el.hidden = false;
      el.style.animation = 'none';
      void el.offsetWidth;
      el.style.animation = '';
    } else {
      el.hidden = true;
    }
  }
  document.body.dataset.screen = name;
  syncAdBanner(name);
}

/* ------------------------------------------------------------------ */
/* luồng chính                                                         */
/* ------------------------------------------------------------------ */

function afterAuth(u) {
  user = u;
  if (!net.socket || net.token !== store.token) {
    net.connect(store.token);
  }
  if (!u.gender) {
    showScreen('gender');
    openGenderScreen({
      user: u,
      onDone: (updated) => {
        user = updated;
        showTemples();
      },
    });
  } else {
    showTemples();
  }
}

function showTemples() {
  closeGenderScreen();
  closeTemples();
  showScreen('temples');
  openTemples({
    user,
    onEnter: enterTemple,
    onLogout: logout,
  });
}

function enterTemple(temple) {
  closeTemples();
  closeGenderScreen();
  showScreen('game');
  $('#game-loading')?.classList.remove('is-hidden');

  // để màn hình "đang mở cổng chùa" kịp vẽ trước khi dựng cảnh 3D
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (currentScreen !== 'game') return;
      game = new Game({
        temple,
        user,
        spawn: { x: (Math.random() - 0.5) * 4, z: 12.5 + Math.random() * 2.5, rot: Math.PI },
        onLeave: () => {
          game = null;
          window.__game = null;
          showTemples();
        },
        onSessionReplaced: (message) => {
          game = null;
          store.clear();
          net.disconnect();
          showScreen('auth');
          openModal({
            title: 'Phiên đăng nhập đã chuyển',
            message: message || 'Tài khoản của bạn vừa đăng nhập ở một thiết bị khác.',
            icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="8.5"/><path d="M12 8v5M12 16h.01"/></svg>',
            actions: [{ label: 'Đăng nhập lại', variant: 'primary' }],
          });
        },
      });
      window.__game = game;
    });
  });
}

async function logout() {
  const ok = await confirmDialog({
    title: 'Đăng xuất?',
    message: 'Bạn sẽ cần đăng nhập lại để tiếp tục tu tập.',
    confirmText: 'Đăng xuất',
    cancelText: 'Ở lại',
  });
  if (!ok) return;
  closeTemples();
  store.clear();
  net.disconnect();
  user = null;
  showScreen('auth');
  switchTab('login');
}

/* ------------------------------------------------------------------ */
/* khởi động                                                           */
/* ------------------------------------------------------------------ */

async function boot() {
  initAuth({ onAuthenticated: afterAuth });
  initAds();

  const params = new URLSearchParams(window.location.search);
  const resetToken = params.get('reset');

  // chip đổi máy chủ (chỉ trên app Android)
  const chip = $('#server-chip');
  if (IS_NATIVE) {
    show(chip);
    $('#server-chip-label').textContent = serverLabel();
    chip.onclick = () => editServer();
  }

  if (store.token) {
    try {
      const res = await api('/api/auth/me', { auth: true });
      user = res.user;
      store.patchUser(user);
    } catch (err) {
      store.clear();
      user = null;
      if (err.status !== 401) {
        toast('Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.', 'err');
      }
    }
  }

  if (user) {
    afterAuth(user);
  } else {
    showScreen('auth');
    document.body.dataset.screen = 'auth';
    const visited = localStorage.getItem('ditu.visited');
    switchTab(visited ? 'login' : 'register');
    localStorage.setItem('ditu.visited', '1');
    if (resetToken) openReset(resetToken);
  }

  // ẩn màn hình chờ (tối đa 1.8s dù font chưa tải xong)
  await Promise.race([
    document.fonts?.ready?.catch(() => {}),
    new Promise((r) => setTimeout(r, 1800)),
  ]);
  setTimeout(() => $('#boot')?.classList.add('is-done'), 320);
}

/* ------------------------------------------------------------------ */
/* đổi địa chỉ máy chủ (app Android)                                   */
/* ------------------------------------------------------------------ */

function editServer() {
  const wrap = document.createElement('div');
  wrap.className = 'field modal-field';
  const label = document.createElement('label');
  label.textContent = 'Địa chỉ máy chủ';
  label.htmlFor = 'server-url';
  const box = document.createElement('div');
  box.className = 'input-wrap';
  const input = document.createElement('input');
  input.id = 'server-url';
  input.type = 'url';
  input.value = SERVER_URL;
  input.placeholder = 'http://192.168.1.10:3000';
  input.autocomplete = 'off';
  input.spellcheck = false;
  box.appendChild(input);
  wrap.append(label, box);

  const hint = document.createElement('p');
  hint.style.cssText = 'font-size:11.5px;color:var(--ink-3);margin:8px 0 0;line-height:1.5';
  hint.textContent =
    'Máy tính chạy server và điện thoại phải cùng một mạng Wi-Fi. Ví dụ: http://192.168.1.10:3000';
  wrap.appendChild(hint);

  openModal({
    title: 'Kết nối máy chủ',
    message: 'Nhập địa chỉ máy chủ đang chạy game (mặc định cho giả lập Android là http://10.0.2.2:3000).',
    body: wrap,
    actions: [
      { label: 'Huỷ', variant: 'ghost' },
      {
        label: 'Lưu & tải lại',
        variant: 'primary',
        onClick: (close) => {
          const url = input.value.trim();
          if (!/^https?:\/\//i.test(url)) {
            toast('Địa chỉ cần bắt đầu bằng http:// hoặc https://', 'err');
            return;
          }
          setServerUrl(url);
          close();
          window.location.reload();
        },
      },
    ],
  });
}

/* ------------------------------------------------------------------ */

function spawnPetals() {
  const layer = $('#petal-layer');
  if (!layer) return;
  for (let i = 0; i < 16; i++) {
    const p = document.createElement('span');
    p.className = 'petal';
    p.style.left = `${Math.random() * 100}%`;
    p.style.animationDuration = `${11 + Math.random() * 10}s`;
    p.style.animationDelay = `${-Math.random() * 18}s`;
    p.style.opacity = `${0.25 + Math.random() * 0.4}`;
    p.style.transform = `scale(${0.7 + Math.random() * 0.8})`;
    layer.appendChild(p);
  }
}

window.addEventListener('contextmenu', (e) => {
  if (currentScreen === 'game') e.preventDefault();
});

window.addEventListener('beforeunload', () => {
  game?.destroy();
});

spawnPetals();

boot();
