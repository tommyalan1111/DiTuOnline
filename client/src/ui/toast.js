let counter = 0;

/**
 * Toast nhỏ ở đáy màn hình.
 * @param {string} message
 * @param {'ok'|'err'|''} type
 * @param {string} rootId
 */
export function toast(message, type = '', rootId = 'toast-root') {
  const root = document.getElementById(rootId) || document.getElementById('toast-root');
  if (!root) return;
  const el = document.createElement('div');
  el.className = `toast ${type}`.trim();
  el.textContent = message;
  el.dataset.id = String(++counter);
  root.appendChild(el);
  setTimeout(() => {
    el.classList.add('is-out');
    setTimeout(() => el.remove(), 320);
  }, type === 'err' ? 4200 : 2800);
}
