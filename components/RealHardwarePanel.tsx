'use client';

/**
 * REAL HARDWARE panel (v0.3, separately gated execution boundary).
 *
 * Scope is deliberately narrow and honest (invariant 6: simulation and
 * reality visibly distinct):
 * - explicit REAL HARDWARE identity, styled unlike any simulation panel
 * - serial connection wizard: list ports -> connect -> handshake
 * - read-only live distance from the HC-SR04 (read_distance capability)
 * - real actuation remains evidence-locked, operator-confirmed, and routed
 *   through the authoritative HardwareExecutionGate chain.
 *
 * Every state shown is real: no bridge (web build) says so, a failed
 * handshake says so, and "connected" appears only after the device answered
 * a read_distance request.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { adviceForFailure, interpretProbe } from '@/lib/hardware/SetupAdvisor';
import type { FirmwareIdentity, SetupAdvice } from '@/lib/hardware/SetupAdvisor';

export interface HardwareBridgeResult {
  ok: boolean;
  error?: string;
  distanceCm?: number;
  ports?: Array<{ path: string; label?: string }>;
}

export interface HardwareProbeResult {
  ok: boolean;
  error?: string;
  diagnoseOk?: boolean;
  diagnoseData?: Record<string, unknown>;
  diagnoseError?: string;
  legacyReadOk?: boolean;
  legacyDeviceMs?: boolean;
}

export interface HardwareAutoDetectResult {
  ok: boolean;
  error?: string;
  results?: Array<HardwareProbeResult & { path: string; label?: string }>;
}

export interface HardwareBridge {
  listPorts: () => Promise<HardwareBridgeResult>;
  connect: (portPath: string) => Promise<HardwareBridgeResult>;
  readDistance: () => Promise<HardwareBridgeResult>;
  disconnect: () => Promise<HardwareBridgeResult>;
  /** Optional (older desktop builds): read-only probe / auto-detect. */
  probe?: (portPath: string) => Promise<HardwareProbeResult>;
  autoDetect?: () => Promise<HardwareAutoDetectResult>;
  /** Real execution (product path): locked until acceptance evidence exists. */
  executionStatus?: () => Promise<HardwareExecutionLock>;
  execute?: (portPath: string, angle: number, confirm: boolean) => Promise<HardwareExecuteOutcome>;
}

export interface HardwareExecutionLock {
  locked: boolean;
  reason?: string;
  evidenceCount?: number;
}

export interface HardwareExecuteOutcome {
  ok: boolean;
  error?: string;
  status?: 'executed' | 'failed' | 'blocked';
  reason?: string;
  executionMode?: string;
  signalSent?: boolean;
  signalState?: 'not_sent' | 'attempted_unconfirmed' | 'device_acknowledged';
  executionEvidence?: 'not_executed' | 'delivery_unconfirmed' | 'device_rejected' | 'command_acknowledged_open_loop' | 'read_response';
  physicalOutcomeVerified?: boolean;
  detail?: string;
  distanceCm?: number;
  readErrors?: string[];
}

function bridge(): HardwareBridge | null {
  if (typeof window === 'undefined') return null;
  const host = window as unknown as { openReality?: { hardware?: HardwareBridge } };
  return host.openReality?.hardware ?? null;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

export function RealHardwarePanel({ language }: { language: 'zh' | 'en' }) {
  const zh = language === 'zh';
  const [expanded, setExpanded] = useState(false);
  const [ports, setPorts] = useState<Array<{ path: string; label?: string }>>([]);
  const [selectedPort, setSelectedPort] = useState('');
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [lastError, setLastError] = useState<string | null>(null);
  const [distanceCm, setDistanceCm] = useState<number | null>(null);
  const [listing, setListing] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [identity, setIdentity] = useState<FirmwareIdentity | null>(null);
  const [advice, setAdvice] = useState<SetupAdvice[]>([]);
  const [execLock, setExecLock] = useState<HardwareExecutionLock | null>(null);
  const [execAngle, setExecAngle] = useState('45');
  const [execConfirmed, setExecConfirmed] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [execOutcome, setExecOutcome] = useState<HardwareExecuteOutcome | null>(null);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollGeneration = useRef(0);
  const mounted = useRef(true);
  const available = bridge() !== null;

  const stopPolling = useCallback(() => {
    pollGeneration.current += 1;
    if (pollTimer.current !== null) {
      clearTimeout(pollTimer.current);
      pollTimer.current = null;
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      stopPolling();
      // The main process owns the serial handle. Closing it on unmount avoids
      // leaving the device locked when navigation destroys this panel.
      const api = bridge();
      if (api) void api.disconnect().catch(() => undefined);
    };
  }, [stopPolling]);

  const refreshPorts = useCallback(async () => {
    const api = bridge();
    if (!api) return;
    setListing(true);
    setLastError(null);
    try {
      const result = await api.listPorts();
      if (!mounted.current) return;
      if (result.ok && result.ports) {
        setPorts(result.ports);
        if (result.ports.length > 0 && !result.ports.some((port) => port.path === selectedPort)) {
          setSelectedPort(result.ports[0].path);
        }
      } else {
        setPorts([]);
        setLastError(result.error ?? 'list ports failed');
      }
    } catch (error) {
      if (mounted.current) {
        setPorts([]);
        setLastError(`list ports failed: ${errorMessage(error)}`);
      }
    } finally {
      if (mounted.current) setListing(false);
    }
  }, [selectedPort]);

  const disconnect = useCallback(async () => {
    stopPolling();
    setDistanceCm(null);
    setStatus('disconnected');
    const api = bridge();
    if (api) {
      try {
        const result = await api.disconnect();
        if (!result.ok && mounted.current) setLastError(result.error ?? 'disconnect failed');
      } catch (error) {
        if (mounted.current) setLastError(`disconnect failed: ${errorMessage(error)}`);
      }
    }
  }, [stopPolling]);

  const startPolling = useCallback(() => {
    stopPolling();
    const generation = pollGeneration.current;
    const poll = async () => {
      const api = bridge();
      if (!api || generation !== pollGeneration.current || !mounted.current) return;
      let reading: HardwareBridgeResult;
      try {
        reading = await api.readDistance();
      } catch (error) {
        reading = { ok: false, error: `read failed: ${errorMessage(error)}` };
      }
      if (generation !== pollGeneration.current || !mounted.current) return;
      if (reading.ok && typeof reading.distanceCm === 'number') {
        setDistanceCm(reading.distanceCm);
        setLastError(null);
      } else {
        // An unreadable sensor is shown as exactly that - never a stale value.
        setDistanceCm(null);
        setLastError(reading.error ?? (language === 'zh' ? '读取失败' : 'read failed'));
      }
      // Schedule only after the current read completes. setInterval allowed a
      // slow 3s request to overlap the next 2s poll and race stale UI updates.
      pollTimer.current = setTimeout(() => void poll(), 2000);
    };
    pollTimer.current = setTimeout(() => void poll(), 2000);
  }, [language, stopPolling]);

  const connect = useCallback(async (portOverride?: string) => {
    const target = portOverride ?? selectedPort;
    const api = bridge();
    if (!api || !target) return;
    setStatus('connecting');
    setLastError(null);
    setDistanceCm(null);
    let result: HardwareBridgeResult;
    try {
      result = await api.connect(target);
    } catch (error) {
      result = { ok: false, error: `connect failed: ${errorMessage(error)}` };
    }
    if (!mounted.current) return;
    if (result.ok) {
      setStatus('connected');
      if (typeof result.distanceCm === 'number') setDistanceCm(result.distanceCm);
      startPolling();
      const lockApi = bridge()?.executionStatus;
      if (lockApi) void lockApi().then((lock) => { if (mounted.current) setExecLock(lock); }).catch(() => undefined);
    } else {
      setStatus('disconnected');
      setLastError(result.error ?? (zh ? '连接失败' : 'connect failed'));
    }
  }, [selectedPort, startPolling, zh]);

  /** Zero-config path: scan every port, identify the firmware, connect. */
  const autoDetect = useCallback(async () => {
    const api = bridge();
    if (!api?.autoDetect) return;
    setDetecting(true);
    setLastError(null);
    setAdvice([]);
    setIdentity(null);
    try {
      const result = await api.autoDetect();
      if (!mounted.current) return;
      if (!result.ok || !result.results) {
        setLastError(result.error ?? 'auto-detect failed');
        setAdvice([adviceForFailure(result.error ?? 'auto-detect failed')]);
        return;
      }
      setPorts(result.results.map((entry) => ({ path: entry.path, label: entry.label })));
      const hit = result.results.find((entry) => entry.ok && entry.diagnoseOk)
        ?? result.results.find((entry) => entry.ok);
      if (!hit) {
        const firstError = result.results[0]?.error;
        setLastError(zh ? '未发现 RealityWarden 设备' : 'No RealityWarden device found');
        setAdvice([adviceForFailure(firstError ?? (result.results.length === 0 ? 'not found' : 'no valid response'))]);
        return;
      }
      const interpreted = interpretProbe({
        diagnoseOk: hit.diagnoseOk === true,
        diagnoseData: hit.diagnoseData,
        diagnoseError: hit.diagnoseError,
        legacyReadOk: hit.legacyReadOk,
        legacyDeviceMs: hit.legacyDeviceMs
      });
      setIdentity(interpreted.identity);
      setAdvice(interpreted.advice);
      setSelectedPort(hit.path);
      // Auto-connect unless the advisor found a blocker (e.g. no device clock:
      // the gate would refuse everything anyway - surface the fix first).
      if (interpreted.identity && !interpreted.advice.some((item) => item.severity === 'error')) {
        await connect(hit.path);
      }
    } catch (error) {
      if (mounted.current) {
        setLastError(errorMessage(error));
        setAdvice([adviceForFailure(errorMessage(error))]);
      }
    } finally {
      if (mounted.current) setDetecting(false);
    }
  }, [connect, zh]);



  /** REAL actuation through the compiled gate chain (main process). */
  const executeReal = useCallback(async () => {
    const api = bridge();
    if (!api?.execute || !selectedPort) return;
    const angle = Number(execAngle);
    setExecuting(true);
    setExecOutcome(null);
    stopPolling(); // main process closes our read connection during execution
    try {
      const outcome = await api.execute(selectedPort, angle, execConfirmed);
      if (mounted.current) setExecOutcome(outcome);
    } catch (error) {
      if (mounted.current) setExecOutcome({ ok: false, error: errorMessage(error) });
    } finally {
      if (mounted.current) {
        setExecuting(false);
        setStatus('disconnected'); // port was handed to the execution chain
        setDistanceCm(null);
      }
    }
  }, [execAngle, execConfirmed, selectedPort, stopPolling]);

  // Advice shown to the operator: structured probe advice wins; otherwise the
  // last raw error is classified on the fly so no failure is ever unexplained.
  const shownAdvice: SetupAdvice[] = advice.length > 0
    ? advice
    : lastError
      ? [adviceForFailure(lastError)]
      : [];

  const statusText = !available
    ? (zh ? '不可用（仅桌面版）' : 'unavailable (desktop app only)')
    : status === 'connected'
      ? (zh ? `已连接 ${selectedPort}` : `connected ${selectedPort}`)
      : status === 'connecting'
        ? (zh ? '连接中…' : 'connecting…')
        : (zh ? '未连接' : 'not connected');
  const dotClass = status === 'connected'
    ? 'bg-status-executed'
    : status === 'connecting'
      ? 'bg-status-warning'
      : 'bg-[#5F6670]';

  return (
    <div className="shrink-0 border-t-2 border-status-warning-edge bg-[#171310]">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="flex h-8 w-full items-center gap-2 px-3 text-left"
        title={zh
          ? '独立的真实硬件边界；执行受证据锁、人工确认和安全门控制。'
          : 'Independent real-hardware boundary; execution requires the evidence lock, operator confirmation, and safety gate.'}
      >
        <span className="rounded-[3px] border border-status-warning-edge bg-status-warning-surface px-1.5 text-[11px] font-bold uppercase tracking-wide text-status-warning">
          REAL HARDWARE
        </span>
        <span className={`inline-block h-2 w-2 rounded-full ${dotClass}`} />
        <span className="min-w-0 flex-1 truncate text-[11px] text-text-secondary">{statusText}</span>
        <span className="text-[11px] font-bold text-text-secondary">{expanded ? 'v' : '^'}</span>
      </button>
      {expanded && (
        <div className="flex flex-col gap-2 border-t border-[#3a2f1d] px-3 py-2 text-[12px]">
          {!available ? (
            <div className="text-text-secondary">
              {zh
                ? '真实硬件桥接仅在桌面版（Electron）中可用。当前为网页模式，所有运行均为仿真，未向任何硬件发送信号。'
                : 'The real-hardware bridge is only available in the desktop (Electron) build. This is web mode: every run is simulated and no signal reaches any hardware.'}
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <select
                  value={selectedPort}
                  onChange={(event) => setSelectedPort(event.target.value)}
                  disabled={status !== 'disconnected'}
                  className="h-7 min-w-0 flex-1 rounded-[3px] border border-border-panel bg-[#0B0C0E] px-1 text-[12px] text-text-primary"
                >
                  {ports.length === 0 && <option value="">{zh ? '（无串口，先点刷新）' : '(no ports - refresh first)'}</option>}
                  {ports.map((port) => (
                    <option key={port.path} value={port.path}>
                      {port.path}{port.label ? ` — ${port.label}` : ''}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => void autoDetect()}
                  disabled={detecting || status !== 'disconnected' || !bridge()?.autoDetect}
                  title={zh
                    ? '扫描所有串口，自动识别 RealityWarden 固件并连接（只读探测，不会驱动舵机）。'
                    : 'Scan every serial port, identify RealityWarden firmware and connect (read-only probe, never actuates).'}
                  className="h-7 rounded-[3px] border border-status-warning-edge px-2 text-[12px] font-semibold text-status-warning hover:bg-status-warning-surface disabled:opacity-40"
                >
                  {detecting ? (zh ? '检测中…' : 'Detecting…') : (zh ? '自动检测' : 'Auto-detect')}
                </button>
                <button
                  type="button"
                  onClick={() => void refreshPorts()}
                  disabled={listing || status !== 'disconnected'}
                  className="h-7 rounded-[3px] border border-border-panel px-2 text-[12px] text-text-secondary hover:bg-[#232736] disabled:opacity-40"
                >
                  {listing ? (zh ? '刷新中…' : 'listing…') : (zh ? '刷新' : 'Refresh')}
                </button>
                {status === 'connected' ? (
                  <button
                    type="button"
                    onClick={() => void disconnect()}
                    className="h-7 rounded-[3px] border border-[#5A2B2B] px-2 text-[12px] text-[#F87171] hover:bg-[#2A1111]"
                  >
                    {zh ? '断开' : 'Disconnect'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void connect()}
                    disabled={!selectedPort || status === 'connecting'}
                    className="h-7 rounded-[3px] border border-status-warning-edge px-2 text-[12px] text-status-warning hover:bg-status-warning-surface disabled:opacity-40"
                  >
                    {status === 'connecting' ? (zh ? '连接中…' : 'Connecting…') : (zh ? '连接' : 'Connect')}
                  </button>
                )}
              </div>
              <div className="flex items-center gap-3 font-mono text-[12px]">
                <span className="text-text-secondary">{zh ? '距离传感器' : 'distance sensor'}:</span>
                <span className={distanceCm === null ? 'text-text-secondary' : 'text-status-executed'}>
                  {status !== 'connected'
                    ? (zh ? '—（未连接）' : '- (not connected)')
                    : distanceCm === null
                      ? (zh ? '无读数' : 'no reading')
                      : `${distanceCm.toFixed(1)} cm`}
                </span>
              </div>
              {identity && (
                <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                  <span className="rounded-[3px] border border-[#075985] bg-[#0B2233] px-1.5 py-0.5 font-semibold text-[#38BDF8]">
                    {identity.legacy
                      ? (zh ? 'RealityWarden（旧版固件）' : 'RealityWarden (legacy firmware)')
                      : `RealityWarden v${identity.firmwareVersion ?? '?'}`}
                  </span>
                  {identity.sensorModel && (
                    <span className="rounded-[3px] border border-border-panel bg-[#232529] px-1.5 py-0.5 text-text-secondary">
                      {identity.sensorModel} · {identity.sensorInterface ?? '?'}
                    </span>
                  )}
                  <span className={`rounded-[3px] border px-1.5 py-0.5 font-semibold ${identity.reportsDeviceMs ? 'border-status-executed-edge text-status-executed-soft' : 'border-status-blocked-edge text-status-blocked-soft'}`}>
                    {identity.reportsDeviceMs
                      ? (zh ? '设备时钟正常' : 'device clock OK')
                      : (zh ? '缺设备时钟（会被安全门拦截）' : 'no device clock (gate will block)')}
                  </span>
                </div>
              )}
              {lastError && (
                <div className="break-all font-mono text-[11px] text-status-blocked-soft">{lastError}</div>
              )}
              {shownAdvice.length > 0 && (
                <div className="flex flex-col gap-1">
                  {shownAdvice.map((item) => (
                    <div
                      key={item.code}
                      className={`rounded-[3px] border px-2 py-1 text-[11px] leading-4 ${item.severity === 'ok' ? 'border-status-executed-edge bg-status-executed-surface text-status-executed-soft' : item.severity === 'warning' ? 'border-status-warning-edge bg-status-warning-surface text-status-warning' : 'border-status-blocked-edge bg-status-blocked-surface text-status-blocked-soft'}`}
                    >
                      {zh ? item.zh : item.en}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
          {status === 'connected' && bridge()?.execute && (
            <div className="flex flex-col gap-1.5 border-t border-[#3a2f1d] pt-2">
              <div className="flex items-center gap-2">
                <span className="rounded-[3px] border border-status-blocked-edge bg-status-blocked-surface px-1.5 text-[11px] font-bold uppercase tracking-wide text-status-blocked-soft">
                  {zh ? '真机执行' : 'REAL EXECUTION'}
                </span>
                {execLock?.locked === false ? (
                  <span className="text-[11px] text-status-executed-soft">{zh ? `已解锁（验收证据 ${execLock.evidenceCount ?? 0}/4）` : `unlocked (evidence ${execLock.evidenceCount ?? 0}/4)`}</span>
                ) : (
                  <span className="text-[11px] text-status-warning">{zh ? `锁定中（验收证据 ${execLock?.evidenceCount ?? 0}/4）` : `locked (evidence ${execLock?.evidenceCount ?? 0}/4)`}</span>
                )}
              </div>
              {execLock?.locked !== false ? (
                <div className="rounded-[3px] border border-status-warning-edge bg-status-warning-surface px-2 py-1 text-[11px] leading-4 text-status-warning">
                  {zh
                    ? '完成四场景验收并把 4 份审计 JSON 存入 docs/acceptance/evidence/ 后自动解锁（操作卡：docs/acceptance/OPERATOR_CARD.md）。'
                    : 'Unlocks automatically once the four acceptance audit JSON files exist in docs/acceptance/evidence/ (see docs/acceptance/OPERATOR_CARD.md).'}
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-text-secondary">{zh ? '目标角度' : 'target angle'}</span>
                    <input
                      value={execAngle}
                      onChange={(event) => setExecAngle(event.target.value)}
                      inputMode="numeric"
                      className="h-7 w-16 rounded-[3px] border border-border-panel bg-[#0B0C0E] px-2 text-[12px] text-text-primary"
                    />
                    <span className="text-[11px] text-text-secondary">0–180°</span>
                    <button
                      type="button"
                      onClick={() => void executeReal()}
                      disabled={executing || !execConfirmed}
                      className="h-7 rounded-[3px] border border-status-blocked-edge px-2 text-[12px] font-semibold text-status-blocked-soft hover:bg-status-blocked-surface disabled:opacity-40"
                    >
                      {executing ? (zh ? '执行中…' : 'Executing…') : (zh ? '通过安全门执行' : 'Execute via gate')}
                    </button>
                  </div>
                  <label className="flex items-center gap-1.5 text-[11px] text-text-secondary">
                    <input type="checkbox" checked={execConfirmed} onChange={(event) => setExecConfirmed(event.target.checked)} />
                    {zh ? '我确认设备周围无人且可以安全动作' : 'I confirm the rig area is clear and safe to move'}
                  </label>
                  <div className="text-[11px] leading-4 text-text-muted">
                    {zh
                      ? '执行走完整安全链：传感器采样→中值→互锁→安全门。缺读数/过近/越界都会被拦截并如实审计。'
                      : 'Execution runs the full safety chain: sensor sampling, median, interlock, gate. Missing data / close obstacle / out-of-range all block, honestly audited.'}
                  </div>
                </>
              )}
              {execOutcome && (
                <div className={`rounded-[3px] border px-2 py-1 font-mono text-[11px] leading-4 ${execOutcome.status === 'executed' ? 'border-status-executed-edge bg-status-executed-surface text-status-executed-soft' : 'border-status-blocked-edge bg-status-blocked-surface text-status-blocked-soft'}`}>
                  <div>
                    [{execOutcome.executionMode ?? 'real_hardware'}] {execOutcome.status ?? 'error'}
                    {typeof execOutcome.signalSent === 'boolean' ? ` · hardwareSignalSent=${String(execOutcome.signalSent)}` : ''}
                    {execOutcome.signalState ? ` · ${execOutcome.signalState}` : ''}
                    {typeof execOutcome.distanceCm === 'number' ? ` · ${execOutcome.distanceCm.toFixed(1)} cm` : ''}
                  </div>
                  <div className="break-all">{execOutcome.reason ?? execOutcome.error ?? execOutcome.detail}</div>
                  {execOutcome.executionEvidence === 'command_acknowledged_open_loop' && (
                    <div className="mt-1 border-t border-status-executed-edge pt-1 font-sans font-semibold">
                      {zh
                        ? '设备已确认命令；SG90 为开环舵机，物理角度/到位状态未经反馈验证。'
                        : 'Device acknowledged the command; the open-loop SG90 provides no feedback proving physical angle or arrival.'}
                    </div>
                  )}
                  {execOutcome.signalState === 'attempted_unconfirmed' && (
                    <div className="mt-1 border-t border-status-blocked-edge pt-1 font-sans font-semibold">
                      {zh
                        ? '主机已尝试发送，但设备未确认交付；不得视为未动作，也不得视为执行成功。'
                        : 'Host transmission was attempted but delivery was not acknowledged; treat this as neither known-safe non-motion nor successful execution.'}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          <div className="border-t border-[#3a2f1d] pt-1.5 text-[11px] text-text-secondary">
            {zh
              ? 'AI Command Terminal 默认运行仿真；真实执行只存在于此独立危险边界，并受证据锁、逐次人工确认与完整安全门控制。'
              : 'AI Command Terminal runs simulation by default. Real actuation exists only inside this independent danger boundary with evidence lock, per-run confirmation, and the full safety gate.'}
          </div>
        </div>
      )}
    </div>
  );
}
