import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

const root = process.cwd();
const outDir = path.join(root, 'public', 'models', 'devices');
fs.mkdirSync(outDir, { recursive: true });

globalThis.FileReader = class FileReader {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((buffer) => {
      this.result = buffer;
      this.onloadend?.();
    }).catch((error) => {
      this.error = error;
      this.onerror?.(error);
    });
  }
};

const mat = {
  body: new THREE.MeshStandardMaterial({ color: '#4B5563', roughness: 0.86, metalness: 0.12 }),
  dark: new THREE.MeshStandardMaterial({ color: '#111827', roughness: 0.88, metalness: 0.08 }),
  frame: new THREE.MeshStandardMaterial({ color: '#9CA3AF', roughness: 0.74, metalness: 0.16 }),
  blue: new THREE.MeshStandardMaterial({ color: '#0066CC', roughness: 0.78, metalness: 0.06 }),
  belt: new THREE.MeshStandardMaterial({ color: '#374151', roughness: 0.82, metalness: 0.1 }),
  light: new THREE.MeshStandardMaterial({ color: '#FFD58A', emissive: '#FFD58A', emissiveIntensity: 0.55, roughness: 0.88, metalness: 0.03 })
};

function mesh(geometry, material, position = [0, 0, 0], rotation = [0, 0, 0]) {
  const node = new THREE.Mesh(geometry, material);
  node.position.set(...position);
  node.rotation.set(...rotation);
  node.castShadow = true;
  node.receiveShadow = true;
  return node;
}

function robotArm() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(0.92, 0.08, 0.72), mat.frame, [0, 0.04, 0]));
  g.add(mesh(new THREE.CylinderGeometry(0.34, 0.42, 0.26, 48), mat.belt, [0, 0.17, 0]));
  g.add(mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.22, 40), mat.body, [0, 0.34, 0]));
  g.add(mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.38, 40), mat.dark, [0, 0.48, 0], [Math.PI / 2, 0, 0]));
  g.add(mesh(new THREE.BoxGeometry(0.2, 0.94, 0.22), mat.body, [0, 0.98, 0], [0, 0, -0.18]));
  g.add(mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.34, 36), mat.dark, [0.1, 1.42, 0], [Math.PI / 2, 0, 0]));
  g.add(mesh(new THREE.BoxGeometry(0.18, 0.84, 0.2), mat.body, [0.55, 1.35, 0], [0, 0, -0.72]));
  g.add(mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.28, 32), mat.dark, [0.86, 1.66, 0], [Math.PI / 2, 0, 0]));
  g.add(mesh(new THREE.BoxGeometry(0.38, 0.13, 0.18), mat.body, [0.96, 1.55, 0]));
  g.add(mesh(new THREE.BoxGeometry(0.09, 0.34, 0.07), mat.body, [1.14, 1.42, 0.1]));
  g.add(mesh(new THREE.BoxGeometry(0.09, 0.34, 0.07), mat.body, [1.14, 1.42, -0.1]));
  g.add(mesh(new THREE.BoxGeometry(0.28, 0.28, 0.28), mat.blue, [-0.85, 0.16, 0.55]));
  return g;
}

function mobileRobot() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(1.32, 0.1, 0.9), mat.frame, [0, 0.06, 0]));
  g.add(mesh(new THREE.BoxGeometry(1.15, 0.32, 0.72), mat.body, [0, 0.18, 0]));
  g.add(mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.12, 36), mat.dark, [0.18, 0.42, 0]));
  g.add(mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.06, 32), mat.blue, [0.18, 0.51, 0]));
  g.add(mesh(new THREE.BoxGeometry(0.06, 0.1, 0.42), mat.frame, [0.6, 0.23, 0]));
  for (const x of [-0.42, 0.42]) for (const z of [-0.42, 0.42]) {
    g.add(mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.1, 24), mat.dark, [x, 0.12, z], [0, 0, Math.PI / 2]));
  }
  return g;
}

function smartLight() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.34, 0.38, 0.07, 40), mat.frame, [0, 0.035, 0]));
  g.add(mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.25, 24), mat.body, [0, 0.62, 0]));
  g.add(mesh(new THREE.CylinderGeometry(0.26, 0.2, 0.16, 36), mat.body, [0, 1.24, 0]));
  g.add(mesh(new THREE.CylinderGeometry(0.36, 0.28, 0.18, 40), mat.light, [0, 1.36, 0], [Math.PI / 2, 0, 0]));
  return g;
}

function cameraSensor() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.9, 20), mat.body, [0, 0.45, 0]));
  g.add(mesh(new THREE.BoxGeometry(0.56, 0.1, 0.44), mat.frame, [0, 0.08, 0]));
  g.add(mesh(new THREE.BoxGeometry(0.42, 0.12, 0.12), mat.belt, [0, 0.92, 0.08]));
  g.add(mesh(new THREE.BoxGeometry(0.9, 0.44, 0.42), mat.body, [0, 1.08, 0]));
  g.add(mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.12, 36), mat.dark, [0, 1.08, -0.32], [Math.PI / 2, 0, 0]));
  g.add(mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.18, 32), mat.dark, [0, 1.08, -0.43], [Math.PI / 2, 0, 0]));
  return g;
}

function conveyorBelt() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(2.75, 0.12, 0.78), mat.frame, [0, 0.13, 0]));
  g.add(mesh(new THREE.BoxGeometry(2.42, 0.08, 0.58), mat.belt, [0, 0.26, 0]));
  for (const z of [-0.42, 0.42]) g.add(mesh(new THREE.BoxGeometry(2.65, 0.12, 0.08), mat.body, [0, 0.38, z]));
  for (const x of [-1.25, 1.25]) g.add(mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.72, 32), mat.belt, [x, 0.23, 0], [Math.PI / 2, 0, 0]));
  g.add(mesh(new THREE.BoxGeometry(0.28, 0.28, 0.28), mat.blue, [-0.75, 0.45, 0]));
  g.add(mesh(new THREE.BoxGeometry(0.72, 0.22, 0.44), mat.frame, [1.35, 0.12, -0.72]));
  for (const x of [-1, 1]) for (const z of [-1, 1]) g.add(mesh(new THREE.BoxGeometry(0.08, 0.42, 0.08), mat.body, [x * 1.12, -0.12, z * 0.28]));
  return g;
}

const assets = [
  ['robot-arm-industrial.glb', robotArm],
  ['mobile-robot-amr.glb', mobileRobot],
  ['smart-light-industrial.glb', smartLight],
  ['camera-sensor-industrial.glb', cameraSensor],
  ['conveyor-belt-industrial.glb', conveyorBelt]
];

async function exportGlb(name, factory) {
  const exporter = new GLTFExporter();
  const scene = factory();
  scene.name = name.replace(/\.glb$/, '');
  const arrayBuffer = await new Promise((resolve, reject) => {
    exporter.parse(scene, resolve, reject, { binary: true });
  });
  fs.writeFileSync(path.join(outDir, name), Buffer.from(arrayBuffer));
}

for (const [name, factory] of assets) {
  await exportGlb(name, factory);
}

fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify({
  version: 1,
  assets: assets.map(([file]) => ({ file, format: 'glb', generated_by: 'scripts/generate-device-glb-assets.mjs' }))
}, null, 2));

console.log(`Generated ${assets.length} GLB device assets in ${path.relative(root, outDir)}`);
