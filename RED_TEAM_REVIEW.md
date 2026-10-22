# Target Atlas red-team review — 22 October 2026

This review covered the bundled scientific datasets, replicate calculations,
compound/batch/plate identity, EC50 lists and exports, graph controls, local
imports, source boundaries, Prism packaging, and launcher/input handling.
It is an application review, not certification of the underlying experiments.

## Confirmed findings and corrections

| Finding | Consequence before the fix | Correction |
| --- | --- | --- |
| Local uploads and published workspace runs were not clearly distinguished | A matching compound could show a bundled curve after a successful upload, giving the impression that the uploaded values were plotted | Uploads open their own Activity overview. Published-only views explicitly identify their source; unlinked uploads cannot masquerade as linked biological/inhibitor runs |
| Generic CSV responses inherited assay context | Raw responses could receive a normalized-percent label, 100% DMSO line, or a previously selected Benchling ID | Supplied units, unassigned Benchling context, no assumed normalization reference, and no inherited published reference-plate notice |
| CSV context columns could be silently ignored | Different runs or conditions could be combined as technical wells | Mixed or partly missing explicit run/condition/plate/time/experiment metadata is rejected. Consistent context is retained and protects grouping across files |
| A target/compound name triggered D1 reference assumptions | A generic import could claim a positive reference pooled over 24 plates | Reference inference requires the named analyzer source and raw plate records; counts derive from those records |
| Native Prism provenance inherited data-only notes | A project with analysis and graphs contained contradictory documentation | Native notes describe the native workflow; data-only notes are explicitly scoped to the companion file |

Two existing UI test expectations were also updated for intentional interface
changes: the workspace comparison shortcut and the added compare-replicates
option. Their numerical and export assertions remain in place.

## Numerical and file checks

- Final regression pass: all 32 runnable JavaScript/browser checks passed,
  plus both saved-Prism-file Python round-trip checks.
- Independently recomputed means and sample SDs for 29,040 stored dose rows
  containing 61,752 well values across 11 curve datasets. All matched within
  `1e-7 * max(1, abs(expected))`; n matched exactly. These include repeated
  source views, not 29,040 independent experiments. No dose rows were skipped.
- All 22 supplied dataset files match their retained SHA-256 baseline.
- The full-site check retains the 270,659-measurement catalog and checks
  navigation, links/reloads, missing requests and unexpected external requests.
- Replicate tests cover unequal well counts, missing runs, equal weighting of
  biological means, pooled-well SD, and separation of conditions, batches and
  plates. Graph tests cover log(M), the exact 100 reference, axis edits,
  measured versus fitted curves, colors, exports and narrow screens.
- The owner's saved Mac Prism single-series result retains all 480 source
  values exactly. The overlay retains 480 exact reference values and 20 other
  values at Prism's observed 15-significant-digit import precision (maximum
  difference below 4e-13). Unused cells remain blank. Checks reproduce residual
  sums, degrees of freedom, EC50 units and all 2,000 saved fitted-curve points.
- The blank website Prism template has no measurement CSV data or cached fit
  results. Script/label injection and launcher-path tests pass.

Reproducible checks are in `tests/`, including `source-dose-statistics.cjs`,
`import-context.cjs`, `local-upload-boundary-browser.cjs`,
`prism-column-guide.cjs`, `prism-96.cjs` and the two Prism round-trip Python
checks. Browser tests run in Chromium on Linux; round-trip checks inspect the
owner's previously returned Prism files.

## Remaining validation limits

- Native Prism execution on Windows, expanded 49–96-observation projects, and
  the reusable Mac folder chooser still need confirmation on those systems.
  Structural/browser tests do not establish native application behavior.
- The native graph inherits template error-bar settings. Confirm SD versus SEM
  in Prism's Format Graph before presenting. Exact Atlas mean/sample-SD/n are
  preserved separately; the opaque graph setting is not asserted by tests.
- Prism fits exported observations, whereas Atlas combined-mode fits use one
  displayed mean per concentration. Their EC50 estimates need not agree.
  Incomplete confidence intervals and fit warnings must remain visible.
- Local Excel files without run/condition metadata cannot be automatically
  distinguished. Import only one biological run and one condition at a time.
- Technical well slots do not identify paired subjects or necessarily retain
  physical well coordinates. The column guide states missing provenance rather
  than inventing it.
