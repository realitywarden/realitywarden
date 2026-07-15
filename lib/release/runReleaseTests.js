const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function readJson(file) {
  return JSON.parse(read(file));
}

const packageJson = readJson('package.json');
const packageLock = readJson('package-lock.json');
const readme = read('README.md');
const windowsTrialGuide = read('docs/WINDOWS_TRIAL_GUIDE.md');
const evaluationGuide = read('docs/EVALUATION_GUIDE.md');
const deviceSupport = read('docs/DEVICE_SUPPORT.md');
const releaseNotes = read('docs/RELEASE_NOTES_V0.5.0.md');
const releaseReadiness = read('docs/RELEASE_READINESS_V0.5.0.md');
const publicLaunchCopy = read('docs/PUBLIC_LAUNCH_COPY.md');
const commercialPositioning = read('docs/COMMERCIAL_POSITIONING.md');
const customerValidation = read('docs/CUSTOMER_VALIDATION.md');
const demoScript = read('docs/DEMO_SCRIPT.md');
const desktopApp = read('docs/DESKTOP_APP.md');
const archivedSocialCopy = read('docs/SOCIAL_MEDIA_LAUNCH_PACK.md');
const packScript = read('scripts/pack-electron.cjs');
const packageVerification = read('scripts/verify-electron-package.cjs');
const gitignore = read('.gitignore');

const version = packageJson.version;
const expectedInstallerName = `RealityWarden-${version}-Setup.exe`;

assert(/^\d+\.\d+\.\d+$/.test(version), 'package.json version must use semver-like x.y.z format.');
assert.equal(packageLock.version, version, 'package-lock.json version must match package.json.');
assert.equal(packageLock.packages[''].version, version, 'package-lock root package version must match package.json.');

assert.equal(packageJson.build?.asar, true, 'electron-builder must package the desktop app with asar enabled.');
assert.equal(
  packageJson.build?.win?.artifactName,
  'RealityWarden-${version}-Setup.${ext}',
  'Windows installer artifact naming must stay versioned and predictable.'
);
assert.equal(packageJson.build?.nsis?.runAfterFinish, false, 'Release installers must not auto-launch outside the explicit lifecycle smoke.');
assert.equal(packageJson.build?.nsis?.deleteAppDataOnUninstall, false, 'Uninstall must preserve user projects and preferences by default.');
assert.equal(packageJson.build?.nsis?.shortcutName, 'RealityWarden', 'Installed shortcuts must use the product name.');

assert.equal(version, '0.5.0', 'This release closure must remain pinned to v0.5.0.');
assert(readme.includes('main simulation workbench never touches hardware'), 'README must keep the simulation workbench boundary explicit.');
assert(readme.includes('43/43 passing') && readme.includes('5/5'), 'README must publish current automated safety evidence counts.');
assert(readme.includes('evidence lock') && readme.includes('operator confirmation'), 'README must describe the gated reference-hardware boundary.');
assert(readme.includes('local PDF/Markdown/text manual import'), 'README must describe the v0.5 manual-import workflow.');
for (const runnableDevice of ['`robot_arm`', '`smart_light`', '`camera_sensor`']) {
  assert(readme.includes(runnableDevice), `README must declare runnable device path ${runnableDevice}.`);
}
assert(readme.includes('./docs/EVALUATION_GUIDE.md'), 'README must link the evaluation guide.');
assert(readme.includes('./docs/WINDOWS_TRIAL_GUIDE.md'), 'README must link the Windows trial guide.');

assert(windowsTrialGuide.includes('simulation-first desktop application'), 'Windows trial guide must state the simulation-first boundary.');
assert(windowsTrialGuide.includes('not general-purpose or production-certified'), 'Windows trial guide must state the real-hardware limitation.');
assert(windowsTrialGuide.includes(expectedInstallerName), 'Windows trial guide must reference the current installer version.');
for (const prompt of ['Move the red cube to the back safe zone', 'Turn on the light', 'Take a photo']) {
  assert(windowsTrialGuide.includes(prompt), `Windows trial guide must include first-run prompt: ${prompt}`);
}
for (const prompt of ['把红方块放到后侧安全区', '打开智能灯', '拍一张照片']) {
  assert(windowsTrialGuide.includes(prompt), `Windows trial guide must include localized first-run prompt: ${prompt}`);
}

assert(evaluationGuide.includes(`v${version} Public Alpha`), 'Evaluation guide must reference the current public alpha version.');
assert(evaluationGuide.includes('main AI Command workflow is simulation-only'), 'Evaluation guide must preserve the default simulation boundary.');
assert(evaluationGuide.includes('Known unsupported example'), 'Evaluation guide must include unsupported prompt examples.');
assert(evaluationGuide.includes('Language Note'), 'Evaluation guide must explain how to use the documented bilingual prompt paths.');
for (const prompt of ['把红方块放到后侧安全区', '把灯改成蓝色', '拍一张照片']) {
  assert(evaluationGuide.includes(prompt), `Evaluation guide must include localized prompt: ${prompt}`);
}
for (const garbledChunk of ['閹?', '閺?', '閹殿偅', '鐠囪', '鎶婄孩', '鎵撳紑', '鎷嶄竴']) {
  assert(!windowsTrialGuide.includes(garbledChunk), `Windows trial guide must not contain mojibake chunk: ${garbledChunk}`);
  assert(!evaluationGuide.includes(garbledChunk), `Evaluation guide must not contain mojibake chunk: ${garbledChunk}`);
}

assert(
  deviceSupport.includes('robot_arm') &&
    deviceSupport.includes('smart_light') &&
    deviceSupport.includes('camera_sensor'),
  'Device support matrix must include the three runnable public device paths.'
);
assert(deviceSupport.includes('Coming Soon'), 'Device support matrix must keep unsupported device families marked as Coming Soon.');

for (const document of [releaseNotes, releaseReadiness]) {
  assert(document.includes(`v${version}`), 'Release documents must reference the package version.');
  assert(document.includes('Public Alpha'), 'Release documents must retain the Public Alpha maturity label.');
  assert(document.includes('43/43') && document.includes('5/5') && document.includes('21/21'), 'Release documents must carry current automated safety and manual-import/action-install evidence.');
  assert(document.includes('command_acknowledged_open_loop'), 'Release documents must state open-loop acknowledgement semantics.');
  assert(!document.includes('production-ready'), 'Release documents must not claim production readiness.');
}
assert(releaseNotes.includes("supported_adapters:['simulator']"), 'Release notes must state the permanent manual-asset adapter boundary.');
assert(publicLaunchCopy.includes(`v${version} Public Alpha`), 'Public launch copy must reference the current version.');
assert(publicLaunchCopy.includes('evidence-locked REAL HARDWARE'), 'Public launch copy must describe the separate gated hardware boundary.');
for (const publicDocument of [publicLaunchCopy, commercialPositioning, customerValidation]) {
  assert(!publicDocument.includes('- no real device execution'), 'Public positioning must not falsely claim the reference real-hardware path does not exist.');
  assert(!publicDocument.includes('- simulation-only\n'), 'Public positioning must not describe the entire product as simulation-only.');
}

assert(demoScript.includes('simulation-first'), 'Demo script must state the simulation-first product boundary.');
assert(demoScript.includes('separately marked ESP32 reference-rig path'), 'Demo script must acknowledge the independently gated reference path.');
assert(archivedSocialCopy.includes('Historical v0.1.1 copy') && archivedSocialCopy.includes('Do not publish'), 'Stale social copy must be visibly archived.');
assert(desktopApp.includes('packaged first-run renderer smoke') && desktopApp.includes('Any missing contract exits non-zero'), 'Desktop packaging docs must describe the renderer smoke scope and its fail-closed exit behavior.');
assert(packScript.includes("['--prod', '--smoke-test']"), 'desktop:pack must run the packaged production smoke path.');
assert(packScript.includes('delete smokeEnvironment.ELECTRON_RUN_AS_NODE'), 'packaged smoke must not inherit Electron run-as-node mode.');
assert(packScript.includes('write-release-evidence.cjs'), 'desktop:pack must write machine-readable evidence only after packaged smoke passes.');
assert(packScript.includes('verify-windows-install-lifecycle.cjs'), 'desktop:pack must run the isolated Windows install lifecycle before release evidence is written.');
assert(packScript.includes("['--prod', '--design-smoke-test']"), 'desktop:pack must run the packaged responsive and accessibility design matrix.');
assert(packScript.includes("['--prod', '--startup-design-smoke-test']"), 'desktop:pack must run the packaged launch and startup recovery matrix.');
for (const packageContract of ['node_modules/pdfjs-dist/package.json', 'Import Device Manual', 'SIMULATION ONLY']) {
  assert(packageVerification.includes(packageContract), `Package verification must cover ${packageContract}.`);
}

for (const ignoredPath of ['/release/', 'demo/', '.next-build/', 'dist-electron/', '.env']) {
  assert(gitignore.includes(ignoredPath), `.gitignore must ignore ${ignoredPath}.`);
}

console.log('Release consistency tests passed.');
console.log(`- Version ${version} is aligned across package metadata and installer naming.`);
console.log('- README, evaluation, trial, release-note, and readiness docs agree on the Public Alpha boundaries.');
console.log('- Desktop packaging remains configured as a releasable installer path.');
