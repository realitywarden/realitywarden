'use client';

/**
 * REAL HARDWARE panel (v0.3, connection-only).
 *
 * Scope is deliberately narrow and honest (invariant 6: simulation and
 * reality visibly distinct):
 * - explicit REAL HARDWARE identity, styled unlike any simulation panel
 * - serial connection wizard: list ports -> connect -> handshake
 * - read-only live distance from the HC-SR04 (read_distance capability)
 * - NO execution path: runs in this build stay simulation-only; wiring real
 *   actuation into the UI is gated on the four-scenario device acceptance.
 *
 * Every state shown is real: no bridge (web build) says so, a failed
 * handshake says so, and "connected" appears only after the device answered
 * a read_distance request.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export interface HardwareBridgeResult {
  ok: boolean;
  error?: string;
  distanceCm?: number;
  ports?: Array<{ path: string; label?: string }>;
}

export interface HardwareBridge {
  listPorts: () => Promise<HardwareBridgeResult>;
  connect: (portPath: string) => Promise<HardwareBridgeResult>;
  readDistance: () => Promise<HardwareBridgeResult>;
  disconnect: () => Promise<HardwareBridgeResult>;
}

function bridge(): HardwareBridge | null {
  if (typeof window === 'undefined') return null;
  const host = window as unknown as { openReality?: { hardware?: HardwareBridge } };
  return host.openReality?.hardware ?? null;
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
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const available = bridge() !== null;

  const stopPolling = useCallback(() => {
    if (pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  const refreshPorts = useCallback(async () => {
    const api = bridge();
    if (!api) return;
    setListing(true);
    setLastError(null);
    try {
      const result = await api.listPorts();
      if (result.ok && result.ports) {
        setPorts(result.ports);
        if (result.ports.length > 0 && !result.ports.some((port) => port.path === selectedPort)) {
          setSelectedPort(result.ports[0].path);
        }
      } else {
        setPorts([]);
        setLastError(result.error ?? 'list ports failed');
      }
    } finally {
      setListing(false);
    }
  }, [selectedPort]);

  const disconnect = useCallback(async () => {
    stopPolling();
    setDistanceCm(null);
    setStatus('disconnected');
    const api = bridge();
    if (api) await api.disconnect();
  }, [stopPolling]);

  const startPolling = useCallback(() => {
    stopPolling();
    pollTimer.current = setInterval(async () => {
      const api = bridge();
      if (!api) return;
      const reading = await api.readDistance();
      if (reading.ok && typeof reading.distanceCm === 'number') {
        setDistanceCm(reading.distanceCm);
      } else {
        // An unreadable sensor is shown as exactly that - never a stale value.
        setDistanceCm(null);
        setLastError(reading.error ?? (language === 'zh' ? '读取失败' : 'read failed'));
      }
    }, 2000);
  }, [language, stopPolling]);

  const connect = useCallback(async () => {
    const api = bridge();
    if (!api || !selectedPort) return;
    setStatus('connecting');
    setLastError(null);
    setDistanceCm(null);
    const result = await api.connect(selectedPort);
    if (result.ok) {
      setStatus('connected');
      if (typeof result.distanceCm === 'number') setDistanceCm(result.distanceCm);
      startPolling();
    } else {
      setStatus('disconnected');
      setLastError(result.error ?? (zh ? '连接失败' : 'connect failed'));
    }
  }, [selectedPort, startPolling, zh]);

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
          ? '真实硬件连接面板。本构建的任务执行仍为仿真-only。'
          : 'Real hardware connection panel. Runs in this build stay simulation-only.'}
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
              {lastError && (
                <div className="break-all font-mono text-[11px] text-status-blocked-soft">{lastError}</div>
              )}
            </>
          )}
          <div className="border-t border-[#3a2f1d] pt-1.5 text-[11px] text-text-secondary">
            {zh
              ? '此面板仅做连接与只读距离。本构建的任务执行仍为仿真-only；真机执行在四场景验收通过后才会解锁。'
              : 'This panel is connection + read-only distance. Task execution in this build stays simulation-only; real actuation unlocks only after the four-scenario device acceptance.'}
          </div>
        </div>
      )}
    </div>
  );
}
