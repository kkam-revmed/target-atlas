const fs = require('node:fs');

function classify(event) {
  const issue = event.issue;
  if (!issue || issue.pull_request || issue.state !== 'open' || !issue.title?.startsWith('[Atlas feedback]') || !issue.body?.includes('<!-- target-atlas-feedback:v1 -->')) return { eligible: false, runWorker: false, reason: 'Not an open Atlas feedback issue.' };
  const kind = /### Feedback type\s+(?:<!--[\s\S]*?-->\s*)?(bug|improvement|assay-question)\b/.exec(issue.body)?.[1];
  if (!kind || kind === 'assay-question') return { eligible: true, runWorker: false, reason: 'Needs the owner: assay meaning, data choice and identity must not be inferred.' };
  const approved = event.action === 'labeled' && event.label?.name === 'atlas-feedback-approved';
  const trustedSubmission = event.action === 'opened' && ['OWNER', 'MEMBER', 'COLLABORATOR'].includes(issue.author_association);
  return { eligible: true, runWorker: approved || trustedSubmission, reason: approved || trustedSubmission ? 'Eligible for investigation when the Codex worker is enabled.' : 'Saved in GitHub. A maintainer can add atlas-feedback-approved to authorize Codex investigation.' };
}

if (require.main === module) {
  const event = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
  const result = classify(event);
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `eligible=${result.eligible}\nrun_worker=${result.runWorker}\n`);
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Target Atlas feedback\n\n${result.reason}\n\nWorker enablement additionally requires ATLAS_FEEDBACK_AUTOMATION=true and OPENAI_API_KEY. No merge or deployment is performed.\n`);
}
module.exports = { classify };
