'use client';

import { Canvas } from '@react-three/fiber';
import { OrbitControls, useGLTF } from '@react-three/drei';
import { Suspense, useMemo } from 'react';
import type { DeviceAsset } from '@/lib/assets/DeviceAsset';
import type { DeviceType } from '@/types/deviceMeta';

function FallbackModel({ deviceType }: { deviceType: DeviceType }) {
  if (deviceType === 'plc_cabinet') {
    return <mesh position={[0, 0.45, 0]}><boxGeometry args={[0.6, 0.9, 0.24]} /><meshStandardMaterial color="#6B7280" roughness={0.72} metalness={0.16} /></mesh>;
  }
  if (deviceType === 'warehouse_rack') {
    return <mesh position={[0, 0.45, 0]}><boxGeometry args={[1.0, 0.08, 0.65]} /><meshStandardMaterial color="#9CA3AF" roughness={0.75} metalness={0.16} /></mesh>;
  }
  if (deviceType === 'sensor_box') {
    return <mesh position={[0, 0.32, 0]}><boxGeometry args={[0.42, 0.36, 0.28]} /><meshStandardMaterial color="#6B7280" roughness={0.76} metalness={0.12} /></mesh>;
  }
  if (deviceType === 'lab_instrument') {
    return <mesh position={[0, 0.28, 0]}><boxGeometry args={[0.82, 0.38, 0.46]} /><meshStandardMaterial color="#9CA3AF" roughness={0.7} metalness={0.12} /></mesh>;
  }
  if (deviceType === 'mobile_robot') {
    return <mesh position={[0, 0.18, 0]}><boxGeometry args={[0.78, 0.24, 0.52]} /><meshStandardMaterial color="#4B5563" roughness={0.82} metalness={0.08} /></mesh>;
  }
  if (deviceType === 'conveyor_belt') {
    return <mesh position={[0, 0.2, 0]}><boxGeometry args={[1.1, 0.16, 0.42]} /><meshStandardMaterial color="#9CA3AF" roughness={0.7} metalness={0.18} /></mesh>;
  }
  return <mesh position={[0, 0.35, 0]}><cylinderGeometry args={[0.24, 0.28, 0.7, 32]} /><meshStandardMaterial color="#4B5563" roughness={0.82} metalness={0.1} /></mesh>;
}

function GLTFPreview({ uri }: { uri: string }) {
  const gltf = useGLTF(uri);
  const scene = useMemo(() => gltf.scene.clone(true), [gltf.scene]);
  return <primitive object={scene} />;
}

export function DeviceModelPreview({ asset, compact = false }: { asset: DeviceAsset; compact?: boolean }) {
  const visual = asset.manifest.visual_model;
  const hasModel = Boolean(visual.path && (visual.type === 'glb' || visual.type === 'gltf'));

  return (
    <div className={compact ? 'h-16 w-full overflow-hidden border border-[#E5E5EA] bg-white' : 'h-64 w-full overflow-hidden border border-[#E5E5EA] bg-white'}>
      <Canvas camera={{ position: [1.8, 1.35, 1.8], fov: 42 }}>
        <color attach="background" args={['#FFFFFF']} />
        <ambientLight intensity={0.72} />
        <directionalLight position={[4, 5, 3]} intensity={0.9} />
        <gridHelper args={[2.4, 12, '#D1D5DB', '#E5E7EB']} />
        <Suspense fallback={<FallbackModel deviceType={asset.manifest.device_type} />}>
          {hasModel ? <GLTFPreview uri={visual.path as string} /> : <FallbackModel deviceType={asset.manifest.device_type} />}
        </Suspense>
        {!compact && <OrbitControls enablePan={false} minDistance={1.4} maxDistance={4.8} target={[0, 0.35, 0]} />}
      </Canvas>
      {!compact && (
        <div className="border-t border-[#E5E5EA] bg-[#F5F5F7] px-2 py-1 text-[11px] text-[#86868B]">
          {asset.manifest.asset_id} / {asset.manifest.device_type} / {asset.manifest.license}
        </div>
      )}
    </div>
  );
}
