# Real Asset Import Workflow

Use this workflow when replacing placeholders with real device models:

1. Put the real `.glb` or `.gltf` file under `public/models/real-devices/`.
2. Add license and attribution text next to the model if required.
3. Update the device profile `model_asset` block.
4. Run:

```powershell
npm run typecheck
npm run test:conformance
npm run test:virtual-lab
```

The conformance test validates that every virtual profile has a model asset and that the referenced file exists.

## Current Imported Sources

- `public/models/real-devices/ur5e-real-open-source.glb`
  - Generated from Universal Robots ROS2 Description UR5e collision STL meshes.
  - Bound to `profiles/virtual-robot-arm/device.meta.json`.
- `public/models/real-devices/turtlebot3-burger-real-open-source.glb`
  - Generated from ROBOTIS TurtleBot3 Burger URDF/STL meshes.
  - Bound to `profiles/virtual-mobile-robot/device.meta.json`.

Rebuild those files with:

```powershell
npm run assets:real
```

Do not relabel generated placeholder assets as real device assets.
