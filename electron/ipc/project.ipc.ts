import { dialog, ipcMain } from 'electron';
import fs from 'node:fs/promises';

const projectFilters = [{ name: 'Open Reality Project', extensions: ['openreality.json'] }];

function isProjectFile(value: unknown) {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.project === 'object' &&
    Array.isArray(record.devices) &&
    Array.isArray(record.scenarios) &&
    Array.isArray(record.profiles) &&
    typeof record.workspace === 'object' &&
    Array.isArray(record.lab_reports) &&
    typeof record.metadata === 'object'
  );
}

async function writeProjectFile(filePath: string, project: unknown) {
  if (!isProjectFile(project)) {
    throw new Error('Invalid Open Reality project file schema.');
  }
  await fs.writeFile(filePath, JSON.stringify(project, null, 2), 'utf8');
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
    const raw = await fs.readFile(filePath, 'utf8');
    const project = JSON.parse(raw) as unknown;
    if (!isProjectFile(project)) throw new Error('Selected file is not a valid Open Reality project.');
    return { canceled: false, filePath, project };
  });

  ipcMain.handle('project:save', async (_event, payload: { project: unknown; filePath?: string | null }) => {
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

  ipcMain.handle('project:saveAs', async (_event, payload: { project: unknown }) => {
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
