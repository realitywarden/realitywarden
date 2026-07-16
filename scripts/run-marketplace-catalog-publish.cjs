const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const output = path.join(root, '.tmp-marketplace-catalog-publish-runtime');
try {
  if (fs.existsSync(output)) fs.rmSync(output, { recursive: true, force: true });
  execFileSync(process.execPath, [
    path.join(root, 'node_modules', 'typescript', 'bin', 'tsc'),
    '-p', path.join(root, 'tsconfig.json'),
    '--outDir', output,
    '--module', 'commonjs',
    '--moduleResolution', 'node',
    '--noEmit', 'false'
  ], { cwd: root, stdio: 'inherit', windowsHide: true });
  execFileSync(process.execPath, [path.join(output, 'scripts', 'publishMarketplaceCatalog.js'), ...process.argv.slice(2)], {
    cwd: root,
    stdio: 'inherit',
    windowsHide: true
  });
} finally {
  if (fs.existsSync(output)) fs.rmSync(output, { recursive: true, force: true });
}
