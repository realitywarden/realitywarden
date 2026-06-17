'use client';

import { Canvas, useFrame } from '@react-three/fiber';
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
  onSelectWorkspaceDevice?: (deviceId: string) => void;
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
      material.opacity = 0.78;
    });
  });

  return (
    <>
      <gridHelper ref={gridRef} args={[8, 16, '#3E4045', '#2B2D31']} position={[0, 0, 0]} />
      <gridHelper args={[8, 80, '#2B2D31', '#2B2D31']} position={[0, 0.002, 0]} />
    </>
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
      color: blocked || preview.unsafe ? '#E11D48' : preview.passed ? '#10B981' : '#0284C7',
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
  const color = blocked || preview.unsafe ? '#E11D48' : preview.passed ? '#10B981' : '#38BDF8';
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
      <meshStandardMaterial ref={materialRef} color="#E11D48" roughness={0.85} metalness={0.05} transparent opacity={0.28} />
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
  onSelect,
  language
}: {
  device: SemanticWorkspaceDevice;
  selected: boolean;
  onSelect?: (deviceId: string) => void;
  language: 'zh' | 'en';
}) {
  const [hovered, setHovered] = useState(false);
  const status = localizeStatus(language, String(device.state.status ?? 'idle'));
  const shortName = localizeDisplayName(language, device.deviceType === 'robot_arm' ? 'Robot Arm' : device.label);
  return (
    <group position={device.position} onPointerOver={() => setHovered(true)} onPointerOut={() => setHovered(false)} onClick={(event) => {
      event.stopPropagation();
      onSelect?.(device.id);
    }}>
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
      {hovered && !selected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.026, 0]}>
          <ringGeometry args={[0.88, 0.91, 72]} />
          <meshBasicMaterial color="#38BDF8" transparent opacity={0.45} />
        </mesh>
      )}
      {hovered && (
      <Html center position={[0.74, 1.32, 0]}>
        <div className="pointer-events-none whitespace-nowrap rounded-[3px] border border-[#313338] bg-[#101114]/55 px-1.5 py-0.5 font-mono text-[8px] font-semibold leading-3 text-[#9AA3AF] opacity-70">
          <div>{shortName}</div>
          <div className="text-[7px] text-[#6B7280]">{localizeDeviceType(language, device.deviceType)} / {status}</div>
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
  onSelectWorkspaceDevice
}: SemanticDeviceStageProps) {
  const frameState = currentActionFrame ? { ...state, ...currentActionFrame.device_state, visual_state: currentActionFrame.visual_state } : state;
  const devices = workspaceDevices ?? [{ id: 'primary', label: t(language, 'device'), deviceType, state: frameState, position: [0, 0.02, 0] as [number, number, number] }];

  return (
    <div className="relative h-full w-full bg-[#232529]">
      <Canvas shadows camera={{ position: [3.05, 2.15, 3.05], fov: 38 }} gl={{ antialias: true }}>
        <color attach="background" args={['#232529']} />
        <ambientLight intensity={0.45} />
        <directionalLight position={[10, 10, 5]} intensity={0.9} castShadow />
        <directionalLight position={[-4, 3, -5]} intensity={0.28} color="#94A3B8" />
        <EngineeringGrid />
        <AxisHud />
        <ScenarioPreviewOverlay preview={scenarioPreview} blocked={blocked} />
        <BlockedWarningRing blocked={blocked} />
        {devices.map((device) => (
          <WorkspaceDeviceMesh
            key={device.id}
            device={device}
            selected={device.id === selectedWorkspaceDeviceId || (!selectedWorkspaceDeviceId && device.id === 'primary')}
            onSelect={onSelectWorkspaceDevice}
            language={language}
          />
        ))}
        <ContactShadows position={[0, 0.01, 0]} opacity={0.16} scale={5.4} blur={2.6} far={2.5} color="#000000" />
        {blocked && (
          <Html center position={[0, 1.75, 0]}>
            <div className="max-w-[360px] border border-[#FECDD3] bg-[#FFF1F2]/95 px-4 py-2 text-center text-xs font-bold tracking-wide text-[#BE123C]">
              <div>{t(language, 'blocked_by_safety_runtime')}</div>
              {blockedReason && (
                <div className="mt-1 text-[10px] font-semibold leading-4 text-[#9F1239]">
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
        <OrbitControls enablePan maxPolarAngle={Math.PI / 2.05} minDistance={2.3} maxDistance={7.2} target={[0, 0.62, 0]} />
      </Canvas>
      <div className="pointer-events-none absolute left-3 top-3 border border-[#313338] bg-[#1E1F22]/90 px-2 py-1 font-mono text-[10px] font-semibold text-[#949BA4]">
        {t(language, 'perspective_grid_snap')}
      </div>
      {scenarioPreview && (
        <div className="pointer-events-none absolute left-3 top-10 border border-[#313338] bg-[#1E1F22]/90 px-2 py-1 font-mono text-[10px] font-semibold text-[#38BDF8]">
          {t(language, 'action_plan_preview')}
        </div>
      )}
      {blocked && (
        <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 border border-[#E11D48] bg-[#2B1116]/95 px-3 py-1 font-mono text-[11px] font-bold text-[#E11D48]">
          {t(language, 'safety_runtime_blocked_caps')}
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
