const fs = require('node:fs');
const path = require('node:path');
const { execFileSync, spawn } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const electronEntry = path.join(root, 'dist-electron', 'main.js');
const projectContractEntry = path.join(root, 'dist-electron-runtime', 'lib', 'project', 'ProjectFileContract.js');
const buildElectron = path.join(root, 'scripts', 'build-electron.cjs');
const electronBin = process.platform === 'win32' ? 'electron.cmd' : 'electron';
const hasNextProdBuild = fs.existsSync(path.join(root, '.next-build', 'BUILD_ID'));

function ensureElectronBuild() {
  if (fs.existsSync(electronEntry) && fs.existsSync(projectContractEntry)) return;
  execFileSync(process.execPath, [buildElectron], {
    cwd: root,
    stdio: 'inherit',
    windowsHide: true
  });
}

function runElectron(args) {
  const child = spawn(electronBin, args, {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    windowsHide: false
  });

  child.on('exit', (code) => {
    process.exit(code ?? 0);
  });
}

ensureElectronBuild();

if (hasNextProdBuild) {
  runElectron([electronEntry, '--prod']);
} else {
  runElectron([electronEntry]);
}
