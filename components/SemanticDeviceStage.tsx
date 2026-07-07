'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { STATUS_COLORS } from '@/lib/ui/statusColors';
import { ContactShadows, Html, OrbitControls, useGLTF } from '@react-three/drei';
import { Suspense, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { localizeDeviceType, localizeDisplayName, localizeStatus, t } from '@/lib/i18n';
import type { DeviceType } from '@/types/deviceMeta';
import type { TimelineStateSnapshot } from '@/lib/virtual-lab/LabReport';
import type { ActionFrame } from '@/lib/action-runtime/ActionState';
import { SemanticCameraSensor } from './devices/SemanticCameraSensor';
import { SemanticConveyorBelt } from './devices/SemanticConveyorBelt';
import { SemanticMobileRobot } from './devices/SemanticMobileRobot';
import { SemanticRobotArm } from './devices/SemanticRobotArm';
import { SemanticSmartLight } from './devices/SemanticSmartLight';

const workspaceBounds = {
  minX: -12,
  maxX: 12,
  minZ: -12,
  maxZ: 12
};

const workspaceSnapStep = 0.1;

interface SemanticDeviceStageProps {
  deviceType: DeviceType;
  state: Record<string, unknown>;
  blocked: boolean;
  language?: 'zh' | 'en';
  blockedReason?: string;
  selectedSnapshot?: TimelineStateSnapshot | null;
  currentActionFrame?: ActionFrame | null;
  scenarioPreview?: { target: [number, number, number]; path: [[number, number, number], [number, number, number]]; unsafe: boolean; passed?: boolean } | null;
  workspaceDevices?: SemanticWorkspaceDevice[];
  selectedWorkspaceDeviceId?: string;
  runTargetWorkspaceDeviceId?: string;
  dropzoneActive?: boolean;
  onSelectWorkspaceDevice?: (deviceId: string) => void;
  onMoveWorkspaceDevice?: (deviceId: string, position: [number, number, number]) => void;
}

export interface SemanticWorkspaceDevice {
  id: string;
  label: string;
  assetId?: string;
  deviceType: DeviceType;
  state: Record<string, unknown>;
  position: [number, number, number];
  modelAsset?: {
    uri: string;
    scale?: number;
    rotation?: [number, number, number];
    position?: [number, number, number];
  };
}

function EngineeringGrid() {
  const gridRef = useRef<THREE.GridHelper | null>(null);

  useFrame(() => {
    if (!gridRef.current) return;
    const materials = Array.isArray(gridRef.current.material) ? gridRef.current.material : [gridRef.current.material];
    materials.forEach((material) => {
      if ('color' in material) (material.color as THREE.Color).set('#3E4045');
      material.transparent = true;
      material.opacity = 0.92;
    });
  });

  return (
    <>
      <gridHelper ref={gridRef} args={[30, 60, '#4B5563', '#313338']} position={[0, 0, 0]} />
      <gridHelper args={[30, 300, '#2B2D31', '#23262B']} position={[0, 0.002, 0]} />
    </>
  );
}

function WorkspaceBoundary() {
  const width = workspaceBounds.maxX - workspaceBounds.minX;
  const depth = workspaceBounds.maxZ - workspaceBounds.minZ;
  const centerX = (workspaceBounds.minX + workspaceBounds.maxX) / 2;
  const centerZ = (workspaceBounds.minZ + workspaceBounds.maxZ) / 2;
  const deckWidth = Math.min(width - 7.2, 10.8);
  const deckDepth = Math.min(depth - 7.2, 10.8);
  return (
    <group position={[centerX, 0.012, centerZ]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.008, 0]}>
        <planeGeometry args={[width - 0.7, depth - 0.7]} />
        <meshStandardMaterial color="#1B1D21" roughness={0.96} metalness={0.02} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.006, 0]}>
        <planeGeometry args={[width - 2.3, depth - 2.3]} />
        <meshStandardMaterial color="#202328" roughness={0.92} metalness={0.03} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[Math.min(width, depth) * 0.48, Math.min(width, depth) * 0.5, 4]} />
        <meshBasicMaterial color="#5B616A" transparent opacity={0.42} wireframe />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[width, depth]} />
        <meshBasicMaterial color="#94A3B8" transparent opacity={0.035} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
        <planeGeometry args={[deckWidth, deckDepth]} />
        <meshStandardMaterial color="#262A30" roughness={0.9} metalness={0.08} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.003, 0]}>
        <ringGeometry args={[Math.min(deckWidth, deckDepth) * 0.3, Math.min(deckWidth, deckDepth) * 0.302, 4]} />
        <meshBasicMaterial color="#7C8590" transparent opacity={0.34} wireframe />
      </mesh>
      {[-deckWidth / 4, deckWidth / 4].map((x) => (
        <mesh key={`deck-x-${x}`} position={[x, 0.004, 0]}>
          <boxGeometry args={[0.025, 0.01, deckDepth - 0.8]} />
          <meshStandardMaterial color="#5B616A" roughness={0.82} metalness={0.16} transparent opacity={0.52} />
        </mesh>
      ))}
      {[-deckDepth / 4, deckDepth / 4].map((z) => (
        <mesh key={`deck-z-${z}`} position={[0, 0.004, z]}>
          <boxGeometry args={[deckWidth - 0.8, 0.01, 0.025]} />
          <meshStandardMaterial color="#5B616A" roughness={0.82} metalness={0.16} transparent opacity={0.52} />
        </mesh>
      ))}
      {[
        [deckWidth / 2, 0, 0, 0.16, 0.014, deckDepth + 0.12],
        [-deckWidth / 2, 0, 0, 0.16, 0.014, deckDepth + 0.12],
        [0, 0, deckDepth / 2, deckWidth + 0.12, 0.014, 0.16],
        [0, 0, -deckDepth / 2, deckWidth + 0.12, 0.014, 0.16]
      ].map(([x, y, z, sx, sy, sz], index) => (
        <mesh key={`deck-frame-${index}`} position={[x as number, (y as number) + 0.006, z as number]}>
          <boxGeometry args={[sx as number, sy as number, sz as number]} />
          <meshStandardMaterial color="#717A84" roughness={0.74} metalness={0.22} transparent opacity={0.82} />
        </mesh>
      ))}
      <mesh position={[0, 0.001, depth / 2]}><boxGeometry args={[width, 0.018, 0.06]} /><meshStandardMaterial color="#5B616A" roughness={0.88} metalness={0.1} transparent opacity={0.74} /></mesh>
      <mesh position={[0, 0.001, -depth / 2]}><boxGeometry args={[width, 0.018, 0.06]} /><meshStandardMaterial color="#5B616A" roughness={0.88} metalness={0.1} transparent opacity={0.74} /></mesh>
      <mesh position={[width / 2, 0.001, 0]}><boxGeometry args={[0.06, 0.018, depth]} /><meshStandardMaterial color="#5B616A" roughness={0.88} metalness={0.1} transparent opacity={0.74} /></mesh>
      <mesh position={[-width / 2, 0.001, 0]}><boxGeometry args={[0.06, 0.018, depth]} /><meshStandardMaterial color="#5B616A" roughness={0.88} metalness={0.1} transparent opacity={0.74} /></mesh>
      {[
        [width / 2 - 0.42, 0, depth / 2 - 0.42],
        [-width / 2 + 0.42, 0, depth / 2 - 0.42],
        [width / 2 - 0.42, 0, -depth / 2 + 0.42],
        [-width / 2 + 0.42, 0, -depth / 2 + 0.42]
      ].map((corner) => (
        <mesh key={corner.join('-')} position={[corner[0], 0.004, corner[2]]}>
          <cylinderGeometry args={[0.06, 0.06, 0.02, 20]} />
          <meshStandardMaterial color="#7A828C" roughness={0.68} metalness={0.18} />
        </mesh>
      ))}
    </group>
  );
}

function WorkspaceReferenceBeacons({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <>
      {[
        [0, 0.014, 0],
        [4, 0.014, 0],
        [-4, 0.014, 0],
        [0, 0.014, 4],
        [0, 0.014, -4]
      ].map((point, index) => (
        <group key={`beacon-${index}`} position={[point[0], point[1], point[2]]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.14, 0.155, 24]} />
            <meshBasicMaterial color="#64748B" transparent opacity={0.2} />
          </mesh>
          <mesh position={[0, 0.001, 0]}>
            <boxGeometry args={[0.11, 0.008, 0.012]} />
            <meshBasicMaterial color="#64748B" transparent opacity={0.24} />
          </mesh>
          <mesh position={[0, 0.001, 0]}>
            <boxGeometry args={[0.012, 0.008, 0.11]} />
            <meshBasicMaterial color="#64748B" transparent opacity={0.24} />
          </mesh>
        </group>
      ))}
    </>
  );
}

const suggestedWorkspaceSlots: [number, number, number][] = [
  [0, 0, 0],
  [4, 0, 0],
  [-4, 0, 0],
  [0, 0, 4],
  [0, 0, -4],
  [4, 0, 4],
  [-4, 0, 4],
  [4, 0, -4]
];

function getSuggestedDropPosition(devices: SemanticWorkspaceDevice[]) {
  const occupancyThreshold = 0.65;
  return suggestedWorkspaceSlots.find((slot) => {
    return !devices.some((device) => {
      const dx = device.position[0] - slot[0];
      const dz = device.position[2] - slot[2];
      return Math.hypot(dx, dz) < occupancyThreshold;
    });
  }) ?? suggestedWorkspaceSlots[suggestedWorkspaceSlots.length - 1];
}

function WorkspaceStarterSlots({
  devices,
  suggestedPosition,
  active
}: {
  devices: SemanticWorkspaceDevice[];
  suggestedPosition: [number, number, number];
  active: boolean;
}) {
  const occupancyThreshold = 0.45;
  if (!active && devices.length > 0) return null;

  return (
    <>
      {suggestedWorkspaceSlots.map((slot, index) => {
        const occupied = devices.some((device) => {
          const dx = device.position[0] - slot[0];
          const dz = device.position[2] - slot[2];
          return Math.hypot(dx, dz) < occupancyThreshold;
        });
        const isSuggested = slot[0] === suggestedPosition[0] && slot[2] === suggestedPosition[2];
        const color = occupied ? '#4B5563' : isSuggested ? (active ? '#38BDF8' : '#0284C7') : '#4B5563';
        const opacity = occupied ? 0.1 : isSuggested ? (active ? 0.36 : 0.22) : 0.08;

        return (
          <group key={`${slot[0]}-${slot[2]}-${index}`} position={[slot[0], 0.014, slot[2]]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.3, 0.34, 32]} />
              <meshBasicMaterial color={color} transparent opacity={opacity} />
            </mesh>
            <mesh position={[0, 0.001, 0]}>
              <boxGeometry args={[0.22, 0.01, 0.018]} />
              <meshBasicMaterial color={color} transparent opacity={Math.min(0.72, opacity + 0.12)} />
            </mesh>
            <mesh position={[0, 0.001, 0]}>
              <boxGeometry args={[0.018, 0.01, 0.22]} />
              <meshBasicMaterial color={color} transparent opacity={Math.min(0.72, opacity + 0.12)} />
            </mesh>
          </group>
        );
      })}
    </>
  );
}

function WorkspaceDropzone({ language, position, active }: { language: 'zh' | 'en'; position: [number, number, number]; active: boolean }) {
  if (!active) return null;
  const ringColor = active ? '#38BDF8' : '#0284C7';
  const ringOpacity = active ? 0.42 : 0.24;
  const planeOpacity = active ? 0.11 : 0.05;
  return (
    <group position={[position[0], 0.018, position[2]]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.84, 0.92, 64]} />
        <meshBasicMaterial color={ringColor} transparent opacity={ringOpacity} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.002, 0]}>
        <planeGeometry args={[1.56, 1.56]} />
        <meshBasicMaterial color={ringColor} transparent opacity={planeOpacity} />
      </mesh>
      <mesh position={[0, 0.001, 0]}>
        <boxGeometry args={[0.7, 0.01, 0.02]} />
        <meshBasicMaterial color="#9BD4FF" transparent opacity={0.75} />
      </mesh>
      <mesh position={[0, 0.001, 0]}>
        <boxGeometry args={[0.02, 0.01, 0.7]} />
        <meshBasicMaterial color="#9BD4FF" transparent opacity={0.75} />
      </mesh>
      <Html center position={[0, 0.075, 1.16]}>
        <div className="pointer-events-none whitespace-nowrap rounded-[3px] border border-[#075985] bg-[#0B2233]/84 px-2 py-1 text-center font-mono text-[8px] leading-3 text-[#D8EEFF]">
          <div className="font-semibold">{t(language, 'workspace_dropzone_title')}</div>
          <div className="mt-0.5 text-[7px] text-[#B6E0FF]">{t(language, 'workspace_dropzone_next')}</div>
          <div className="mt-0.5 text-[7px] text-[#9BD4FF]">{t(language, 'workspace_dropzone_subtitle')}</div>
        </div>
      </Html>
    </group>
  );
}

function AxisHud() {
  return (
    <group position={[-2.55, 0.06, 2.35]}>
      <arrowHelper args={[new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 0), 0.42, '#E11D48']} />
      <arrowHelper args={[new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 0), 0.42, '#059669']} />
      <arrowHelper args={[new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 0, 0), 0.42, '#0284C7']} />
    </group>
  );
}

function ScenarioPreviewOverlay({ preview, blocked }: { preview?: SemanticDeviceStageProps['scenarioPreview']; blocked: boolean }) {
  const line = useMemo(() => {
    if (!preview) return null;
    const geometry = new THREE.BufferGeometry().setFromPoints(preview.path.map((point) => new THREE.Vector3(point[0], 0.045, point[2])));
    const material = new THREE.LineDashedMaterial({
      color: blocked || preview.unsafe ? STATUS_COLORS.blocked : preview.passed ? STATUS_COLORS.executed : STATUS_COLORS.info,
      dashSize: 0.2,
      gapSize: 0.1,
      transparent: true,
      opacity: 0.9
    });
    const object = new THREE.Line(geometry, material);
    object.computeLineDistances();
    return object;
  }, [blocked, preview]);
  if (!preview) return null;
  const color = blocked || preview.unsafe ? STATUS_COLORS.blocked : preview.passed ? STATUS_COLORS.executed : '#38BDF8';
  return (
    <>
      {line && <primitive object={line} />}
      <group position={[preview.target[0], 0.055, preview.target[2]]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.18, 0.2, 48]} />
          <meshBasicMaterial color={color} />
        </mesh>
        <mesh>
          <sphereGeometry args={[0.045, 16, 10]} />
          <meshBasicMaterial color={color} />
        </mesh>
      </group>
    </>
  );
}

function footprintSizeForDevice(deviceType: DeviceType): [number, number] {
  if (deviceType === 'robot_arm') return [1.8, 1.8];
  if (deviceType === 'mobile_robot') return [1.4, 1.9];
  if (deviceType === 'conveyor_belt') return [2.4, 1.2];
  if (deviceType === 'warehouse_rack') return [2.2, 1.4];
  if (deviceType === 'plc_cabinet') return [1.1, 0.9];
  return [1.2, 1.2];
}

function SelectedDeviceFootprint({ device, language }: { device?: SemanticWorkspaceDevice; language: 'zh' | 'en' }) {
  // Empty workspace: nothing selected, nothing to draw. Without this guard an
  // empty workspace crashed the whole stage (React error screen), which made
  // it look like "you must already have a device before adding one".
  if (!device) return null;
  const [width, depth] = footprintSizeForDevice(device.deviceType);
  const edgeThickness = 0.03;
  const crossLength = Math.min(width, depth) * 0.42;

  return (
    <group position={[device.position[0], 0.02, device.position[2]]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.006, 0]}>
        <planeGeometry args={[width * 0.92, depth * 0.92]} />
        <meshBasicMaterial color="#0B2233" transparent opacity={0.12} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[Math.max(width, depth) * 0.46, Math.max(width, depth) * 0.48, 64]} />
        <meshBasicMaterial color="#0066CC" transparent opacity={0.28} />
      </mesh>
      <mesh position={[0, 0.001, depth / 2]}>
        <boxGeometry args={[width, 0.012, edgeThickness]} />
        <meshStandardMaterial color="#38BDF8" roughness={0.8} metalness={0.08} transparent opacity={0.7} />
      </mesh>
      <mesh position={[0, 0.001, -depth / 2]}>
        <boxGeometry args={[width, 0.012, edgeThickness]} />
        <meshStandardMaterial color="#38BDF8" roughness={0.8} metalness={0.08} transparent opacity={0.7} />
      </mesh>
      <mesh position={[width / 2, 0.001, 0]}>
        <boxGeometry args={[edgeThickness, 0.012, depth]} />
        <meshStandardMaterial color="#38BDF8" roughness={0.8} metalness={0.08} transparent opacity={0.7} />
      </mesh>
      <mesh position={[-width / 2, 0.001, 0]}>
        <boxGeometry args={[edgeThickness, 0.012, depth]} />
        <meshStandardMaterial color="#38BDF8" roughness={0.8} metalness={0.08} transparent opacity={0.7} />
      </mesh>
      <mesh position={[0, 0.002, 0]}>
        <boxGeometry args={[crossLength, 0.01, 0.02]} />
        <meshBasicMaterial color="#D8EEFF" transparent opacity={0.82} />
      </mesh>
      <mesh position={[0, 0.002, 0]}>
        <boxGeometry args={[0.02, 0.01, crossLength]} />
        <meshBasicMaterial color="#D8EEFF" transparent opacity={0.82} />
      </mesh>
      <Html center position={[0, 0.06, depth / 2 + 0.18]}>
        <div className="pointer-events-none whitespace-nowrap rounded-[3px] border border-[#075985] bg-[#0B2233]/85 px-1.5 py-0.5 font-mono text-[8px] font-semibold leading-3 text-[#D8EEFF]">
          {language === 'zh' ? '\u5e03\u5c40\u9009\u4e2d' : 'LAYOUT SELECTED'}
        </div>
      </Html>
    </group>
  );
}

function CommandOutcomeGhost({
  deviceType,
  language,
  preview,
  currentActionFrame,
  runTargetDevice
}: {
  deviceType: DeviceType;
  language: 'zh' | 'en';
  preview?: SemanticDeviceStageProps['scenarioPreview'];
  currentActionFrame?: ActionFrame | null;
  runTargetDevice?: SemanticWorkspaceDevice;
}) {
  const visual = currentActionFrame?.visual_state as Record<string, unknown> | undefined;
  const frameTarget = Array.isArray(visual?.target_position) ? visual.target_position as [number, number, number] : null;
  const anchor = preview?.target ?? frameTarget ?? runTargetDevice?.position ?? null;
  if (!anchor || !runTargetDevice) return null;

  const smartLightColor = typeof runTargetDevice.state.color === 'string'
    ? String(runTargetDevice.state.color)
    : typeof currentActionFrame?.device_state?.color === 'string'
      ? String(currentActionFrame.device_state.color)
      : 'neutral';
  const smartLightBrightness = Number(
    currentActionFrame?.device_state?.brightness
    ?? runTargetDevice.state.brightness
    ?? 0
  );
  const cameraAction = typeof visual?.capture_flash === 'number' && visual.capture_flash > 0.1
    ? (language === 'zh' ? '\u6b63\u5728\u62cd\u6444' : 'Capturing')
    : language === 'zh'
      ? '\u8bfb\u53d6\u72b6\u6001'
      : 'Read state';

  const label = deviceType === 'robot_arm'
    ? (language === 'zh' ? '\u7ed3\u679c\u843d\u70b9' : 'Result Target')
    : deviceType === 'smart_light'
      ? `${language === 'zh' ? '\u706f\u5149\u7ed3\u679c' : 'Light Result'} | ${smartLightColor} / ${Math.round(smartLightBrightness * 100)}%`
      : `${language === 'zh' ? '\u6444\u50cf\u53cd\u9988' : 'Camera Result'} | ${cameraAction}`;

  const color = deviceType === 'robot_arm'
    ? '#D1D5DB'
    : deviceType === 'smart_light'
      ? '#38BDF8'
      : '#A78BFA';

  return (
    <group position={[anchor[0], Math.max(0.08, anchor[1] + 0.08), anchor[2]]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.22, 0.26, 48]} />
        <meshBasicMaterial color={color} transparent opacity={0.55} />
      </mesh>
      <mesh position={[0, 0.28, 0]}>
        <cylinderGeometry args={[0.018, 0.018, 0.56, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.2} />
      </mesh>
      <mesh position={[0, 0.56, 0]}>
        <sphereGeometry args={[0.05, 18, 12]} />
        <meshBasicMaterial color={color} transparent opacity={0.45} />
      </mesh>
      <Html center position={[0, 0.82, 0]}>
        <div className="pointer-events-none whitespace-nowrap rounded-[3px] border border-white/10 bg-[#101114]/75 px-2 py-1 font-mono text-[8px] font-semibold leading-3 text-[#E6EAF0] backdrop-blur-sm">
          <div className="text-[#9AA3AF]">{language === 'zh' ? '\u9884\u671f\u7ed3\u679c' : 'Expected Result'}</div>
          <div>{label}</div>
        </div>
      </Html>
    </group>
  );
}
function BlockedWarningRing({ blocked }: { blocked: boolean }) {
  const materialRef = useRef<THREE.MeshStandardMaterial | null>(null);

  useFrame(({ clock }) => {
    if (!materialRef.current) return;
    materialRef.current.opacity = blocked ? 0.22 + ((Math.sin(clock.elapsedTime * 4) + 1) / 2) * 0.12 : 0;
  });

  if (!blocked) return null;
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
      <ringGeometry args={[1.55, 1.62, 96]} />
      <meshStandardMaterial ref={materialRef} color={STATUS_COLORS.blocked} roughness={0.85} metalness={0.05} transparent opacity={0.28} />
    </mesh>
  );
}

function IndustrialAssetFallback({ assetId, deviceType, state }: { assetId?: string; deviceType: DeviceType; state: Record<string, unknown> }) {
  if (assetId === 'generic-plc-cabinet' || deviceType === 'plc_cabinet') {
    return (
      <group>
        <mesh position={[0, 0.55, 0]}><boxGeometry args={[0.62, 1.1, 0.22]} /><meshStandardMaterial color="#6B7280" roughness={0.72} metalness={0.18} /></mesh>
        <mesh position={[0, 0.58, -0.116]}><boxGeometry args={[0.54, 0.9, 0.012]} /><meshStandardMaterial color="#111827" roughness={0.8} /></mesh>
        {[-0.18, 0, 0.18].map((x, i) => <mesh key={x} position={[x, 0.95, -0.13]}><sphereGeometry args={[0.035, 16, 12]} /><meshStandardMaterial color={i === 0 ? '#10B981' : i === 1 ? '#F59E0B' : '#EF4444'} emissive={i === 0 ? '#10B981' : '#000000'} emissiveIntensity={0.35} /></mesh>)}
        {Array.from({ length: 6 }).map((_, i) => <mesh key={i} position={[-0.24 + i * 0.095, 0.24, -0.13]}><boxGeometry args={[0.055, 0.08, 0.03]} /><meshStandardMaterial color="#D1D5DB" roughness={0.8} /></mesh>)}
      </group>
    );
  }
  if (assetId === 'generic-lab-instrument' || deviceType === 'lab_instrument') {
    return (
      <group>
        <mesh position={[0, 0.28, 0]}><boxGeometry args={[0.9, 0.42, 0.5]} /><meshStandardMaterial color="#9CA3AF" roughness={0.7} metalness={0.12} /></mesh>
        <mesh position={[-0.18, 0.34, -0.255]}><boxGeometry args={[0.32, 0.16, 0.014]} /><meshStandardMaterial color="#111827" roughness={0.75} emissive="#0EA5E9" emissiveIntensity={0.12} /></mesh>
        {[0.18, 0.3, 0.42].map((x) => <mesh key={x} position={[x, 0.31, -0.265]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.035, 0.035, 0.025, 24]} /><meshStandardMaterial color="#374151" roughness={0.65} /></mesh>)}
      </group>
    );
  }
  if (assetId === 'generic-warehouse-rack' || deviceType === 'warehouse_rack') {
    return (
      <group>
        {[-0.55, 0.55].map((x) => [-0.38, 0.38].map((z) => <mesh key={`${x}-${z}`} position={[x, 0.65, z]}><boxGeometry args={[0.06, 1.3, 0.06]} /><meshStandardMaterial color="#4B5563" roughness={0.75} metalness={0.18} /></mesh>))}
        {[0.25, 0.65, 1.05].map((y) => <mesh key={y} position={[0, y, 0]}><boxGeometry args={[1.28, 0.055, 0.86]} /><meshStandardMaterial color="#9CA3AF" roughness={0.72} metalness={0.12} /></mesh>)}
        <mesh position={[-0.28, 0.46, 0]}><boxGeometry args={[0.28, 0.22, 0.26]} /><meshStandardMaterial color="#B45309" roughness={0.85} /></mesh>
        <mesh position={[0.28, 0.86, 0.12]}><boxGeometry args={[0.32, 0.2, 0.24]} /><meshStandardMaterial color="#B45309" roughness={0.85} /></mesh>
      </group>
    );
  }
  if (assetId === 'generic-sensor-box' || deviceType === 'sensor_box') {
    return (
      <group>
        <mesh position={[0, 0.35, 0]}><boxGeometry args={[0.44, 0.38, 0.28]} /><meshStandardMaterial color="#6B7280" roughness={0.76} metalness={0.12} /></mesh>
        <mesh position={[0, 0.36, -0.17]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.09, 0.09, 0.08, 32]} /><meshStandardMaterial color="#111827" roughness={0.7} /></mesh>
        <mesh position={[0.16, 0.53, -0.145]}><sphereGeometry args={[0.035, 16, 12]} /><meshStandardMaterial color="#10B981" emissive="#10B981" emissiveIntensity={0.35} /></mesh>
      </group>
    );
  }
  if (assetId === 'generic-ptz-camera') return <SemanticCameraSensor state={{ ...state, ptz: true }} />;
  return <DeviceByType deviceType={deviceType} state={state} />;
}

function DeviceByType({ deviceType, state }: { deviceType: DeviceType; state: Record<string, unknown> }) {
  if (deviceType === 'mobile_robot') return <SemanticMobileRobot state={state} />;
  if (deviceType === 'smart_light') return <SemanticSmartLight state={state} />;
  if (deviceType === 'camera_sensor') return <SemanticCameraSensor state={state} />;
  if (deviceType === 'conveyor_belt') return <SemanticConveyorBelt state={state} />;
  return <SemanticRobotArm state={state} />;
}

function DeviceModelAsset({ device }: { device: SemanticWorkspaceDevice }) {
  const asset = device.modelAsset;
  const gltf = useGLTF(asset?.uri ?? '');
  const scene = useMemo(() => gltf.scene.clone(true), [gltf.scene]);
  if (!asset) return <IndustrialAssetFallback assetId={device.assetId} deviceType={device.deviceType} state={device.state} />;

  return (
    <group
      scale={asset.scale ?? 1}
      position={asset.position ?? [0, 0, 0]}
      rotation={asset.rotation ?? [0, 0, 0]}
    >
      <primitive object={scene} />
    </group>
  );
}

function WorkspaceDeviceMesh({
  device,
  selected,
  runTarget,
  showPersistentLabel,
  onSelect,
  language,
  onStartDrag
}: {
  device: SemanticWorkspaceDevice;
  selected: boolean;
  runTarget: boolean;
  showPersistentLabel: boolean;
  onSelect?: (deviceId: string) => void;
  language: 'zh' | 'en';
  onStartDrag?: (deviceId: string, point: THREE.Vector3, currentPosition: [number, number, number]) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const status = localizeStatus(language, String(device.state.status ?? 'idle'));
  const shortName = localizeDisplayName(language, device.deviceType === 'robot_arm' ? 'Robot Arm' : device.label);
  return (
    <group
      position={device.position}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
      onClick={(event) => {
        event.stopPropagation();
        onSelect?.(device.id);
      }}
      onPointerDown={(event) => {
        event.stopPropagation();
        onSelect?.(device.id);
        onStartDrag?.(device.id, event.point.clone(), device.position);
      }}
    >
      {device.modelAsset ? (
        <Suspense fallback={<IndustrialAssetFallback assetId={device.assetId} deviceType={device.deviceType} state={device.state} />}>
          <DeviceModelAsset device={device} />
        </Suspense>
      ) : (
        <IndustrialAssetFallback assetId={device.assetId} deviceType={device.deviceType} state={device.state} />
      )}
      {selected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025, 0]}>
          <ringGeometry args={[0.9, 0.95, 72]} />
          <meshBasicMaterial color="#0066CC" transparent opacity={0.72} />
        </mesh>
      )}
      {runTarget && (
        <>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.021, 0]}>
            <ringGeometry args={[1.03, 1.08, 72]} />
            <meshBasicMaterial color="#F59E0B" transparent opacity={0.82} />
          </mesh>
          <mesh position={[0, 1.18, 0]}>
            <cylinderGeometry args={[0.012, 0.012, 1.8, 12]} />
            <meshBasicMaterial color="#F59E0B" transparent opacity={0.32} />
          </mesh>
        </>
      )}
      {hovered && !selected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.026, 0]}>
          <ringGeometry args={[0.88, 0.91, 72]} />
          <meshBasicMaterial color="#38BDF8" transparent opacity={0.45} />
        </mesh>
      )}
      {(hovered || showPersistentLabel) && (
        <Html center position={[0.84, selected ? 1.34 : 1.28, 0]}>
          <div className={`pointer-events-none whitespace-nowrap rounded-[3px] border px-1.5 py-0.5 font-mono text-[7px] font-semibold leading-3 ${selected ? 'border-[#075985] bg-[#0B2233]/70 text-[#D8EEFF] opacity-85' : runTarget ? 'border-status-running-edge bg-status-warning-surface/76 text-[#FDE68A] opacity-82' : 'border-[#313338] bg-[#101114]/50 text-[#9AA3AF] opacity-62'}`}>
            <div>{shortName}</div>
            <div className="text-[7px] text-[#6B7280]">{localizeDeviceType(language, device.deviceType)} / {status}</div>
            {runTarget && (
              <div className="text-[7px] font-bold text-status-running">{language === 'zh' ? '\u5f53\u524d\u8fd0\u884c\u76ee\u6807' : 'RUN TARGET'}</div>
            )}
          </div>
        </Html>
      )}
    </group>
  );
}

export function SemanticDeviceStage({
  deviceType,
  state,
  blocked,
  language = 'zh',
  blockedReason,
  selectedSnapshot,
  currentActionFrame,
  scenarioPreview,
  workspaceDevices,
  selectedWorkspaceDeviceId,
  runTargetWorkspaceDeviceId,
  dropzoneActive,
  onSelectWorkspaceDevice,
  onMoveWorkspaceDevice
}: SemanticDeviceStageProps) {
  const frameState = currentActionFrame ? { ...state, ...currentActionFrame.device_state, visual_state: currentActionFrame.visual_state } : state;
  const devices = workspaceDevices ?? [{ id: 'primary', label: t(language, 'device'), deviceType, state: frameState, position: [0, 0.02, 0] as [number, number, number] }];
  const [dragging, setDragging] = useState<{ id: string; offsetX: number; offsetZ: number } | null>(null);
  const runTargetDevice = devices.find((device) => device.id === runTargetWorkspaceDeviceId) ?? devices[0];
  const selectedDevice = devices.find((device) => device.id === selectedWorkspaceDeviceId) ?? devices[0];
  const suggestedDropPosition = getSuggestedDropPosition(devices);
  const compactSingleDeviceView = devices.length <= 1 && !dropzoneActive;

  return (
    <div className="relative h-full w-full bg-[#232529]">
      <Canvas shadows camera={{ position: [4.25, 2.65, 4.25], fov: 32 }} gl={{ antialias: true }}>
        <color attach="background" args={['#232529']} />
        <ambientLight intensity={0.62} />
        <directionalLight position={[10, 10, 5]} intensity={1.1} castShadow />
        <directionalLight position={[-4, 3, -5]} intensity={0.4} color="#CBD5E1" />
        <EngineeringGrid />
        <WorkspaceBoundary />
        <WorkspaceReferenceBeacons active={Boolean(dropzoneActive)} />
        <AxisHud />
        <WorkspaceStarterSlots devices={devices} suggestedPosition={suggestedDropPosition} active={Boolean(dropzoneActive)} />
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.001, 0]}
          visible={false}
          onPointerMove={(event) => {
            if (!dragging || !onMoveWorkspaceDevice) return;
            const rawX = Math.min(workspaceBounds.maxX, Math.max(workspaceBounds.minX, event.point.x + dragging.offsetX));
            const rawZ = Math.min(workspaceBounds.maxZ, Math.max(workspaceBounds.minZ, event.point.z + dragging.offsetZ));
            const nextX = Math.round(rawX / workspaceSnapStep) * workspaceSnapStep;
            const nextZ = Math.round(rawZ / workspaceSnapStep) * workspaceSnapStep;
            const currentY = devices.find((device) => device.id === dragging.id)?.position[1] ?? 0;
            onMoveWorkspaceDevice(dragging.id, [nextX, currentY, nextZ]);
          }}
          onPointerUp={() => setDragging(null)}
          onPointerLeave={() => setDragging(null)}
        >
          <planeGeometry args={[54, 54]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>
        <ScenarioPreviewOverlay preview={scenarioPreview} blocked={blocked} />
        <CommandOutcomeGhost
          deviceType={deviceType}
          language={language}
          preview={scenarioPreview}
          currentActionFrame={currentActionFrame}
          runTargetDevice={runTargetDevice}
        />
        <WorkspaceDropzone language={language} position={suggestedDropPosition} active={Boolean(dropzoneActive)} />
        <SelectedDeviceFootprint device={selectedDevice} language={language} />
        <BlockedWarningRing blocked={blocked} />
        {devices.map((device) => (
          <WorkspaceDeviceMesh
            key={device.id}
            device={device}
            selected={device.id === selectedWorkspaceDeviceId || (!selectedWorkspaceDeviceId && device.id === 'primary')}
            runTarget={device.id === runTargetWorkspaceDeviceId || (!runTargetWorkspaceDeviceId && device.id === 'primary')}
            showPersistentLabel={!compactSingleDeviceView}
            onSelect={onSelectWorkspaceDevice}
            language={language}
            onStartDrag={(deviceId, point, currentPosition) => {
              setDragging({
                id: deviceId,
                offsetX: currentPosition[0] - point.x,
                offsetZ: currentPosition[2] - point.z
              });
            }}
          />
        ))}
        <ContactShadows position={[0, 0.01, 0]} opacity={0.16} scale={8.6} blur={3.2} far={3.8} color="#000000" />
        {blocked && (
          <Html center position={[0, 1.75, 0]}>
            <div className="max-w-[360px] border border-[#FECDD3] bg-[#FFF1F2]/95 px-4 py-2 text-center text-xs font-bold tracking-wide text-status-blocked">
              <div>{t(language, 'blocked_by_safety_runtime')}</div>
              {blockedReason && (
                <div className="mt-1 text-[11px] font-semibold leading-4 text-[#9F1239]">
                  {blockedReason}
                </div>
              )}
            </div>
          </Html>
        )}
        {selectedSnapshot && !blocked && (
          <Html position={[-2.2, 1.7, -1.9]}>
            <div className="border border-[#313338] bg-[#1E1F22]/95 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-[#949BA4]">
              {t(language, 'snapshot')} {selectedSnapshot.step_index}: {selectedSnapshot.stage}
            </div>
          </Html>
        )}
        <OrbitControls enablePan maxPolarAngle={Math.PI / 2.05} minDistance={2.6} maxDistance={22} target={[0, 0.82, 0]} />
      </Canvas>
      <div className="pointer-events-none absolute left-3 top-3 rounded-[3px] border border-[#313338] bg-[#1E1F22]/82 px-2 py-1 font-mono text-[11px] leading-4 text-[#949BA4]">
        <div className="font-semibold text-[#C2CAD3]">{t(language, 'perspective_grid_snap')}</div>
      </div>
      {scenarioPreview && (
        <div className="pointer-events-none absolute left-3 top-[2.65rem] rounded-[3px] border border-[#313338] bg-[#1E1F22]/82 px-2 py-1 font-mono text-[11px] font-semibold text-[#38BDF8]">
          {t(language, 'action_plan_preview')}
        </div>
      )}
      {blocked && (
        <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 border border-status-blocked bg-status-blocked-surface/95 px-3 py-1 font-mono text-[11px] font-bold text-status-blocked">
          {t(language, 'safety_runtime_blocked_caps')}
        </div>
      )}
      {!compactSingleDeviceView && (
        <div className="pointer-events-none absolute right-3 bottom-3 rounded-[3px] border border-[#313338] bg-[#1E1F22]/72 px-2 py-1 font-mono text-[11px] leading-4 text-[#8A8F98]">
          <span className="text-[#E6EAF0]">{t(language, 'workspace_layout_bounds')}</span>: X {workspaceBounds.minX}..{workspaceBounds.maxX}, Z {workspaceBounds.minZ}..{workspaceBounds.maxZ}
        </div>
      )}
      {selectedDevice && !compactSingleDeviceView && (
        <div className="pointer-events-none absolute right-3 top-3 rounded-[3px] border border-[#075985] bg-[#0B2233]/68 px-2 py-1 font-mono text-[11px] leading-4 text-[#D8EEFF]">
          <div className="font-semibold">{t(language, 'workspace_selected_layout')}</div>
          <div>{localizeDisplayName(language, selectedDevice.label)}</div>
          <div>X {selectedDevice.position[0].toFixed(1)} | Y {selectedDevice.position[1].toFixed(1)} | Z {selectedDevice.position[2].toFixed(1)}</div>
        </div>
      )}
      {blocked && <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_52%,rgba(225,29,72,0.11)_100%)]" />}
    </div>
  );
}

useGLTF.preload('/models/devices/robot-arm-industrial.glb');
useGLTF.preload('/models/devices/mobile-robot-amr.glb');
useGLTF.preload('/models/devices/smart-light-industrial.glb');
useGLTF.preload('/models/devices/camera-sensor-industrial.glb');
useGLTF.preload('/models/devices/conveyor-belt-industrial.glb');
useGLTF.preload('/models/real-devices/ur5e-real-open-source.glb');
useGLTF.preload('/models/real-devices/turtlebot3-burger-real-open-source.glb');
