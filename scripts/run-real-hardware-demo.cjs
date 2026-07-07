// Compiles the TypeScript project and runs the REAL HARDWARE demo runner.
// Usage: npm run hardware:demo -- --port COM3 [--scenario all|1|2|3|4]
const { execSync } = require('node:child_process');
const fs = require('node:fs');

const tmp = '.tmp-real-hardware-demo';
const forwarded = process.argv.slice(2).join(' ');

if (fs.existsSync(tmp)) fs.rmSync(tmp, { recursive: true, force: true });
try {
  execSync(
    `npx tsc -p tsconfig.json --outDir ${tmp} --module commonjs --moduleResolution node --noEmit false`,
    { stdio: 'inherit' }
  );
  execSync(`node ${tmp}/scripts/realHardwareDemo.js ${forwarded}`, { stdio: 'inherit' });
} finally {
  if (fs.existsSync(tmp)) fs.rmSync(tmp, { recursive: true, force: true });
}
