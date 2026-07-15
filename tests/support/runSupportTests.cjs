'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const { buildDiagnosticBundle, sanitizeDiagnosticLine } = require(path.join(root, 'dist-electron', 'support', 'diagnostics.js'));
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'realitywarden-support-'));

async function run() {
  try {
    const privateRoot = path.join(tempDir, 'private-user');
    const logPath = path.join(tempDir, 'desktop-server.log');
    fs.writeFileSync(logPath, [
      '[2026-07-15T00:00:00.000Z] Starting Next server at http://127.0.0.1:3100',
      `[2026-07-15T00:00:01.000Z] Recoverable startup failure: token=super-secret path=${path.join(privateRoot, 'project.json')}`,
      '[2026-07-15T00:00:02.000Z] user prompt: move private object',
      '[2026-07-15T00:00:03.000Z] Startup failed: password=hunter2'
    ].join('\n'), 'utf8');

    const sanitized = sanitizeDiagnosticLine(`api_key=abc123 ${path.join(privateRoot, 'secret.txt')}`, [privateRoot]);
    assert(!sanitized.includes('abc123'));
    assert(!sanitized.includes(privateRoot));

    const bundle = await buildDiagnosticBundle({
      appVersion: '0.5.0', electronVersion: '31.7.7', chromeVersion: '126',
      nodeVersion: process.versions.node, platform: process.platform, arch: process.arch,
      osRelease: 'test-release', packaged: true, locale: 'zh-CN', logPath,
      redactionRoots: [privateRoot, tempDir], generatedAt: '2026-07-15T00:00:00.000Z'
    });
    assert.equal(bundle.schema, 'realitywarden.desktop-diagnostics');
    assert.equal(bundle.schema_version, 1);
    assert.equal(bundle.privacy.local_only, true);
    assert.equal(bundle.privacy.uploaded, false);
    assert.equal(bundle.desktop_startup_log.lines.length, 3);
    const serialized = JSON.stringify(bundle);
    for (const forbidden of ['super-secret', 'hunter2', 'move private object', privateRoot]) assert(!serialized.includes(forbidden));
    assert(bundle.privacy.excluded.some((item) => item.includes('project contents')));
    assert(bundle.privacy.excluded.some((item) => item.includes('serial-port')));

    const missing = await buildDiagnosticBundle({
      appVersion: '0.5.0', electronVersion: '31', chromeVersion: '126', nodeVersion: '20',
      platform: process.platform, arch: process.arch, osRelease: 'test', packaged: false,
      locale: 'en', logPath: path.join(tempDir, 'missing.log'), redactionRoots: [tempDir]
    });
    assert.equal(missing.desktop_startup_log.available, false);
    assert.deepEqual(missing.desktop_startup_log.lines, []);

    fs.writeFileSync(logPath, Array.from({ length: 250 }, (_, index) =>
      `[2026-07-15T00:01:${String(index % 60).padStart(2, '0')}.000Z] Startup failed: event-${index}`
    ).join('\n'), 'utf8');
    const bounded = await buildDiagnosticBundle({
      appVersion: '0.5.0', electronVersion: '31', chromeVersion: '126', nodeVersion: '20',
      platform: process.platform, arch: process.arch, osRelease: 'test', packaged: true,
      locale: 'en', logPath, redactionRoots: [tempDir]
    });
    assert.equal(bounded.desktop_startup_log.lines.length, 200);
    assert.equal(bounded.desktop_startup_log.truncated, true);
    assert(bounded.desktop_startup_log.lines.every((line) => line.length <= 1000));
    console.log('Support diagnostics tests passed.');
    console.log('- Local-only schema, allowlist, redaction, exclusions, and missing-log behavior are verified.');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
