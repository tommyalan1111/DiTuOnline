import nodemailer from 'nodemailer';

const {
  SMTP_HOST,
  SMTP_PORT = '587',
  SMTP_SECURE = 'false',
  SMTP_USER,
  SMTP_PASS,
  MAIL_FROM = 'Đi Tu Online <no-reply@ditu.local>',
} = process.env;

export const mailEnabled = Boolean(SMTP_HOST);

let transporter = null;
if (mailEnabled) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: String(SMTP_SECURE).toLowerCase() === 'true',
    auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
  });
}

/**
 * Sends the password reset email. When SMTP is not configured the link is
 * printed to the server console instead (and surfaced to the client in dev).
 */
export async function sendResetEmail({ to, username, link, minutes }) {
  const subject = 'Đặt lại mật khẩu · Đi Tu Online';
  const text = [
    `Xin chào ${username},`,
    '',
    'Có người vừa yêu cầu đặt lại mật khẩu cho tài khoản Đi Tu Online của bạn.',
    `Mở liên kết sau để đặt mật khẩu mới (hết hạn sau ${minutes} phút):`,
    link,
    '',
    'Nếu không phải bạn, hãy bỏ qua email này — mật khẩu của bạn vẫn an toàn.',
    '',
    'Chúc bạn một ngày an lạc.',
  ].join('\n');

  if (!transporter) {
    console.log('\n──────── ĐẶT LẠI MẬT KHẨU ────────');
    console.log(`Người dùng : ${username} <${to}>`);
    console.log(`Liên kết   : ${link}`);
    console.log(`Hết hạn sau: ${minutes} phút`);
    console.log('──────────────────────────────────\n');
    return { delivered: false, link };
  }

  await transporter.sendMail({
    from: MAIL_FROM,
    to,
    subject,
    text,
    html: `<p>Xin chào <b>${escapeHtml(username)}</b>,</p>
      <p>Có người vừa yêu cầu đặt lại mật khẩu cho tài khoản Đi Tu Online của bạn.</p>
      <p><a href="${link}" style="display:inline-block;padding:12px 20px;border-radius:999px;background:#2f6b4f;color:#fff;text-decoration:none">Đặt lại mật khẩu</a></p>
      <p>Liên kết hết hạn sau ${minutes} phút. Nếu không phải bạn, hãy bỏ qua email này.</p>
      <p style="color:#888">Chúc bạn một ngày an lạc.</p>`,
  });
  return { delivered: true };
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
