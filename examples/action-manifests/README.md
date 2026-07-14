# Reference Action Recipes

These three manifests prove that the v0.4 declarative action format is not
specific to robot manipulation:

- `scan_left_to_right.json` — robot arm motion across known safe targets;
- `focus_work_light.json` — typed smart-light on/brightness/color values;
- `inspect_then_capture.json` — read-only camera inspection followed by capture.

Each file is an untrusted proposal. Import validates the strict schema, exact
selected device type, declared capabilities, known targets, value policy, and
safety envelope. Running expands the recipe into ordinary TaskDSL primitives;
risk is recomputed and the normal simulation safety/runtime path remains
unavoidable.

Recipes are profile-specific. Select the matching Robot Arm, Smart Light, or
Camera Sensor profile before importing its JSON file. A cross-device import is
rejected explicitly and never converted automatically.
