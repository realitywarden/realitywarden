'use strict';
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const temp = path.join(root, '.tmp-marketplace-provision');
if (fs.existsSync(temp)) fs.rmSync(temp, { recursive: true, force: true });
try {
  execFileSync(process.execPath, [path.join(root, 'node_modules', 'typescript', 'bin', 'tsc'), '-p', 'tsconfig.json', '--outDir', temp, '--module', 'commonjs', '--moduleResolution', 'node', '--noEmit', 'false'], { cwd: root, stdio: 'inherit', windowsHide: true });
  execFileSync(process.execPath, [path.join(temp, 'scripts', 'provisionMarketplaceDistribution.js'), ...process.argv.slice(2)], { cwd: root, stdio: 'inherit', windowsHide: true });
} finally {
  if (fs.existsSync(temp)) fs.rmSync(temp, { recursive: true, force: true });
}
