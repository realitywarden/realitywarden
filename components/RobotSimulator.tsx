'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { DeviceGeometry } from '@/types/deviceMeta';
import type { SafetyReport } from '@/types/safety';
import type { MotionPlan } from '@/types/simulation';
import type { TaskDSL } from '@/types/taskDsl';

interface RobotSimulatorProps {
  geometry: DeviceGeometry;
  profileId: string;
  task: TaskDSL | null;
  motionPlan: MotionPlan | null;
  safety: SafetyReport | null;
  runKey: number;
  onStepStatus: (stepId: string, status: 'running' | 'completed') => void;
  onComplete: () => void;
}

function toVector3(value: [number, number, number]) {
  return new THREE.Vector3(value[0], value[1], value[2]);
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function moveVector(source: THREE.Vector3, target: THREE.Vector3, duration: number, cancelled: () => boolean) {
  const start = source.clone();
  const startTime = performance.now();
  return new Promise<void>((resolve) => {
    const tick = (now: number) => {
      if (cancelled()) {
        resolve();
        return;
      }
      const progress = Math.min(1, (now - startTime) / duration);
      source.lerpVectors(start, target, progress);
      if (progress < 1) requestAnimationFrame(tick);
      else resolve();
    };
    requestAnimationFrame(tick);
  });
}

function makeWorkspaceBorder(geometry: DeviceGeometry, color: number) {
  const { x_min, x_max, z_min, z_max } = geometry.workspace;
  const y = geometry.table.height + 0.035;
  const points = [
    new THREE.Vector3(x_min, y, z_min),
    new THREE.Vector3(x_max, y, z_min),
    new THREE.Vector3(x_max, y, z_max),
    new THREE.Vector3(x_min, y, z_max),
    new THREE.Vector3(x_min, y, z_min)
  ];
  return new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color }));
}

export function RobotSimulator({ geometry, profileId, task, motionPlan, safety, runKey, onStepStatus, onComplete }: RobotSimulatorProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const armRef = useRef<THREE.Group | null>(null);
  const redRef = useRef<THREE.Mesh | null>(null);
  const blueRef = useRef<THREE.Mesh | null>(null);
  const borderRef = useRef<THREE.Line | null>(null);
  const pathRef = useRef<THREE.Line | null>(null);
  const cancelRef = useRef(0);

  useEffect(() => {
    if (!mountRef.current) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf7f3ea);
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    mountRef.current.appendChild(renderer.domElement);

    sceneRef.current = scene;
    cameraRef.current = camera;
    rendererRef.current = renderer;

    const resize = () => {
      if (!mountRef.current) return;
      const { clientWidth, clientHeight } = mountRef.current;
      renderer.setSize(clientWidth, clientHeight);
      camera.aspect = clientWidth / clientHeight;
      camera.updateProjectionMatrix();
    };
    resize();
    window.addEventListener('resize', resize);

    let animationId = 0;
    const render = () => {
      animationId = requestAnimationFrame(render);
      renderer.render(scene, camera);
    };
    render();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationId);
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  useEffect(() => {
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    if (!scene || !camera) return;

    cancelRef.current += 1;
    scene.clear();
    scene.background = new THREE.Color(0xf7f3ea);
    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(5, 10, 5);
    scene.add(directionalLight);

    camera.position.copy(toVector3(geometry.camera.position));
    camera.lookAt(toVector3(geometry.camera.target));

    const table = new THREE.Mesh(
      new THREE.BoxGeometry(geometry.table.width, geometry.table.height, geometry.table.depth),
      new THREE.MeshStandardMaterial({ color: 0xe7e0d3, roughness: 1 })
    );
    table.position.y = geometry.table.height / 2 - geometry.table.height;
    scene.add(table);

    for (const [zoneId, zone] of Object.entries(geometry.zones)) {
      const isForbidden = zoneId.includes('glass') || zoneId.includes('operator') || zoneId.includes('calibration');
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(zone.size[0], zone.size[1]),
        new THREE.MeshStandardMaterial({
          color: isForbidden ? 0xe11d48 : 0x059669,
          transparent: true,
          opacity: isForbidden ? 0.1 : 0.15,
          roughness: 0.9,
          metalness: 0.05,
          side: THREE.DoubleSide
        })
      );
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.copy(toVector3(zone.position));
      scene.add(mesh);
    }

    const border = makeWorkspaceBorder(geometry, 0xe7e0d3);
    scene.add(border);
    borderRef.current = border;

    const robotMaterial = new THREE.MeshStandardMaterial({ color: 0x4b5563, roughness: 0.9, metalness: 0.1 });
    const arm = new THREE.Group();
    arm.position.copy(toVector3(geometry.robot.base_position));
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.18, 32), robotMaterial);
    const shoulder = new THREE.Mesh(new THREE.BoxGeometry(0.2, geometry.robot.arm_segments[0], 0.2), robotMaterial);
    shoulder.position.set(0, geometry.robot.arm_segments[0] / 2, 0);
    const forearm = new THREE.Mesh(new THREE.BoxGeometry(0.16, geometry.robot.arm_segments[1], 0.16), robotMaterial);
    forearm.position.set(geometry.robot.arm_segments[1] * 0.35, geometry.robot.arm_segments[0] * 0.8, 0);
    forearm.rotation.z = -0.75;
    const gripper = new THREE.Mesh(
      new THREE.BoxGeometry(geometry.robot.gripper_size * 1.8, geometry.robot.gripper_size * 0.35, geometry.robot.gripper_size),
      robotMaterial
    );
    gripper.position.set(0, geometry.robot.arm_segments[0] + geometry.robot.arm_segments[1] * 0.45, -0.35);
    arm.add(base, shoulder, forearm, gripper);
    scene.add(arm);
    armRef.current = arm;

    const red = new THREE.Mesh(
      new THREE.BoxGeometry(geometry.objects.red_cube.size, geometry.objects.red_cube.size, geometry.objects.red_cube.size),
      new THREE.MeshStandardMaterial({ color: 0xd9534f, roughness: 0.7 })
    );
    red.position.copy(toVector3(geometry.objects.red_cube.position));
    scene.add(red);
    redRef.current = red;

    const blue = new THREE.Mesh(
      new THREE.BoxGeometry(geometry.objects.blue_cube.size, geometry.objects.blue_cube.size, geometry.objects.blue_cube.size),
      new THREE.MeshStandardMaterial({ color: 0x5bc0de, roughness: 0.7 })
    );
    blue.position.copy(toVector3(geometry.objects.blue_cube.position));
    scene.add(blue);
    blueRef.current = blue;

    const glass = new THREE.Mesh(
      new THREE.CylinderGeometry(geometry.objects.glass_cup.radius, geometry.objects.glass_cup.radius * 0.82, geometry.objects.glass_cup.height, 32),
      new THREE.MeshStandardMaterial({ color: 0x9ca3af, transparent: true, opacity: 0.3 })
    );
    glass.position.copy(toVector3(geometry.objects.glass_cup.position));
    scene.add(glass);
  }, [geometry, profileId]);

  useEffect(() => {
    cancelRef.current += 1;
    const token = cancelRef.current;
    const cancelled = () => cancelRef.current !== token;

    const scene = sceneRef.current;
    const red = redRef.current;
    const blue = blueRef.current;
    const border = borderRef.current;
    const arm = armRef.current;
    if (!scene || !red || !blue || !border || !arm) return;

    red.position.copy(toVector3(geometry.objects.red_cube.position));
    blue.position.copy(toVector3(geometry.objects.blue_cube.position));
    const gripper = arm.children[3];
    gripper.position.set(0, geometry.robot.arm_segments[0] + geometry.robot.arm_segments[1] * 0.45, -0.35);
    (border.material as THREE.LineBasicMaterial).color.setHex(safety?.status === 'blocked' ? 0xdc2626 : 0xe7e0d3);

    if (pathRef.current) {
      scene.remove(pathRef.current);
      pathRef.current.geometry.dispose();
    }
    if (!task || !safety || !motionPlan) return;

    const redStart = toVector3(geometry.objects.red_cube.position);
    const blueStart = toVector3(geometry.objects.blue_cube.position);
    const rightSafe = toVector3(geometry.zones.right_safe_zone.position);
    const leftSafe = toVector3(geometry.zones.left_safe_zone.position);
    const blocked = safety.status === 'blocked';
    const plannedPath = motionPlan.steps.flatMap((step) => step.path ?? []);
    const pathPoints = plannedPath.length > 0
      ? plannedPath
      : blocked
      ? [redStart, new THREE.Vector3(geometry.workspace.x_max + 0.5, redStart.y, geometry.workspace.z_max)]
      : task.steps.some((step) => step.target === 'blue_cube')
        ? [redStart, rightSafe, blueStart, leftSafe]
        : [redStart, rightSafe];
    const path = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pathPoints.map((point) => {
        const vector = Array.isArray(point) ? new THREE.Vector3(point[0], point[1], point[2]) : point.clone();
        return vector.setY(geometry.table.height + 0.07);
      })),
      new THREE.LineDashedMaterial({ color: blocked ? 0xdc2626 : 0xe26d3d, dashSize: 0.2, gapSize: 0.1 })
    );
    path.computeLineDistances();
    scene.add(path);
    pathRef.current = path;

    if (safety.status !== 'pass' || motionPlan.steps.some((step) => step.status === 'blocked')) return;

    const lift = geometry.robot.arm_segments[0] + geometry.robot.arm_segments[1] * 0.35;
    const run = async () => {
      let held: THREE.Mesh | null = null;
      for (const step of motionPlan.steps) {
        if (cancelled()) return;
        onStepStatus(step.step_id, 'running');
        if ((step.action === 'move_to_pose' || step.action === 'return_home') && step.target_position) {
          const target = new THREE.Vector3(step.target_position[0], step.target_position[1], step.target_position[2]).sub(arm.position).setY(lift);
          await moveVector(gripper.position, target, Math.max(250, step.estimated_duration_ms), cancelled);
          if (held) {
            held.position.set(step.target_position[0], step.target_position[1], step.target_position[2]);
          }
        }
        if (step.action === 'grasp') {
          held = step.target === 'blue_cube' ? blue : red;
          held.position.y += geometry.objects.red_cube.size * 0.45;
          await delay(120);
        }
        if (step.action === 'release') {
          if (held && step.target_position) {
            held.position.set(step.target_position[0], step.target_position[1], step.target_position[2]);
          }
          held = null;
          await delay(120);
        }
        onStepStatus(step.step_id, 'completed');
      }
      await moveVector(gripper.position, new THREE.Vector3(0, lift, -0.35), 520, cancelled);
      if (!cancelled()) onComplete();
    };

    void run();
  }, [runKey, safety, task, motionPlan, onStepStatus, onComplete, geometry]);

  return (
    <main className={`relative h-full w-[40%] overflow-hidden rounded-xl border border-panel-border shadow-inner ${safety?.status === 'blocked' ? 'animate-pulse-error' : ''}`}>
      <div ref={mountRef} className="h-full w-full" />
      <div className="pointer-events-none absolute left-5 top-5 rounded-lg border border-panel-border bg-panel/90 px-4 py-3 shadow-sm">
        <div className="text-xs font-semibold uppercase text-text-muted">Robot Simulator</div>
        <div className="mt-1 text-sm font-bold">
          {safety?.status === 'blocked'
            ? 'BLOCKED - no device execution'
            : safety?.status === 'pass'
              ? 'PASS - profile dry run approved'
              : safety?.status === 'needs_confirmation'
                ? 'NEEDS CONFIRMATION - no animation'
                : 'Waiting for task'}
        </div>
        <div className="mt-1 text-xs text-text-muted">{profileId}</div>
      </div>
      {safety?.status === 'blocked' && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-4 text-lg font-bold text-blocked-red shadow-sm">BLOCKED</div>
        </div>
      )}
    </main>
  );
}
