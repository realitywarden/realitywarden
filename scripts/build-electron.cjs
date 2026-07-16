const { execFileSync } = require('node:child_process');
const path = require('node:path');
const { buildSync } = require('esbuild');

const root = path.resolve(__dirname, '..');
const tsc = path.join(root, 'node_modules', 'typescript', 'bin', 'tsc');

execFileSync(process.execPath, [tsc, '-p', 'electron/tsconfig.json'], {
  cwd: root,
  stdio: 'inherit',
  windowsHide: true
});

// Compile the shared runtime (safety chain: SafetyMonitor -> gate -> adapter
// -> transport) for the main process. The electron tsconfig cannot include
// lib/ (rootDir), so hardware.ipc requires this compiled tree at runtime -
// the SAME code the CLI demo and the invariant tests run, never a copy.
execFileSync(process.execPath, [tsc, '-p', 'tsconfig.json', '--outDir', 'dist-electron-runtime', '--module', 'commonjs', '--moduleResolution', 'node', '--noEmit', 'false'], {
  cwd: root,
  stdio: 'inherit',
  windowsHide: true
});

// esptool-js 0.6 ships browser ESM without a Node package type marker. Bundle
// that official implementation for the CommonJS Electron main process; this
// is packaging only, not a copy or reimplementation of the flashing protocol.
buildSync({
  entryPoints: [path.join(root, 'node_modules', 'esptool-js', 'bundle.js')],
  outfile: path.join(root, 'dist-electron-runtime', 'esptool-js.cjs'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  legalComments: 'eof',
  logLevel: 'warning'
});
