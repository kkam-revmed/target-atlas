const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn, execFileSync } = require('node:child_process');
const { chromium } = require('playwright-core');
const root = process.env.ATLAS_ROOT || path.resolve(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'crosslinking.json'), 'utf8'));
const base = id => id.replace(/-\d{3,}$/, '');
const pct = v => v == null ? '—' : Number(v).toLocaleString('en-US', { maximumFractionDigits: 4 }) + '%';
const hit = q => q.conditions.with_cypa.total_percent > 20 && q.comparison.total_fold.value != null && q.comparison.total_fold.value > 2;
const matches = (q, mode) => mode === 'hits' ? hit(q) : q.conditions[mode === 'no_signal' ? 'no_cypa' : 'with_cypa'].total_percent > 0;
const expectedCount = (rows, mode) => `${rows.filter(q => matches(q, mode)).length} / ${rows.length} (${(100 * rows.filter(q => matches(q, mode)).length / rows.length).toLocaleString('en-US', { maximumFractionDigits: 1 })}%)`;
const csv = text => JSON.parse(execFileSync('python3', ['-c', 'import csv,sys,json; print(json.dumps(list(csv.DictReader(sys.stdin))))'], { input: text.replace(/^\uFEFF/, ''), encoding: 'utf8' }));
async function checkTable(page, record) {
  assert.match(await page.locator('#xlinkSelectedHeading').innerText(), new RegExp(base(record.compound)));
  assert((await page.locator('#xlinkSelectedHeading').innerText()).includes(record.context));
  const table = page.locator('.xlink-adduct-table');
  assert(await table.isVisible());
  assert.equal(await table.evaluate(el => !!el.closest('details')), false, 'adduct values must be visible without expanding details');
  const source = page.locator('#xlinkSelected .xlink-source');
  assert(await source.isVisible());
  assert((await source.innerText()).includes(record.sheet + '!' + record.conditions.with_cypa.source_range));
  assert.equal(await source.evaluate(el => !!el.closest('details')), false, 'source cells must remain visible');
  assert(await page.locator('#xlink-adduct-0').evaluate(el => el.getBoundingClientRect().width <= 560), 'adduct graph must stay compact');
  const actual = await table.locator('tbody tr').evaluateAll(rows => rows.map(row => [...row.querySelectorAll('td')].map(td => td.textContent)));
  const no = record.conditions.no_cypa, yes = record.conditions.with_cypa;
  assert.deepEqual(actual, Array.from({ length: Math.max(no.adduct_percent.length, yes.adduct_percent.length) }, (_, i) => [pct(no.adduct_percent[i]), pct(yes.adduct_percent[i])]));
  assert.deepEqual(await table.locator('tfoot td').allTextContents(), [pct(no.total_percent), pct(yes.total_percent)]);
}
async function downloadRows(page, selector) {
  const pending = page.waitForEvent('download');
  await page.locator(selector).click();
  const downloaded = await pending;
  return csv(fs.readFileSync(await downloaded.path(), 'utf8'));
}
function checkCSV(rows, records) {
  // The existing exporter prefixes formula-like text for spreadsheet safety.
  rows = rows.map(row => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, /^'[=+\-@]/.test(value) ? value.slice(1) : value])));
  assert.equal(rows.length, records.length * 2);
  assert.deepEqual(rows.map(r => r.full_batch_id + '/' + r.source_context + '/' + r.condition).sort(), records.flatMap(q => ['No CypA', '+CypA'].map(c => q.compound + '/' + q.context + '/' + c)).sort());
  for (const row of rows) {
    const q = records.find(q => q.compound === row.full_batch_id && q.context === row.source_context);
    const c = q.conditions[row.condition === 'No CypA' ? 'no_cypa' : 'with_cypa'];
    for (const [i, key] of ['no_adduct_percent', 'one_adduct_percent', 'two_adduct_percent', 'three_adduct_percent', 'four_adduct_percent', 'five_adduct_percent'].entries()) {
      assert.equal(row[key], c.adduct_percent[i] == null ? '' : String(c.adduct_percent[i]), key);
    }
    assert.equal(row.total_crosslinking_percent, String(c.total_percent));
    assert.equal(row.source_file, data.source); assert.equal(row.source_sheet, q.sheet);
    assert.equal(row.source_row, String(q.source_row)); assert.equal(row.source_range, c.source_range);
    assert.equal(row.total_fold_plus_over_no, q.comparison.total_fold.value == null ? '' : String(q.comparison.total_fold.value));
    assert.equal(row.hit_status === 'Hit', hit(q));
  }
}
(async () => {
  const url = process.env.ATLAS_URL || 'http://127.0.0.1:4175/';
  const server = process.env.ATLAS_URL ? null : spawn('python3', ['-m', 'http.server', '4175', '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
  let browser;
  try {
    for (let i = 0; i < 50; i++) { try { if ((await fetch(url)).ok) break; } catch {} await new Promise(r => setTimeout(r, 100)); }
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
    for (const width of [1440, 390, 320]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, acceptDownloads: true });
      const page = await context.newPage(), errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(url + '?view=crosslinking');
      await page.locator('.xlink-adduct-table').waitFor();
      await page.locator('#xlinkCompoundSelect').selectOption('RMC-0737135');
      await page.locator('#xlinkBatchSelect').selectOption('RMC-0737135-001');
      for (const target of data.contexts) {
        await page.locator('#xlinkContext').selectOption(target);
        const q = data.records.find(q => q.compound === 'RMC-0737135-001' && q.context === target);
        await checkTable(page, q);
        checkCSV(await downloadRows(page, '#xlinkSelectedCSV'), [q]);
      }
      const multi = data.compounds.find(id => data.compounds.filter(c => base(c) === base(id)).length > 1);
      await page.locator('#xlinkCompoundSelect').selectOption(base(multi));
      for (const id of data.compounds.filter(c => base(c) === base(multi))) {
        await page.locator('#xlinkBatchSelect').selectOption(id);
        await checkTable(page, data.records.find(q => q.compound === id && q.context === data.contexts[2]));
      }
      // The top picker must accept typed IDs without merging distinct batches.
      const search=page.locator('#xlinkPickerSearch');
      await search.pressSequentially('0737135');
      await checkTable(page, data.records.find(q=>q.compound==='RMC-0737135-001'&&q.context===data.contexts[2]));
      assert.equal(await page.evaluate(()=>document.activeElement.id),'xlinkPickerSearch');
      for(const id of data.compounds.filter(c=>base(c)===base(multi))){
        await search.fill('  '+id.toLowerCase()+'  ');
        assert.equal(await page.locator('#xlinkBatchSelect').inputValue(),id);
        const q=data.records.find(q=>q.compound===id&&q.context===data.contexts[2]);
        await checkTable(page,q);
        checkCSV(await downloadRows(page,'#xlinkSelectedCSV'),[q]);
      }
      await search.fill(base(multi)+'-999');
      assert(await page.locator('#xlinkCompoundSelect').isDisabled());
      assert(await page.locator('#xlinkBatchSelect').isDisabled());
      assert(!(await page.locator('#xlinkSelected').isVisible()),'no match must not display the previous result');
      assert.match(await page.locator('#xlinkPickerStatus').innerText(),/No matching compound batch/);
      await page.locator('#xlinkContext').selectOption(data.contexts[0]);
      await search.fill('');
      assert.equal(await page.locator('#xlinkCompoundSelect option').count(),new Set(data.compounds.map(base)).size);
      assert((await page.locator('#xlinkSelectedHeading').innerText()).includes(data.contexts[0]));
      await search.fill('RMC-');
      await page.locator('#xlinkCompoundSelect').selectOption('RMC-0737135');
      await checkTable(page,data.records.find(q=>q.compound==='RMC-0737135-001'&&q.context===data.contexts[0]));
      await search.fill('');
      const zero = data.records.find(q => q.conditions.no_cypa.total_percent === 0 && q.comparison.total_fold.value == null);
      assert(zero, 'the supplied data must exercise an undefined fold at a zero baseline');
      await page.locator('#xlinkContext').selectOption(zero.context);
      await page.locator('#xlinkCompoundSelect').selectOption(base(zero.compound));
      await page.locator('#xlinkBatchSelect').selectOption(zero.compound);
      await checkTable(page, zero);
      checkCSV(await downloadRows(page, '#xlinkSelectedCSV'), [zero]);
      for (const target of data.contexts) for (const mode of ['no_signal', 'with_signal', 'hits']) {
        // Select using attributes in the browser so spaces and parentheses remain literal.
        await page.locator('#xlinkSummary').evaluate((el, { target, mode }) => [...el.querySelectorAll('[data-xlink-list]')].find(b => b.dataset.xlinkContext === target && b.dataset.xlinkList === mode).click(), { target, mode });
        assert.equal(await page.locator('#xlinkContext').inputValue(), target);
        assert.equal(await page.locator('#xlinkListFilter').inputValue(), mode);
        const expected = data.records.filter(q => q.context === target && matches(q, mode));
        assert.deepEqual((await page.locator('#xlinkTable [data-xlink-compound]').evaluateAll(els => els.map(e => e.dataset.xlinkCompound))).sort(), expected.map(q => q.compound).sort());
        const text = await page.locator('#xlinkSummary').evaluate((el, { target, mode }) => [...el.querySelectorAll('[data-xlink-list]')].find(b => b.dataset.xlinkContext === target && b.dataset.xlinkList === mode).textContent, { target, mode });
        assert.equal(text, expectedCount(data.records.filter(q => q.context === target), mode));
        if (width === 1440) checkCSV(await downloadRows(page, '#xlinkCSV'), expected);
      }
      await page.locator('#xlinkClear').click();
      await page.locator('#xlinkSearch').fill('RMC-0737135-001');
      checkCSV(await downloadRows(page, '#xlinkCSV'), data.records.filter(q => q.compound === 'RMC-0737135-001' && q.context === data.contexts[2]));
      await page.locator('#xlinkTable [data-xlink-compound]').click();
      assert.equal(await page.locator('#xlinkBatchSelect').inputValue(), 'RMC-0737135-001');
      assert.equal(await page.evaluate(() => document.activeElement.id), 'xlinkSelectedHeading');
      await page.locator('#xlinkSearch').fill('not-a-compound');
      assert(await page.locator('#xlinkCSV').isDisabled());
      assert.match(await page.locator('#xlinkTable').innerText(), /No batches match/);
      const overflow = await page.evaluate(() => ({ page: document.documentElement.scrollWidth, width: innerWidth, table: document.querySelector('.xlink-adduct-table').getBoundingClientRect().right }));
      assert(overflow.page <= overflow.width + 1 && overflow.table <= overflow.width, JSON.stringify(overflow));
      await page.locator('a[href="#xlinkAdvanced"]').click();
      assert(await page.locator('#xcompareMembership').isVisible());
      await page.locator('#xcompareMembership').selectOption('any');
      await page.locator('#xcompareSearch').fill('RMC-0737135-001');
      await page.locator('#xcompareTable [data-xlink-compound]').click();
      await checkTable(page, data.records.find(q => q.compound === 'RMC-0737135-001' && q.context === data.contexts[2]));
      assert.deepEqual(errors, []);
      console.log(`PASS ${width}px: visible adduct values, all contexts, distinct batches, counts and drill-downs, CSV source fidelity, empty search, keyboard focus, advanced comparisons and layout`);
      await context.close();
    }
  } finally { if (browser) await browser.close(); server?.kill(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
