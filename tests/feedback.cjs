// GitHub navigation is intercepted. These tests do not create public issues.
const { chromium } = require('playwright-core');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  try {
    for (const width of [1440, 390, 320]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      const requests = [], errors = [];
      await context.route('https://github.com/**', route => { requests.push({ method: route.request().method(), url: route.request().url() }); return route.fulfill({ contentType: 'text/html', body: '<h1>Intercepted GitHub draft</h1>' }); });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      const ready = () => page.waitForFunction(() => !document.querySelector('#demo').disabled && document.querySelector('#status').hidden && document.querySelector('#metrics').textContent.trim());
      await page.goto((process.env.ATLAS_URL || 'http://127.0.0.1:4173/') + '?view=curves&experiment=EXP26007301');
      await ready(); await page.locator('#sendAtlasFeedback').click();
      assert.match(await page.locator('.feedback-notice').innerText(), /public GitHub issue/);
      assert.equal(requests.length, 0, 'opening the dialog must not transmit anything');
      await page.locator('#atlasFeedback input[name="title"]').fill('Selection review & quoted "text"');
      await page.locator('#atlasFeedback textarea[name="description"]').fill('Please check selection controls.\nSecond line.');
      const view = JSON.parse(await page.locator('[data-feedback-context]').textContent());
      assert.equal(view.experiment, 'EXP26007301');
      assert(view.compoundBatch.startsWith('RMC-'));
      const box = await page.locator('#atlasFeedback').evaluate(el => ({ viewport: innerWidth, left: el.getBoundingClientRect().left, right: el.getBoundingClientRect().right, width: el.clientWidth, scroll: el.scrollWidth }));
      assert(box.left >= 0 && box.right <= box.viewport && box.scroll <= box.width + 1);
      let opened = context.waitForEvent('page');
      await page.locator('[data-feedback-submit]').click();
      let tab = await opened; await tab.waitForLoadState(); await tab.close();
      let url = new URL(await page.locator('[data-feedback-draft]').getAttribute('href'));
      assert.equal(url.origin, 'https://github.com');
      assert.equal(url.pathname, '/kkam-revmed/target-atlas/issues/new');
      assert.equal(url.searchParams.get('template'), 'atlas-feedback.md');
      assert.equal(url.searchParams.get('title'), '[Atlas feedback] Selection review & quoted "text"');
      assert(url.searchParams.get('body').includes('Please check selection controls.\nSecond line.'));
      assert(url.searchParams.get('body').includes(JSON.stringify(view, null, 2)));
      assert.match(await page.locator('[data-feedback-status]').innerText(), /only prepared a draft/);
      assert(await page.locator('[data-feedback-submit]').isEnabled(), 'navigation is not a submission receipt');
      await page.locator('#atlasFeedback input[name="includeContext"]').uncheck();
      assert(await page.locator('[data-feedback-draft]').isHidden(), 'changing consent invalidates the old draft');
      opened = context.waitForEvent('page'); await page.locator('[data-feedback-submit]').click();
      tab = await opened; await tab.waitForLoadState(); await tab.close();
      url = new URL(await page.locator('[data-feedback-draft]').getAttribute('href'));
      assert(!url.searchParams.get('body').includes('EXP26007301'));
      assert(url.searchParams.get('body').includes('Not included.'));
      const longText = 'A long feedback request & details.\n'.repeat(200);
      await page.locator('#atlasFeedback textarea[name="description"]').fill(longText);
      const tabs = context.pages().length;
      await page.locator('[data-feedback-submit]').click();
      assert.equal(context.pages().length, tabs);
      assert(await page.locator('[data-feedback-copy-area]').isVisible());
      assert((await page.locator('[data-feedback-text]').inputValue()).includes(longText.trim()));
      url = new URL(await page.locator('[data-feedback-draft]').getAttribute('href'));
      assert.equal(url.searchParams.has('body'), false);
      await page.keyboard.press('Escape');
      assert.equal(await page.evaluate(() => document.activeElement.id), 'sendAtlasFeedback');
      await page.locator('nav [data-view="dataExport"]').click(); await page.waitForSelector('[data-count]');
      await page.locator('#sendAtlasFeedback').click(); await page.locator('#atlasFeedback input[name="includeContext"]').check();
      const exportContext = JSON.parse(await page.locator('[data-feedback-context]').textContent());
      assert.equal(exportContext.section, 'dataExport'); assert.equal(exportContext.experiment, undefined);
      assert(exportContext.datasets.length > 0 && exportContext.measurements.length > 0);
      assert.equal(exportContext.records, undefined);
      await page.keyboard.press('Escape');
      await page.evaluate(() => { window.AtlasFeedbackConfig = { repository: 'https://example.invalid/feedback' }; });
      await page.locator('#sendAtlasFeedback').click(); assert(await page.locator('[data-feedback-submit]').isDisabled());
      assert(requests.every(request => request.method === 'GET'));
      assert.deepEqual(errors, []);
      console.log(`PASS ${width}px: public GitHub draft, exact text/context, consent, long-text fallback, focus and layout; no issue submitted`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
