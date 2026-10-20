const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const protectedJS = new Set(['data-catalog.js', 'compound-batches.js', 'selectivity-identity.js', 'plate-mapping.js', 'orientation-mapping.js', 'parse.js', 'engine.js', 'potency.js', 'crosslink-hits.js', 'feedback-config.js', 'worker.js']);
function allowed(file, baselineFiles) {
  if (['tests/environment-verification.cjs', 'tests/feedback.cjs', 'tests/export-measurement-selection.cjs', 'tests/feedback-worker.test.cjs'].includes(file)) return false;
  if (/^tests\/[A-Za-z0-9_-]+\.(cjs|js)$/.test(file)) return true;
  if (!baselineFiles.has(file) || file.includes('/')) return false;
  return file.endsWith('.css') || ['index.html', 'presentation.html'].includes(file) || file.endsWith('.js') && !protectedJS.has(file);
}
function verify(root, baseline) {
  if (!/^[a-f0-9]{40}$/.test(baseline)) throw new Error('A full trusted baseline commit is required.');
  const git = args => execFileSync('git', args, { cwd: root, maxBuffer: 100 * 1024 * 1024 });
  const split = bytes => bytes.toString().split('\0').filter(Boolean);
  const baselineFiles = new Set(split(git(['ls-tree', '-r', '--name-only', '-z', baseline])));
  const datasets = [...baselineFiles].filter(file => file.endsWith('.json'));
  if (datasets.length !== 22) throw new Error(`Expected 22 supplied dataset JSON files, found ${datasets.length}.`);
  for (const file of datasets) {
    const current = fs.readFileSync(path.join(root, file));
    if (!current.equals(git(['show', `${baseline}:${file}`]))) throw new Error(`Dataset changed: ${file}`);
  }
  const changed = split(git(['diff', '--name-only', '--no-renames', '-z', baseline]));
  const untracked = split(git(['ls-files', '--others', '--exclude-standard', '-z']));
  for (const file of new Set([...changed, ...untracked])) {
    if (!allowed(file, baselineFiles)) throw new Error(`Automatic changes are not permitted for ${file}. Ask the owner.`);
    const full = path.join(root, file);
    if (!fs.existsSync(full) || !fs.lstatSync(full).isFile()) throw new Error(`Deletion or non-regular file rejected: ${file}`);
  }
  // Reject executable bits and symlink/submodule modes, not only file contents.
  const raw = split(git(['diff', '--raw', '--no-renames', '-z', baseline]));
  for (let i = 0; i < raw.length; i += 2) {
    const [oldMode, newMode] = raw[i].slice(1).split(' ');
    if (newMode !== '100644' || !['000000', '100644'].includes(oldMode)) throw new Error(`File mode change rejected: ${raw[i + 1]}`);
  }
  return { datasets: datasets.length, changed };
}
if (require.main === module) console.log(JSON.stringify(verify(process.argv[2] || process.cwd(), process.argv[3])));
module.exports = { allowed, verify };
