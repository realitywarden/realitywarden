const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const compiledMain = path.join(root, 'dist-electron', 'main.js');
const tsc = path.join(root, 'node_modules', 'typescript', 'bin', 'tsc');

if (!fs.existsSync(compiledMain)) {
  execFileSync(process.execPath, [tsc, '-p', 'electron/tsconfig.json'], {
    cwd: root,
    stdio: 'inherit',
    windowsHide: true
  });
}

require(compiledMain);
