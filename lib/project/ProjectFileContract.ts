export const MAX_PROJECT_FILE_BYTES = 25 * 1024 * 1024;
export const PROJECT_FILE_TYPE = 'open_reality_desktop_project';
export const WORKSPACE_FILE_TYPE = 'open_reality_lab_workspace';

export type ProjectContractResult<T> =
  | { ok: true; value: T }
  | { ok: false; code: 'invalid_json' | 'invalid_schema' | 'file_too_large'; detail: string };

const deviceTypes = new Set([
  'robot_arm',
  'mobile_robot',
  'smart_light',
  'camera_sensor',
  'conveyor_belt',
  'plc_cabinet',
  'lab_instrument',
  'warehouse_rack',
  'sensor_box'
]);
const speedLimits = new Set(['slow', 'normal', 'fast']);
const forceLimits = new Set(['low', 'medium', 'high']);
const runResults = new Set(['pass', 'blocked', 'failed']);

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function schemaFailure(detail: string): ProjectContractResult<never> {
  return { ok: false, code: 'invalid_schema', detail };
}

function exactKeys(value: Record<string, unknown>, allowed: readonly string[], path: string) {
  const allowedSet = new Set(allowed);
  const unknown = Object.keys(value).find((key) => !allowedSet.has(key));
  return unknown ? `${path}.${unknown} is not allowed` : null;
}

function boundedString(value: unknown, path: string, maxLength = 500, allowEmpty = false) {
  if (typeof value !== 'string') return `${path} must be a string`;
  if (!allowEmpty && value.trim().length === 0) return `${path} must not be empty`;
  if (value.length > maxLength) return `${path} exceeds ${maxLength} characters`;
  return null;
}

function timestamp(value: unknown, path: string) {
  const stringError = boundedString(value, path, 64);
  if (stringError) return stringError;
  return Number.isFinite(Date.parse(value as string)) ? null : `${path} must be an ISO-compatible timestamp`;
}

function finiteTuple(value: unknown, path: string) {
  if (!Array.isArray(value) || value.length !== 3 || value.some((item) => typeof item !== 'number' || !Number.isFinite(item))) {
    return `${path} must be a three-number finite tuple`;
  }
  return null;
}

function jsonValue(value: unknown, path: string, depth = 0): string | null {
  if (depth > 24) return `${path} exceeds the maximum nesting depth`;
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? null : `${path} must not contain non-finite numbers`;
  if (Array.isArray(value)) {
    if (value.length > 10_000) return `${path} exceeds the maximum array length`;
    for (let index = 0; index < value.length; index += 1) {
      const error = jsonValue(value[index], `${path}[${index}]`, depth + 1);
      if (error) return error;
    }
    return null;
  }
  if (!record(value)) return `${path} contains a non-JSON value`;
  const keys = Object.keys(value);
  if (keys.length > 10_000) return `${path} exceeds the maximum object size`;
  for (const key of keys) {
    if (key === '__proto__' || key === 'prototype' || key === 'constructor') return `${path}.${key} is forbidden`;
    const error = jsonValue(value[key], `${path}.${key}`, depth + 1);
    if (error) return error;
  }
  return null;
}

function validateWorkspaceDevice(value: unknown, path: string): string | null {
  if (!record(value)) return `${path} must be an object`;
  const keyError = exactKeys(value, ['id', 'label', 'assetId', 'profileId', 'deviceType', 'slot', 'position', 'current_state', 'last_run_result', 'config'], path);
  if (keyError) return keyError;
  for (const field of ['id', 'label', 'profileId'] as const) {
    const error = boundedString(value[field], `${path}.${field}`, field === 'label' ? 500 : 200);
    if (error) return error;
  }
  if (value.assetId !== undefined) {
    const error = boundedString(value.assetId, `${path}.assetId`, 200);
    if (error) return error;
    if (value.profileId !== value.assetId) return `${path}.profileId must match assetId for asset-backed devices`;
  }
  if (typeof value.deviceType !== 'string' || !deviceTypes.has(value.deviceType)) return `${path}.deviceType is unsupported`;
  if (typeof value.slot !== 'number' || !Number.isInteger(value.slot) || value.slot < 0 || value.slot > 100_000) return `${path}.slot must be a non-negative integer`;
  if (value.position !== undefined) {
    const error = finiteTuple(value.position, `${path}.position`);
    if (error) return error;
  }
  if (value.current_state !== undefined) {
    if (!record(value.current_state)) return `${path}.current_state must be an object`;
    const error = jsonValue(value.current_state, `${path}.current_state`);
    if (error) return error;
  }
  if (value.last_run_result !== undefined && (typeof value.last_run_result !== 'string' || !runResults.has(value.last_run_result))) return `${path}.last_run_result is invalid`;
  if (!record(value.config)) return `${path}.config must be an object`;
  const configKeys = exactKeys(value.config, ['enabled', 'adapter_target_id', 'max_speed', 'force_limit', 'forbidden_zones'], `${path}.config`);
  if (configKeys) return configKeys;
  if (typeof value.config.enabled !== 'boolean') return `${path}.config.enabled must be boolean`;
  const adapterError = boundedString(value.config.adapter_target_id, `${path}.config.adapter_target_id`, 200);
  if (adapterError) return adapterError;
  if (typeof value.config.max_speed !== 'string' || !speedLimits.has(value.config.max_speed)) return `${path}.config.max_speed is invalid`;
  if (typeof value.config.force_limit !== 'string' || !forceLimits.has(value.config.force_limit)) return `${path}.config.force_limit is invalid`;
  if (!Array.isArray(value.config.forbidden_zones) || value.config.forbidden_zones.length > 100) return `${path}.config.forbidden_zones must be an array of at most 100 ids`;
  for (let index = 0; index < value.config.forbidden_zones.length; index += 1) {
    const error = boundedString(value.config.forbidden_zones[index], `${path}.config.forbidden_zones[${index}]`, 200);
    if (error) return error;
  }
  return null;
}

export function validateLabWorkspaceFile(value: unknown): ProjectContractResult<Record<string, unknown>> {
  if (!record(value)) return schemaFailure('workspace must be an object');
  const keyError = exactKeys(value, ['file_type', 'version', 'saved_at', 'language', 'selected_profile_id', 'selected_scenario_id', 'selected_workspace_device_id', 'prompt', 'devices', 'custom_actions', 'manual_imports'], 'workspace');
  if (keyError) return schemaFailure(keyError);
  if (value.file_type !== WORKSPACE_FILE_TYPE) return schemaFailure(`workspace.file_type must be ${WORKSPACE_FILE_TYPE}`);
  if (value.version !== 1) return schemaFailure('workspace.version must be 1');
  const savedAtError = timestamp(value.saved_at, 'workspace.saved_at');
  if (savedAtError) return schemaFailure(savedAtError);
  if (value.language !== 'zh' && value.language !== 'en') return schemaFailure('workspace.language must be zh or en');
  for (const field of ['selected_profile_id', 'selected_scenario_id'] as const) {
    const error = boundedString(value[field], `workspace.${field}`, 200);
    if (error) return schemaFailure(error);
  }
  if (value.selected_workspace_device_id !== null) {
    const error = boundedString(value.selected_workspace_device_id, 'workspace.selected_workspace_device_id', 200);
    if (error) return schemaFailure(error);
  }
  const promptError = boundedString(value.prompt, 'workspace.prompt', 20_000, true);
  if (promptError) return schemaFailure(promptError);
  if (!Array.isArray(value.devices) || value.devices.length > 500) return schemaFailure('workspace.devices must be an array of at most 500 devices');
  const deviceIds = new Set<string>();
  for (let index = 0; index < value.devices.length; index += 1) {
    const error = validateWorkspaceDevice(value.devices[index], `workspace.devices[${index}]`);
    if (error) return schemaFailure(error);
    const id = (value.devices[index] as Record<string, unknown>).id as string;
    if (deviceIds.has(id)) return schemaFailure(`workspace.devices contains duplicate id ${id}`);
    deviceIds.add(id);
  }
  if (value.selected_workspace_device_id !== null && !deviceIds.has(value.selected_workspace_device_id as string)) return schemaFailure('workspace.selected_workspace_device_id does not reference a workspace device');
  for (const field of ['custom_actions', 'manual_imports'] as const) {
    if (value[field] === undefined) continue;
    if (!Array.isArray(value[field]) || (value[field] as unknown[]).length > 1_000) return schemaFailure(`workspace.${field} must be an array of at most 1000 records`);
    const error = jsonValue(value[field], `workspace.${field}`);
    if (error) return schemaFailure(error);
  }
  return { ok: true, value };
}

function validateScenario(value: unknown, path: string) {
  if (!record(value)) return `${path} must be an object`;
  const keys = exactKeys(value, ['id', 'device_profile', 'prompt', 'expected_safety_result'], path);
  if (keys) return keys;
  for (const field of ['id', 'device_profile', 'expected_safety_result'] as const) {
    const error = boundedString(value[field], `${path}.${field}`, 200);
    if (error) return error;
  }
  return boundedString(value.prompt, `${path}.prompt`, 20_000, true);
}

function validateProfile(value: unknown, path: string) {
  if (!record(value)) return `${path} must be an object`;
  const keys = exactKeys(value, ['id', 'device_type', 'label'], path);
  if (keys) return keys;
  const idError = boundedString(value.id, `${path}.id`, 200);
  if (idError) return idError;
  if (typeof value.device_type !== 'string' || !deviceTypes.has(value.device_type)) return `${path}.device_type is unsupported`;
  return boundedString(value.label, `${path}.label`, 500);
}

export function validateOpenRealityProjectFile(value: unknown): ProjectContractResult<Record<string, unknown>> {
  if (!record(value)) return schemaFailure('project document must be an object');
  const keyError = exactKeys(value, ['project', 'devices', 'scenarios', 'profiles', 'workspace', 'lab_reports', 'metadata'], 'document');
  if (keyError) return schemaFailure(keyError);
  if (!record(value.project)) return schemaFailure('document.project must be an object');
  const projectKeys = exactKeys(value.project, ['name', 'file_type', 'version'], 'document.project');
  if (projectKeys) return schemaFailure(projectKeys);
  const nameError = boundedString(value.project.name, 'document.project.name', 200);
  if (nameError) return schemaFailure(nameError);
  if (value.project.file_type !== PROJECT_FILE_TYPE) return schemaFailure(`document.project.file_type must be ${PROJECT_FILE_TYPE}`);
  if (value.project.version !== 1) return schemaFailure('document.project.version must be 1');
  const workspace = validateLabWorkspaceFile(value.workspace);
  if (!workspace.ok) return workspace;
  if (!Array.isArray(value.devices) || value.devices.length > 500) return schemaFailure('document.devices must be an array of at most 500 devices');
  for (let index = 0; index < value.devices.length; index += 1) {
    const error = validateWorkspaceDevice(value.devices[index], `document.devices[${index}]`);
    if (error) return schemaFailure(error);
  }
  if (JSON.stringify(value.devices) !== JSON.stringify((value.workspace as Record<string, unknown>).devices)) return schemaFailure('document.devices must exactly match workspace.devices');
  if (!Array.isArray(value.scenarios) || value.scenarios.length > 2_000) return schemaFailure('document.scenarios must be an array of at most 2000 scenarios');
  for (let index = 0; index < value.scenarios.length; index += 1) {
    const error = validateScenario(value.scenarios[index], `document.scenarios[${index}]`);
    if (error) return schemaFailure(error);
  }
  if (!Array.isArray(value.profiles) || value.profiles.length > 2_000) return schemaFailure('document.profiles must be an array of at most 2000 profiles');
  for (let index = 0; index < value.profiles.length; index += 1) {
    const error = validateProfile(value.profiles[index], `document.profiles[${index}]`);
    if (error) return schemaFailure(error);
  }
  if (!Array.isArray(value.lab_reports) || value.lab_reports.length > 100) return schemaFailure('document.lab_reports must be an array of at most 100 reports');
  const reportsError = jsonValue(value.lab_reports, 'document.lab_reports');
  if (reportsError) return schemaFailure(reportsError);
  if (!record(value.metadata)) return schemaFailure('document.metadata must be an object');
  const metadataKeys = exactKeys(value.metadata, ['saved_at', 'app', 'real_device_execution_enabled'], 'document.metadata');
  if (metadataKeys) return schemaFailure(metadataKeys);
  const metadataTime = timestamp(value.metadata.saved_at, 'document.metadata.saved_at');
  if (metadataTime) return schemaFailure(metadataTime);
  if (value.metadata.app !== 'RealityWarden Desktop') return schemaFailure('document.metadata.app must be RealityWarden Desktop');
  if (value.metadata.real_device_execution_enabled !== false) return schemaFailure('document.metadata.real_device_execution_enabled must remain false');
  return { ok: true, value };
}

export function parseOpenRealityProjectText(text: string): ProjectContractResult<Record<string, unknown>> {
  if (typeof text !== 'string') return { ok: false, code: 'invalid_json', detail: 'project content must be text' };
  if (new TextEncoder().encode(text).byteLength > MAX_PROJECT_FILE_BYTES) return { ok: false, code: 'file_too_large', detail: `project content exceeds ${MAX_PROJECT_FILE_BYTES} bytes` };
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    return { ok: false, code: 'invalid_json', detail: error instanceof Error ? error.message : 'invalid JSON' };
  }
  return validateOpenRealityProjectFile(parsed);
}

export function serializeOpenRealityProjectFile(value: unknown): ProjectContractResult<string> {
  const checked = validateOpenRealityProjectFile(value);
  if (!checked.ok) return checked;
  return { ok: true, value: `${JSON.stringify(checked.value, null, 2)}\n` };
}
