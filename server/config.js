import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const PORT = Number(process.env.PORT || 3000);
export const HOST = process.env.HOST || '0.0.0.0';
export const NODE_ENV = process.env.NODE_ENV || 'development';
export const IS_DEV = NODE_ENV !== 'production';
export const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
export const PUBLIC_DIR = path.join(ROOT, 'server', 'public');
export const TEMPLE_CAPACITY = 50;
export const TOKEN_TTL_DAYS = 30;
export const RESET_TTL_MIN = 30;
export const APP_NAME = 'Đi Tu Online';

fs.mkdirSync(DATA_DIR, { recursive: true });

function readOrCreateSecret() {
  const file = path.join(DATA_DIR, 'secret.key');
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET;
  try {
    return fs.readFileSync(file, 'utf8').trim();
  } catch {
    const secret = crypto.randomBytes(48).toString('hex');
    fs.writeFileSync(file, secret, { mode: 0o600 });
    return secret;
  }
}

export const AUTH_SECRET = readOrCreateSecret();

/** Public base URL used to build links inside emails. */
export function baseUrl(req) {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/+$/, '');
  const proto = req?.protocol || 'http';
  const host = req?.get?.('host') || `localhost:${PORT}`;
  return `${proto}://${host}`;
}
