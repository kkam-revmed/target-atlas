# Compound workspace

The default landing view is `?view=runComparison`. Choose exact compound batches once, then use the same selection across **Graph & export**, **Activity & fits**, **Dose values**, **Other assays**, and **Sources & methods**. Partial IDs such as `051` filter the available batches. Selection and the active tab survive navigation to another Atlas view and back during the page session; reloading starts a fresh comparison.

The graph supports Cyclin D1/CypA, selectivity, or both. Choose biological runs and physical plates in the expandable control. Orientation and specialist QC tools remain under **Advanced tools**; existing links still work. Kd1, TR-FRET, primary-screen summaries and crosslinking evidence appear inline for the exact selected batches under **Other assays**.

## Compare or combine

| Mode | Display and error bars |
| --- | --- |
| Technical wells | Individual supplied wells at each concentration, with their run means. No pairing of wells across concentrations is assumed. |
| Biological runs | Technical means for each biological run, with within-run sample SD. |
| Combined biological mean | Equally weighted run means at each concentration, with between-run sample SD; n counts biological runs. |
| All technical + biological wells | All selected wells weighted equally within each assay and plate group, with pooled-well sample SD; n counts wells. |

All modes preserve separate assays, conditions, batches and plate groups. The selectivity RMC-0741051 plate 1/plate 2 reference is the same batch 001, retaining its two original source labels. The supplied D1 reference aggregates wells across plates; its within-run SD is not single-plate technical SD. Missing values stay missing, and a single observation has no sample SD.

Measured curves, independent 4PL curves, or both can be displayed. Existing per-run fits and derived fits to displayed combined means remain distinct from GDS-reported parameters. This workspace change does not change the calculations. Fit warnings and parameter provenance are in **Activity & fits**. PNG/SVG exports use the current axes; CSV exports the selected displayed series with their SD basis, well values and source metadata. Axis clipping does not discard data from CSV.

## Validation

- `tests/workspace-browser.cjs`: default navigation, partial search, selected batches, persistent tabs, four replicate modes, inline assay evidence, exports, keyboard navigation, empty selection, legacy entry points and 1440/390/320 px layouts.
- Existing run-comparison numerical and browser tests: technical, biological and pooled SD; fit inputs; separate plates/batches; missing values; source immutability; selected-data exports.
- Existing graph-format browser tests: axes, exact 100 reference, SVG/PNG contents and unchanged measurements/fits.
- Retained environment verification helper: navigation adapted to open overview explicitly and expand collapsed tool groups; all scientific, export, catalog and deep-link assertions retained.
- All 22 supplied dataset JSON files match the retained SHA-256 baseline; catalog count remains 270659.

From Activity overview, click an EC50 count and then **Graph these compounds** to open all visible batches in the workspace. The current list search is respected; no three-compound truncation is applied. This shortcut supports the supplied D1/CypA and selectivity curves. It selects the current run and target/condition. The unassigned D1 GDS report opens the same batches’ measured curves without CypA inhibitor, with an explicit note that the biological run and independent fit are not the GDS-reported fit.

## Local imports and source boundaries

Local CSV/Excel uploads open Activity overview and remain local to that browser.
They are not added to the published-run compound workspace. A notice identifies
published-only views while a local analysis is active; matching compound IDs do
not establish that the uploaded measurements are being plotted there. Unlinked
uploads cannot be treated as linked biological or inhibitor-condition runs.

Generic CSV response values retain their supplied units. They are not labeled
NanoBRET normalized percentages, assigned the selected published Benchling ID,
or given a 100% DMSO reference without normalization evidence. A target or
compound name alone does not establish a positive-reference role or plate count.

Import one biological run and one condition at a time. Mixed or partly missing
explicit run, condition, plate, time or experiment fields in tidy CSV files are
rejected. Consistent context is retained; technical well labels do not become
biological-replicate identifiers. Excel files lacking these identifiers cannot
be automatically distinguished by run: do not combine different runs or
conditions in one local analysis.

Audit regression checks: `tests/import-context.cjs`,
`tests/local-upload-boundary-browser.cjs`, and
`tests/source-dose-statistics.cjs`. The latter independently verifies means,
sample SD and n across all 29,040 stored dose rows in the 11 curve datasets;
these include repeated source views and are not 29,040 independent experiments.
Native Prism verification limits remain documented in PRISM_HANDOFF.md.
