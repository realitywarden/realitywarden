#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const supportLevels = new Set(['simulation_only', 'read_only', 'coming_soon', 'unsupported']);
const adapterModes = new Set(['simulation_only', 'read_only', 'real_disabled']);

function readAsset(filePath) {
  try {
    return {
      asset: JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '')),
      errors: []
    };
  } catch (error) {
    return {
      asset: null,
      errors: [`Invalid JSON: ${error.message}`]
    };
  }
}

function validate(asset) {
  const errors = [];
  const warnings = [];
  if (!asset || typeof asset !== 'object' || Array.isArray(asset)) errors.push('Reality Asset must be a JSON object.');
  if (!asset?.assetId) errors.push('assetId is required.');
  if (!asset?.version) errors.push('version is required.');
  if (!asset?.deviceManifest) errors.push('deviceManifest is required.');
  if (!Array.isArray(asset?.capabilityContracts) || asset.capabilityContracts.length === 0) {
    errors.push('capabilityContracts must contain at least one capability.');
  }
  if (!supportLevels.has(asset?.supportLevel)) errors.push(`supportLevel is invalid: ${asset?.supportLevel}`);
  if (!asset?.adapterBoundary) errors.push('adapterBoundary is required.');
  if (asset?.adapterBoundary?.realAdapterEnabled !== false) errors.push('realAdapterEnabled must be false in Public Alpha.');
  if (asset?.deviceManifest?.adapter?.realAdapterEnabled !== false) errors.push('deviceManifest.adapter.realAdapterEnabled must be false.');
  if (asset?.adapterBoundary?.adapterMode && !adapterModes.has(asset.adapterBoundary.adapterMode)) {
    errors.push(`adapterMode is invalid: ${asset.adapterBoundary.adapterMode}`);
  }
  if (asset?.adapterBoundary?.adapterMode === 'real_disabled' && (asset.adapterBoundary.simulationAdapterAvailable || asset.adapterBoundary.readOnlyAdapterAvailable)) {
    errors.push('real_disabled adapter mode cannot expose runnable adapters.');
  }
  if (asset?.supportLevel === 'coming_soon' && (asset?.adapterBoundary?.simulationAdapterAvailable || asset?.adapterBoundary?.readOnlyAdapterAvailable)) {
    errors.push('Coming Soon assets cannot be runnable.');
  }
  if (!asset?.examplePrompts || !Object.values(asset.examplePrompts).some((items) => Array.isArray(items) && items.length > 0)) {
    errors.push('examplePrompts must include at least one prompt group.');
  }
  if (!Array.isArray(asset?.safetyNotes) || asset.safetyNotes.length === 0) errors.push('safetyNotes must exist.');
  if (!Array.isArray(asset?.tags) || asset.tags.length === 0) warnings.push('tags should identify asset source and support level.');
  return { valid: errors.length === 0, errors, warnings };
}

function hintFor(message) {
  if (message.includes('realAdapterEnabled')) return 'Fix: realAdapterEnabled must be false in Public Alpha.';
  if (message.includes('deviceManifest')) return 'Fix: add a complete deviceManifest section.';
  if (message.includes('capabilityContracts')) return 'Fix: add capabilityContracts.';
  if (message.includes('Coming Soon')) return 'Fix: Coming Soon assets cannot be runnable.';
  if (message.includes('safetyNotes')) return 'Fix: add safetyNotes.';
  if (message.includes('examplePrompts')) return 'Fix: add supported, unsupported, or ambiguous examplePrompts.';
  return 'Fix: update the field named in the validation error.';
}

function printReport(filePath, parseErrors, validation) {
  const unsafe = [...parseErrors, ...validation.errors].some((error) => error.includes('realAdapterEnabled'));
  const valid = parseErrors.length === 0 && validation.valid;
  console.log(`Reality Asset Validation: ${path.basename(filePath)}`);
  console.log(`Status: ${valid ? 'VALID' : unsafe ? 'UNSAFE' : 'INVALID'}`);
  console.log('Boundary: no real device execution; TaskDSL is not a hardware command.');
  if (parseErrors.length > 0) {
    console.log('\nErrors:');
    for (const error of parseErrors) console.log(`- ${error}`);
  }
  if (validation.errors.length > 0) {
    console.log('\nErrors:');
    for (const error of validation.errors) console.log(`- ${error}`);
  }
  if (validation.warnings.length > 0) {
    console.log('\nWarnings:');
    for (const warning of validation.warnings) console.log(`- ${warning}`);
  }
  const hints = Array.from(new Set([...parseErrors, ...validation.errors].map(hintFor)));
  if (hints.length > 0) {
    console.log('\nFix suggestions:');
    for (const hint of hints) console.log(`- ${hint}`);
  }
}

const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: node scripts/validate-reality-asset.cjs <asset.json>');
  process.exit(1);
}

const parsed = readAsset(filePath);
const validation = parsed.asset ? validate(parsed.asset) : { valid: false, errors: [], warnings: [] };
printReport(filePath, parsed.errors, validation);
process.exit(parsed.errors.length === 0 && validation.valid ? 0 : 1);
