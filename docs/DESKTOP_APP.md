# Desktop App

RealityWarden Desktop is the primary product direction. It is a desktop virtual lab for AI-controlled devices, not a website and not a browser presentation.

## Why Desktop

AI reality-device development needs local project files, workspace persistence, audit exports, simulator assets, menus, keyboard shortcuts, and a tool layout that behaves like engineering software. Electron lets the current Next.js, React, and TypeScript workbench become a cross-platform desktop Alpha quickly while preserving Web development mode.

## Electron Architecture

```text
Electron Main Process
-> starts local Next app
-> creates BrowserWindow
-> loads http://127.0.0.1:PORT
-> registers menus and IPC
-> uses preload to expose safe renderer APIs
```

Renderer code never receives direct Node.js or `fs` access.

## Main Process

`electron/main.ts` owns:

- single-instance desktop startup
- local Next server startup
- `BrowserWindow` creation
- application title: RealityWarden
- application menu creation
- IPC registration
- shutdown of the local simulator server

## Renderer

The renderer remains the Studio Workbench UI. In desktop mode it calls `window.openReality` for local files and exports. In Web mode the same UI keeps browser-based fallbacks.

## Preload

`electron/preload.ts` exposes only:

- `window.openReality.project.new()`
- `window.openReality.project.open()`
- `window.openReality.project.save(project, filePath?)`
- `window.openReality.project.saveAs(project)`
- `window.openReality.export.labReport(report)`
- `window.openReality.export.deploymentPackage(package)`
- `window.openReality.file.reveal(filePath)`
- `window.openReality.support.openGuide()`
- `window.openReality.support.exportDiagnostics()`
- `window.openReality.support.showAbout()`
- `window.openReality.onMenuAction(callback)`

The preload does not expose `fs`, Node globals, or arbitrary IPC channels.

## IPC

IPC modules live in `electron/ipc/`:

- `project.ipc.ts`: New/Open/Save/Save As project files
- `file.ipc.ts`: limited local file reveal
- `export.ipc.ts`: Lab Report and Deployment Package exports
- `support.ipc.ts`: packaged support guide, local diagnostic export, and local About dialog

All local file reads and writes happen in the Main Process through these IPC handlers.

## Local Project Files

Project files use the extension:

```text
.openreality.json
```

Project schema:

```json
{
  "project": {},
  "devices": [],
  "scenarios": [],
  "profiles": [],
  "workspace": {},
  "lab_reports": [],
  "metadata": {}
}
```

The current write format is project/workspace version 2. Version 2 stores every user-imported `DeviceAsset` inside `workspace.imported_assets`; GLB/GLTF bytes are embedded as data URLs so a project does not depend on a temporary blob URL or a path on the machine that created it. Version 1 remains readable and is explicitly normalized to version 2 with an empty imported-asset collection. A legacy file that referenced bytes it never contained cannot invent those bytes and is rejected if the referenced asset cannot be resolved.

The renderer and Main Process both use the same strict, versioned contract before saving or opening project files. Validation rejects unknown keys, unsupported device/config values, duplicate or dangling workspace references, divergent `devices` copies, unsafe `real_device_execution_enabled` metadata, non-finite values, excessive nesting, and prototype-pollution keys. Files larger than 25 MiB are rejected before the desktop process reads them; values are never clamped or silently repaired.

Browser workspace import uses the same contract. Complete validated v2 projects, including embedded imported assets, autosave to IndexedDB instead of the small synchronous localStorage quota. Existing localStorage v1 autosaves are recovered once and migrated only after a durable write succeeds. A corrupt autosave is quarantined without changing the current workspace or overwriting/deleting the saved bytes; the operator must explicitly discard it before autosave resumes. Storage failures remain visible and retryable.

## Local Export

Desktop export uses native save dialogs:

- Export Lab Report
- Export Deployment Package

Web development mode keeps browser download fallbacks.

## Desktop Menu

The desktop menu includes:

- File: New Project, Open Project, Save Project, Save Project As, Export Lab Report, Export Deployment Package, Exit
- Run: Run Preflight, Run Virtual Lab, Stop, Replay
- View: Toggle Project Explorer, Toggle Inspector, Toggle Console, Reload
- Help: Open Support Guide, Export Local Diagnostic Bundle, About RealityWarden

Menu actions are sent to the renderer through a safe `menu:action` channel.

The same support actions are discoverable in the visible File menu because the
Windows native menu bar is normally collapsed. The installed guide is packaged
under `resources/support` and opens in an isolated in-app window without network
access. Diagnostic export is
user-initiated and local-only: it contains version/runtime metadata and a
bounded, allowlisted, redacted startup-log excerpt. It excludes project content,
prompts, audit/hardware results, serial ports, environment variables, and
credentials, and performs no upload.

## Security Boundary

Electron is configured with:

- `contextIsolation: true`
- `nodeIntegration: false`
- a limited preload bridge
- no renderer `fs` access
- no Real Device execution in the main UI

## Real Device Boundary

Real Device execution is not enabled by default. The current product path is Virtual Lab first.

The separately marked reference-rig Real Device execution requires:

- certified adapter
- verified RealDeviceTransport behind HardwareExecutionGate
- Safety Runtime approval before transport execution
- human supervision
- emergency stop handling

## Windows Packaging

Current desktop Alpha supports a unified launcher:

```bash
npm run desktop:start
```

The launcher prefers the production shell when `.next-build` exists and otherwise falls back to the development shell.

Explicit desktop development mode:

```bash
npm run desktop:dev
```

Current desktop Alpha supports Electron source build with:

```bash
npm run desktop:build
```

Non-interactive production smoke check:

```bash
npm run desktop:smoke
```

Packaging entry point:

```bash
npm run desktop:pack
```

`desktop:pack` is the Windows installer path. It uses `electron-builder` with an `nsis` x64 target and writes artifacts to `release/`. The command packages the compiled shared hardware safety runtime, the Next production runtime, the SHA256-paired prebuilt firmware image, and rebuilt Windows `serialport` native bindings. Next runs from `app.asar.unpacked` because Windows child processes require a real working directory; Electron and the shared safety runtime remain loaded from the packaged application.

After electron-builder finishes, `scripts/verify-electron-package.cjs` fails the command unless all required asar/unpacked entries, native bindings, PDF/manual-import runtime, firmware checksums, branding metadata, and the versioned NSIS artifact are present. `desktop:pack` then runs a packaged first-run renderer smoke: a hidden, isolated Electron session starts the bundled Next server and must load the real AppHeader, Device Navigator, CommandDock, sole Run/Stop pair, simulation boundary, independent REAL HARDWARE boundary, and preload bridge. Any missing contract exits non-zero. The same smoke check can be repeated manually without installing:

```powershell
release\win-unpacked\RealityWarden.exe --prod --smoke-test
```

Installer artifact pattern:

```text
release/RealityWarden-<version>-Setup.exe
```

Only after package verification, startup/product-design acceptance, and the
isolated install lifecycle pass, packaging writes the release evidence artifacts:

```text
release/RealityWarden-<version>-Release-Evidence.json
release/RealityWarden-<version>-Release-Evidence.json.sha256
```

The schema-v4 machine-readable manifest records the exact installer SHA256/size,
packaged executable size, Next BUILD_ID, source commit, clean/dirty worktree
state, startup and product-design evidence, and the clean install/offline/
reinstall/uninstall lifecycle evidence. If Git metadata is unavailable it says
so instead of guessing. It explicitly does not claim code-signing status,
historical cross-version migration, physical hardware acceptance, or a verified
physical outcome.

Current verified Public Alpha installer artifact:

```text
release/RealityWarden-0.5.0-Setup.exe
```

If `electron-builder` is missing, the command now fails explicitly instead of exiting successfully without producing an installer.
