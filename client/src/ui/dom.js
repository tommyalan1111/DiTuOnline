export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function show(el) {
  if (el) el.hidden = false;
}

export function hide(el) {
  if (el) el.hidden = true;
}

export function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[c]);
}

export function initialOf(name) {
  const s = String(name || '?').trim();
  return s ? [...s][0].toUpperCase() : '?';
}

export function setFieldError(form, field, message) {
  const wrap = form.querySelector(`.field[data-field="${field}"]`);
  if (!wrap) return;
  wrap.classList.add('is-invalid');
  const err = wrap.querySelector('[data-error]');
  if (err) err.textContent = message || '';
}

export function clearFieldError(form, field) {
  const wrap = form.querySelector(`.field[data-field="${field}"]`);
  if (!wrap) return;
  wrap.classList.remove('is-invalid');
  const err = wrap.querySelector('[data-error]');
  if (err) err.textContent = '';
}

export function clearFieldErrors(form) {
  form.querySelectorAll('.field.is-invalid').forEach((f) => f.classList.remove('is-invalid'));
}

export function focusField(form, field) {
  const input = form.querySelector(`.field[data-field="${field}"] input`);
  input?.focus();
}

export function setLoading(button, loading) {
  if (!button) return;
  button.classList.toggle('is-loading', loading);
  button.disabled = loading;
}

export function debounce(fn, ms = 200) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}
