const KEY = 'ditu.session.v1';

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || null;
  } catch {
    return null;
  }
}

let session = load();

export const store = {
  get token() {
    return session?.token || null;
  },
  get user() {
    return session?.user || null;
  },
  setSession(token, user) {
    session = { token, user };
    localStorage.setItem(KEY, JSON.stringify(session));
  },
  patchUser(user) {
    if (!session) return;
    session.user = user;
    localStorage.setItem(KEY, JSON.stringify(session));
  },
  clear() {
    session = null;
    localStorage.removeItem(KEY);
  },
  get soundEnabled() {
    return localStorage.getItem('ditu.sound') !== 'off';
  },
};
