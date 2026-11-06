import { $ } from './dom.js';

let activeClose = null;

/**
 * Mở modal trung tâm.
 * @param {object} opts
 * @param {string} opts.title
 * @param {string} [opts.message]
 * @param {Node|string} [opts.body] nội dung tuỳ biến (Node hoặc HTML nội bộ)
 * @param {Array} [opts.actions] [{label, variant, onClick(close), submit}]
 * @param {boolean} [opts.dismissible]
 */
export function openModal({ title, message, body, actions = [], dismissible = true, icon = '' }) {
  closeModal();

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');

  if (icon) {
    const ic = document.createElement('div');
    ic.className = 'modal-icon';
    ic.innerHTML = icon;
    modal.appendChild(ic);
  }

  const h = document.createElement('h3');
  h.textContent = title;
  modal.appendChild(h);

  if (message) {
    const p = document.createElement('p');
    p.textContent = message;
    modal.appendChild(p);
  }

  if (body) {
    if (typeof body === 'string') {
      const div = document.createElement('div');
      div.innerHTML = body;
      modal.appendChild(div);
    } else {
      modal.appendChild(body);
    }
  }

  const row = document.createElement('div');
  row.className = 'modal-actions';

  const close = () => {
    backdrop.remove();
    activeClose = null;
    document.removeEventListener('keydown', onKey);
  };

  for (const a of actions) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `btn ${a.variant === 'primary' ? 'btn-primary' : 'btn-ghost'}`;
    btn.textContent = a.label;
    btn.addEventListener('click', () => {
      if (a.onClick) a.onClick(close);
      else close();
    });
    row.appendChild(btn);
  }

  if (row.children.length) modal.appendChild(row);

  backdrop.appendChild(modal);
  document.getElementById('modal-root').appendChild(backdrop);
  activeClose = close;

  const onKey = (e) => {
    if (e.key === 'Escape' && dismissible) close();
  };
  document.addEventListener('keydown', onKey);

  if (dismissible) {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) close();
    });
  }

  const focusable = modal.querySelector('input, button');
  setTimeout(() => focusable?.focus(), 60);

  return { close, modal, backdrop };
}

export function closeModal() {
  activeClose?.();
}

export function confirmDialog({
  title,
  message,
  confirmText = 'Đồng ý',
  cancelText = 'Huỷ',
  danger = false,
  icon = '',
}) {
  return new Promise((resolve) => {
    openModal({
      title,
      message,
      icon,
      actions: [
        {
          label: cancelText,
          variant: 'ghost',
          onClick: (close) => {
            close();
            resolve(false);
          },
        },
        {
          label: confirmText,
          variant: 'primary',
          onClick: (close) => {
            close();
            resolve(true);
          },
        },
      ],
    });
  });
}
