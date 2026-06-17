import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';

const root = process.cwd();
const outDir = path.join(root, 'public', 'models', 'real-devices');
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

const loader = new STLLoader();

const materials = {
  urBody: new THREE.MeshStandardMaterial({ color: '#D8DDE3', roughness: 0.62, metalness: 0.18 }),
  urJoint: new THREE.MeshStandardMaterial({ color: '#B8C0CA', roughness: 0.7, metalness: 0.16 }),
  turtleBody: new THREE.MeshStandardMaterial({ color: '#30343B', roughness: 0.78, metalness: 0.12 }),
  turtleWheel: new THREE.MeshStandardMaterial({ color: '#111827', roughness: 0.86, metalness: 0.08 }),
  turtleSensor: new THREE.MeshStandardMaterial({ color: '#4B5563', roughness: 0.76, metalness: 0.14 })
};

function parseStl(filePath) {
  const buffer = fs.readFileSync(filePath);
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  const geometry = loader.parse(arrayBuffer);
  geometry.computeVertexNormals();
  return geometry;
}

function stlMesh(filePath, material, options = {}) {
  const mesh = new THREE.Mesh(parseStl(filePath), material);
  mesh.name = options.name ?? path.basename(filePath, path.extname(filePath));
  mesh.position.set(...(options.position ?? [0, 0, 0]));
  mesh.rotation.set(...(options.rotation ?? [0, 0, 0]));
  mesh.scale.set(...(options.scale ?? [1, 1, 1]));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function degrees(value) {
  return THREE.MathUtils.degToRad(value);
}

function makeUr5e() {
  const baseDir = path.join(root, '.asset-sources', 'universal-robots-ros2-description', 'meshes', 'ur5e', 'collision');
  const group = new THREE.Group();
  group.name = 'Universal Robots UR5e - collision mesh assembly';

  const parts = [
    ['base.stl', materials.urJoint, [0, 0, 0], [0, 0, degrees(180)]],
    ['shoulder.stl', materials.urJoint, [0, 0, 0.1625], [0, 0, degrees(180)]],
    ['upperarm.stl', materials.urBody, [0, 0, 0.34], [degrees(90), 0, degrees(-90)]],
    ['forearm.stl', materials.urBody, [-0.43, 0, 0.58], [degrees(90), 0, degrees(-90)]],
    ['wrist1.stl', materials.urJoint, [-0.78, 0, 0.64], [degrees(90), 0, 0]],
    ['wrist2.stl', materials.urJoint, [-0.83, -0.1, 0.64], [0, 0, 0]],
    ['wrist3.stl', materials.urJoint, [-0.83, -0.19, 0.64], [degrees(90), 0, 0]]
  ];

  for (const [file, material, position, rotation] of parts) {
    group.add(stlMesh(path.join(baseDir, file), material, { name: `ur5e_${path.basename(file, '.stl')}`, position, rotation }));
  }

  group.rotation.y = degrees(-18);
  group.scale.setScalar(2.2);
  return group;
}

function makeTurtleBot3Burger() {
  const meshDir = path.join(root, '.asset-sources', 'turtlebot3', 'turtlebot3_description', 'meshes');
  const group = new THREE.Group();
  group.name = 'ROBOTIS TurtleBot3 Burger - URDF mesh assembly';

  group.add(stlMesh(path.join(meshDir, 'bases', 'burger_base.stl'), materials.turtleBody, {
    name: 'turtlebot3_burger_base',
    position: [-0.032, 0, 0.01],
    scale: [0.001, 0.001, 0.001]
  }));
  group.add(stlMesh(path.join(meshDir, 'wheels', 'left_tire.stl'), materials.turtleWheel, {
    name: 'turtlebot3_left_tire',
    position: [0, 0.08, 0.033],
    rotation: [0, 0, 0],
    scale: [0.001, 0.001, 0.001]
  }));
  group.add(stlMesh(path.join(meshDir, 'wheels', 'right_tire.stl'), materials.turtleWheel, {
    name: 'turtlebot3_right_tire',
    position: [0, -0.08, 0.033],
    rotation: [0, 0, 0],
    scale: [0.001, 0.001, 0.001]
  }));
  group.add(stlMesh(path.join(meshDir, 'sensors', 'lds.stl'), materials.turtleSensor, {
    name: 'turtlebot3_lds_sensor',
    position: [-0.032, 0, 0.182],
    scale: [0.001, 0.001, 0.001]
  }));

  group.scale.setScalar(6.2);
  group.rotation.y = degrees(180);
  return group;
}

async function exportGlb(fileName, object) {
  const exporter = new GLTFExporter();
  const arrayBuffer = await new Promise((resolve, reject) => {
    exporter.parse(object, resolve, reject, { binary: true, onlyVisible: true });
  });
  fs.writeFileSync(path.join(outDir, fileName), Buffer.from(arrayBuffer));
}

const assets = [
  {
    file: 'ur5e-real-open-source.glb',
    source: 'https://github.com/UniversalRobots/Universal_Robots_ROS2_Description',
    license: 'BSD-3-Clause for repository content used here; UR5e collision STL meshes from Universal Robots ROS2 description package.',
    attribution: 'Universal Robots ROS2 Description, UR5e collision meshes.',
    make: makeUr5e
  },
  {
    file: 'turtlebot3-burger-real-open-source.glb',
    source: 'https://github.com/ROBOTIS-GIT/turtlebot3',
    license: 'Apache-2.0',
    attribution: 'ROBOTIS TurtleBot3 Burger URDF/STL meshes.',
    make: makeTurtleBot3Burger
  }
];

for (const asset of assets) {
  await exportGlb(asset.file, asset.make());
}

fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify({
  version: 1,
  generated_by: 'scripts/convert-real-device-assets.mjs',
  assets: assets.map(({ make, ...asset }) => ({ ...asset, format: 'glb' }))
}, null, 2));

console.log(`Converted ${assets.length} real device model assets into ${path.relative(root, outDir)}`);
