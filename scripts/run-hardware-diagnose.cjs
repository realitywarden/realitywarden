// Compile and run the read-only hardware diagnostic without shell interpolation.
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const tmp = '.tmp-hardware-diagnose';
const tsc = path.join('node_modules', 'typescript', 'bin', 'tsc');

if (fs.existsSync(tmp)) fs.rmSync(tmp, { recursive: true, force: true });
try {
  const compile = spawnSync(process.execPath, [tsc, '-p', 'tsconfig.json', '--outDir', tmp, '--module', 'commonjs', '--moduleResolution', 'node', '--noEmit', 'false'], { stdio: 'inherit' });
  if (compile.status !== 0) process.exitCode = compile.status ?? 1;
  else {
    const run = spawnSync(process.execPath, [path.join(tmp, 'scripts', 'hardwareDiagnose.js'), ...process.argv.slice(2)], { stdio: 'inherit' });
    process.exitCode = run.status ?? 1;
  }
} finally {
  if (fs.existsSync(tmp)) fs.rmSync(tmp, { recursive: true, force: true });
}
