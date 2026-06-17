const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const packageJson = JSON.parse(read('package.json'));
const main = read('electron/main.ts');
const preload = read('electron/preload.ts');
const projectIpc = read('electron/ipc/project.ipc.ts');
const exportIpc = read('electron/ipc/export.ipc.ts');
const menu = read('electron/menus/appMenu.ts');
const docs = read('docs/DESKTOP_APP.md');

for (const file of [
  'electron/main.ts',
  'electron/preload.ts',
  'electron/ipc/project.ipc.ts',
  'electron/ipc/file.ipc.ts',
  'electron/ipc/export.ipc.ts',
  'electron/menus/appMenu.ts'
]) {
  assert(fs.existsSync(path.join(root, file)), `${file} must exist.`);
}

assert(main.includes("title: 'Open Reality Studio'"), 'Desktop window title must be Open Reality Studio.');
assert(main.includes('contextIsolation: true'), 'Electron must enable contextIsolation.');
assert(main.includes('nodeIntegration: false'), 'Electron must disable nodeIntegration.');
assert(main.includes('preload:'), 'Electron window must load a preload script.');

assert(preload.includes("contextBridge.exposeInMainWorld('openReality'"), 'preload must expose window.openReality.');
assert(!preload.includes('fs'), 'preload must not expose fs.');
assert(preload.includes('ipcRenderer.invoke'), 'preload must use IPC invocation.');

assert(projectIpc.includes('showOpenDialog'), 'Project IPC must open local project files.');
assert(projectIpc.includes('showSaveDialog'), 'Project IPC must save local project files.');
assert(projectIpc.includes('isProjectFile'), 'Project IPC must validate project schema.');
assert(projectIpc.includes('project') && projectIpc.includes('devices') && projectIpc.includes('workspace') && projectIpc.includes('lab_reports'), 'Project schema must include required top-level sections.');

assert(exportIpc.includes('export:labReport'), 'Export IPC must support Lab Report export.');
assert(exportIpc.includes('export:deploymentPackage'), 'Export IPC must support Deployment Package export.');

for (const script of ['desktop:dev', 'desktop:build', 'desktop:pack', 'test:desktop']) {
  assert(packageJson.scripts[script], `package.json missing ${script}.`);
}

for (const label of ['New Project', 'Open Project', 'Save Project', 'Export Lab Report', 'Export Deployment Package', 'Run Virtual Lab', 'Replay']) {
  assert(menu.includes(label), `Desktop menu missing ${label}.`);
}

assert(docs.includes('Electron Architecture'), 'DESKTOP_APP.md must document Electron architecture.');
assert(docs.includes('Real Device'), 'DESKTOP_APP.md must document real-device safety boundary.');

console.log('Desktop tests passed.');
console.log('- Electron main/preload/IPC/menu files exist.');
console.log('- preload exposes window.openReality without fs access.');
console.log('- project schema and export IPC are covered.');
console.log('- desktop scripts and docs are present.');
