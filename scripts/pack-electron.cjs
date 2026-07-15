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

const packagedExecutable = path.join(root, 'release', 'win-unpacked', 'RealityWarden.exe');
const smokeEnvironment = { ...process.env };
delete smokeEnvironment.ELECTRON_RUN_AS_NODE;
execFileSync(packagedExecutable, ['--prod', '--smoke-test'], {
  cwd: path.dirname(packagedExecutable),
  env: smokeEnvironment,
  stdio: 'inherit',
  timeout: 300_000,
  windowsHide: true
});

console.log('Packaged desktop first-run renderer smoke test passed.');

const packageJson = require(path.join(root, 'package.json'));
const designEvidencePath = path.join(root, 'release', `RealityWarden-${packageJson.version}-Design-Acceptance.json`);
execFileSync(packagedExecutable, ['--prod', '--design-smoke-test'], {
  cwd: path.dirname(packagedExecutable),
  env: { ...smokeEnvironment, ORS_DESIGN_EVIDENCE_PATH: designEvidencePath },
  stdio: 'inherit',
  timeout: 300_000,
  windowsHide: true
});

console.log('Packaged desktop product-design acceptance passed.');

execFileSync(process.execPath, [path.join(__dirname, 'verify-windows-install-lifecycle.cjs')], {
  cwd: root,
  stdio: 'inherit',
  windowsHide: true
});

execFileSync(process.execPath, [path.join(__dirname, 'write-release-evidence.cjs')], {
  cwd: root,
  stdio: 'inherit',
  windowsHide: true
});
