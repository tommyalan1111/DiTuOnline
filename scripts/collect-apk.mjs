/**
 * Sao chép APK vừa build vào thư mục build/ với tên có phiên bản + thời điểm,
 * đồng thời ghi lại vào build/versions.md.
 *
 * Chạy tự động sau `npm run android:apk`, hoặc chạy tay:
 *   node scripts/collect-apk.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

const src = path.join(root, 'android/app/build/outputs/apk/debug/app-debug.apk');
if (!fs.existsSync(src)) {
  console.error('✗ Không thấy APK. Hãy chạy "npm run android:apk" trước.');
  process.exit(1);
}

const outDir = path.join(root, 'build');
fs.mkdirSync(outDir, { recursive: true });

const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
const stamp =
  `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
  `-${pad(now.getHours())}${pad(now.getMinutes())}`;

const name = `DiTuOnline-v${pkg.version}-${stamp}-debug.apk`;
const dest = path.join(outDir, name);

fs.copyFileSync(src, dest);

const size = fs.statSync(dest).size / 1024 / 1024;
const logPath = path.join(outDir, 'versions.md');
if (!fs.existsSync(logPath)) {
  fs.writeFileSync(
    logPath,
    '# Các bản APK\n\n| Tệp | Kích thước | Thời điểm build |\n| --- | --- | --- |\n',
  );
}
fs.appendFileSync(
  logPath,
  `| \`${name}\` | ${size.toFixed(1)} MB | ${now.toLocaleString('vi-VN')} |\n`,
);

console.log(`\n📦 Đã lưu: build/${name}  (${size.toFixed(1)} MB)\n`);
