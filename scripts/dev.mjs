import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const viteBin = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');

const colors = {
  server: '\x1b[36m',
  client: '\x1b[35m',
};
const reset = '\x1b[0m';

function run(name, cmd, args) {
  const child = spawn(cmd, args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], env: process.env });
  const prefix = `${colors[name] || ''}[${name}]${reset} `;

  const pipe = (stream) => {
    let buffer = '';
    stream.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) process.stdout.write(prefix + line + '\n');
    });
  };
  pipe(child.stdout);
  pipe(child.stderr);

  child.on('exit', (code) => {
    process.stdout.write(`${prefix}thoát với mã ${code}\n`);
  });
  return child;
}

const procs = [
  run('server', process.execPath, ['--watch', 'server/index.js']),
  run('client', process.execPath, [viteBin]),
];

function shutdown() {
  for (const p of procs) p.kill('SIGTERM');
  setTimeout(() => process.exit(0), 300);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

console.log('\n  Đi Tu Online — dev\n  Web:    http://localhost:5173\n  Server: http://localhost:3000\n');
