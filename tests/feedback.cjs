// Run against a local static server. Submission responses are simulated here;
// this test never creates an issue or starts an external worker.
const { chromium } = require('playwright-core');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  try {
    for (const width of [1440, 390, 320]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errors = [], requests = [];
      page.on('pageerror', error => errors.push(error.message));
      let connected = false, reply = 'failure';
      await page.route('**/feedback-config.js*', route => route.fulfill({ contentType: 'application/javascript', body: `window.AtlasFeedbackConfig={endpoint:${connected ? "'./api/feedback'" : 'null'}};` }));
      await page.route('**/api/feedback', async route => {
        const body = route.request().postDataJSON(); requests.push(body);
        assert.equal(route.request().headers()['idempotency-key'], body.requestId);
        if (reply === 'failure') return route.fulfill({ status: 503, body: 'Unavailable' });
        if (reply === 'unauthorized') return route.fulfill({ status: 401, body: 'Unauthorized' });
        if (reply === 'invalid') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'fb_test', status: 'queued', requestId: 'wrong-request' }) });
        if (reply === 'success') return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: 'fb_test', status: 'queued', requestId: body.requestId }) });
        return route.abort();
      });
      const open = async () => {
        await page.locator('#sendAtlasFeedback').click();
        await page.waitForSelector('#atlasFeedback[open]');
      };
      const send = async () => {
        await page.locator('[data-feedback-submit]').click();
        await page.waitForFunction(() => document.querySelector('[data-feedback-status]').textContent && !document.querySelector('[data-feedback-status]').textContent.includes('Sending your feedback'));
      };
      const ready = () => page.waitForFunction(() => !document.querySelector('#demo').disabled && document.querySelector('#status').hidden && document.querySelector('#metrics').textContent.trim());
      const url = (process.env.ATLAS_URL || 'http://127.0.0.1:4173/') + '?view=curves&experiment=EXP26007301';
      await page.goto(url); await ready(); await open();
      assert(await page.locator('[data-feedback-submit]').isDisabled());
      assert.equal(requests.length, 0);
      assert(await page.locator('[data-feedback-unavailable]').isVisible());
      await page.keyboard.press('Escape');
      assert.equal(await page.evaluate(() => document.activeElement.id), 'sendAtlasFeedback');
      connected = true; await page.reload(); await ready(); await open();
      await page.locator('#atlasFeedback input[name="title"]').fill('Selection review');
      await page.locator('#atlasFeedback textarea').fill('Please check the measurement selection controls.');
      const context = JSON.parse(await page.locator('[data-feedback-context]').textContent());
      assert.equal(context.section, 'curves');
      assert.equal(context.experiment, 'EXP26007301');
      assert(context.compoundBatch.startsWith('RMC-'));
      const bounds = await page.locator('#atlasFeedback').evaluate(el => ({ viewport: innerWidth, left: el.getBoundingClientRect().left, right: el.getBoundingClientRect().right, width: el.clientWidth, scroll: el.scrollWidth }));
      assert(bounds.left >= 0 && bounds.right <= bounds.viewport && bounds.scroll <= bounds.width + 1);
      await send();
      assert.match(await page.locator('[data-feedback-status]').innerText(), /could not be confirmed/);
      assert.equal(await page.locator('#atlasFeedback textarea').inputValue(), 'Please check the measurement selection controls.');
      const requestId = requests[0].requestId;
      assert.deepEqual(requests[0].context, context);
      assert.deepEqual(Object.keys(requests[0]).sort(), ['context', 'description', 'kind', 'requestId', 'schemaVersion', 'title']);
      reply = 'invalid'; await send();
      assert.match(await page.locator('[data-feedback-status]').innerText(), /could not be confirmed/);
      assert.equal(requests[1].requestId, requestId);
      reply = 'success'; await send();
      assert.equal(requests[2].requestId, requestId, 'retry must use the same idempotency key');
      assert.equal(await page.locator('[data-feedback-status]').innerText(), 'Feedback received. Reference: fb_test.');
      assert(await page.locator('[data-feedback-submit]').isDisabled());
      await page.locator('[data-feedback-another]').click();
      await page.locator('#atlasFeedback input[name="title"]').fill('Assay wording question');
      await page.locator('#atlasFeedback textarea').fill('Please clarify the description.');
      await page.locator('#atlasFeedback input[name="includeContext"]').uncheck();
      reply = 'unauthorized'; await send();
      assert.match(await page.locator('[data-feedback-status]').innerText(), /sign in/);
      assert.equal(requests[3].context, null);
      assert.notEqual(requests[3].requestId, requestId);
      reply = 'success'; await send();
      assert.equal(requests[4].requestId, requests[3].requestId);
      await page.keyboard.press('Escape');
      // An external endpoint is never enabled, even if a configuration is incorrect.
      await page.evaluate(() => { window.AtlasFeedbackConfig = { endpoint: 'https://example.invalid/feedback' }; });
      await open(); await page.locator('[data-feedback-another]').click();
      assert(await page.locator('[data-feedback-submit]').isDisabled());
      assert.deepEqual(errors, []);
      console.log(`PASS ${width}px: disconnected state, context consent, retry identity, receipt validation, auth error, dialog focus, and layout`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
