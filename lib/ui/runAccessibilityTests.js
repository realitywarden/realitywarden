const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const page = read('app/page.tsx');
const styles = read('app/globals.css');
const notice = read('components/OperatorNotice.tsx');
const actionComposer = read('components/ActionComposer.tsx');
const routeError = read('app/error.tsx');
const globalError = read('app/global-error.tsx');
const stageError = read('components/StageErrorBoundary.tsx');
const semanticStage = read('components/SemanticDeviceStage.tsx');

assert(notice.includes("role={urgent ? 'alert' : 'status'}"), 'Operator notices must expose alert/status semantics by urgency.');
assert(notice.includes("aria-live={urgent ? 'assertive' : 'polite'}") && notice.includes('aria-atomic="true"'), 'Operator notices must announce complete messages with the correct live-region priority.');
assert(notice.includes('onDismiss') && notice.includes('Dismiss notification'), 'Operator notices must remain explicitly dismissible.');
assert(page.includes("operatorNotice.persistent || operatorNotice.severity === 'error'"), 'Error notices must remain visible until the operator dismisses or resolves them.');
assert(page.includes("operatorNotice.severity === 'warning' ? 8000 : 5000"), 'Non-error notices must provide readable display time.');
assert(page.includes("kind: 'discard_autosave'") && page.includes('window.localStorage.removeItem(workspaceStorageKey)'), 'Corrupted autosave recovery must be explicit and must not mutate the current workspace.');

assert(actionComposer.includes("event.key === 'Escape'") && actionComposer.includes("event.key !== 'Tab'"), 'Action Composer must support Escape and keyboard focus containment.');
assert(read('components/AppHeader.tsx').includes('data-action-composer-trigger'), 'The Action Composer opener must expose a stable focus-return target.');
assert(page.includes("document.querySelector<HTMLElement>('[data-action-composer-trigger]')?.focus()") && page.includes('onClose={closeActionComposer}'), 'The parent surface must restore trigger focus after modal background suppression is removed.');
assert(actionComposer.includes('aria-labelledby="action-composer-title"') && actionComposer.includes('aria-describedby="action-composer-description"'), 'Action Composer must expose a labelled dialog contract.');
assert(actionComposer.includes("role={feedback.ok ? 'status' : 'alert'}"), 'Action Composer feedback must announce success and errors with distinct semantics.');
assert(styles.includes('.modal-surface-active > :not([data-app-modal])') && page.includes('data-app-modal'), 'Every app modal must suppress underlying Three.js overlays and background accessibility targets.');
assert(semanticStage.includes('const worldLabelZIndexRange: [number, number] = [10, 0]') && (semanticStage.match(/zIndexRange=\{worldLabelZIndexRange\}/g) ?? []).length === 7, 'Every Three.js world label must stay below CommandDock and workspace controls.');

for (const [name, source] of [['route', routeError], ['global', globalError], ['stage', stageError]]) {
  assert(source.includes('role="alert"') && source.includes('aria-live="assertive"'), `${name} recovery boundary must announce the contained failure.`);
  assert(source.includes('window.location.reload()'), `${name} recovery boundary must offer a full reload fallback.`);
  assert(!source.includes('Nothing was sent to real hardware') && !source.includes('No signals were sent to real hardware'), `${name} recovery boundary must not infer hardware delivery state from a UI failure.`);
}
assert(routeError.includes('does not prove whether hardware received an earlier command'), 'Route recovery must state hardware delivery uncertainty honestly.');
assert(globalError.includes('does not prove prior hardware delivery state'), 'Global recovery must state hardware delivery uncertainty honestly.');
assert(stageError.includes('does not prove prior hardware delivery state'), '3D recovery must state hardware delivery uncertainty honestly.');
assert(stageError.includes('revision: state.revision + 1'), '3D recovery must remount the failed stage instead of only clearing the error flag.');

console.log('Accessibility and recovery tests passed.');
console.log('- Persistent, announced operator errors include explicit corrupted-autosave recovery.');
console.log('- Action Composer traps/restores focus and exposes labelled dialog semantics.');
console.log('- UI/3D crash boundaries offer retry + reload without inventing hardware-delivery evidence.');
