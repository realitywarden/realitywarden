import { app, BrowserWindow, dialog } from 'electron';
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import { registerExportIpc } from './ipc/export.ipc';
import { registerFileIpc } from './ipc/file.ipc';
import { registerHardwareIpc } from './ipc/hardware.ipc';
import { registerProjectIpc } from './ipc/project.ipc';
import { createAppMenu } from './menus/appMenu';

const root = path.resolve(__dirname, '..');
const sourceRoot = path.resolve(root, '..');
const appRoot = fs.existsSync(path.join(root, 'package.json')) ? root : sourceRoot;
const serverRoot = app.isPackaged ? path.join(process.resourcesPath, 'app.asar.unpacked') : appRoot;
const basePort = Number(process.env.ORS_DESKTOP_PORT || 3100);
const isSmokeTest = process.argv.includes('--smoke-test');

let nextProcess: ChildProcess | null = null;
let mainWindow: BrowserWindow | null = null;

function getServerLogPath() {
  const baseDir = app.isReady() ? app.getPath('userData') : path.join(sourceRoot, '.tmp');
  const logDir = path.join(baseDir, 'logs');
  fs.mkdirSync(logDir, { recursive: true });
  return path.join(logDir, 'desktop-server.log');
}

const singleInstanceLock = isSmokeTest ? true : app.requestSingleInstanceLock();
if (!singleInstanceLock) app.quit();

if (isSmokeTest) {
  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch('headless');
  app.commandLine.appendSwitch('disable-gpu');
  app.commandLine.appendSwitch('disable-gpu-compositing');
  app.commandLine.appendSwitch('in-process-gpu');
}

function appendLog(message: string) {
  try {
    fs.appendFileSync(getServerLogPath(), `[${new Date().toISOString()}] ${message}\n`);
  } catch {
    // Startup logging must not block the desktop shell.
  }
}

function loadingHtml() {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      html, body { margin: 0; height: 100%; background: #090A0C; color: #E5E7EB; font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif; -webkit-font-smoothing: antialiased; }
      body { display: grid; place-items: center; }
      main { width: 380px; border: 1px solid #3A3F4A; background: #121418; padding: 24px; }
      .brand { color: #38BDF8; font-size: 11px; font-weight: 800; letter-spacing: .16em; text-transform: uppercase; }
      h1 { margin: 8px 0; font-size: 18px; line-height: 1.25; }
      p { margin: 0; color: #9CA3AF; font-size: 12px; line-height: 1.7; }
      .bar { height: 3px; margin-top: 18px; overflow: hidden; background: #2A2D35; }
      .bar::before { content: ""; display: block; height: 100%; width: 42%; background: #38BDF8; animation: move 1.15s ease-in-out infinite; }
      @keyframes move { 0% { transform: translateX(-120%); } 100% { transform: translateX(260%); } }
    </style>
  </head>
  <body>
    <main>
      <div class="brand">RealityWarden Desktop</div>
      <h1>Starting Virtual Lab</h1>
      <p>The local simulator service is starting. RealityWarden will load automatically.</p>
      <div class="bar"></div>
    </main>
  </body>
</html>`;
}

function request(url: string) {
  return new Promise<boolean>((resolve) => {
    const req = http.get(url, (res) => {
      res.resume();
      resolve(Boolean(res.statusCode && res.statusCode >= 200 && res.statusCode < 400));
    });
    req.on('error', () => resolve(false));
    req.setTimeout(800, () => {
      req.destroy();
      resolve(false);
    });
  });
}

function isPortAvailable(port: number) {
  return new Promise<boolean>((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => server.close(() => resolve(true)));
    server.listen(port, '127.0.0.1');
  });
}

async function findAvailablePort(startPort: number) {
  for (let port = startPort; port < startPort + 20; port += 1) {
    if (await isPortAvailable(port)) return port;
  }
  throw new Error(`No available simulator port found from ${startPort} to ${startPort + 19}.`);
}

async function waitForServer(url: string, timeoutMs = 240000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await request(url)) return;
    await new Promise((resolve) => setTimeout(resolve, 350));
  }
  throw new Error(`Simulator server did not start at ${url} within ${Math.round(timeoutMs / 1000)} seconds.`);
}

interface RendererSmokeSnapshot {
  ready: boolean;
  title: string;
  appHeader: boolean;
  deviceNavigator: boolean;
  commandDock: boolean;
  runControls: number;
  stopControls: number;
  simulationBoundary: boolean;
  realHardwareBoundary: boolean;
  preloadBridge: boolean;
  offlineDegradation: boolean;
}

async function waitForRendererSmoke(window: BrowserWindow, requireOfflineDegradation = false, timeoutMs = 60_000) {
  const started = Date.now();
  let lastSnapshot: RendererSmokeSnapshot | null = null;
  while (Date.now() - started < timeoutMs) {
    lastSnapshot = await window.webContents.executeJavaScript(`(() => {
      const exactButtons = (label) => Array.from(document.querySelectorAll('button')).filter((button) => button.textContent?.trim() === label).length;
      const bodyText = document.body?.innerText ?? '';
      const allText = document.body?.textContent ?? '';
      const snapshot = {
        title: document.title,
        appHeader: Boolean(document.querySelector('[data-component="AppHeader"]')),
        deviceNavigator: Boolean(document.querySelector('[data-component="DeviceNavigator"]')),
        commandDock: Boolean(document.querySelector('[data-component="CommandDock"]')),
        runControls: exactButtons('Run'),
        stopControls: exactButtons('Stop'),
        simulationBoundary: bodyText.includes('SIMULATION ONLY') || bodyText.includes('Simulation Only'),
        realHardwareBoundary: Boolean(document.querySelector('[data-real-hardware-boundary]')) && bodyText.includes('REAL HARDWARE'),
        preloadBridge: typeof window.openReality === 'object',
        offlineDegradation: allText.includes('rule compiler (LLM offline)') || allText.includes('规则编译器（LLM 离线）')
      };
      return { ...snapshot, ready: snapshot.title === 'RealityWarden' && snapshot.appHeader && snapshot.deviceNavigator && snapshot.commandDock && snapshot.runControls === 1 && snapshot.stopControls === 1 && snapshot.simulationBoundary && snapshot.realHardwareBoundary && snapshot.preloadBridge && (${requireOfflineDegradation ? 'snapshot.offlineDegradation' : 'true'}) };
    })()`, true) as RendererSmokeSnapshot;
    if (lastSnapshot.ready) return lastSnapshot;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Packaged renderer did not satisfy the first-run contract: ${JSON.stringify(lastSnapshot)}`);
}

function enforceOfflineSmokeBoundary(window: BrowserWindow, localOrigin: string) {
  window.webContents.session.webRequest.onBeforeRequest((details, callback) => {
    try {
      const requestUrl = new URL(details.url);
      const isNetworkRequest = requestUrl.protocol === 'http:' || requestUrl.protocol === 'https:';
      callback({ cancel: isNetworkRequest && requestUrl.origin !== localOrigin });
    } catch {
      callback({ cancel: false });
    }
  });
}

function createDesktopWindow(show: boolean) {
  const preloadPath = path.join(__dirname, 'preload.js');
  const iconPath = path.join(appRoot, 'assets', 'branding', 'realitywarden.ico');
  return new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1180,
    minHeight: 720,
    center: true,
    title: 'RealityWarden',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    backgroundColor: '#090A0C',
    autoHideMenuBar: true,
    frame: true,
    titleBarStyle: 'default',
    show,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      partition: isSmokeTest ? `realitywarden-smoke-${process.pid}` : undefined
    }
  });
}

async function startNextServer(port: number) {
  const prod = process.argv.includes('--prod');
  const url = `http://127.0.0.1:${port}`;
  if (await request(url)) return;

  const nextCli = path.join(serverRoot, 'node_modules', 'next', 'dist', 'bin', 'next');
  const args = prod ? [nextCli, 'start', '-p', String(port)] : [nextCli, 'dev', '-p', String(port)];
  const nextDistDir = prod ? '.next-build' : `.next-desktop-${port}`;
  const logStream = fs.createWriteStream(getServerLogPath(), { flags: 'a' });
  logStream.write(`\n[${new Date().toISOString()}] Starting node ${args.join(' ')}\n`);

  const child = spawn(process.execPath, args, {
    cwd: serverRoot,
    env: {
      ...process.env,
      BROWSER: 'none',
      ELECTRON_RUN_AS_NODE: '1',
      ORS_NEXT_DIST_DIR: nextDistDir
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true
  });

  nextProcess = child;
  child.stdout?.pipe(logStream);
  child.stderr?.pipe(logStream);
  child.on('error', (error) => logStream.write(`[${new Date().toISOString()}] server error: ${error.message}\n`));
  child.on('exit', (code, signal) => {
    logStream.write(`[${new Date().toISOString()}] server exited code=${code} signal=${signal}\n`);
    logStream.end();
    nextProcess = null;
  });
}

async function createWindow() {
  const port = await findAvailablePort(basePort);
  const url = `http://127.0.0.1:${port}`;

  appendLog(`Starting Next server at ${url}`);
  await startNextServer(port);
  await waitForServer(url);

  if (isSmokeTest) {
    mainWindow = createDesktopWindow(false);
    const offlineSmoke = process.argv.includes('--offline-smoke-test');
    if (offlineSmoke) enforceOfflineSmokeBoundary(mainWindow, url);
    await mainWindow.loadURL(url);
    const snapshot = await waitForRendererSmoke(mainWindow, offlineSmoke);
    appendLog(`Packaged first-run renderer smoke passed at ${url}: ${JSON.stringify(snapshot)}`);
    mainWindow.destroy();
    mainWindow = null;
    shutdownServer();
    await app.quit();
    return;
  }

  mainWindow = createDesktopWindow(true);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  await mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(loadingHtml())}`);
  await mainWindow.loadURL(url);
}

function shutdownServer() {
  if (!nextProcess) return;
  nextProcess.kill('SIGTERM');
  nextProcess = null;
}

registerProjectIpc();
registerFileIpc();
registerHardwareIpc();
registerExportIpc();

app.on('second-instance', () => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
});

app.whenReady().then(async () => {
  if (!singleInstanceLock) return;
  createAppMenu(appRoot);
  try {
    await createWindow();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    appendLog(`Startup failed: ${message}`);
    if (isSmokeTest) process.exitCode = 1;
    dialog.showErrorBox('RealityWarden failed to start', message);
    shutdownServer();
    app.quit();
  }
});

app.on('window-all-closed', () => {
  shutdownServer();
  app.quit();
});

app.on('before-quit', shutdownServer);
