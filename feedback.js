'use strict';

(() => {
  const trigger = document.getElementById('sendAtlasFeedback');
  if (!trigger) return;
  const dialog = document.createElement('dialog');
  dialog.id = 'atlasFeedback';
  dialog.setAttribute('aria-labelledby', 'atlasFeedbackTitle');
  dialog.innerHTML = `
    <form id="atlasFeedbackForm">
      <div class="feedback-heading"><h2 id="atlasFeedbackTitle">Send feedback</h2><button type="button" data-feedback-close aria-label="Close feedback">×</button></div>
      <p>Report a problem, suggest an improvement, or flag an assay question.</p>
      <p class="feedback-notice" data-feedback-unavailable hidden>Feedback submission is not connected yet. Nothing you enter here will be sent.</p>
      <label>Feedback type<select name="kind"><option value="bug">Something isn't working</option><option value="improvement">Improvement suggestion</option><option value="assay-question">Assay or data question</option></select></label>
      <label>Summary<input name="title" required maxlength="160" autocomplete="off" placeholder="A short description"></label>
      <label>Details<textarea name="description" required maxlength="8000" rows="5" placeholder="What were you trying to do? What happened, and what did you expect?"></textarea></label>
      <p class="feedback-help">Please describe the issue without attaching original workbooks or pasting experimental data.</p>
      <label class="feedback-check"><input name="includeContext" type="checkbox" checked>Include current view details</label>
      <details class="feedback-context"><summary>Review the details included</summary><pre data-feedback-context></pre></details>
      <p class="feedback-help">View details include the selected section, experiment and compound when applicable. They do not include measurements, files, or account information.</p>
      <p data-feedback-status role="status" aria-live="polite"></p>
      <div class="feedback-actions"><button type="button" class="secondary" data-feedback-close>Close</button><button type="button" class="secondary" data-feedback-another hidden>Send another</button><button type="submit" class="primary" data-feedback-submit>Send feedback</button></div>
    </form>`;
  document.body.appendChild(dialog);
  const form = dialog.querySelector('form');
  const field = name => form.elements.namedItem(name);
  const status = dialog.querySelector('[data-feedback-status]');
  const submit = dialog.querySelector('[data-feedback-submit]');
  const another = dialog.querySelector('[data-feedback-another]');
  let context = {}, pending = null, busy = false, delivered = false;

  function endpoint() {
    const configured = window.AtlasFeedbackConfig?.endpoint;
    if (typeof configured !== 'string' || !configured.trim()) return null;
    try {
      const url = new URL(configured, location.href);
      // Reuse the site's authentication. Never send feedback to an arbitrary host.
      return url.origin === location.origin && /^https?:$/.test(url.protocol) && !url.username && !url.password && !url.hash && !url.search ? url.href : null;
    } catch (_) { return null; }
  }

  function readContext() {
    const value = id => document.getElementById(id)?.value || null;
    const section = document.querySelector('nav [aria-current="page"]')?.dataset.view || 'overview';
    const result = { section, sectionTitle: document.getElementById('pageTitle')?.textContent || section };
    // All-source views must not inherit an unrelated experiment from the header.
    if (!['dataSources', 'dataExport', 'batchComparison', 'assayEvidence', 'crosslinking'].includes(section)) {
      result.experiment = value('studySelect');
      if (result.experiment === 'EXP26007301') {
        result.biologicalReplicate = value('selectivityReplicate');
        result.referencePlate = value('selectivityReferencePlate');
      } else if (result.experiment === 'EXP26007104') {
        result.biologicalReplicate = value('orientationReplicate');
        result.responseBasis = value('orientationMode');
      } else if (result.experiment === 'EXP26003438') {
        result.biologicalReplicate = value('d1Replicate');
        result.condition = value('d1Condition');
      }
      if (section === 'curves') result.compoundBatch = value('compoundBatch');
      if (section === 'map') result.compoundBatch = value('mapCompoundBatch');
    }
    if (section === 'batchComparison') {
      for (const key of ['base', 'left', 'right', 'category', 'metric', 'coverage']) result[key] = document.querySelector(`[data-batch-control="${key}"]`)?.value || null;
    }
    if (section === 'dataExport') {
      result.datasets = [...document.querySelectorAll('#dataExport [data-category]:checked')].map(el => el.dataset.category);
      result.measurements = [...document.querySelectorAll('#dataExport [data-metric]:checked')].map(el => el.dataset.metric);
      result.columns = [...document.querySelectorAll('#dataExport [data-column]:checked')].map(el => el.dataset.column);
      result.filters = Object.fromEntries([...document.querySelectorAll('#dataExport [data-filter]')].map(el => [el.dataset.filter, el.value]));
    }
    return result;
  }

  function controls() {
    for (const name of ['kind', 'title', 'description', 'includeContext']) field(name).disabled = busy || delivered;
    submit.disabled = busy || delivered || !endpoint();
    submit.textContent = busy ? 'Sending…' : 'Send feedback';
    another.hidden = !delivered;
    dialog.querySelector('[data-feedback-unavailable]').hidden = Boolean(endpoint());
    dialog.querySelector('[data-feedback-context]').textContent = field('includeContext').checked ? JSON.stringify(context, null, 2) : 'No view details will be included.';
  }

  trigger.addEventListener('click', () => {
    // Freeze the context for a retry of an uncertain delivery.
    if (!pending && !busy && !delivered) context = readContext();
    controls();
    dialog.showModal();
    field('title').focus();
  });
  dialog.querySelectorAll('[data-feedback-close]').forEach(button => button.addEventListener('click', () => dialog.close()));
  dialog.addEventListener('close', () => trigger.focus({ preventScroll: true }));
  field('includeContext').addEventListener('change', controls);
  another.addEventListener('click', () => {
    form.reset(); pending = null; delivered = false; status.textContent = ''; context = readContext(); controls(); field('title').focus();
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const url = endpoint();
    if (busy || delivered || !url || !form.reportValidity()) return;
    const title = field('title').value.trim(), description = field('description').value.trim();
    if (!title || !description) { status.textContent = 'Enter a summary and details before sending.'; return; }
    const contents = { schemaVersion: 1, kind: field('kind').value, title, description, context: field('includeContext').checked ? context : null };
    const fingerprint = JSON.stringify(contents);
    if (!pending || pending.fingerprint !== fingerprint) pending = { fingerprint, requestId: crypto.randomUUID(), contents };
    const request = pending;
    busy = true; status.textContent = 'Sending your feedback…'; controls();
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(url, { method: 'POST', mode: 'same-origin', credentials: 'same-origin', redirect: 'error', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': request.requestId }, body: JSON.stringify({ ...request.contents, requestId: request.requestId }), signal: controller.signal });
      if (response.status === 401 || response.status === 403) throw new Error('Please sign in to Target Atlas again before sending. Your message is still here.');
      if (response.status === 429) throw new Error('Feedback is busy right now. Please try again shortly. Your message is still here.');
      if (!response.ok) throw new Error('Delivery could not be confirmed. Your message is still here; you can retry.');
      const receipt = await response.json();
      if (typeof receipt.id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(receipt.id) || receipt.requestId !== request.requestId || receipt.status !== 'queued') throw new Error('Delivery could not be confirmed. Your message is still here; you can retry.');
      delivered = true;
      status.textContent = `Feedback received. Reference: ${receipt.id}.`;
    } catch (error) {
      status.textContent = error instanceof TypeError || error.name === 'AbortError' || error instanceof SyntaxError ? 'Delivery could not be confirmed. Your message is still here; you can retry.' : error.message;
    } finally {
      clearTimeout(timeout); busy = false; controls();
    }
  });
})();
