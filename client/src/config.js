const native = Boolean(window.Capacitor?.isNativePlatform?.());

const savedServer = localStorage.getItem('ditu.server') || '';
const envServer = import.meta.env.VITE_DEFAULT_SERVER || '';

export const IS_NATIVE = native;

function normalize(url) {
  return String(url || '').trim().replace(/\/+$/, '');
}

export const SERVER_URL = native
  ? normalize(savedServer || envServer || 'http://10.0.2.2:3000')
  : normalize(savedServer || '');

export function setServerUrl(url) {
  const v = normalize(url);
  if (v) localStorage.setItem('ditu.server', v);
  else localStorage.removeItem('ditu.server');
}

export function serverLabel() {
  if (!IS_NATIVE) return window.location.host;
  return SERVER_URL.replace(/^https?:\/\//, '');
}

export const APP_VERSION = '1.0.0';

// Thông tin hòm công đức
// Đổi số này nếu muốn dùng ví khác.
export const MOMO_NUMBER = '0902821105';
export const MOMO_NAME = 'Đi Tu Online';
