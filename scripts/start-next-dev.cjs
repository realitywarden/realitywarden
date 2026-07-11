const path = require('node:path');
const { spawn } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const nextCli = path.join(root, 'node_modules', 'next', 'dist', 'bin', 'next');

// Keep development output separate from the production build consumed by the
// desktop packager. Otherwise `npm run dev` can lock `.next-build` on Windows
// and make `npm run build` fail before Next.js starts.
const child = spawn(process.execPath, [nextCli, 'dev', ...process.argv.slice(2)], {
  cwd: root,
  env: { ...process.env, ORS_NEXT_DIST_DIR: process.env.ORS_NEXT_DIST_DIR || '.next-dev' },
  stdio: 'inherit',
  windowsHide: false
});

child.on('error', (error) => {
  console.error(`Unable to start the Next.js development server: ${error.message}`);
  process.exitCode = 1;
});

child.on('exit', (code, signal) => {
  if (signal) process.exitCode = 1;
  else process.exitCode = code ?? 1;
});
