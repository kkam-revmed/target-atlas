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

The compound workspace and matched CypA comparison have a **Graph options** menu beside the figure (immediately above it on mobile). Choose technical wells, separate biological runs with technical means, combined biological means, or pooled technical/biological wells. Choose measured curves with no 4PL, 4PL curves, or both. Conditions and plate groups remain separate. The menu explains the selected SD basis.

Each displayed series has its own color picker. Colors are remembered during the current mounted comparison, including switching away from a replicate mode and back. **Reset colors** restores defaults. Both PNG and SVG use the current colors; changing color does not change data, SD or fits. CypA selections and display settings survive viewport resizing.

**Curve to recolor** selects one displayed series; clicking a named BDR swatch immediately changes that curve. **Apply BDR palette to all curves** assigns colors in palette order to every displayed series. Custom colors remain available. The explicit graph RGB values on slides 4 and 7 take priority over the differing brand appendix values on slide 41. The secondary swatches come from slide 42. No clinical drug identity is assigned to an RMC compound through color. The light Approachable color is optional; the first two colors applied automatically are Progressive Green and Blue-Violet.

| BDR swatch | Exact hex | Slide |
| --- | --- | --- |
| Progressive Green | #13D377 | 4 / 7 |
| Blue-Violet | #5136E0 | 4 |
| Purple | #A24DFF | 4 |
| Balanced Green | #1F6B5D | 7 |
| Light Blue-Violet | #8D9BFF | 7 / 42 |
| Approachable | #7AFFE5 | 7 |
| Black | #000000 | 4 / 7 |
| Light Purple | #D1A6FF | 42 |
| Dark Purple | #5C2C91 | 42 |
| Dark Blue-Violet | #2B1980 | 42 |
| Light Red-Orange | #FF9966 | 42 |
| Red-Orange | #FF5400 | 42 |
| Dark Red-Orange | #C44202 | 42 |
| Light Yellow-Orange | #FFCD69 | 42 |
| Yellow-Orange | #FFAA00 | 42 |
| Dark Yellow-Orange | #C28100 | 42 |

**Download Prism data (.pzfx)** transfers the selected measurements and provenance as Prism tables. It does not create Prism graphs or analyses. See [Prism handoff](PRISM_HANDOFF.md) for Mac Prism 11 and the template requirement for automatic graph creation.

Open **Axes & export** beside a dose-response, CypA, orientation or crosslinking figure. Set X/Y minimum and maximum, then choose **Apply axes**. Blank fields use automatic limits; **Reset to automatic** restores them. Concentration limits must be positive. Minimum must be less than maximum. Adduct distribution has a numeric X axis and categorical condition rows, so only X limits are editable.

Custom limits replot and clip the figure; a visible annotation states that values outside the range are hidden. Measurements, SD, fits, data tables and selected-data CSV exports are unchanged. Changing limits does not refit or normalize data. A control outside the chosen Y range is omitted rather than moved to the plot edge. Limits are retained for that graph during the current page session, not saved to the supplied dataset. A custom range can intentionally override the common automatic range.

Other SVG figures have standalone PNG/SVG download controls. Their specialized axes (for example PCA and categorical overview charts) retain their existing definitions.

## Rules that do not apply to these assays

The deck's tumor volume, body weight, animal exclusions, RECIST, survival and PK/PD sections describe other study types. Their SEM, 0–125% PD limits, animal censoring, significance tests and treatment-name rules are not applied to these in-vitro datasets. No significance analysis is invented. The in-vivo 9 × 6 cm / 6 × 6 cm presets are not presented as mandatory in-vitro dimensions; exported SVG artwork can be resized in slides.

Technical sample SD, equally weighted biological-run SD and pooled-well SD remain separate choices. Existing independent fits, newly requested fits to displayed means and reported GDS parameters retain their existing labels and provenance. Fit warnings, missing measurements, plate groups, conditions and Compound Management batches remain distinct.

## Verification

`tests/graph-format-browser.cjs` checks font/color conventions, shared concentration domains (including different input dose ranges), exact positioning of the 100% reference, custom-limit validation/reset/clipping, unchanged plotted measurements and fit metadata, exports using current limits, legacy figure downloads and mobile overflow. Existing graph and replicate tests cover selected measurements, SD calculations and export scope. The retained environment verification helper checks the dataset catalog and core journeys. All 22 supplied dataset JSON files must match the retained SHA-256 baseline; catalog count remains 270659.

Concentration plots in the workspace and shared comparison renderer offer **Axes & export → Concentration axis labels**: log₁₀(M) (default, owner-selected), µM values with log spacing, or log₁₀(µM). X limits are always entered in µM and labeled accordingly. This only changes labels: 1 µM = −6 in log₁₀(M); 10 µM = −5. Source doses, fit parameters, CSV and Prism data remain in their original units. Graph exports retain the chosen labels. No fitted curves are extrapolated beyond measured concentrations when extending axis bounds.

The shared corrected NanoBRET comparison graphs use the owner-requested Y-axis title **NanoBRET normalized (%)**. Original source labels and normalization methods remain in the supplied datasets and source context; changing this presentation title does not renormalize values. Explicit ratio-normalized plots retain their distinct axis title.

Shared concentration graphs expose compact **Y ▾** and **X ▾** controls beside the plot. Y offers common percentage ranges and custom limits; X offers concentration-label choices and limits entered in µM. Applying or resetting one menu preserves the other axis. Menus synchronize with Axes & export, support Escape/close, and stay outside the exported SVG/PNG. They do not change source measurements, normalization, fit calculations or CSV scope.
