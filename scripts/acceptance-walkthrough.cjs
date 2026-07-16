// Guided four-scenario acceptance walkthrough (operator-facing, Chinese).
//
// Usage:
//   npm run hardware:acceptance -- --port COM3
//   npm run hardware:acceptance -- --port COM3 --only 1      (re-run one scenario)
//
// Every scenario starts with an EXPLICIT gated parking step (servo to 0°)
// so the operator sees a known starting position, and a blocked scenario is
// a meaningful negative test: a gate failure would show up as a visible
// 0°->45° sweep, not a trivially-still servo.
//
// Honesty rules:
// - Evidence is only written when BOTH the audit log and the operator's
//   physical observation match the expected outcome. Nothing is fabricated.
// - "blocked but the servo moved" aborts immediately as a P0 incident.
// - No new execution path: every command runs through the same compiled demo
//   runner and its safety gate.
'use strict';

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');

const ROOT = path.resolve(__dirname, '..');
const EVIDENCE_DIR = path.join(ROOT, 'docs', 'acceptance', 'evidence');
const AUDIT_MARKER = '=== Audit log export';
const TMP = path.join(ROOT, '.tmp-acceptance-wizard');

function argValue(flag) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function extractAuditEntries(output) {
  const markerIndex = output.lastIndexOf(AUDIT_MARKER);
  if (markerIndex < 0) return null;
  const bracketIndex = output.indexOf('[', markerIndex);
  if (bracketIndex < 0) return null;
  let depth = 0;
  for (let i = bracketIndex; i < output.length; i += 1) {
    if (output[i] === '[') depth += 1;
    else if (output[i] === ']') {
      depth -= 1;
      if (depth === 0) {
        try {
          const parsed = JSON.parse(output.slice(bracketIndex, i + 1));
          return Array.isArray(parsed) ? parsed : null;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

if (process.argv.includes('--selftest')) {
  const sample = `noise\n${AUDIT_MARKER} (every entry carries hardwareSignalSent) ===\n[\n  {"code":"x","data":{"args":{"angle":45}}}\n]\n`;
  const entries = extractAuditEntries(sample);
  if (!entries || entries.length !== 1 || entries[0].data.args.angle !== 45) {
    console.error('selftest FAIL');
    process.exit(1);
  }
  console.log('selftest PASS');
  process.exit(0);
}

const port = argValue('--port');
if (!port) {
  console.error('缺少 --port，例如：npm run hardware:acceptance -- --port COM3');
  console.error('只补跑部分场景：npm run hardware:acceptance -- --port COM3 --only 1');
  process.exit(1);
}
const selected = new Set((argValue('--only') ?? '1,2,3,4').split(',').map((v) => v.trim()));
const wants = (n) => selected.has(String(n));

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (question) => new Promise((resolve) => rl.question(question, (answer) => resolve(answer.trim())));
const pressEnter = async (hint) => { await ask(`\n>>> ${hint}，准备好后按【回车】继续...`); };

async function confirmYesNo(question) {
  for (;;) {
    const answer = (await ask(`${question} (y/n): `)).toLowerCase();
    if (answer === 'y') return true;
    if (answer === 'n') return false;
    console.log('请输入 y 或 n');
  }
}

function compileOnce() {
  console.log('\n首次编译运行时（约 1 分钟，只需一次）...');
  if (fs.existsSync(TMP)) fs.rmSync(TMP, { recursive: true, force: true });
  const tsc = path.join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc');
  const compile = spawnSync(process.execPath, [tsc, '-p', 'tsconfig.json', '--outDir', TMP, '--module', 'commonjs', '--moduleResolution', 'node', '--noEmit', 'false'], { cwd: ROOT, stdio: 'inherit' });
  if (compile.status !== 0) {
    console.error('编译失败，见上方输出。');
    process.exit(compile.status ?? 1);
  }
}

function runScenario(id) {
  const result = spawnSync(process.execPath, [
    path.join(TMP, 'scripts', 'realHardwareDemo.js'),
    '--port', port,
    '--scenario', id
  ], { cwd: ROOT, encoding: 'utf8' });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  console.log(output);
  return { status: result.status, output, audit: extractAuditEntries(output) };
}

function findEntry(audit, predicate) {
  return (audit ?? []).find(predicate) ?? null;
}

function saveEvidence(scenario, description, entries, observation) {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  const date = new Date().toISOString().slice(0, 10);
  const file = path.join(EVIDENCE_DIR, `${date}-scenario-${scenario}.json`);
  fs.writeFileSync(file, `${JSON.stringify({
    schema: 'realitywarden.acceptance-evidence',
    schema_version: 1,
    scenario,
    description,
    port,
    captured_at: new Date().toISOString(),
    operator_confirmed: observation,
    audit: entries
  }, null, 2)}\n`);
  console.log(`✔ 证据已保存：${path.relative(ROOT, file)}`);
}

function p0Abort(message) {
  console.error(`\n!!!!!!  P0 安全事故：${message}`);
  console.error('立即断电停止，保留全部日志。不要重试。');
  cleanup();
  process.exit(2);
}

function cleanup() {
  try { if (fs.existsSync(TMP)) fs.rmSync(TMP, { recursive: true, force: true }); } catch { /* best effort */ }
}

/**
 * Explicit gated parking step. Requires the sensor to be healthy (the park
 * command itself passes the interlock), so it runs BEFORE the operator sets
 * up a blocking condition (hand / unplugged sensor).
 */
async function parkAtZero(extraHint) {
  for (;;) {
    await pressEnter(`【归零】舵机将经安全门转到 0°。${extraHint ?? '确保探头前 20~30cm 有书、传感器接好'}，眼睛盯住舵机`);
    const run = runScenario('park');
    const parked = findEntry(run.audit, (e) => e?.data?.args?.angle === 0 && e.hardwareSignalSent === true && !String(e.code).includes('blocked'));
    if (parked) {
      console.log('归零指令已执行（此后它应停在 0° 不再动）。');
      return true;
    }
    console.log('归零被安全门拦下或未确认送达（多半是传感器前有遮挡/没读数）。清空探头前方 10cm 内的障碍后重试。');
    const retry = await confirmYesNo('重试归零吗？(n=跳过本场景)');
    if (!retry) return false;
  }
}

async function main() {
  console.log('=== RealityWarden 四场景真机验收向导 ===');
  console.log(`端口：${port}（协议口；出问题先关掉所有串口监视器）`);
  console.log('前置：固件为脉宽版且诊断 8/8 PASS；舵机橙线→GPIO18；传感器工作正常。');
  console.log('每个场景都会先"归零"，让你从已知位置观察——被拦的场景里舵机必须全程停在 0°。');

  compileOnce();

  // ---------- 场景 1 ----------
  if (wants(1)) {
    console.log('\n───── 场景 1：合法角度，应当执行 ─────');
    if (await parkAtZero()) {
      await pressEnter('【场景1】保持书在 20~30cm。即将发送 45° 指令，舵机应从 0° 明显摆到 45°');
      const run = runScenario('1');
      const s1 = findEntry(run.audit, (e) => e?.data?.args?.angle === 45);
      const s1ok = Boolean(s1 && s1.hardwareSignalSent === true && !String(s1.code).includes('blocked'));
      console.log(`\n判定：场景1 审计=${s1ok ? '通过（已执行且设备确认）' : '未通过'}`);
      const moved = await confirmYesNo('你亲眼看到舵机从 0° 摆到 45° 了吗？');
      if (s1ok && moved) saveEvidence(1, 'move_to_angle 45 -> executed, servo visibly swept from 0 (operator confirmed)', [s1], { servo_moved: true });
      else console.log('场景1未同时满足审计+人工观察，未保存证据。');
    }
  }

  // ---------- 场景 2 ----------
  if (wants(2)) {
    console.log('\n───── 场景 2：越界角度，必须拦截 ─────');
    if (await parkAtZero()) {
      await pressEnter('【场景2】即将发送 200° 非法指令。舵机必须全程停在 0° 纹丝不动');
      const run = runScenario('2');
      const s2 = findEntry(run.audit, (e) => e?.data?.args?.angle === 200);
      const s2ok = Boolean(s2 && s2.hardwareSignalSent === false && String(s2.message ?? '').includes('angle_out_of_range'));
      console.log(`\n判定：场景2 审计=${s2ok ? '通过（已拦截，零信号）' : '未通过'}`);
      const stayed = await confirmYesNo('舵机是不是全程停在 0° 没动？');
      if (s2ok && !stayed) p0Abort('200° 被审计标记为拦截，但舵机动了');
      if (s2ok && stayed) saveEvidence(2, 'move_to_angle 200 -> blocked angle_out_of_range, servo stayed at 0', [s2], { servo_stayed_still: true });
      else console.log('场景2未同时满足审计+人工观察，未保存证据。');
    }
  }

  // ---------- 场景 3 ----------
  if (wants(3)) {
    console.log('\n───── 场景 3：障碍过近，距离互锁必须拦截 ─────');
    if (await parkAtZero()) {
      await pressEnter('【场景3】现在用手掌或书挡在探头正前方【不到 10cm】处，并保持不动。舵机必须全程停在 0°');
      const run = runScenario('3');
      const s3 = findEntry(run.audit, (e) => String(e?.message ?? '').includes('min_safe_distance'));
      const s3ok = Boolean(s3 && s3.hardwareSignalSent === false);
      console.log(`\n判定：场景3 审计=${s3ok ? '通过（距离互锁拦截，零信号）' : '未通过（没有出现 min_safe_distance 拦截）'}`);
      const stayed = await confirmYesNo('舵机是不是全程停在 0° 没动？');
      if (s3ok && !stayed) p0Abort('距离互锁被标记为拦截，但舵机动了');
      if (s3ok && stayed) saveEvidence(3, 'obstacle <10cm -> blocked min_safe_distance_violation, servo stayed at 0', [s3], { servo_stayed_still: true });
      else console.log('场景3未同时满足审计+人工观察，未保存证据。提示：手要保持在 10cm 以内不动。');
    }
  }

  // ---------- 场景 4 ----------
  if (wants(4)) {
    console.log('\n───── 场景 4：传感器失联，默认拦截 ─────');
    if (await parkAtZero('先把传感器接好（上一场景拔过线的插回去）')) {
      await pressEnter('【场景4】现在拔掉传感器的 VCC 线（红色那根，从红色电源条上拔出）。舵机必须全程停在 0°');
      const run = runScenario('4');
      const s4 = findEntry(run.audit, (e) => String(e?.message ?? '').includes('sensor_missing'));
      const s4ok = Boolean(s4 && s4.hardwareSignalSent === false);
      console.log(`\n判定：场景4 审计=${s4ok ? '通过（传感器失联默认拦截，零信号）' : '未通过（没有出现 sensor_missing 拦截）'}`);
      const stayed = await confirmYesNo('舵机是不是全程停在 0° 没动？');
      if (s4ok && !stayed) p0Abort('传感器失联被标记为拦截，但舵机动了');
      if (s4ok && stayed) saveEvidence(4, 'sensor unplugged -> blocked sensor_missing, servo stayed at 0', [s4], { servo_stayed_still: true });
      else console.log('场景4未同时满足审计+人工观察，未保存证据。');
      console.log('\n>>> 把传感器 VCC 线插回红色电源条。');
    }
  }

  const count = fs.existsSync(EVIDENCE_DIR) ? fs.readdirSync(EVIDENCE_DIR).filter((n) => n.endsWith('.json')).length : 0;
  console.log(`\n=== 完成：证据 ${count}/4 ===`);
  if (count >= 4) {
    console.log('四场景证据齐全，桌面版 REAL HARDWARE 面板的真机执行已解锁（仍需每次人工勾选确认）。');
  } else {
    console.log('未凑齐 4 份。缺哪个场景就用 --only 补哪个，例如：npm run hardware:acceptance -- --port ' + port + ' --only 1');
  }
  cleanup();
  rl.close();
}

main().catch((error) => {
  console.error(`向导异常退出：${error instanceof Error ? error.message : String(error)}`);
  cleanup();
  rl.close();
  process.exit(1);
});
