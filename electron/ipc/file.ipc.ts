import { ipcMain, shell } from 'electron';

export function registerFileIpc() {
  ipcMain.handle('file:reveal', async (_event, payload: { filePath: string }) => {
    shell.showItemInFolder(payload.filePath);
    return { ok: true };
  });
}
