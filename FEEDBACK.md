# Target Atlas feedback on GitHub

The implementation is prepared on `feature/in-app-feedback`. It has not been pushed,
merged, deployed, or activated. GitHub Issues is the inbox; GitHub Actions is the worker
host. GitHub Pages continues to serve the Atlas and does not run a backend server.

## What scientists do

1. Click **Send feedback** inside Target Atlas.
2. Enter a problem, improvement suggestion, or assay/data question. Review or remove the
   included view context. Measurements, files, account information and browser URLs are
   not attached. Do not paste confidential data or upload original workbook archives.
3. Click **Continue on GitHub**, sign in if needed, then choose **Create issue**.
   The GitHub issue is public. Atlas only prepares the draft and never reports navigation
   as a successful submission.
4. Use **View submitted feedback** to see the public inbox. The issue number is the receipt.

Long messages or broad export selections can exceed URL limits. The form preserves the
complete text, offers a copy/paste fallback, and opens a draft without truncating it.
The form makes no GitHub API calls and contains no access token or server credential.

## Automatic processing

The `Target Atlas feedback` workflow listens for opened and labeled issues on the default
branch. Only open issues with the Atlas title prefix and marker enter its intake path.
Issue text is untrusted input; it is never interpolated into shell commands.

- Assay/data questions and unrecognized types remain owner decisions, even if labeled.
- Reports from repository owners/collaborators can start the Codex worker automatically.
  The official Codex action additionally checks the triggering user's repository write access.
- Other public reports remain in the inbox until a maintainer applies the
  `atlas-feedback-approved` label. This prevents arbitrary public visitors from starting
  paid code-execution jobs. The label is not created by this branch.
- The worker is disabled unless repository variable `ATLAS_FEEDBACK_AUTOMATION` is `true`.
  It also needs the `OPENAI_API_KEY` GitHub Actions secret. These settings have not been
  configured or inspected by this change. API usage and GitHub-hosted runner usage may
  incur charges; a ChatGPT subscription does not supply this API credential.

An enabled worker uses the official pinned `openai/codex-action`, on a disposable
GitHub-hosted Linux runner with a workspace permission profile and protected API-key
proxy. Dependencies are installed before the agent runs. Repository access is read-only;
checkout credentials are not persisted. No branch push, PR creation, merge, deployment,
permission change or issue comment is performed.

The worker investigates the report and leaves a focused patch and report. A separate,
fresh validation job applies that untrusted patch to the trusted baseline. It rejects
changes to datasets, identity/fit/catalog code, workflow/guard configuration, feedback
destinations, trusted verification tests, file modes, deletions and symlinks. It verifies
all 22 JSON files byte-for-byte, then runs the trusted browser/export tests, including the
catalog count of 270659. The retained helper is copied into `tests/environment-verification.cjs`
with only the checkout and Chromium paths made configurable.

Find workflow status under the repository's **Actions → Target Atlas feedback** tab.
Successful validation produces `reviewed-feedback-<issue number>` containing the patch,
report and test logs. `unvalidated-feedback-<issue number>` is an intermediate candidate,
not a validated fix. A failed or skipped job does not imply that the issue is fixed.
Artifacts expire after 14 days. The implementation does not yet post progress back into
the issue; the Actions run and its summary are the processing record.

## Scientific rules for the worker

Use only supplied data. Do not add, replace, regenerate, reinterpret or invent experimental
data. Preserve values, qualifiers, units, original labels and provenance. Keep reported
fits, independent refits, summaries, plates, conditions, replicates and time points
distinct; missing is not zero. Suffixes -001/-002/-003 are distinct Compound Management
batches. The sole exception is EXP26007301 RMC-0741051 source labels 001/002, which are
batch001 on plate1/plate2; preserve both labels and measurements. Original workbooks
stay local and must not be requested or uploaded.

Assay meaning, data choice, identity and statistical interpretation require an owner
decision. Do not silently resolve these from a public issue. Continue independent UI
checks and include owner questions in the report. There is no automatic scientific-data
correction and no automatic publication of generated code.

## Activation remaining

The owner's current no-push/no-merge/no-deploy limits still apply. After approval to
release this reviewed branch:

1. Put the issue template and workflow on `main`, and publish the frontend through the
   existing Pages release process. A workflow only on a feature branch does not receive
   default-branch issue events.
2. Confirm repository Issues and Actions are enabled. Add the
   `atlas-feedback-approved` label if non-collaborators will submit feedback.
3. Add `OPENAI_API_KEY` in repository **Settings → Secrets and variables → Actions → Secrets**.
   Do not paste the key into chat, source files, issues, or the frontend configuration.
4. Set Actions variable `ATLAS_FEEDBACK_AUTOMATION=true` when ready to enable the worker.
   Setting it to `false` disables new worker runs while retaining the feedback inbox.
5. Submit an authorized, non-sensitive smoke-test issue and inspect its Actions run and
   reviewed artifact. The current local tests intercept GitHub navigation and create no
   real issue. The hosted Codex job has not been exercised without an enabled workflow
   and configured credential.

## Local checks

With the app served locally on port 4173 and the retained tools available:

```sh
NODE_PATH=/workspace/target-atlas-tools/node_modules node tests/feedback.cjs
node --test tests/feedback-worker.test.cjs
NODE_PATH=/workspace/target-atlas-tools/node_modules node tests/environment-verification.cjs
node /workspace/target-atlas-tools/verify.cjs
```

The browser test covers desktop and mobile GitHub draft navigation, exact text/context,
public-disclosure copy, consent, long-text fallback, focus return and layout. GitHub
requests are intercepted and no issue is submitted. Routing/guard tests use only exact
copies of the existing datasets and do not modify any experimental values.
