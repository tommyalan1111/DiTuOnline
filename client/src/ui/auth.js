import { api } from '../api.js';
import { store } from '../store.js';
import {
  $,
  $$,
  setFieldError,
  clearFieldError,
  clearFieldErrors,
  setLoading,
  focusField,
} from './dom.js';
import { toast } from './toast.js';
import { openModal } from './modal.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
const USERNAME_RE = /^[\p{L}\p{N}_.-]{3,20}$/u;

let onAuthenticatedCb = null;

export function initAuth({ onAuthenticated }) {
  onAuthenticatedCb = onAuthenticated;

  $$('.auth-tab').forEach((tab) => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });
  $$('[data-goto-tab]').forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.gotoTab));
  });

  $$('.eye').forEach((btn) => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.eye);
      if (!input) return;
      const showing = input.type === 'text';
      input.type = showing ? 'password' : 'text';
      btn.classList.toggle('is-on', !showing);
      btn.setAttribute('aria-label', showing ? 'Hiện mật khẩu' : 'Ẩn mật khẩu');
    });
  });

  const loginForm = $('#form-login');
  const registerForm = $('#form-register');

  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    handleLogin(loginForm);
  });

  registerForm.addEventListener('submit', (e) => {
    e.preventDefault();
    handleRegister(registerForm);
  });

  // xoá lỗi khi người dùng nhập lại
  for (const form of [loginForm, registerForm]) {
    form.addEventListener('input', (e) => {
      const field = e.target.closest('.field');
      if (field?.classList.contains('is-invalid')) field.classList.remove('is-invalid');
    });
  }

  const pwd = $('#reg-password');
  pwd?.addEventListener('input', () => updateStrength(pwd.value));

  const openForgotFromLogin = () => {
    const id = $('#login-identifier').value.trim();
    openForgot(EMAIL_RE.test(id) ? id : '');
  };
  $('#btn-forgot').addEventListener('click', openForgotFromLogin);
  $('#btn-forgot-reg').addEventListener('click', () => {
    const email = $('#reg-email').value.trim();
    openForgot(EMAIL_RE.test(email) ? email : '');
  });
}

export function switchTab(tab) {
  const container = $('.auth-tabs');
  container.dataset.tab = tab;
  $$('.auth-tab').forEach((t) => {
    const active = t.dataset.tab === tab;
    t.classList.toggle('is-active', active);
    t.setAttribute('aria-selected', String(active));
  });
  $$('.auth-form').forEach((f) => {
    f.hidden = f.dataset.panel !== tab;
    if (!f.hidden) clearFieldErrors(f);
  });
  const first = tab === 'login' ? $('#login-identifier') : $('#reg-username');
  setTimeout(() => first?.focus({ preventScroll: true }), 120);
}

function updateStrength(value) {
  const wrap = $('.strength');
  const label = wrap.querySelector('span');
  if (!value) {
    wrap.hidden = true;
    return;
  }
  wrap.hidden = false;
  let score = 0;
  if (value.length >= 8) score++;
  if (/[a-zA-ZÀ-ỹ]/.test(value) && /[0-9]/.test(value)) score++;
  if (value.length >= 12 || /[^a-zA-Z0-9À-ỹ]/.test(value)) score++;
  wrap.className = `strength s${score}`;
  label.textContent = ['Rất yếu', 'Yếu', 'Khá', 'Mạnh'][score];
}

function validateLogin(data) {
  const errors = {};
  if (!data.identifier.trim()) errors.identifier = 'Vui lòng nhập email hoặc tên hiển thị.';
  if (!data.password) errors.password = 'Vui lòng nhập mật khẩu.';
  return errors;
}

function validateRegister(data) {
  const errors = {};
  const username = data.username.trim();

  if (!username) errors.username = 'Vui lòng nhập tên hiển thị.';
  else if (username.length < 3) errors.username = 'Tên hiển thị phải có ít nhất 3 ký tự.';
  else if (!USERNAME_RE.test(username)) errors.username = 'Tên chỉ gồm chữ, số, dấu chấm, gạch ngang hoặc gạch dưới.';

  const email = data.email.trim();
  if (!email) errors.email = 'Vui lòng nhập email.';
  else if (!EMAIL_RE.test(email)) errors.email = 'Email không hợp lệ.';

  if (!data.password) errors.password = 'Vui lòng nhập mật khẩu.';
  else if (data.password.length < 8) errors.password = 'Mật khẩu phải có ít nhất 8 ký tự.';
  else if (!/[a-zA-ZÀ-ỹ]/.test(data.password) || !/[0-9]/.test(data.password))
    errors.password = 'Mật khẩu cần có cả chữ và số.';

  if (!data.confirmPassword) errors.confirmPassword = 'Vui lòng nhập lại mật khẩu.';
  else if (data.password !== data.confirmPassword) errors.confirmPassword = 'Mật khẩu nhập lại không khớp.';

  return errors;
}

function showErrors(form, errors) {
  clearFieldErrors(form);
  let first = null;
  for (const [field, msg] of Object.entries(errors)) {
    setFieldError(form, field, msg);
    if (!first) first = field;
  }
  if (first) focusField(form, first);
}

async function handleLogin(form) {
  const data = {
    identifier: form.identifier.value,
    password: form.password.value,
  };
  const errors = validateLogin(data);
  if (Object.keys(errors).length) return showErrors(form, errors);

  const btn = form.querySelector('[data-submit]');
  setLoading(btn, true);
  try {
    const res = await api('/api/auth/login', { method: 'POST', body: data });
    store.setSession(res.token, res.user);
    toast(`Chào mừng trở lại, ${res.user.username}.`, 'ok');
    onAuthenticatedCb?.(res.user);
  } catch (err) {
    if (err.field) {
      setFieldError(form, err.field, err.message);
      focusField(form, err.field);
    } else {
      toast(err.message || 'Đăng nhập thất bại.', 'err');
    }
  } finally {
    setLoading(btn, false);
  }
}

async function handleRegister(form) {
  const data = {
    username: form.username.value.trim(),
    email: form.email.value.trim(),
    password: form.password.value,
    confirmPassword: form.confirmPassword.value,
  };
  const errors = validateRegister(data);
  if (Object.keys(errors).length) return showErrors(form, errors);

  const btn = form.querySelector('[data-submit]');
  setLoading(btn, true);
  try {
    const res = await api('/api/auth/register', { method: 'POST', body: data });
    store.setSession(res.token, res.user);
    toast('Tạo tài khoản thành công. Một đời tu bắt đầu từ đây.', 'ok');
    onAuthenticatedCb?.(res.user);
  } catch (err) {
    if (err.field) {
      setFieldError(form, err.field, err.message);
      focusField(form, err.field);
    } else {
      toast(err.message || 'Không thể tạo tài khoản.', 'err');
    }
  } finally {
    setLoading(btn, false);
  }
}

/* ------------------------------------------------------------------ */
/* quên mật khẩu                                                       */
/* ------------------------------------------------------------------ */

function inputField({ id, label, type = 'text', placeholder = '', autocomplete = 'off' }) {
  const wrap = document.createElement('div');
  wrap.className = 'field modal-field';
  wrap.dataset.field = id;

  const l = document.createElement('label');
  l.htmlFor = id;
  l.textContent = label;

  const box = document.createElement('div');
  box.className = 'input-wrap';

  const input = document.createElement('input');
  input.id = id;
  input.type = type;
  input.placeholder = placeholder;
  input.autocomplete = autocomplete;

  box.appendChild(input);
  wrap.append(l, box);

  const err = document.createElement('p');
  err.className = 'error';
  err.dataset.error = '';
  wrap.appendChild(err);

  return { wrap, input, err };
}

function setInputError(fieldWrap, message) {
  fieldWrap.classList.toggle('is-invalid', Boolean(message));
  const err = fieldWrap.querySelector('[data-error]');
  if (err) err.textContent = message || '';
}

export function openForgot(prefillEmail = '') {
  const emailField = inputField({
    id: 'forgot-email',
    label: 'Email đã đăng ký',
    type: 'email',
    placeholder: 'ban@email.com',
    autocomplete: 'email',
  });
  emailField.input.value = prefillEmail;

  const wrap = document.createElement('div');
  wrap.appendChild(emailField.wrap);

  let busy = false;

  const modal = openModal({
    title: 'Quên mật khẩu',
    message: 'Nhập email bạn đã dùng để đăng ký, chúng tôi sẽ gửi liên kết đặt lại mật khẩu.',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3.2" y="5.4" width="17.6" height="13.2" rx="2.6"/><path d="m4 7 8 6 8-6"/></svg>',
    body: wrap,
    actions: [
      { label: 'Để sau', variant: 'ghost' },
      {
        label: 'Gửi liên kết',
        variant: 'primary',
        onClick: async (close) => {
          if (busy) return;
          const email = emailField.input.value.trim();
          if (!EMAIL_RE.test(email)) {
            setInputError(emailField.wrap, 'Email không hợp lệ.');
            emailField.input.focus();
            return;
          }
          busy = true;
          try {
            const res = await api('/api/auth/forgot', { method: 'POST', body: { email } });
            close();
            showForgotSent(res);
          } catch (err) {
            setInputError(emailField.wrap, err.message || 'Không gửi được yêu cầu.');
          } finally {
            busy = false;
          }
        },
      },
    ],
  });

  setTimeout(() => emailField.input.focus(), 120);
  emailField.input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      modal.modal.querySelector('.modal-actions .btn:last-child')?.click();
    }
  });
}

function showForgotSent(res) {
  const wrap = document.createElement('div');

  const p = document.createElement('p');
  p.style.margin = '0 0 12px';
  p.textContent = res.message || 'Yêu cầu đã được ghi nhận.';
  wrap.appendChild(p);

  if (res.devResetUrl) {
    const note = document.createElement('div');
    note.className = 'modal-note';
    note.textContent = 'Môi trường thử nghiệm chưa cấu hình email. Bạn có thể mở liên kết đặt lại ngay bên dưới.';
    wrap.appendChild(note);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-primary';
    btn.style.width = '100%';
    btn.style.height = '44px';
    btn.textContent = 'Đặt lại mật khẩu ngay';
    btn.addEventListener('click', () => {
      const url = new URL(res.devResetUrl);
      const token = url.searchParams.get('reset');
      openReset(token);
    });
    wrap.appendChild(btn);
  }

  openModal({
    title: 'Kiểm tra email',
    body: wrap,
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3.5 7.5 12 13l8.5-5.5"/><rect x="3.5" y="5" width="17" height="14" rx="2.5"/></svg>',
    actions: [{ label: 'Đã hiểu', variant: 'primary' }],
  });
}

export function openReset(token) {
  if (!token) {
    toast('Liên kết đặt lại không hợp lệ.', 'err');
    return;
  }

  const pwd = inputField({
    id: 'reset-password',
    label: 'Mật khẩu mới',
    type: 'password',
    placeholder: 'Tối thiểu 8 ký tự, có chữ và số',
    autocomplete: 'new-password',
  });
  const confirm = inputField({
    id: 'reset-confirm',
    label: 'Nhập lại mật khẩu mới',
    type: 'password',
    placeholder: 'Nhập lại mật khẩu',
    autocomplete: 'new-password',
  });

  const wrap = document.createElement('div');
  wrap.append(pwd.wrap, confirm.wrap);

  let busy = false;

  const modal = openModal({
    title: 'Đặt lại mật khẩu',
    message: 'Chọn mật khẩu mới cho tài khoản của bạn.',
    body: wrap,
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="5" y="10.5" width="14" height="9.5" rx="2.4"/><path d="M8.2 10.5V8a3.8 3.8 0 0 1 7.6 0v2.5"/></svg>',
    actions: [
      { label: 'Huỷ', variant: 'ghost' },
      {
        label: 'Đổi mật khẩu',
        variant: 'primary',
        onClick: async (close) => {
          if (busy) return;
          setInputError(pwd.wrap, '');
          setInputError(confirm.wrap, '');

          if (pwd.input.value.length < 8) {
            setInputError(pwd.wrap, 'Mật khẩu phải có ít nhất 8 ký tự.');
            return;
          }
          if (!/[a-zA-ZÀ-ỹ]/.test(pwd.input.value) || !/[0-9]/.test(pwd.input.value)) {
            setInputError(pwd.wrap, 'Mật khẩu cần có cả chữ và số.');
            return;
          }
          if (pwd.input.value !== confirm.input.value) {
            setInputError(confirm.wrap, 'Mật khẩu nhập lại không khớp.');
            return;
          }

          busy = true;
          try {
            await api('/api/auth/reset', {
              method: 'POST',
              body: { token, password: pwd.input.value, confirmPassword: confirm.input.value },
            });
            close();
            toast('Đã đổi mật khẩu. Mời bạn đăng nhập lại.', 'ok');
            switchTab('login');
            $('#login-identifier').value = '';
            $('#login-password').value = '';
            const url = new URL(window.location.href);
            url.searchParams.delete('reset');
            window.history.replaceState({}, '', url.pathname + url.hash);
          } catch (err) {
            setInputError(pwd.wrap, err.message || 'Không đổi được mật khẩu.');
          } finally {
            busy = false;
          }
        },
      },
    ],
  });

  setTimeout(() => pwd.input.focus(), 120);
}
