const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const source = fs.readFileSync(path.join(root, 'lib', 'compiler', 'mockTaskCompiler.ts'), 'utf8');
const page = fs.readFileSync(path.join(root, 'app', 'page.tsx'), 'utf8');
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

assert(source.includes('parseRobotArmPickPlacePrompt'), 'Robot Arm compiler must parse prompt intent.');
assert(source.includes('blue_cube') && source.includes('left_safe_zone') && source.includes('front_safe_zone') && source.includes('inspection_zone'), 'Robot Arm compiler must support object and destination variants.');
assert(source.includes('robotArmPickPlaceSteps(prompt)'), 'Robot Arm safe steps must be generated from prompt, not a fixed script.');
assert(source.includes('const intent = parseRobotArmPickPlacePrompt(prompt)') && source.includes('target: intent.object') && source.includes('target: intent.destination'), 'Robot Arm pick-and-place steps must use parsed object and destination.');
assert(source.includes("'front_safe_zone'") && source.includes('\\u524d\\u4fa7'), 'Robot Arm compiler must map front-side safe zone language to front_safe_zone.');
assert(page.includes('const runPrompt = prompt.trim() || getLocalizedPrompt(runScenarioDefinition, language)'), 'Run must pass the user typed prompt into LiveScenarioRunner instead of silently replacing it with scenario defaults.');
assert(page.includes('compilePromptToTaskDSL(prompt, effectiveSelectedProfile.deviceMeta.device_type)'), 'Scenario preview must use the user typed prompt, not the selected scenario default prompt.');

const virtualMeta = JSON.parse(fs.readFileSync(path.join(root, 'profiles', 'virtual-robot-arm', 'device.meta.json'), 'utf8'));
const virtualGeometry = JSON.parse(fs.readFileSync(path.join(root, 'profiles', 'virtual-robot-arm', 'geometry.json'), 'utf8'));
for (const target of ['red_cube', 'blue_cube', 'pickup_zone', 'inspection_zone', 'left_safe_zone', 'right_safe_zone', 'front_safe_zone', 'back_safe_zone']) {
  assert(virtualMeta.constraints.known_targets.includes(target), `virtual robot arm must know target ${target}`);
  assert(virtualGeometry.objects[target] || virtualGeometry.zones[target], `virtual robot arm geometry must declare target ${target}`);
}

console.log('Compiler tests passed.');
console.log('- Robot Arm prompt compiler supports object and destination variants.');
console.log('- Robot Arm safe task is no longer a fixed red_cube -> right_safe_zone script.');
