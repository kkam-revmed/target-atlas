// Uses only the repository's supplied datasets. Serve the checkout before running:
// NODE_PATH=/workspace/target-atlas-tools/node_modules node tests/export-measurement-selection.cjs
const { chromium } = require('playwright-core');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, acceptDownloads: true });
      await page.goto(process.env.ATLAS_URL || 'http://127.0.0.1:4173/');
      await page.waitForFunction(() => !document.querySelector('#demo').disabled && document.querySelector('#status').hidden);
      await page.locator('nav [data-view="dataExport"]').click();
      await page.waitForSelector('[data-count]');
      await page.locator('[data-action="none-datasets"]').click();
      await page.locator('[data-category="kd1"]').check();
      await page.locator('#dataExport details').evaluateAll(elements => elements.forEach(element => element.open = true));
      await page.locator('[data-filter="compound"]').fill('RMC-0741051');
      await page.locator('[data-metric="Mean Cmax"]').uncheck();
      await page.locator('[data-category="tr_fret"]').check();
      assert.equal(await page.locator('[data-metric="Mean Cmax"]').isChecked(), false, 'adding TR-FRET must preserve the excluded Kd1 metric');
      assert.equal(await page.locator('[data-metric="GMean qAC50"]').isChecked(), true);
      assert.equal(await page.locator('[data-metric="qAC50"]').isChecked(), true, 'newly available measurements start selected');
      await page.locator('[data-category="tr_fret"]').uncheck();
      assert.equal(await page.locator('[data-metric="Mean Cmax"]').isChecked(), false, 'removing TR-FRET must preserve the excluded Kd1 metric');
      // Mastersheet summaries share the exact same metric label with Kd1.
      await page.locator('[data-category="source_summary"]').check();
      assert.equal(await page.locator('[data-metric="Mean Cmax"]').isChecked(), false, 'adding a dataset with the same metric must not reselect it');
      await page.locator('[data-category="source_summary"]').uncheck();
      const count = await page.locator('[data-count]').innerText();
      assert.match(count, /^4 matching measurements/, 'one qAC50 per supplied Kd1 time point');
      const waiting = page.waitForEvent('download');
      await page.locator('[data-action="csv"]').click();
      const download = await waiting;
      assert.equal(await download.failure(), null);
      const csv = await fs.readFile(await download.path(), 'utf8');
      assert.equal(csv.includes('Mean Cmax'), false, 'export must not contain the deselected metric');
      assert.equal(csv.split('\r\n').filter(line => line.includes('"GMean qAC50"')).length, 4);
      // Explicit bulk measurement controls still work, including empty selection.
      await page.locator('[data-action="none-metrics"]').click();
      await page.locator('[data-category="tr_fret"]').check();
      await page.locator('[data-category="tr_fret"]').uncheck();
      assert.equal(await page.locator('[data-metric]:checked').count(), 0);
      assert.equal(await page.locator('[data-action="csv"]').isDisabled(), true);
      await page.locator('[data-action="all-metrics"]').click();
      assert.match(await page.locator('[data-count]').innerText(), /^8 matching measurements/);
      console.log(`PASS ${width}px: dataset changes preserve measurement choices and the downloaded CSV`);
      await page.close();
    }
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
