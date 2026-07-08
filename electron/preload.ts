import { contextBridge, ipcRenderer } from 'electron';

type MenuAction =
  | 'project:new'
  | 'project:open'
  | 'project:save'
  | 'project:saveAs'
  | 'export:labReport'
  | 'export:deploymentPackage'
  | 'run:preflight'
  | 'run:virtualLab'
  | 'run:stop'
  | 'run:replay'
  | 'view:toggleExplorer'
  | 'view:toggleInspector'
  | 'view:toggleConsole';

const api = {
  project: {
    new: () => ipcRenderer.invoke('project:new'),
    open: () => ipcRenderer.invoke('project:open'),
    save: (project: unknown, filePath?: string | null) => ipcRenderer.invoke('project:save', { project, filePath }),
    saveAs: (project: unknown) => ipcRenderer.invoke('project:saveAs', { project })
  },
  export: {
    labReport: (report: unknown) => ipcRenderer.invoke('export:labReport', { report }),
    deploymentPackage: (deploymentPackage: unknown) => ipcRenderer.invoke('export:deploymentPackage', { deploymentPackage })
  },
  file: {
    reveal: (filePath: string) => ipcRenderer.invoke('file:reveal', { filePath })
  },
  hardware: {
    listPorts: () => ipcRenderer.invoke('hardware:listPorts'),
    connect: (portPath: string) => ipcRenderer.invoke('hardware:connect', { portPath }),
    readDistance: () => ipcRenderer.invoke('hardware:readDistance'),
    disconnect: () => ipcRenderer.invoke('hardware:disconnect')
  },
  onMenuAction: (callback: (action: MenuAction) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, action: MenuAction) => callback(action);
    ipcRenderer.on('menu:action', listener);
    return () => ipcRenderer.removeListener('menu:action', listener);
  }
};

contextBridge.exposeInMainWorld('openReality', api);
