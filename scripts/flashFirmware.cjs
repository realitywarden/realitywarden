// One-click firmware flash for the RealityWarden ESP32-S3 rig.
//
// Usage:
//   npm run hardware:flash -- --port COM3
//   npm run hardware:flash -- --port COM3 --esptool "C:\\path\\to\\esptool.exe"
//   npm run hardware:flash -- --port COM3 --binary firmware/prebuilt/xxx.merged.bin
//   npm run hardware:flash -- --port COM3 --order <firmware-write-order.json>
//
// --order flashes ONLY the reviewed prebuilt image a governed firmware write
// order authorizes (schema realitywarden.firmware-write-order, produced by
// lib/device-onboarding/FirmwareWriteOrder.ts after an explicit second human
// review). The image digest must match the order AND the .sha256 companion.
// A write order never grants execution authority.
//
// Flashes firmware/prebuilt/esp32s3-realitywarden-v0.1.4.merged.bin (a full
// merged image, written at offset 0x0) using esptool. esptool is discovered in
// this order:
//   1. --esptool argument / ESPTOOL_PATH env var
//   2. `esptool` / `esptool.py` on PATH
//   3. `python -m esptool`
//   4. the copy the Arduino IDE installs with the ESP32 core
//      (%LOCALAPPDATA%\Arduino15 or ~/.arduino15 packages/esp32/tools/esptool_py)
// If none is found, it prints exactly what to install and the Arduino IDE
// fallback. It never guesses and never flashes without a resolved tool.
//
// Safety notes: flashing is inherently an operator action on the FLASHING
// port (ESP32-S3: the "COM/UART" port, not the native USB CDC port). esptool
// itself refuses non-ESP devices during its sync handshake. This script never
// sends RealityWarden protocol commands and cannot actuate the servo.
'use strict';

const { spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const DEFAULT_BINARY = path.join('firmware', 'prebuilt', 'esp32s3-realitywarden-v0.1.4.merged.bin');
const CHIP = 'esp32s3';
const BAUD = '460800';

function argValue(flag) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function fail(message) {
  console.error(`FAIL  ${message}`);
  process.exit(1);
}

function tryRun(command, args) {
  try {
    const result = spawnSync(command, args, { encoding: 'utf8', windowsHide: true });
    if (result.error) return null;
    const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
    // A real esptool prints its version banner; "No module named" or a shell
    // "not found" means the candidate does not actually exist.
    if (/no module named|not found|not recognized/i.test(output)) return null;
    return /esptool/i.test(output) ? { command } : null;
  } catch {
    return null;
  }
}

function findArduinoEsptool() {
  const roots = [];
  if (process.env.LOCALAPPDATA) roots.push(path.join(process.env.LOCALAPPDATA, 'Arduino15'));
  roots.push(path.join(os.homedir(), '.arduino15'));
  roots.push(path.join(os.homedir(), 'Library', 'Arduino15'));
  for (const root of roots) {
    const toolRoot = path.join(root, 'packages', 'esp32', 'tools', 'esptool_py');
    if (!fs.existsSync(toolRoot)) continue;
    const versions = fs.readdirSync(toolRoot).sort().reverse();
    for (const version of versions) {
      for (const name of ['esptool.exe', 'esptool', 'esptool.py']) {
        const candidate = path.join(toolRoot, version, name);
        if (fs.existsSync(candidate)) return candidate;
      }
    }
  }
  return null;
}

function resolveEsptool() {
  const explicit = argValue('--esptool') ?? process.env.ESPTOOL_PATH;
  if (explicit) {
    if (!fs.existsSync(explicit)) fail(`--esptool path does not exist: ${explicit}`);
    return { command: explicit, prefixArgs: [] };
  }
  if (tryRun('esptool', ['version'])) return { command: 'esptool', prefixArgs: [] };
  if (tryRun('esptool.py', ['version'])) return { command: 'esptool.py', prefixArgs: [] };
  for (const python of ['python', 'python3', 'py']) {
    if (tryRun(python, ['-m', 'esptool', 'version'])) return { command: python, prefixArgs: ['-m', 'esptool'] };
  }
  const arduino = findArduinoEsptool();
  if (arduino) {
    return arduino.endsWith('.py')
      ? { command: 'python', prefixArgs: [arduino] }
      : { command: arduino, prefixArgs: [] };
  }
  return null;
}

// Minimal, duplicated-on-purpose contract checks for governed write orders.
// The authoritative validator is lib/device-onboarding/FirmwareWriteOrder.ts
// (covered by test:device-onboarding); this script re-checks the literals it
// depends on so a tampered JSON file cannot steer the flasher.
function loadWriteOrder(orderPath) {
  if (!fs.existsSync(orderPath)) fail(`write order not found: ${orderPath}`);
  let order;
  try {
    order = JSON.parse(fs.readFileSync(orderPath, 'utf8'));
  } catch (error) {
    fail(`write order is not valid JSON: ${error.message}`);
  }
  if (!order || typeof order !== 'object' || Array.isArray(order)) fail('write order must be a JSON object');
  if (order.schema !== 'realitywarden.firmware-write-order') fail('write order has the wrong schema identifier');
  if (order.schema_version !== 1) fail('unsupported write order schema_version');
  if (order.status !== 'write_authorized') fail(`write order status must be "write_authorized", got "${String(order.status)}"`);
  if (!order.write_review || order.write_review.confirmed !== true) fail('write order lacks an explicit write authorization review');
  if (order.execution_authority_granted !== false) fail('a write order can never grant execution authority; refusing tampered order');
  if (order.real_adapter_enabled !== false) fail('a write order can never enable a real adapter; refusing tampered order');
  if (!order.image || typeof order.image.file !== 'string' || !/^[a-f0-9]{64}$/.test(String(order.image.sha256))) {
    fail('write order image reference is malformed');
  }
  return order;
}

function main() {
  const port = argValue('--port');
  if (!port) fail('missing --port. Example: npm run hardware:flash -- --port COM3  (ESP32-S3: use the "COM/UART" flashing port)');

  const orderPath = argValue('--order');
  if (orderPath && argValue('--binary')) fail('--order and --binary are mutually exclusive: the order decides the image');
  const order = orderPath ? loadWriteOrder(orderPath) : null;

  const binaryPath = order
    ? path.resolve(path.join(__dirname, '..'), order.image.file)
    : (argValue('--binary') ?? DEFAULT_BINARY);
  if (!fs.existsSync(binaryPath)) fail(`firmware image not found: ${binaryPath}`);

  // Integrity check: refuse to flash a corrupted image.
  const shaPath = `${binaryPath}.sha256`;
  const actualSha = crypto.createHash('sha256').update(fs.readFileSync(binaryPath)).digest('hex');
  if (order) {
    // Order mode: the companion digest is mandatory and every leg must agree.
    if (!fs.existsSync(shaPath)) fail('write orders require the .sha256 companion next to the image');
    const companion = fs.readFileSync(shaPath, 'utf8').trim().split(/\s+/)[0];
    if (companion !== actualSha) fail(`firmware image failed its integrity check (sha256 mismatch).\n      expected ${companion}\n      actual   ${actualSha}`);
    if (order.image.sha256 !== actualSha) {
      fail(`the image on disk is not the image this write order authorizes.\n      order    ${order.image.sha256}\n      actual   ${actualSha}`);
    }
    console.log('PASS  write order verified: image, companion digest, and order digest all match');
    console.log('INFO  a write order grants NO execution authority; the runtime evidence lock is unchanged.');
  } else if (fs.existsSync(shaPath)) {
    const expected = fs.readFileSync(shaPath, 'utf8').trim().split(/\s+/)[0];
    if (expected !== actualSha) {
      fail(`firmware image failed its integrity check (sha256 mismatch).\n      expected ${expected}\n      actual   ${actualSha}\n      Re-checkout ${binaryPath} and retry.`);
    }
    console.log('PASS  firmware image integrity verified (sha256)');
  } else {
    console.log('WARN  no .sha256 next to the image; skipping integrity check');
  }

  const esptool = resolveEsptool();
  if (!esptool) {
    console.error('FAIL  esptool not found. Fix one of:');
    console.error('      1. pip install esptool          (then re-run)');
    console.error('      2. install the Arduino IDE ESP32 core once (it bundles esptool; this script finds it automatically)');
    console.error('      3. pass --esptool <path-to-esptool.exe> or set ESPTOOL_PATH');
    console.error('      Fallback: flash firmware/esp32-realitywarden/esp32-realitywarden.ino via the Arduino IDE (docs/REAL_HARDWARE_ESP32.md).');
    process.exit(1);
  }

  const args = [...esptool.prefixArgs, '--chip', CHIP, '--port', port, '--baud', BAUD, 'write_flash', '0x0', binaryPath];
  console.log(`INFO  flashing ${binaryPath}`);
  console.log(`INFO  ${esptool.command} ${args.join(' ')}`);
  console.log('INFO  close any serial monitor on this port first. Do not unplug during flashing.');
  const run = spawnSync(esptool.command, args, { stdio: 'inherit', windowsHide: true });
  if (run.error) fail(`could not start esptool: ${run.error.message}`);
  if (run.status !== 0) {
    console.error('FAIL  esptool exited with an error. Common causes:');
    console.error('      - wrong port (ESP32-S3: flash via the "COM/UART" port, not the native USB port)');
    console.error('      - port held by a serial monitor / the desktop app - close it and retry');
    console.error('      - board not in download mode: hold BOOT, tap RESET, release BOOT, retry');
    process.exit(run.status ?? 1);
  }
  console.log('PASS  firmware flashed. Press RESET (or replug), then verify with:');
  console.log(`      npm run hardware:diagnose -- --port ${port}`);
  if (order) {
    console.log('      For onboarding evidence, capture a read-only diagnostics report:');
    console.log(`      npm run hardware:diagnose -- --port ${port} --json <report.json>`);
  }
}

main();
