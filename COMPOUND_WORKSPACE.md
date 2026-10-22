# Compound workspace

The default landing view is `?view=runComparison`. Choose up to three exact compound batches once, then use the same selection across **Graph & export**, **Activity & fits**, **Dose values**, **Other assays**, and **Sources & methods**. Partial IDs such as `051` filter the available batches. Selection and the active tab survive navigation to another Atlas view and back during the page session; reloading starts a fresh comparison.

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
