import { SERVER_URL } from './config.js';
import { store } from './store.js';

export class ApiError extends Error {
  constructor(message, field, status) {
    super(message);
    this.name = 'ApiError';
    this.field = field;
    this.status = status;
  }
}

export async function api(path, { method = 'GET', body, auth = false, timeout = 15000 } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth && store.token) headers.Authorization = `Bearer ${store.token}`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);

  let res;
  try {
    res = await fetch(`${SERVER_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: ctrl.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    throw new ApiError(
      err.name === 'AbortError'
        ? 'Máy chủ phản hồi quá lâu. Vui lòng thử lại.'
        : 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.',
      null,
      0,
    );
  }
  clearTimeout(timer);

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok || !data || data.ok === false) {
    throw new ApiError(data?.error || `Lỗi máy chủ (${res.status})`, data?.field || null, res.status);
  }
  return data;
}
