const { execFileSync } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

let builderCli;

try {
  require.resolve('electron-builder');
  builderCli = require.resolve('electron-builder/out/cli/cli.js');
} catch {
  console.error('electron-builder is not installed. Run npm install to fetch devDependencies before packaging the desktop installer.');
  process.exit(1);
}

execFileSync(process.execPath, [builderCli, '--win', 'nsis'], {
  cwd: root,
  stdio: 'inherit',
  windowsHide: true
});

execFileSync(process.execPath, [path.join(__dirname, 'verify-electron-package.cjs')], {
  cwd: root,
  stdio: 'inherit',
  windowsHide: true
});
