'use client';

import type { DeviceProfile } from '@/types/deviceMeta';
import type { DeviceType } from '@/types/deviceMeta';
import type { LabReport, TimelineStateSnapshot } from '@/lib/virtual-lab/LabReport';
import type { ActionFrame } from '@/lib/action-runtime/ActionState';
import { localizeDeviceType, localizeFidelity, t } from '@/lib/i18n';
import { getSimulatorFidelity } from '@/lib/virtual-lab/SimulatorFidelity';
import type { SemanticWorkspaceDevice } from './SemanticDeviceStage';
import { SemanticDeviceStage } from './SemanticDeviceStage';
import { StatusPill } from './StatusPill';
import type { UiLanguage } from './LabConfigurator';

function localBlockedReason(reason: string | undefined, language: UiLanguage) {
  if (!reason || language === 'en') return reason;
  if (reason.includes('Unsupported action')) return '\u8bbe\u5907\u4e0d\u652f\u6301\u8be5\u52a8\u4f5c\u3002';
  if (reason.includes('Forbidden zone') || reason.includes('forbidden')) return '\u547d\u4ee4\u89e6\u53d1\u4e86\u7981\u6b62\u533a\u89c4\u5219\u3002';
  if (reason.includes('outside workspace')) return '\u76ee\u6807\u8d85\u51fa\u8bbe\u5907\u5de5\u4f5c\u7a7a\u95f4\u3002';
  if (reason.includes('throw')) return '\u5b89\u5168\u7b56\u7565\u4e0d\u5141\u8bb8\u629b\u63b7\u52a8\u4f5c\u3002';
  if (reason.includes('speed')) return '\u901f\u5ea6\u8d85\u51fa\u5f53\u524d\u8bbe\u5907\u6863\u6848\u9650\u5236\u3002';
  if (reason.includes('force')) return '\u529b\u5ea6\u8d85\u51fa\u5f53\u524d\u8bbe\u5907\u6863\u6848\u9650\u5236\u3002';
  return reason;
}

export function VirtualDeviceStage({
  language,
  profile,
  report,
  replaySnapshot
  ,
  currentActionFrame,
  scenarioPreview,
  workspaceDevices,
  selectedWorkspaceDeviceId,
  onDropDevice,
  onDropAsset,
  onSelectWorkspaceDevice
}: {
  language: UiLanguage;
  profile: DeviceProfile;
  report: LabReport | null;
  replaySnapshot: TimelineStateSnapshot | null;
  currentActionFrame?: ActionFrame | null;
  scenarioPreview?: { target: [number, number, number]; path: [[number, number, number], [number, number, number]]; unsafe: boolean; passed?: boolean } | null;
  workspaceDevices: SemanticWorkspaceDevice[];
  selectedWorkspaceDeviceId: string | null;
  onDropDevice: (deviceType: DeviceType) => void;
  onDropAsset?: (assetId: string) => void;
  onSelectWorkspaceDevice: (deviceId: string) => void;
}) {
  const fidelity = getSimulatorFidelity(profile.deviceMeta);
  const replayState = {
    ...(replaySnapshot?.device_state ?? report?.device_state_after ?? profile.deviceMeta.runtime_state),
    ...(currentActionFrame?.device_state ?? replaySnapshot?.action_frame?.device_state ?? {}),
    visual_state: currentActionFrame?.visual_state ?? replaySnapshot?.action_frame?.visual_state
  };
  const blocked = replaySnapshot?.safety_status === 'blocked' || report?.result === 'blocked';
  const blockedReason = replaySnapshot?.safety_report.blocked_reasons[0] ?? report?.safety_report.blocked_reasons[0];
  const displayType = localizeDeviceType(language, profile.deviceMeta.device_type);

  return (
    <main
      className="relative flex h-full min-w-0 flex-1 flex-col overflow-hidden border-r border-border-panel bg-bg-workspace"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        const droppedAsset = event.dataTransfer.getData('application/open-reality-asset-id');
        if (droppedAsset && onDropAsset) {
          onDropAsset(droppedAsset);
          return;
        }
        const droppedType = event.dataTransfer.getData('application/open-reality-device-type') as DeviceType;
        if (droppedType) onDropDevice(droppedType);
      }}
    >
      <div className="relative min-h-0 flex-1">
        <SemanticDeviceStage
          deviceType={profile.deviceMeta.device_type}
          state={replayState}
          blocked={blocked}
          language={language}
          blockedReason={localBlockedReason(blockedReason, language)}
          selectedSnapshot={replaySnapshot}
          currentActionFrame={currentActionFrame ?? replaySnapshot?.action_frame}
          scenarioPreview={scenarioPreview}
          workspaceDevices={workspaceDevices}
          selectedWorkspaceDeviceId={selectedWorkspaceDeviceId ?? undefined}
          onSelectWorkspaceDevice={onSelectWorkspaceDevice}
        />
        <div className="pointer-events-none absolute bottom-3 left-3 max-w-[360px] rounded-[3px] border border-white/5 bg-black/35 px-2 py-1 font-mono text-[10px] leading-4 text-[#8A8F98] opacity-75 backdrop-blur-md">
          <span className="text-[#E6EAF0]">{t(language, 'device')}</span>: {displayType}
          <span className="mx-2 text-[#4B5563]">|</span>
          <span className="text-[#E6EAF0]">{t(language, 'adapter')}</span>: {t(language, 'simulator_adapter_short')}
          <span className="mx-2 text-[#4B5563]">|</span>
          <span className="text-[#E6EAF0]">{t(language, 'fidelity')}</span>: {localizeFidelity(language, fidelity.level)}
        </div>
      </div>
    </main>
  );
}
