import { ipcMain } from 'electron';
import type { SupportActions } from '../support/supportActions';

export function registerSupportIpc(actions: SupportActions) {
  ipcMain.handle('support:openGuide', () => actions.openGuide());
  ipcMain.handle('support:exportDiagnostics', () => actions.exportDiagnostics());
  ipcMain.handle('support:showAbout', () => actions.showAbout());
}
