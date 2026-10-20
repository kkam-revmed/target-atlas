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
      <p class="feedback-notice">You’ll review and submit a <strong>public GitHub issue</strong>. A GitHub account is required. Please leave out confidential information.</p>
      <p data-feedback-unavailable hidden>The feedback destination is unavailable. Nothing has been submitted.</p>
      <label>Feedback type<select name="kind"><option value="bug">Something isn't working</option><option value="improvement">Improvement suggestion</option><option value="assay-question">Assay or data question</option></select></label>
      <label>Summary<input name="title" required maxlength="160" autocomplete="off" placeholder="A short description"></label>
      <label>Details<textarea name="description" required maxlength="8000" rows="5" placeholder="What were you trying to do? What happened, and what did you expect?"></textarea></label>
      <p class="feedback-help">Please describe the issue without attaching original workbooks or pasting experimental data.</p>
      <label class="feedback-check"><input name="includeContext" type="checkbox" checked>Include current view details</label>
      <details class="feedback-context"><summary>Review the details included</summary><pre data-feedback-context></pre></details>
      <p class="feedback-help">View details include the selected section, experiment and compound when applicable. They do not include measurements, files, or account information.</p>
      <p data-feedback-status role="status" aria-live="polite"></p>
      <div data-feedback-copy-area hidden><label>Feedback text<textarea data-feedback-text readonly rows="6"></textarea></label><button type="button" class="secondary" data-feedback-copy>Copy feedback text</button></div>
      <p><a data-feedback-draft target="_blank" rel="noopener noreferrer" hidden>Open GitHub draft</a></p>
      <div class="feedback-actions"><button type="button" class="secondary" data-feedback-close>Close</button><button type="submit" class="primary" data-feedback-submit>Continue on GitHub</button></div>
      <p class="feedback-help"><a data-feedback-inbox target="_blank" rel="noopener noreferrer">View submitted feedback</a></p>
    </form>`;
  document.body.appendChild(dialog);
  const form = dialog.querySelector('form');
  const field = name => form.elements.namedItem(name);
  const status = dialog.querySelector('[data-feedback-status]');
  const submit = dialog.querySelector('[data-feedback-submit]');
  const draft = dialog.querySelector('[data-feedback-draft]');
  const copyArea = dialog.querySelector('[data-feedback-copy-area]');
  const copyText = dialog.querySelector('[data-feedback-text]');
  let context = {};

  function repository() {
    const configured = window.AtlasFeedbackConfig?.repository;
    return typeof configured === 'string' && /^[A-Za-z0-9_-]+\/[A-Za-z0-9_.-]+$/.test(configured) ? configured : null;
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
    const repo = repository();
    submit.disabled = !repo;
    dialog.querySelector('[data-feedback-unavailable]').hidden = Boolean(repo);
    const inbox = dialog.querySelector('[data-feedback-inbox]');
    inbox.hidden = !repo;
    if (repo) inbox.href = `https://github.com/${repo}/issues?q=${encodeURIComponent('is:issue "[Atlas feedback]" in:title')}`;
    dialog.querySelector('[data-feedback-context]').textContent = field('includeContext').checked ? JSON.stringify(context, null, 2) : 'No view details will be included.';
  }

  function invalidateDraft() {
    draft.hidden = true; draft.removeAttribute('href'); copyArea.hidden = true; copyText.value = ''; status.textContent = '';
  }
  trigger.addEventListener('click', () => {
    context = readContext(); invalidateDraft(); controls();
    dialog.showModal();
    field('title').focus();
  });
  dialog.querySelectorAll('[data-feedback-close]').forEach(button => button.addEventListener('click', () => dialog.close()));
  dialog.addEventListener('close', () => trigger.focus({ preventScroll: true }));
  for (const name of ['kind', 'title', 'description', 'includeContext']) field(name).addEventListener('input', () => { invalidateDraft(); controls(); });
  dialog.querySelector('[data-feedback-copy]').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(copyText.value); status.textContent = 'Feedback text copied. Open the GitHub draft, paste it into the issue body, then choose Create issue.'; }
    catch (_) { copyText.focus(); copyText.select(); status.textContent = 'Select and copy the feedback text, then paste it into the GitHub issue body.'; }
  });

  form.addEventListener('submit', event => {
    event.preventDefault();
    const repo = repository();
    if (!repo || !form.reportValidity()) return;
    const title = field('title').value.trim(), description = field('description').value.trim();
    if (!title || !description) { status.textContent = 'Enter a summary and details before sending.'; return; }
    const body = ['<!-- target-atlas-feedback:v1 -->', '### Feedback type', field('kind').value, '### Details', description, '### View context', field('includeContext').checked ? '```json\n' + JSON.stringify(context, null, 2) + '\n```' : 'Not included.'].join('\n\n');
    const url = new URL(`https://github.com/${repo}/issues/new`);
    url.searchParams.set('template', 'atlas-feedback.md');
    url.searchParams.set('title', '[Atlas feedback] ' + title);
    url.searchParams.set('body', body);
    // Long selections can exceed proxy/URL limits. Keep every character and offer
    // a copy/paste handoff instead of silently truncating diagnostic context.
    if (url.href.length > 6000) {
      url.searchParams.delete('body'); copyText.value = body; copyArea.hidden = false;
      status.textContent = 'This feedback is too long to prefill. Copy the text below, open the GitHub draft, paste it into the issue body, then choose Create issue.';
    } else {
      copyArea.hidden = true;
      status.textContent = 'Finish submitting on GitHub by choosing Create issue. Atlas has only prepared a draft. If a new tab does not open, use the link below.';
    }
    draft.href = url.href; draft.hidden = false;
    if (copyArea.hidden) draft.click();
  });
})();
