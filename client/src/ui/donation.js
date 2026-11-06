import { openModal } from './modal.js';
import { toast } from './toast.js';
import { MOMO_NUMBER } from '../config.js';

function formatNumber(n) {
  const s = String(n);
  if (s.length === 10) return `${s.slice(0, 4)} ${s.slice(4, 7)} ${s.slice(7)}`;
  return s;
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // fallback cho WebView cũ
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.cssText = 'position:fixed;top:-100px;left:-100px;opacity:0';
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  ta.remove();
  return ok;
}

/**
 * Hòm công đức: mở popup hiện số Momo + ảnh QR (nếu có client/public/momo-qr.png).
 */
export function openDonationBox({ username = '' } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'donate';

  const hero = document.createElement('div');
  hero.className = 'donate-hero';
  hero.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <path d="M4 10.5h16v8.2a1.3 1.3 0 0 1-1.3 1.3H5.3A1.3 1.3 0 0 1 4 18.7v-8.2Z"/>
      <path d="M3 7.5h18v3H3zM12 7.5V20"/>
      <path d="M12 7.5C10.4 4.9 8.6 4 7.4 4.8 6 5.8 7 7.5 9 7.5h3Z"/>
      <path d="M12 7.5c1.6-2.6 3.4-3.5 4.6-2.7 1.4 1 .4 2.7-1.6 2.7h-3Z"/>
    </svg>`;

  const intro = document.createElement('p');
  intro.className = 'donate-intro';
  intro.textContent =
    'Một nén hương, một chút tấm lòng — giúp chùa thêm đèn thêm hương và giữ máy chủ luôn sáng.';

  const card = document.createElement('div');
  card.className = 'donate-card';

  const brand = document.createElement('div');
  brand.className = 'donate-brand';
  brand.textContent = 'MOMO';

  const num = document.createElement('div');
  num.className = 'donate-num';
  num.textContent = formatNumber(MOMO_NUMBER);

  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.className = 'btn donate-copy';
  copyBtn.textContent = 'Sao chép số';
  copyBtn.addEventListener('click', async () => {
    const ok = await copyText(MOMO_NUMBER);
    copyBtn.textContent = ok ? 'Đã sao chép ✓' : 'Không sao chép được';
    if (ok) toast('Đã sao chép số Momo.', 'ok');
    setTimeout(() => (copyBtn.textContent = 'Sao chép số'), 2200);
  });

  card.append(brand, num, copyBtn);

  const qrBox = document.createElement('div');
  qrBox.className = 'donate-qr';
  qrBox.hidden = true;

  const qrImg = new Image();
  qrImg.alt = 'Mã QR Momo';
  qrImg.addEventListener('load', () => {
    qrBox.hidden = false;
    qrBox.appendChild(qrImg);
  });
  qrImg.addEventListener('error', () => {
    qrBox.hidden = true;
  });
  qrImg.src = './momo-qr.png';

  const note = document.createElement('p');
  note.className = 'donate-note';
  note.textContent = username
    ? `Nội dung chuyển: “Công đức ${username}”`
    : 'Nội dung chuyển: “Công đức” + tên của bạn';

  const hint = document.createElement('p');
  hint.className = 'donate-hint';
  hint.textContent = 'Mở ứng dụng Momo → Nhận tiền → nhập số bên trên, hoặc quét mã QR nếu có.';

  wrap.append(hero, intro, card, qrBox, note, hint);

  openModal({
    title: 'Hòm công đức',
    body: wrap,
    icon: '',
    actions: [{ label: 'Đóng', variant: 'primary' }],
  });
}
