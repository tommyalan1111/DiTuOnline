import { api } from '../api.js';
import { net } from '../net.js';
import { $, $$, initialOf, show, escapeHtml } from './dom.js';
import { toast } from './toast.js';


let offCounts = null;
let templesCache = [];
let onEnterCb = null;

const HILLS = `
  <svg viewBox="0 0 300 70" preserveAspectRatio="none" aria-hidden="true">
    <path class="hill-a" d="M-10 70 L48 22 L96 70 Z" />
    <path class="hill-a" d="M180 70 L232 28 L292 70 Z" />
    <path class="hill-b" d="M40 70 L112 34 L172 70 Z" />
    <path class="hill-b" d="M150 70 L206 40 L260 70 Z" />
    <path class="hill-c" d="M-20 70 L70 52 L150 70 Z" />
    <path class="hill-c" d="M120 70 L210 50 L320 70 Z" />
  </svg>`;

export async function openTemples({ user, onEnter, onLogout }) {
  onEnterCb = onEnter;

  $('#user-name').textContent = user.username;
  $('#user-merit').textContent = user.merit ?? 0;
  $('#user-avatar').textContent = initialOf(user.username);

  // xác nhận được xử lý ở main.logout() để tránh hỏi hai lần
  $('#btn-temples-logout').onclick = () => onLogout();

  const grid = $('#temple-grid');
  grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--ink-3)">Đang mở danh sách chùa…</div>';

  try {
    const data = await api('/api/temples');
    templesCache = data.temples;
    render();
    $('#total-online').textContent = templesCache.reduce((s, t) => s + t.online, 0);
  } catch (err) {
    grid.innerHTML = '';
    toast(err.message || 'Không tải được danh sách chùa.', 'err');
    return;
  }

  // cập nhật số người theo thời gian thực
  offCounts?.();
  offCounts = net.on('counts', (counts) => {
    let total = 0;
    for (const t of templesCache) {
      const n = counts[t.id] ?? t.online;
      t.online = n;
      t.full = n >= t.capacity;
      total += n;
    }
    $('#total-online').textContent = total;
    render({ soft: true });
  });
}

export function closeTemples() {
  offCounts?.();
  offCounts = null;
  onEnterCb = null;
}

function render({ soft = false } = {}) {
  const grid = $('#temple-grid');

  if (!soft) {
    grid.innerHTML = '';
    for (const t of templesCache) {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'temple-card';
      card.dataset.id = String(t.id);
      card.style.setProperty('--accent', t.accent);
      card.style.setProperty('--soft', t.accentSoft);
      card.innerHTML = `
        <div class="temple-art">
          ${HILLS}
          <span class="temple-seal">${escapeHtml(t.seal || '寺')}</span>
        </div>
        <div class="temple-body">
          <p class="temple-tagline">${escapeHtml(t.tagline)}</p>
          <h3 class="temple-name">${escapeHtml(t.name)}</h3>
          <p class="temple-desc">${escapeHtml(t.description)}</p>
          <div class="temple-foot">
            <div class="occ-bar"><i></i></div>
            <span class="occ-text"><b>${t.online}</b>/${t.capacity}</span>
            <span class="temple-go">›</span>
          </div>
        </div>
      `;
      card.addEventListener('click', () => {
        if (card.classList.contains('is-full')) {
          toast(`${t.name} đã đủ ${t.capacity} người. Hãy chọn chùa khác.`, 'err');
          return;
        }
        onEnterCb?.(t);
      });
      grid.appendChild(card);
    }
  }

  for (const t of templesCache) {
    const card = grid.querySelector(`.temple-card[data-id="${t.id}"]`);
    if (!card) continue;
    card.classList.toggle('is-full', t.full);
    card.setAttribute('aria-disabled', String(Boolean(t.full)));
    const bar = card.querySelector('.occ-bar i');
    bar.style.width = `${Math.min(100, (t.online / t.capacity) * 100)}%`;
    card.querySelector('.occ-text').innerHTML = `<b>${t.online}</b>/${t.capacity}`;
    const go = card.querySelector('.temple-go');
    if (go) go.textContent = t.full ? '×' : '›';
    card.title = t.full ? `${t.name} đã đủ ${t.capacity} người` : `Bước vào ${t.name}`;
  }
}
