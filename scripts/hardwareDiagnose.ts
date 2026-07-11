/**
 * Read-only ESP32 + ultrasonic sensor diagnostic. Never actuates the servo
 * (all commands here are read-only; the transport itself refuses actuation
 * frames outside the execution gate — audit 1.1).
 *
 * NOTE: the `serial_ttl` branch below targets an experimental IOE-SR05
 * firmware variant that is NOT checked into this repo (only the pulse_width
 * HC-SR04 firmware is). Keep the branch until that variant lands or is
 * abandoned; the checked-in firmware always reports `pulse_width`.
 */
import { SerialEsp32Transport, createNodeSerialPort } from '../lib/hardware';
import type { TransportResponse } from '../lib/hardware';

function argValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function numberField(record: Record<string, unknown> | undefined, key: string): number | undefined {
  const value = record?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function describeOpenError(port: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (/access denied/i.test(message)) {
    return `无法打开 ${port}：端口被其他程序占用。关闭串口监视器和其他硬件进程后重试。`;
  }
  if (/cannot find|not found|file not found/i.test(message)) {
    return `找不到 ${port}：检查设备管理器中的实际运行串口。`;
  }
  return `无法打开 ${port}：${message}`;
}

interface SampleResult {
  ok: boolean;
  distanceCm?: number;
  deviceMs?: number;
  detail?: string;
  elapsedMs: number;
}

async function main() {
  const portPath = argValue('--port');
  if (!portPath) {
    console.error('缺少 --port，例如：npm run hardware:diagnose -- --port COM3');
    process.exitCode = 1;
    return;
  }
  const baudRate = Number(argValue('--baud') ?? 115200);
  const requestedSamples = Number(argValue('--samples') ?? 8);
  const loopbackMode = process.argv.includes('--loopback');
  if (!Number.isInteger(baudRate) || baudRate <= 0) throw new Error(`无效波特率：${baudRate}`);
  if (!Number.isInteger(requestedSamples) || requestedSamples < 3 || requestedSamples > 50) {
    throw new Error('--samples 必须是 3 到 50 之间的整数');
  }

  console.log('=== RealityWarden 只读硬件诊断（不会驱动舵机） ===');
  console.log(`[1/4] 打开 ${portPath} @ ${baudRate}...`);
  const transport = new SerialEsp32Transport(createNodeSerialPort(portPath, baudRate), { requestTimeoutMs: 3000 });
  try {
    await transport.connect();
  } catch (error) {
    console.error(`FAIL  ${describeOpenError(portPath, error)}`);
    process.exitCode = 1;
    return;
  }

  try {
    console.log('PASS  串口已打开；等待 ESP32 启动...');
    await sleep(1200);

    if (loopbackMode) {
      console.log('[2/2] 执行 GPIO5 → GPIO4 同步回环测试...');
      const response = await transport.send({ id: `loopback-${Date.now()}`, cmd: 'diagnose_gpio_loopback' });
      if (!response.ok) {
        console.log(`FAIL  回环命令失败：${response.detail ?? 'unknown failure'}`);
        process.exitCode = 1;
        return;
      }
      const passed = response.data?.loopbackPassed === true;
      console.log(`INFO  GPIO5低时GPIO4=${String(response.data?.echoWhileLow)}，GPIO5高时GPIO4=${String(response.data?.echoWhileHigh)}，恢复低后GPIO4=${String(response.data?.echoAfterLow)}`);
      console.log(passed
        ? 'PASS  GPIO5、GPIO4、杜邦线和面包板连接正常。'
        : 'FAIL  GPIO回环未跟随 0→1→0；检查引脚和面包板导通行。');
      process.exitCode = passed ? 0 : 1;
      return;
    }

    console.log('[2/4] 检查诊断固件和传感器接口...');
    let firmwareDiagnostic: TransportResponse | null = null;
    let sensorLabel = '超声波传感器';
    try {
      firmwareDiagnostic = await transport.send({ id: `diag-${Date.now()}`, cmd: 'diagnose_hardware' });
      if (firmwareDiagnostic.ok) {
        const data = firmwareDiagnostic.data;
        console.log(`PASS  固件=${String(data?.firmware ?? 'unknown')}，协议=${String(data?.protocolVersion ?? 'unknown')}`);
        if (data?.sensorInterface === 'serial_ttl') {
          sensorLabel = String(data.sensorModel ?? 'IOE-SR05');
          console.log(`INFO  传感器=${sensorLabel}，接口=TTL串口 ${String(data.sensorBaud)} 8N1`);
          console.log(`INFO  EN=GPIO${String(data.enablePin)}，TXD→RX=GPIO${String(data.sensorRxPin)}，有效帧=${String(data.successfulFrames)}/3，校验错误=${String(data.checksumErrors)}`);
          if (numberField(data, 'successfulFrames') && numberField(data, 'lastDistanceMm') !== undefined) {
            console.log(`INFO  固件自检最后距离=${String(data.lastDistanceMm)} mm`);
          }
        } else if (data?.sensorInterface === 'pulse_width') {
          sensorLabel = String(data.sensorModel ?? 'HC-SR04-compatible');
          console.log(`INFO  传感器=${sensorLabel}，接口=Trig/Echo 脉宽`);
          console.log(`INFO  Trig=GPIO${String(data.trigPin)}，Echo=GPIO${String(data.echoPin)}，Echo空闲=${String(data.echoIdleLevel)}，有效回波=${String(data.successfulEchoes)}/3`);
          if (numberField(data, 'lastDistanceCm') !== undefined) {
            console.log(`INFO  固件自检最后距离=${String(data.lastDistanceCm)} cm`);
          }
        } else {
          console.log('WARN  固件未声明可识别的传感器接口。');
        }
      } else {
        console.log(`WARN  固件诊断返回失败：${firmwareDiagnostic.detail ?? 'unknown failure'}`);
      }
    } catch (error) {
      console.log(`WARN  诊断命令无响应：${error instanceof Error ? error.message : String(error)}`);
    }

    console.log(`[3/4] 连续读取 ${sensorLabel}（${requestedSamples} 次）...`);
    const samples: SampleResult[] = [];
    for (let index = 1; index <= requestedSamples; index += 1) {
      const started = Date.now();
      try {
        const response = await transport.send({ id: `sensor-${Date.now()}-${index}`, cmd: 'read_distance' });
        const distanceCm = numberField(response.data, 'distanceCm');
        const deviceMs = numberField(response.data, 'deviceMs');
        const sample: SampleResult = {
          ok: response.ok && distanceCm !== undefined,
          distanceCm,
          deviceMs,
          detail: response.ok && distanceCm === undefined ? '缺少 data.distanceCm' : response.detail,
          elapsedMs: Date.now() - started
        };
        samples.push(sample);
        console.log(sample.ok
          ? `  #${index} PASS ${distanceCm?.toFixed(1)} cm deviceMs=${deviceMs ?? 'missing'} (${sample.elapsedMs}ms)`
          : `  #${index} FAIL ${sample.detail ?? 'unknown failure'} (${sample.elapsedMs}ms)`);
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        samples.push({ ok: false, detail, elapsedMs: Date.now() - started });
        console.log(`  #${index} FAIL ${detail}`);
      }
      await sleep(100);
    }

    console.log('[4/4] 诊断结论');
    const good = samples.filter((sample) => sample.ok);
    if (good.length > 0) {
      const distances = good.map((sample) => sample.distanceCm as number);
      console.log(`PASS  ${sensorLabel} 有效读数 ${good.length}/${samples.length}，范围 ${Math.min(...distances).toFixed(1)}–${Math.max(...distances).toFixed(1)} cm。`);
      if (good.some((sample) => sample.deviceMs === undefined)) {
        console.log('FAIL  固件未返回 deviceMs；安全门仍会阻止舵机。');
        process.exitCode = 1;
      } else {
        console.log('PASS  串口传感器、帧校验和设备时钟正常，可用于安全门。');
      }
      return;
    }

    const details = samples.map((sample) => sample.detail ?? '').join(' | ');
    if (/failed checksum/i.test(details)) {
      console.log('FAIL  收到 IOE-SR05 数据但校验失败：检查 TXD 分压、共地和 9600 波特率信号质量。');
    } else if (/no echo pulse/i.test(details)) {
      console.log('FAIL  Trig 已发出，但 Echo 没有返回高电平脉冲。');
      console.log('      无分压电阻时仅可用3.3V供电并直连Echo→GPIO4；5V供电时禁止Echo直连ESP32。');
      console.log('      在探头正前方10–30cm放置平整硬板后复测。');
    } else if (/no IOE-SR05 serial frame/i.test(details)) {
      console.log('FAIL  未收到 IOE-SR05 的 4 字节串口帧。');
      console.log('      最简测试接线：VCC→3.3V，GND→共地，Trig/EN→GND，Echo/TXD→GPIO4（3.3V供电时可直连）。');
      console.log('      若使用5V供电，TXD必须经5V→3.3V分压后接GPIO4；模块应每18ms输出 FF+H+L+SUM。');
    } else if (/timeout/i.test(details)) {
      console.log('FAIL  ESP32 主协议无响应：检查 COM3、115200 波特率和固件运行状态。');
    } else {
      console.log(`FAIL  未获得有效距离；最后协议错误=${transport.getLastProtocolError() ?? 'none'}。`);
    }
    process.exitCode = 1;
  } finally {
    await transport.disconnect().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(`FAIL  ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
