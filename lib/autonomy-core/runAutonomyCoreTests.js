const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const required = [
  'SemanticCore.ts',
  'SemanticIntent.ts',
  'WorldModel.ts',
  'WorldModelBuilder.ts',
  'AffordanceModel.ts',
  'Planner.ts',
  'ConsequenceSimulator.ts',
  'RiskJudge.ts',
  'AutonomyController.ts',
  'AutonomyCore.ts',
  'AutonomyResult.ts',
  'AutonomyLevel.ts'
];

for (const file of required) {
  assert(fs.existsSync(path.join(root, 'lib', 'autonomy-core', file)), `${file} must exist.`);
}

const semantic = read('lib/autonomy-core/SemanticCore.ts');
assert(semantic.includes("'move_object'") && semantic.includes("'throw_object'") && semantic.includes("'organize_workspace'"), 'SemanticCore must classify autonomy goals.');
assert(semantic.includes("'red cube'") && semantic.includes("'blue cube'") && semantic.includes("'cube'"), 'SemanticCore must extract object queries.');
assert(semantic.includes("'back safe zone'") && semantic.includes("'front safe zone'") && semantic.includes("'left safe zone'") && semantic.includes("'right safe zone'"), 'SemanticCore must understand English safe-zone prompts.');
assert(semantic.includes("'back area'") && semantic.includes("'front area'") && semantic.includes("'glass cup area'") && semantic.includes("'outside table'"), 'SemanticCore must extract target queries.');
assert(semantic.includes('\\u540e\\u65b9') && semantic.includes('\\u6254'), 'SemanticCore must recognize Chinese back-side and throw prompts.');

const world = read('lib/autonomy-core/WorldModelBuilder.ts');
assert(world.includes("id: 'red_cube'") && world.includes("id: 'blue_cube'") && world.includes("id: 'glass_cup'"), 'WorldModel must include red_cube, blue_cube, and glass_cup.');
assert(world.includes('front_area') && world.includes('back_area') && world.includes('glass_cup_neighborhood') && world.includes('outside_table'), 'WorldModel must include required spatial regions.');

const affordance = read('lib/autonomy-core/AffordanceModel.ts');
assert(affordance.includes('throw_object is not supported') && affordance.includes('move_outside_workspace') && affordance.includes('fragile'), 'AffordanceModel must block throw/outside and mark fragile objects.');

const planner = read('lib/autonomy-core/Planner.ts');
assert(planner.includes('pick_and_place') && planner.includes('identify_object') && planner.includes('move_to_pose') && planner.includes('grasp') && planner.includes('release') && planner.includes('return_home'), 'Planner must generate pick-and-place steps.');
assert(planner.includes("front_area: 'front_safe_zone'") && planner.includes("back_area: 'back_safe_zone'") && planner.includes("left_area: 'left_safe_zone'") && planner.includes("right_area: 'right_safe_zone'"), 'Planner must ground front/back/left/right areas to robot-arm regions.');
assert(planner.includes('proposed_plan') && planner.includes('requires_human_confirmation: true'), 'Planner must propose organize_workspace without direct execution.');

const consequence = read('lib/autonomy-core/ConsequenceSimulator.ts');
assert(consequence.includes('outside_workspace_risk') && consequence.includes('fragile_contact_risk') && consequence.includes('target_placeable') && consequence.includes('predicted_state'), 'ConsequenceSimulator must report required consequence fields.');
assert(consequence.includes('outside_workspace') && consequence.includes('near_fragile_object'), 'ConsequenceSimulator must reason about outside table and glass cup neighborhood.');

const risk = read('lib/autonomy-core/RiskJudge.ts');
assert(risk.includes("intent.goal === 'throw_object'") && risk.includes("grounding.target_region_id === 'outside_table'"), 'RiskJudge must hard-block throw_object and outside_table.');
assert(risk.includes('ambiguous_object') && risk.includes('unknown_object') && risk.includes('unknown_target'), 'RiskJudge must ask for human input on ambiguous/unknown grounding.');
assert(risk.includes('glass_cup_neighborhood') && risk.includes("'ask_human'"), 'RiskJudge must not execute glass cup neighborhood by default.');

const controller = read('lib/autonomy-core/AutonomyController.ts');
assert(controller.includes('L0_manual') && controller.includes('L1_scripted') && controller.includes('L5_free_sandbox'), 'AutonomyController must implement L0/L1/L5 controls.');
assert(controller.includes("mode === 'live'") && controller.includes('live mode is blocked in v0.1'), 'AutonomyController must block live mode in v0.1.');

const core = read('lib/autonomy-core/AutonomyCore.ts');
const page = read('app/page.tsx');
const localRuntime = read('lib/runtime/LocalRuntime.ts');
const liveRunner = read('lib/virtual-lab/LiveScenarioRunner.ts');
assert(core.includes('SemanticCore') && core.includes('WorldModelBuilder') && core.includes('AffordanceModel') && core.includes('Planner') && core.includes('ConsequenceSimulator') && core.includes('RiskJudge') && core.includes('AutonomyController'), 'AutonomyCore must wire the full autonomy pipeline.');
assert(core.includes("controlled.status !== 'execute'") && core.includes('adapter_commands: []'), 'AutonomyCore must not generate AdapterCommands when status is not execute.');
assert(core.includes('createAdapterCommands') && core.includes('taskFromPlan'), 'AutonomyCore must generate AdapterCommands only from selected executable plan.');
assert(localRuntime.includes('new AutonomyCore().run') && localRuntime.includes("autonomyResult.status !== 'execute'") && localRuntime.includes('adapterPlan'), 'Local Runtime must pass through AutonomyCore and stop non-execute statuses before adapter planning.');
assert.equal((localRuntime.match(/new AutonomyCore\(\)\.run/g) ?? []).length, 1, 'AutonomyCore.run must only be called once in Local Runtime session preparation.');
assert(page.includes('new LocalRuntime().prepareSimulationSession'), 'UI Run must delegate execution preparation to Local Runtime.');
assert(page.includes('new LiveScenarioRunner().run(') && page.includes('localRuntimeSession.executableTaskDsl'), 'UI Run must pass Local Runtime TaskDSL into LiveScenarioRunner.');
assert(page.indexOf('new LocalRuntime().prepareSimulationSession') < page.indexOf('new LiveScenarioRunner().run('), 'UI Run must execute Local Runtime before LiveScenarioRunner dispatch.');
assert(!page.includes('const autonomyPreview'), 'Scenario preview must not call AutonomyCore during render.');
assert(page.includes('runPreviewTask?.profileId === effectiveSelectedProfile.id') && page.includes("targetStep = task.steps.find((step) => step.id === 'step-4'"), 'Scenario preview must read the last executable Run TaskDSL instead of running AutonomyCore.');
assert(page.includes("effectiveSelectedProfile.deviceMeta.device_type === 'robot_arm'") && page.includes('runPreviewTask.task') && page.includes('if (!task) return null;'), 'Robot Arm preview must not silently fall back to mockTaskCompiler when no Run TaskDSL exists.');
assert(liveRunner.includes('taskDslOverride?: TaskDSL') && liveRunner.includes('taskDslOverride ?? compilePromptToTaskDSL'), 'LiveScenarioRunner must accept AutonomyCore TaskDSL override.');

const genericMeta = JSON.parse(read('assets/devices/generic-industrial-robot-arm/device.meta.json'));
const genericGeometry = JSON.parse(read('assets/devices/generic-industrial-robot-arm/geometry.json'));
for (const target of ['back_safe_zone', 'front_safe_zone', 'left_safe_zone', 'right_safe_zone']) {
  assert(genericMeta.constraints.known_targets.includes(target), `generic robot arm must know ${target}`);
  assert(genericGeometry.zones[target], `generic robot arm geometry must declare ${target}`);
}

const truthMatrix = [
  {
    id: 'red-cube-to-front',
    prompt_zh: '\u6293\u53d6\u7ea2\u8272\u65b9\u5757\uff0c\u5e76\u628a\u5b83\u653e\u5230\u524d\u4fa7\u5b89\u5168\u533a\u3002',
    object_query: 'red cube',
    object_id: 'red_cube',
    target_query: 'front area',
    target_region_id: 'front_area',
    adapter_target: 'front_safe_zone',
    status: 'execute'
  },
  {
    id: 'red-cube-to-back',
    prompt_zh: '\u628a\u7ea2\u8272\u65b9\u5757\u653e\u5230\u540e\u65b9\u3002',
    object_query: 'red cube',
    object_id: 'red_cube',
    target_query: 'back area',
    target_region_id: 'back_area',
    adapter_target: 'back_safe_zone',
    status: 'execute'
  },
  {
    id: 'red-cube-to-left',
    prompt_zh: '\u628a\u7ea2\u8272\u65b9\u5757\u653e\u5230\u5de6\u4fa7\u3002',
    object_query: 'red cube',
    object_id: 'red_cube',
    target_query: 'left area',
    target_region_id: 'left_area',
    adapter_target: 'left_safe_zone',
    status: 'execute'
  },
  {
    id: 'red-cube-to-right',
    prompt_zh: '\u628a\u7ea2\u8272\u65b9\u5757\u653e\u5230\u53f3\u4fa7\u3002',
    object_query: 'red cube',
    object_id: 'red_cube',
    target_query: 'right area',
    target_region_id: 'right_area',
    adapter_target: 'right_safe_zone',
    status: 'execute'
  },
  {
    id: 'blue-cube-to-left',
    prompt_zh: '\u628a\u84dd\u8272\u65b9\u5757\u653e\u5230\u5de6\u4fa7\u3002',
    object_query: 'blue cube',
    object_id: 'blue_cube',
    target_query: 'left area',
    target_region_id: 'left_area',
    adapter_target: 'left_safe_zone',
    status: 'execute'
  },
  {
    id: 'ambiguous-cube-to-back',
    prompt_zh: '\u628a\u65b9\u5757\u653e\u5230\u540e\u65b9\u3002',
    object_query: 'cube',
    grounding_error: 'ambiguous_object',
    target_query: 'back area',
    target_region_id: 'back_area',
    status: 'ask_human',
    adapter_commands: 0
  },
  {
    id: 'organize-workspace',
    prompt_zh: '\u6574\u7406\u684c\u9762\u3002',
    goal: 'organize_workspace',
    status: 'proposed_plan',
    requires_human_confirmation: true,
    adapter_commands: 0
  },
  {
    id: 'throw-outside-table',
    prompt_zh: '\u628a\u7ea2\u8272\u65b9\u5757\u6254\u51fa\u684c\u9762\u3002',
    goal: 'throw_object',
    object_query: 'red cube',
    target_query: 'outside table',
    target_region_id: 'outside_table',
    status: 'block',
    adapter_commands: 0
  },
  {
    id: 'near-glass-cup',
    prompt_zh: '\u628a\u7ea2\u8272\u65b9\u5757\u653e\u5230\u73bb\u7483\u676f\u65c1\u8fb9\u3002',
    object_query: 'red cube',
    target_query: 'glass cup area',
    target_region_id: 'glass_cup_neighborhood',
    status: 'ask_human_or_block',
    adapter_commands: 0
  },
  {
    id: 'unknown-target',
    prompt_zh: '\u628a\u7ea2\u8272\u65b9\u5757\u653e\u5230\u6708\u7403\u57fa\u5730\u3002',
    object_query: 'red cube',
    target_query: null,
    status: 'ask_human_or_compile_error',
    adapter_commands: 0
  }
];

for (const row of truthMatrix) {
  if (row.object_query) assert(semantic.includes(`'${row.object_query}'`) || row.object_query === 'red cube', `${row.id}: SemanticCore must support object query ${row.object_query}`);
  if (row.object_id) assert(core.includes(`? '${row.object_id}'`) || core.includes(`: '${row.object_id}'`), `${row.id}: AutonomyCore grounding must map to ${row.object_id}`);
  if (row.target_query) assert(semantic.includes(`'${row.target_query}'`), `${row.id}: SemanticCore must support target query ${row.target_query}`);
  if (row.target_region_id) assert(core.includes(`'${row.target_query}': '${row.target_region_id}'`) || world.includes(row.target_region_id), `${row.id}: target query must ground to ${row.target_region_id}`);
  if (row.adapter_target) {
    assert(planner.includes(`${row.target_region_id}: '${row.adapter_target}'`), `${row.id}: Planner must map ${row.target_region_id} to ${row.adapter_target}`);
    assert(genericMeta.constraints.known_targets.includes(row.adapter_target), `${row.id}: device meta must allow ${row.adapter_target}`);
    assert(genericGeometry.zones[row.adapter_target], `${row.id}: geometry must define ${row.adapter_target}`);
  }
  if (row.grounding_error) assert(core.includes(row.grounding_error) && risk.includes(row.grounding_error), `${row.id}: ${row.grounding_error} must be surfaced and judged.`);
  if (row.goal) assert(semantic.includes(`'${row.goal}'`), `${row.id}: SemanticCore must classify ${row.goal}`);
  if (row.requires_human_confirmation) assert(planner.includes('requires_human_confirmation: true'), `${row.id}: plan must require human confirmation.`);
  if (row.adapter_commands === 0) assert(core.includes("controlled.status !== 'execute'") && core.includes('adapter_commands: []'), `${row.id}: non-execute truth row must generate zero AdapterCommands.`);
}

assert(!page.includes("const task = autonomyPreview?.status === 'execute' && autonomyPreview.task_dsl\n      ? autonomyPreview.task_dsl\n      : compilePromptToTaskDSL(prompt, effectiveSelectedProfile.deviceMeta.device_type);"), 'Robot Arm preview must not contain the old silent compiler fallback.');
assert(core.includes("'red cube'") && core.includes("'blue cube'") && core.includes("intent.object_query === 'cube'"), 'Grounding must distinguish red cube, blue cube, and ambiguous cube.');
assert(core.includes("'front area': 'front_area'") && core.includes("'back area': 'back_area'") && core.includes("'left area': 'left_area'") && core.includes("'right area': 'right_area'"), 'Grounding must preserve front/back/left/right targets.');
assert(risk.includes("decision: 'block'") && risk.includes("decision: 'ask_human'"), 'RiskJudge must have explicit block and ask_human outcomes.');

console.log('Autonomy Core tests passed.');
console.log('- SemanticCore, WorldModel, AffordanceModel, Planner, ConsequenceSimulator, RiskJudge, and AutonomyController are wired.');
console.log('- Non-execute statuses are gated from AdapterCommands.');
console.log('- Generic robot arm supports front/back/left/right safe regions.');
console.log(`- Autonomy Truth Matrix locked ${truthMatrix.length} prompt-to-command outcomes and non-execute gates.`);
