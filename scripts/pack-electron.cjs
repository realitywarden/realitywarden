const { execFileSync } = require('node:child_process');

try {
  require.resolve('electron-builder');
} catch {
  console.log('electron-builder is not installed. Desktop source and Electron build are ready; install electron-builder to produce an installer.');
  process.exit(0);
}

execFileSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['electron-builder', '--dir'], {
  stdio: 'inherit',
  windowsHide: true
});
