import type { DeviceMeta } from '@/types/deviceMeta';
import type { DeviceGeometry } from '@/types/deviceMeta';
import type { ExecutionReport } from '@/types/execution';
import type { SafetyReport } from '@/types/safety';
import type { TaskDSL } from '@/types/taskDsl';

export interface RunBundle {
  product: 'RealityWarden';
  generated_at: string;
  prompt: string;
  profile_id: string | null;
  device_meta: DeviceMeta | null;
  geometry: DeviceGeometry | null;
  task_dsl: TaskDSL | null;
  safety_report: SafetyReport | null;
  execution_report: ExecutionReport | null;
}

export function exportRunBundle(bundle: RunBundle) {
  const payload = JSON.stringify(bundle, null, 2);
  const blob = new Blob([payload], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `open-reality-run-${Date.now()}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
