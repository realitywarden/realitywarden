# Real Device Model Assets

RealityWarden must not label generated geometry as a real device model.

A real device model asset must come from one of these sources:

1. Manufacturer CAD, GLB, GLTF, STEP, STL, or URDF mesh files.
2. An open-source robot description repository with a clear license.
3. A customer-owned or contributor-owned 3D asset with written permission.

Generated placeholder models belong in:

```text
public/models/devices/
```

Verified real device models belong in:

```text
public/models/real-devices/
```

## Device Profile Binding

Every real asset must be declared in `device.meta.json`:

```json
{
  "model_asset": {
    "format": "glb",
    "uri": "/models/real-devices/vendor-device.glb",
    "source": "real_device_cad",
    "license": "Vendor license or open-source license name",
    "attribution": "Vendor / project / author",
    "scale": 1,
    "position": [0, 0, 0],
    "rotation": [0, 0, 0]
  }
}
```

Allowed `source` values:

```text
real_device_cad
open_source_robot_model
generated_placeholder
```

## Current Status

RealityWarden now has two verified real-source GLB assets:

| Profile | Runtime asset | Source | License |
| --- | --- | --- | --- |
| `virtual-robot-arm` | `/models/real-devices/ur5e-real-open-source.glb` | Universal Robots ROS2 Description, UR5e collision STL meshes | BSD-3-Clause repository content; UR mesh terms must be reviewed for production redistribution |
| `virtual-mobile-robot` | `/models/real-devices/turtlebot3-burger-real-open-source.glb` | ROBOTIS TurtleBot3 Burger URDF/STL meshes | Apache-2.0 |

The remaining built-in smart light, camera sensor, and conveyor belt GLB assets are still placeholders generated for the rendering pipeline.
They must stay marked as `generated_placeholder` until a licensed real asset is imported.

To make a profile real, replace its `model_asset.uri` with a licensed real GLB and set:

```json
"source": "real_device_cad"
```

or:

```json
"source": "open_source_robot_model"
```

## Candidate Real Sources

- Universal Robots ROS2 Description: official description files and meshes for Universal Robots manipulators. Mesh license is governed by Universal Robots graphical documentation terms for some models; verify redistribution requirements before production release.
- OpenArm: open-source robot arm project. The description repository is Apache-2.0 and hardware CAD is separately licensed.
- TurtleBot / ROS robot descriptions: useful for mobile robot profiles when license and mesh availability are confirmed.
- OpenFlexure / open-source microscope and camera-housing projects: candidate source for the `camera_sensor` profile when STL and license are confirmed.
- Open-source conveyor or belt-printer projects: candidate source for the `conveyor_belt` profile only when the model is a usable hardware assembly and redistribution is allowed.

Do not import Sketchfab, GrabCAD, vendor CAD, or marketplace assets unless the license explicitly permits redistribution inside this project.
