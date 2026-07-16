/**
 * Authoritative resolver for the built-in desktop flasher.
 *
 * Only an image registered by FirmwareWriteOrder may cross this boundary.
 * The image, its mandatory companion digest, and (when supplied) the reviewed
 * write order must all agree. Callers receive the exact bytes that were
 * hashed, avoiding a validate-then-reread gap before flashing.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { basename, isAbsolute, join, normalize, relative, resolve } from 'node:path';
import { PREBUILT_FIRMWARE_IMAGES, validateFirmwareWriteOrder } from './FirmwareWriteOrder';

const DEFAULT_TEMPLATE = 'esp32_s3_sg90_hc_sr04_v1' as const;
const DEFAULT_IMAGE = PREBUILT_FIRMWARE_IMAGES[DEFAULT_TEMPLATE];

export type GovernedFirmwareRequest =
  | { source: 'reviewed_prebuilt'; imageFile?: unknown }
  | { source: 'write_order'; order: unknown; imageFile?: unknown };

export type GovernedFirmwarePlan = {
  file: string;
  sha256: string;
  version: string;
  sensorInterface: 'pulse_width';
  address: 0;
  byteLength: number;
  bytes: Uint8Array;
};

export type GovernedFirmwareResult =
  | { ok: true; plan: GovernedFirmwarePlan }
  | { ok: false; code: string; detail: string };

function refusal(code: string, detail: string): GovernedFirmwareResult {
  return { ok: false, code, detail };
}

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function resolveInsideRoot(rootDir: string, repoRelativePath: string): string | null {
  if (isAbsolute(repoRelativePath)) return null;
  const root = resolve(rootDir);
  const absolute = resolve(root, normalize(repoRelativePath));
  const back = relative(root, absolute);
  return back.length > 0 && !back.startsWith('..') && !isAbsolute(back) ? absolute : null;
}

function parseCompanion(text: string, expectedFileName: string): string | null {
  const match = text.trim().match(/^([a-f0-9]{64})\s+\*?([^\s]+)$/);
  if (!match || basename(match[2]) !== expectedFileName) return null;
  return match[1];
}

export function governedFirmwareAvailability(sensorInterface: string | null | undefined) {
  if (sensorInterface === 'serial_ttl') {
    return {
      available: false as const,
      reason: '该配置暂无已审镜像 / No reviewed image is available for serial_ttl. Live compilation is not used as a fallback.'
    };
  }
  return { available: true as const };
}

export function resolveGovernedFirmwareImage(
  raw: unknown,
  rootDir: string
): GovernedFirmwareResult {
  if (!raw || typeof raw !== 'object') return refusal('invalid_request', 'firmware request must be an object');
  const request = raw as Partial<GovernedFirmwareRequest> & { imageFile?: unknown; order?: unknown };
  if (request.source !== 'reviewed_prebuilt' && request.source !== 'write_order') {
    return refusal('invalid_source', 'only reviewed_prebuilt or write_order inputs are accepted');
  }
  if (!DEFAULT_IMAGE) return refusal('image_unavailable', `no reviewed prebuilt image exists for ${DEFAULT_TEMPLATE}`);
  if (request.imageFile !== undefined && request.imageFile !== DEFAULT_IMAGE.file) {
    return refusal('unpaired_image_path', 'the requested image path is not the registered reviewed prebuilt image');
  }
  const absolute = resolveInsideRoot(rootDir, DEFAULT_IMAGE.file);
  if (!absolute) return refusal('image_path_rejected', 'reviewed image path escaped the application resource root');

  let bytes: Uint8Array;
  let companionText: string;
  try {
    bytes = readFileSync(absolute);
    companionText = readFileSync(`${absolute}.sha256`, 'utf8');
  } catch (error) {
    return refusal('paired_image_missing', `reviewed image and mandatory .sha256 companion are required: ${error instanceof Error ? error.message : String(error)}`);
  }
  const companionSha = parseCompanion(companionText, basename(DEFAULT_IMAGE.file));
  if (!companionSha) return refusal('companion_rejected', 'the .sha256 companion is malformed or names a different image');
  const actualSha = sha256(bytes);
  if (actualSha !== companionSha) {
    return refusal('image_sha256_mismatch', 'image sha256 does not match its mandatory companion; flashing refused');
  }

  if (request.source === 'write_order') {
    const checked = validateFirmwareWriteOrder(request.order, {
      image_file: DEFAULT_IMAGE.file,
      image_sha256: actualSha
    });
    if (!checked.ok) return refusal('write_order_rejected', checked.detail);
    if (checked.order.image.sha256 !== companionSha) {
      return refusal('three_way_sha256_mismatch', 'write order, companion, and image sha256 must all match');
    }
  } else if (Object.prototype.hasOwnProperty.call(request, 'order')) {
    return refusal('unexpected_write_order', 'a write order is only accepted with source=write_order');
  }

  const versionMatch = basename(DEFAULT_IMAGE.file).match(/-v([0-9]+(?:\.[0-9]+)+)\.merged\.bin$/);
  if (!versionMatch) return refusal('image_version_unknown', 'reviewed image filename does not contain a governed version');
  return {
    ok: true,
    plan: {
      file: DEFAULT_IMAGE.file,
      sha256: actualSha,
      version: versionMatch[1],
      sensorInterface: 'pulse_width',
      address: 0,
      byteLength: bytes.byteLength,
      bytes
    }
  };
}
