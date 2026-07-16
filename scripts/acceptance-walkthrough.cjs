// Guided four-scenario acceptance walkthrough (operator-facing, Chinese).
//
// Usage: npm run hardware:acceptance -- --port COM3
//
// Walks the operator through the P0 scenarios step by step: tells them what
// to place where, waits for Enter, runs the existing demo runner, parses the
// audit export, verdicts each scenario, asks the operator to confirm what the
// servo physically did, and saves evidence JSON into docs/acceptance/evidence/
// (the real-execution unlock directory).
//
// Honesty rules:
// - Evidence is only written when BOTH the audit log and the operator's
//   physical observation match the expected outcome. Nothing is fabricated.
// - "blocked but the servo moved" aborts immediately as a P0 incident.
// - This wrapper adds no execution path: it shells out to the same demo
//   runner an operator would run by hand.
'use strict';

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');

const ROOT = path.resolve(__dirname, '..');
const EVIDENCE_DIR = path.join(ROOT, 'docs', 'acceptance', 'evidence');
const AUDIT_MARKER = '=== Audit log export';

function argValue(flag) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function extractAuditEntries(output) {
  const markerIndex = output.lastIndexOf(AUDIT_MARKER);
  if (markerIndex < 0) return null;
  const bracketIndex = output.indexOf('[', markerIndex);
  if (bracketIndex < 0) return null;
  // The audit export is the last JSON array in the output; parse greedily
  // from the first bracket after the marker to the matching close.
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
const onlyArg = argValue('--only');
const selected = new Set((onlyArg ?? '1,2,3,4').split(',').map((v) => v.trim()));
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

function runDemo(scenarioArgs) {
  console.log('\n运行中（含编译，约 1 分钟，请勿动接线）...');
  const result = spawnSync(process.execPath, [
    path.join(ROOT, 'scripts', 'run-real-hardware-demo.cjs'),
    '--port', port,
    ...scenarioArgs
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
  process.exit(2);
}

async function main() {
  console.log('=== RealityWarden 四场景真机验收向导 ===');
  console.log(`端口：${port}（协议口；出问题先关掉所有串口监视器）`);
  console.log('前置：固件为脉宽版且诊断 8/8 PASS；舵机橙线→GPIO18；传感器工作正常。');

  // ---------- 场景 1 + 2 ----------
  if (wants(1) || wants(2)) {
  await pressEnter('【场景1+2】把书/硬板立在探头正前方 20~30cm 处（离开 10cm 安全线远一点）');
  const run12 = runDemo([]);
  if (!run12.audit) { console.error('未能解析审计日志，检查上面的输出。'); process.exit(1); }

  const s1 = findEntry(run12.audit, (e) => e?.data?.args?.angle === 45);
  const s2 = findEntry(run12.audit, (e) => e?.data?.args?.angle === 200);
  const s1ok = Boolean(s1 && s1.hardwareSignalSent === true && !String(s1.code).includes('blocked'));
  const s2ok = Boolean(s2 && s2.hardwareSignalSent === false && String(s2.message ?? '').includes('angle_out_of_range'));

  console.log(`\n判定：场景1（45°）审计=${s1ok ? '通过（已执行且确认送达）' : '未通过'}；场景2（200°）审计=${s2ok ? '通过（已拦截，零信号）' : '未通过'}`);
  const servoMoved = await confirmYesNo('你亲眼看到舵机在场景1时转动了吗？');
  const servoStayedFor200 = await confirmYesNo('200° 指令时舵机是不是纹丝不动？');
  if (s2ok && !servoStayedFor200) p0Abort('200° 被审计标记为拦截，但舵机动了');
  if (s1ok && servoMoved) saveEvidence(1, 'move_to_angle 45 -> executed, servo moved (operator confirmed)', [s1], { servo_moved: true });
  else console.log('场景1未同时满足审计+人工观察，未保存证据。');
  if (s2ok && servoStayedFor200) saveEvidence(2, 'move_to_angle 200 -> blocked angle_out_of_range, servo still', [s2], { servo_stayed_still: true });
  else console.log('场景2未同时满足审计+人工观察，未保存证据。');
  }

  // ---------- 场景 3 ----------
  if (wants(3)) {
  await pressEnter('【场景3】用手掌或书挡在探头正前方【不到 10cm】的位置，并保持不动');
  const run3 = runDemo(['--scenario', '3']);
  const s3 = findEntry(run3.audit, (e) => String(e?.message ?? '').includes('min_safe_distance'));
  const s3ok = Boolean(s3 && s3.hardwareSignalSent === false);
  console.log(`\n判定：场景3 审计=${s3ok ? '通过（距离互锁拦截，零信号）' : '未通过（没有出现 min_safe_distance 拦截）'}`);
  const servoStayed3 = await confirmYesNo('场景3全程舵机是不是纹丝不动？');
  if (s3ok && !servoStayed3) p0Abort('距离互锁被标记为拦截，但舵机动了');
  if (s3ok && servoStayed3) saveEvidence(3, 'obstacle <10cm -> blocked min_safe_distance_violation, servo still', [s3], { servo_stayed_still: true });
  else console.log('场景3未同时满足审计+人工观察，未保存证据。提示：手要保持在 10cm 以内不动，重跑本向导可重试。');
  }

  // ---------- 场景 4 ----------
  if (wants(4)) {
  await pressEnter('【场景4】拔掉传感器的 VCC 线（红色那根，从红色电源条上拔出即可）');
  const run4 = runDemo(['--scenario', '4']);
  const s4 = findEntry(run4.audit, (e) => String(e?.message ?? '').includes('sensor_missing'));
  const s4ok = Boolean(s4 && s4.hardwareSignalSent === false);
  console.log(`\n判定：场景4 审计=${s4ok ? '通过（传感器失联默认拦截，零信号）' : '未通过（没有出现 sensor_missing 拦截）'}`);
  const servoStayed4 = await confirmYesNo('场景4全程舵机是不是纹丝不动？');
  if (s4ok && !servoStayed4) p0Abort('传感器失联被标记为拦截，但舵机动了');
  if (s4ok && servoStayed4) saveEvidence(4, 'sensor unplugged -> blocked sensor_missing, servo still', [s4], { servo_stayed_still: true });
  else console.log('场景4未同时满足审计+人工观察，未保存证据。');

  console.log('\n>>> 把传感器 VCC 线插回红色电源条。');
  }

  const count = fs.existsSync(EVIDENCE_DIR) ? fs.readdirSync(EVIDENCE_DIR).filter((n) => n.endsWith('.json')).length : 0;
  console.log(`\n=== 完成：证据 ${count}/4 ===`);
  if (count >= 4) {
    console.log('四场景证据齐全，桌面版 REAL HARDWARE 面板的真机执行已解锁（仍需每次人工勾选确认）。');
  } else {
    console.log('未凑齐 4 份。缺哪个场景就重跑本向导补哪个（已保存的会被同日期文件覆盖更新）。');
  }
  rl.close();
}

main().catch((error) => {
  console.error(`向导异常退出：${error instanceof Error ? error.message : String(error)}`);
  rl.close();
  process.exit(1);
});
