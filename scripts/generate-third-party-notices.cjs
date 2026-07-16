'use strict';

const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const nodeModulesRoot = path.join(root, 'node_modules');
const outputMarkdown = path.join(root, 'docs', 'THIRD_PARTY_NOTICES.md');
const outputHtml = path.join(root, 'docs', 'THIRD_PARTY_NOTICES.html');
const MAX_LICENSE_BYTES = 1024 * 1024;

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function npmCliPath() {
  if (process.env.npm_execpath && fs.existsSync(process.env.npm_execpath)) return process.env.npm_execpath;
  const bundled = path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
  if (!fs.existsSync(bundled)) throw new Error('npm CLI could not be located for notices generation');
  return bundled;
}

function html(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function cell(value) {
  return String(value).replaceAll('|', '\\|').replaceAll('\r', ' ').replaceAll('\n', ' ');
}

function licenseLabel(component) {
  const labels = (component.licenses ?? []).map((entry) => entry.expression ?? entry.license?.id ?? entry.license?.name).filter(Boolean);
  return labels.length > 0 ? labels.join(' OR ') : 'not declared in SBOM';
}

function packagePath(component) {
  const relative = (component.properties ?? []).find((item) => item.name === 'cdx:npm:package:path')?.value;
  if (typeof relative !== 'string') throw new Error(`SBOM package path missing for ${component.name}@${component.version}`);
  const absolute = path.resolve(root, relative);
  if (!absolute.startsWith(`${nodeModulesRoot}${path.sep}`) || !fs.existsSync(absolute) || !fs.statSync(absolute).isDirectory()) throw new Error(`SBOM package path escaped or is unavailable: ${relative}`);
  return absolute;
}

function licenseFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /^(licen[cs]e|copying|notice)(\..*)?$/i.test(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
}

function readLicense(filePath) {
  const bytes = fs.readFileSync(filePath);
  if (bytes.byteLength > MAX_LICENSE_BYTES) throw new Error(`license text exceeds ${MAX_LICENSE_BYTES} bytes: ${filePath}`);
  return bytes.toString('utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').trim();
}

function sourceUrl(component) {
  return (component.externalReferences ?? []).find((item) => item.type === 'vcs')?.url
    ?? (component.externalReferences ?? []).find((item) => item.type === 'website')?.url
    ?? (component.externalReferences ?? []).find((item) => item.type === 'distribution')?.url
    ?? '';
}

function repositoryFile(relative, label) {
  if (typeof relative !== 'string' || path.isAbsolute(relative)) throw new Error(`${label} must be a repository-relative path`);
  const absolute = path.resolve(root, relative);
  if (!absolute.startsWith(`${root}${path.sep}`) || !fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) throw new Error(`${label} escaped or is unavailable: ${relative}`);
  return absolute;
}

function buildNotices() {
  const sbom = JSON.parse(execFileSync(process.execPath, [npmCliPath(), 'sbom', '--omit', 'dev', '--sbom-format', 'cyclonedx', '--sbom-type', 'application'], {
    cwd: root, encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024
  }));
  if (sbom.bomFormat !== 'CycloneDX' || !Array.isArray(sbom.components)) throw new Error('npm did not produce a CycloneDX component inventory');
  const texts = new Map();
  const packages = sbom.components.map((component) => {
    const directory = packagePath(component);
    const textIds = [];
    for (const name of licenseFiles(directory)) {
      const text = readLicense(path.join(directory, name));
      if (!text) continue;
      const digest = sha256(text);
      if (!texts.has(digest)) texts.set(digest, { text, origins: [] });
      texts.get(digest).origins.push(`${component.name}@${component.version}/${name}`);
      textIds.push(digest.slice(0, 12));
    }
    return {
      name: component.name,
      version: component.version,
      declaredLicense: licenseLabel(component),
      source: sourceUrl(component),
      textIds: [...new Set(textIds)]
    };
  }).sort((a, b) => `${a.name}@${a.version}`.localeCompare(`${b.name}@${b.version}`));

  const provenance = JSON.parse(fs.readFileSync(path.join(root, 'third_party', 'model-assets', 'provenance.json'), 'utf8'));
  if (provenance.schema_version !== 1 || !Array.isArray(provenance.assets) || provenance.assets.length === 0) throw new Error('model asset provenance must use schema v1 with at least one asset');
  const modelSources = provenance.assets.map((item) => {
    for (const field of ['display_name', 'runtime_file', 'runtime_sha256', 'source_repository', 'source_commit', 'license', 'license_file', 'license_text_sha256', 'attribution', 'scope_evidence']) {
      if (typeof item[field] !== 'string' || !item[field]) throw new Error(`model asset provenance field missing: ${field}`);
    }
    const runtimePath = repositoryFile(item.runtime_file, 'model runtime file');
    const licensePath = repositoryFile(item.license_file, 'model license file');
    if (sha256(fs.readFileSync(runtimePath)) !== item.runtime_sha256) throw new Error(`model runtime digest mismatch: ${item.runtime_file}`);
    const text = readLicense(licensePath);
    if (sha256(text) !== item.license_text_sha256) throw new Error(`model license digest mismatch: ${item.license_file}`);
    const digest = sha256(text);
    if (!texts.has(digest)) texts.set(digest, { text, origins: [] });
    texts.get(digest).origins.push(`${item.display_name} pinned upstream LICENSE`);
    return {
      asset: item.display_name,
      file: item.runtime_file,
      source: `${item.source_repository}/tree/${item.source_commit}`,
      license: item.license,
      attribution: item.attribution,
      scopeNote: item.scope_evidence,
      textId: digest.slice(0, 12)
    };
  });

  const lockSha256 = sha256(fs.readFileSync(path.join(root, 'package-lock.json')));
  const lines = [
    '# RealityWarden Third-Party Notices', '',
    'This file lists third-party software and model assets redistributed with RealityWarden. It does not grant a license to RealityWarden itself. Package coverage is generated from the npm production-dependency CycloneDX inventory and bound to the repository lockfile.', '',
    `Lockfile SHA-256: \`${lockSha256}\``, '',
    '## Redistributed model assets', '',
    '| Asset | Runtime file | Source | License | Attribution | License text |', '| --- | --- | --- | --- | --- | --- |',
    ...modelSources.map((item) => `| ${cell(item.asset)} | \`${cell(item.file)}\` | ${cell(item.source)} | ${cell(item.license)} | ${cell(item.attribution)} ${cell(item.scopeNote)} | ${item.textId} |`), '',
    '## npm production dependency inventory', '',
    'Optional packages present in the production dependency inventory are included conservatively. A missing standalone license file is reported rather than silently replaced; the declared SPDX expression and source remain listed.', '',
    '| Package | Version | Declared license | Source | Included text id(s) |', '| --- | --- | --- | --- | --- |',
    ...packages.map((item) => `| ${cell(item.name)} | ${cell(item.version)} | ${cell(item.declaredLicense)} | ${cell(item.source)} | ${item.textIds.length ? item.textIds.join(', ') : 'no standalone file in installed package'} |`), '',
    '## Included license and notice texts', ''
  ];
  for (const [digest, record] of [...texts.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    lines.push(`### ${digest.slice(0, 12)}`, '', `Origins: ${record.origins.sort().map((origin) => `\`${origin}\``).join(', ')}`, '', '<pre>', html(record.text), '</pre>', '');
  }
  const markdown = `${lines.join('\n').trimEnd()}\n`;
  const rows = packages.map((item) => `<tr><td>${html(item.name)}</td><td>${html(item.version)}</td><td>${html(item.declaredLicense)}</td><td>${html(item.source)}</td><td>${html(item.textIds.length ? item.textIds.join(', ') : 'no standalone file in installed package')}</td></tr>`).join('');
  const modelRows = modelSources.map((item) => `<tr><td>${html(item.asset)}</td><td>${html(item.file)}</td><td>${html(item.source)}</td><td>${html(item.license)}</td><td>${html(`${item.attribution} ${item.scopeNote}`)}</td><td>${html(item.textId)}</td></tr>`).join('');
  const textSections = [...texts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([digest, record]) => `<section><h3>${digest.slice(0, 12)}</h3><p>Origins: ${record.origins.sort().map(html).join(', ')}</p><pre>${html(record.text)}</pre></section>`).join('');
  const document = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>RealityWarden Third-Party Notices</title><style>body{margin:0;background:#090A0C;color:#E5E7EB;font:14px/1.55 system-ui,sans-serif}main{max-width:1100px;margin:auto;padding:32px}h1,h2,h3{color:#F8FAFC}a{color:#38BDF8}table{width:100%;border-collapse:collapse;margin:16px 0 28px}th,td{border:1px solid #334155;padding:8px;vertical-align:top;text-align:left;word-break:break-word}th{background:#111827}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#111827;border:1px solid #334155;padding:16px}code{color:#FCD34D}@media(max-width:720px){main{padding:16px}table{display:block;overflow:auto}}</style></head><body><main><h1>RealityWarden Third-Party Notices</h1><p>This document lists third-party software and model assets redistributed with RealityWarden. It does not grant a license to RealityWarden itself. Package coverage is generated from the npm production-dependency CycloneDX inventory.</p><p>Lockfile SHA-256: <code>${lockSha256}</code></p><h2>Redistributed model assets</h2><table><thead><tr><th>Asset</th><th>Runtime file</th><th>Source</th><th>License</th><th>Attribution</th><th>Text id</th></tr></thead><tbody>${modelRows}</tbody></table><h2>npm production dependency inventory</h2><p>Optional inventory entries are included conservatively. Missing standalone files are reported explicitly.</p><table><thead><tr><th>Package</th><th>Version</th><th>Declared license</th><th>Source</th><th>Text id(s)</th></tr></thead><tbody>${rows}</tbody></table><h2>Included license and notice texts</h2>${textSections}</main></body></html>\n`;
  return { markdown, html: document, packageCount: packages.length, textCount: texts.size, lockSha256 };
}

function main() {
  const built = buildNotices();
  if (process.argv.includes('--check')) {
    for (const [file, expected] of [[outputMarkdown, built.markdown], [outputHtml, built.html]]) {
      if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== expected) throw new Error(`third-party notices are stale: ${path.relative(root, file)}`);
    }
    console.log(`Third-party notices are current (${built.packageCount} npm packages, ${built.textCount} unique texts).`);
    return;
  }
  fs.writeFileSync(outputMarkdown, built.markdown, 'utf8');
  fs.writeFileSync(outputHtml, built.html, 'utf8');
  console.log(`Generated third-party notices (${built.packageCount} npm packages, ${built.textCount} unique texts).`);
}

try { main(); }
catch (error) {
  console.error(`Third-party notices failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

module.exports = { buildNotices };
