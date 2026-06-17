'use client';

import { useMemo, useState } from 'react';
import type { DeviceScenario } from '@/lib/virtual-lab/DeviceScenario';
import type { DeviceProfile, DeviceType } from '@/types/deviceMeta';
import type { DeviceAsset } from '@/lib/assets/DeviceAsset';
import type { Locale } from '@/lib/i18n';
import { localizeCategory, localizeDeviceType, localizeDisplayName, localizeMetadataValue, localizeProfileName, localizeScenarioName, t } from '@/lib/i18n';

export type UiLanguage = Locale;

interface LabConfiguratorProps {
  language: UiLanguage;
  deviceTypes: DeviceType[];
  deviceType: DeviceType;
  profiles: DeviceProfile[];
  selectedProfileId: string;
  scenarios: DeviceScenario[];
  selectedScenarioId: string;
  deviceAssets: DeviceAsset[];
  onLanguageChange: (language: UiLanguage) => void;
  onDeviceTypeChange: (deviceType: DeviceType) => void;
  onProfileChange: (profileId: string) => void;
  onScenarioChange: (scenarioId: string) => void;
  onAddAsset: (assetId: string) => void;
}

function SelectChevron() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#86868B]" fill="currentColor">
      <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.17l3.71-3.94a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z" clipRule="evenodd" />
    </svg>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-text-secondary">{children}</div>;
}

const selectClassName =
  'h-7 w-full appearance-none rounded-[3px] border border-[#313338] bg-[#1E1F22] px-2 pr-7 text-[12px] font-medium text-[#E6EAF0] outline-none transition-colors hover:border-[#3A3D45] focus:border-[#0284C7] focus:ring-1 focus:ring-[#0284C7]';

export function LabConfigurator({
  language,
  deviceTypes,
  deviceType,
  profiles,
  selectedProfileId,
  scenarios,
  selectedScenarioId,
  deviceAssets,
  onLanguageChange,
  onDeviceTypeChange,
  onProfileChange,
  onScenarioChange,
  onAddAsset
}: LabConfiguratorProps) {
  const [assetQuery, setAssetQuery] = useState('');
  const profileLabel = (profile: DeviceProfile) => localizeProfileName(language, profile.deviceMeta.display_name ?? profile.label ?? profile.id);
  const scenarioLabel = (scenario: DeviceScenario) => localizeScenarioName(language, scenario.id);
  const filteredAssets = useMemo(() => {
    const query = assetQuery.trim().toLowerCase();
    const assetsForDeviceType = deviceAssets.filter((asset) => asset.manifest.device_type === deviceType);
    if (!query) return assetsForDeviceType;
    return assetsForDeviceType.filter((asset) => {
      const manifest = asset.manifest;
      return [
        manifest.display_name,
        manifest.asset_id,
        manifest.device_type,
        manifest.category,
        manifest.license
      ].some((value) => String(value ?? '').toLowerCase().includes(query));
    });
  }, [assetQuery, deviceAssets, deviceType]);

  return (
    <aside className="flex h-full w-[292px] shrink-0 flex-col overflow-hidden border-r border-border-panel bg-bg-panel">
      <div className="flex h-full min-h-0 flex-col">
        <header className="flex-none border-b border-border-panel px-2.5 py-2">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[10px] font-bold uppercase tracking-wide text-text-secondary">{t(language, 'devices')}</div>
            <div className="relative w-24">
              <select value={language} onChange={(event) => onLanguageChange(event.target.value as UiLanguage)} className={selectClassName}>
                <option value="zh">{t(language, 'chinese')}</option>
                <option value="en">{t(language, 'english')}</option>
              </select>
              <SelectChevron />
            </div>
          </div>
        </header>

        <section className="grid flex-none gap-2 px-2.5 py-2">
          <div>
            <FieldLabel>{t(language, 'device_type')}</FieldLabel>
            <div className="relative">
              <select value={deviceType} onChange={(event) => onDeviceTypeChange(event.target.value as DeviceType)} className={selectClassName}>
                {deviceTypes.map((type) => (
                  <option key={type} value={type}>{localizeDeviceType(language, type)}</option>
                ))}
              </select>
              <SelectChevron />
            </div>
          </div>

          <div>
            <FieldLabel>{t(language, 'device_profile')}</FieldLabel>
            <div className="relative">
              <select value={selectedProfileId} onChange={(event) => onProfileChange(event.target.value)} className={selectClassName}>
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>{profileLabel(profile)}</option>
                ))}
              </select>
              <SelectChevron />
            </div>
          </div>

          <div>
            <FieldLabel>{t(language, 'scenario')}</FieldLabel>
            <div className="relative">
              <select value={scenarios.length > 0 ? selectedScenarioId : '__coming_soon__'} onChange={(event) => onScenarioChange(event.target.value)} disabled={scenarios.length === 0} className={`${selectClassName} disabled:cursor-not-allowed disabled:opacity-60`}>
                {scenarios.length === 0 ? (
                  <option value="__coming_soon__">{t(language, 'scenario_not_implemented')}</option>
                ) : scenarios.map((scenario) => (
                  <option key={scenario.id} value={scenario.id}>{scenarioLabel(scenario)}</option>
                ))}
              </select>
              <SelectChevron />
            </div>
          </div>
        </section>

        <section className="flex min-h-0 flex-1 flex-col border-t border-border-panel px-2.5 py-2">
          <FieldLabel>{t(language, 'asset_library')}</FieldLabel>
          <input
            value={assetQuery}
            onChange={(event) => setAssetQuery(event.target.value)}
            className="mb-2 h-7 w-full rounded-[3px] border border-[#313338] bg-[#111214] px-2 text-[11px] text-[#E6EAF0] outline-none placeholder:text-[#5F6670] focus:border-[#0284C7]"
            placeholder={t(language, 'search_assets')}
          />
          <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto pr-1">
            <div className="grid gap-1">
            {filteredAssets.map((asset) => (
              <button
                key={asset.manifest.asset_id}
                type="button"
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.setData('application/open-reality-device-type', asset.manifest.device_type);
                  event.dataTransfer.setData('application/open-reality-asset-id', asset.manifest.asset_id);
                  event.dataTransfer.effectAllowed = 'copy';
                }}
                onClick={() => onAddAsset(asset.manifest.asset_id)}
                title={localizeDisplayName(language, asset.manifest.display_name)}
                className="group grid min-h-[66px] grid-cols-[32px_1fr_auto] gap-2 rounded-[3px] border border-border-panel bg-bg-panel p-1.5 text-left transition-colors hover:bg-[#24272C]"
              >
                <div className="relative h-8 w-8 overflow-hidden rounded-[3px] border border-border-panel bg-[#232529]">
                  <div className="absolute bottom-1 left-1 right-1 h-2 bg-[#4B5563]" />
                  <div className="absolute left-1.5 top-2 h-4 w-5 border border-[#6B7280] bg-[#9CA3AF]" />
                  <div className="absolute right-1 top-1.5 h-5 w-1.5 bg-[#374151]" />
                  <div className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[#10B981]" />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-semibold leading-4 text-text-primary">{localizeDisplayName(language, asset.manifest.display_name)}</div>
                  <div className="mt-0.5 text-[11px] leading-4 text-text-secondary">
                    {localizeDeviceType(language, asset.manifest.device_type)} / {localizeCategory(language, asset.manifest.category)}
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-1">
                    <span className="rounded-[3px] border border-border-panel bg-[#232529] px-1.5 py-0.5 text-[9px] font-semibold text-text-secondary">{t(language, 'sim')}</span>
                    <span className="rounded-[3px] border border-border-panel bg-[#232529] px-1.5 py-0.5 text-[9px] font-semibold text-text-secondary">{t(language, 'risk')} {localizeMetadataValue(language, asset.manifest.risk_class ?? 'medium')}</span>
                    <span className="rounded-[3px] border border-[#075985] bg-[#0B2233] px-1.5 py-0.5 text-[9px] font-semibold text-[#38BDF8]">{t(language, 'license')}</span>
                  </div>
                </div>
                <span className="self-center rounded-[3px] border border-border-panel px-1.5 py-0.5 text-[10px] font-bold text-selected opacity-0 group-hover:opacity-100">{t(language, 'add')}</span>
              </button>
            ))}
            {filteredAssets.length === 0 && (
              <div className="border border-dashed border-border-panel bg-[#181A1D] px-2 py-4 text-center text-[11px] text-text-secondary">
                {t(language, 'no_assets_found')}
              </div>
            )}
            </div>
          </div>
        </section>

        <section className="flex-none border-t border-border-panel px-2.5 py-2">
          {/* Conformance boundary copy: Developer Preview / Not for production hardware */}
          <div className="text-[10px] font-bold uppercase tracking-wide text-text-secondary">{t(language, 'developer_preview')}</div>
          <div className="mt-1 text-[11px] leading-4 text-text-muted">{t(language, 'not_for_production')}</div>
        </section>
      </div>
    </aside>
  );
}
