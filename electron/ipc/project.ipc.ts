import { dialog, ipcMain } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';

const projectFilters = [{ name: 'Open Reality Project', extensions: ['openreality.json'] }];

interface ProjectContractRuntime {
  MAX_PROJECT_FILE_BYTES: number;
  parseOpenRealityProjectText(text: string): { ok: true; value: unknown } | { ok: false; code: string; detail: string };
  serializeOpenRealityProjectFile(value: unknown): { ok: true; value: string } | { ok: false; code: string; detail: string };
}

let projectContractRuntime: ProjectContractRuntime | null = null;

function loadProjectContract() {
  if (projectContractRuntime) return projectContractRuntime;
  const runtimePath = path.resolve(__dirname, '..', '..', 'dist-electron-runtime', 'lib', 'project', 'ProjectFileContract.js');
  projectContractRuntime = require(runtimePath) as ProjectContractRuntime;
  return projectContractRuntime;
}

async function writeProjectFile(filePath: string, project: unknown) {
  const serialized = loadProjectContract().serializeOpenRealityProjectFile(project);
  if (!serialized.ok) throw new Error(`${serialized.code}: ${serialized.detail}`);
  await fs.writeFile(filePath, serialized.value, 'utf8');
}

export function registerProjectIpc() {
  ipcMain.handle('project:new', async () => ({
    canceled: false,
    project: null,
    filePath: null
  }));

  ipcMain.handle('project:open', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Open Open Reality Project',
      properties: ['openFile'],
      filters: projectFilters
    });
    if (result.canceled || result.filePaths.length === 0) return { canceled: true };

    const filePath = result.filePaths[0];
    const contract = loadProjectContract();
    const stats = await fs.stat(filePath);
    if (stats.size > contract.MAX_PROJECT_FILE_BYTES) throw new Error(`file_too_large: project file exceeds ${contract.MAX_PROJECT_FILE_BYTES} bytes`);
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = contract.parseOpenRealityProjectText(raw);
    if (!parsed.ok) throw new Error(`${parsed.code}: ${parsed.detail}`);
    return { canceled: false, filePath, project: parsed.value };
  });

  ipcMain.handle('project:save', async (_event, payload: { project?: unknown; filePath?: string | null } | null) => {
    if (!payload || !('project' in payload)) throw new Error('invalid_schema: save payload must contain a project');
    let filePath = payload.filePath;
    if (!filePath) {
      const result = await dialog.showSaveDialog({
        title: 'Save Open Reality Project',
        defaultPath: 'Untitled.openreality.json',
        filters: projectFilters
      });
      if (result.canceled || !result.filePath) return { canceled: true };
      filePath = result.filePath;
    }
    await writeProjectFile(filePath, payload.project);
    return { canceled: false, filePath };
  });

  ipcMain.handle('project:saveAs', async (_event, payload: { project?: unknown } | null) => {
    if (!payload || !('project' in payload)) throw new Error('invalid_schema: save payload must contain a project');
    const result = await dialog.showSaveDialog({
      title: 'Save Open Reality Project As',
      defaultPath: 'Untitled.openreality.json',
      filters: projectFilters
    });
    if (result.canceled || !result.filePath) return { canceled: true };
    await writeProjectFile(result.filePath, payload.project);
    return { canceled: false, filePath: result.filePath };
  });
}
