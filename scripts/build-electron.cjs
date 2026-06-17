const { execFileSync } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const tsc = path.join(root, 'node_modules', 'typescript', 'bin', 'tsc');

execFileSync(process.execPath, [tsc, '-p', 'electron/tsconfig.json'], {
  cwd: root,
  stdio: 'inherit',
  windowsHide: true
});
