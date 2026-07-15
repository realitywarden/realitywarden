import fs from 'node:fs/promises';

const MAX_LOG_BYTES = 128 * 1024;
const MAX_LOG_LINES = 200;
const MAX_LINE_LENGTH = 1000;

export interface DiagnosticBundleContext {
  appVersion: string;
  electronVersion: string;
  chromeVersion: string;
  nodeVersion: string;
  platform: NodeJS.Platform;
  arch: string;
  osRelease: string;
  packaged: boolean;
  locale: string;
  logPath: string;
  redactionRoots: string[];
  generatedAt?: string;
}

export interface RealityWardenDiagnosticBundle {
  schema: 'realitywarden.desktop-diagnostics';
  schema_version: 1;
  generated_at: string;
  release_channel: 'Public Alpha';
  application: {
    name: 'RealityWarden';
    version: string;
    packaged: boolean;
    locale: string;
  };
  runtime: {
    platform: NodeJS.Platform;
    arch: string;
    os_release: string;
    electron: string;
    chrome: string;
    node: string;
  };
  privacy: {
    local_only: true;
    uploaded: false;
    excluded: string[];
  };
  desktop_startup_log: {
    available: boolean;
    truncated: boolean;
    lines: string[];
  };
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function sanitizeDiagnosticLine(input: string, redactionRoots: string[]) {
  let line = input.replace(/[\r\n\0]/g, ' ');
  for (const root of redactionRoots.filter(Boolean).sort((a, b) => b.length - a.length)) {
    line = line.replace(new RegExp(escapeRegExp(root), 'gi'), '<redacted-path>');
  }
  line = line
    .replace(/\b(authorization|token|api[_-]?key|password|secret)\s*[:=]\s*(?:bearer\s+)?[^\s,;]+/gi, '$1=<redacted>')
    .replace(/([?&](?:token|api[_-]?key|key|secret)=)[^&\s]+/gi, '$1<redacted>')
    .replace(/\b[A-Za-z]:\\(?:[^\s<>:"|?*]+\\)*[^\s<>:"|?*]*/g, '<redacted-path>')
    .replace(/\/(?:Users|home)\/[^\s]+/gi, '<redacted-path>');
  return line.slice(0, MAX_LINE_LENGTH);
}

function isSupportLogLine(line: string) {
  return /\]\s(?:Starting Next server at|Recoverable startup failure:|Slow-start status update failed:|Startup failed:|Packaged first-run renderer smoke passed|Startup design acceptance passed:|Product design acceptance passed:)/.test(line);
}

async function readSupportLog(logPath: string, redactionRoots: string[]) {
  try {
    const handle = await fs.open(logPath, 'r');
    try {
      const stat = await handle.stat();
      const start = Math.max(0, stat.size - MAX_LOG_BYTES);
      const buffer = Buffer.alloc(stat.size - start);
      await handle.read(buffer, 0, buffer.length, start);
      const filtered = buffer.toString('utf8').split(/\r?\n/).filter(isSupportLogLine);
      const lines = filtered.slice(-MAX_LOG_LINES).map((line) => sanitizeDiagnosticLine(line, redactionRoots));
      return { available: true, truncated: start > 0 || filtered.length > MAX_LOG_LINES, lines };
    } finally {
      await handle.close();
    }
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
    if (code === 'ENOENT') return { available: false, truncated: false, lines: [] };
    return {
      available: false,
      truncated: false,
      lines: [`Log unavailable (${sanitizeDiagnosticLine(code || 'read_error', redactionRoots)}).`]
    };
  }
}

export async function buildDiagnosticBundle(context: DiagnosticBundleContext): Promise<RealityWardenDiagnosticBundle> {
  return {
    schema: 'realitywarden.desktop-diagnostics',
    schema_version: 1,
    generated_at: context.generatedAt ?? new Date().toISOString(),
    release_channel: 'Public Alpha',
    application: {
      name: 'RealityWarden',
      version: context.appVersion,
      packaged: context.packaged,
      locale: context.locale
    },
    runtime: {
      platform: context.platform,
      arch: context.arch,
      os_release: context.osRelease,
      electron: context.electronVersion,
      chrome: context.chromeVersion,
      node: context.nodeVersion
    },
    privacy: {
      local_only: true,
      uploaded: false,
      excluded: [
        'project contents and imported assets',
        'AI prompts and generated commands',
        'audit evidence and hardware results',
        'serial-port inventory',
        'environment variables and credentials'
      ]
    },
    desktop_startup_log: await readSupportLog(context.logPath, context.redactionRoots)
  };
}
