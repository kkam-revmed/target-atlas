# Graph presentation and axis controls

Target Atlas uses the applicable in-vitro conventions from the owner-supplied **BDR GraphPad Prism Guidelines, August 2026**, especially slide 39 and its example figures. The original deck stays local and is not distributed with the website.

## Applied conventions

- Dose-response figures use Arial, bold 11 pt axis numbers and bold 12 pt axis titles. Axes and graph text are black; control reference lines are black. Units, scientific names and original source labels are preserved.
- The example figures' bottom/left axis frame is used. Curve lines and symbols remain distinguishable; SD bars remain visible. Green compound colors are retained as requested by the owner. No undocumented clinical-drug identity is assigned to an RMC compound.
- Related automatic dose-response panels share their concentration range. This includes all targets in a compound comparison, both biological runs, and the orientation panels. Concentration remains in the supplied µM units on a logarithmic axis.
- Comparison legends use black text and list the sample-size basis for each series. A range of n means that the count varies by concentration. Biological-run counts are distinguished from measured/pooled-well counts.
- The normalized control reference is exactly 100, and is named DMSO only where that identity is established. The activity cutoff is a separate annotation. Neither reference fixes a fitted baseline.
- PNG and standalone editable SVG downloads include the graph's current limits, legend and annotations. SVG embeds its fonts/style declarations; it does not require the website stylesheet. These are figure exports, not native Prism project files, and do not imply numerical equivalence to a Prism analysis.

## Axes and exports

Open **Axes & export** beside a dose-response, CypA, orientation or crosslinking figure. Set X/Y minimum and maximum, then choose **Apply axes**. Blank fields use automatic limits; **Reset to automatic** restores them. Concentration limits must be positive. Minimum must be less than maximum. Adduct distribution has a numeric X axis and categorical condition rows, so only X limits are editable.

Custom limits replot and clip the figure; a visible annotation states that values outside the range are hidden. Measurements, SD, fits, data tables and selected-data CSV exports are unchanged. Changing limits does not refit or normalize data. A control outside the chosen Y range is omitted rather than moved to the plot edge. Limits are retained for that graph during the current page session, not saved to the supplied dataset. A custom range can intentionally override the common automatic range.

Other SVG figures have standalone PNG/SVG download controls. Their specialized axes (for example PCA and categorical overview charts) retain their existing definitions.

## Rules that do not apply to these assays

The deck's tumor volume, body weight, animal exclusions, RECIST, survival and PK/PD sections describe other study types. Their SEM, 0–125% PD limits, animal censoring, significance tests and treatment-name rules are not applied to these in-vitro datasets. No significance analysis is invented. The in-vivo 9 × 6 cm / 6 × 6 cm presets are not presented as mandatory in-vitro dimensions; exported SVG artwork can be resized in slides.

Technical sample SD, equally weighted biological-run SD and pooled-well SD remain separate choices. Existing independent fits, newly requested fits to displayed means and reported GDS parameters retain their existing labels and provenance. Fit warnings, missing measurements, plate groups, conditions and Compound Management batches remain distinct.

## Verification

`tests/graph-format-browser.cjs` checks font/color conventions, shared concentration domains (including different input dose ranges), exact positioning of the 100% reference, custom-limit validation/reset/clipping, unchanged plotted measurements and fit metadata, exports using current limits, legacy figure downloads and mobile overflow. Existing graph and replicate tests cover selected measurements, SD calculations and export scope. The retained environment verification helper checks the dataset catalog and core journeys. All 22 supplied dataset JSON files must match the retained SHA-256 baseline; catalog count remains 270659.
