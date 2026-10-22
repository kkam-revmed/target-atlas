# Prism 11 on Mac

Choose the compound batches and comparison in Atlas, then use **Download Prism data (.pzfx)** beside the graph. The same action is available in the matched CypA comparison. Open the downloaded file in Prism 11.

The file contains two XY data tables and an Info sheet:

- **Selected observations:** each plotted series is a distinct Y dataset. Technical/individual-run mode exports supplied wells as subcolumns; biological-mean mode exports one run mean per subcolumn; pooled mode exports all selected wells with their biological-run identities retained in the subcolumn labels and provenance.
- **Displayed mean, SD and n:** retains the values shown by Atlas, with the SD basis in each series title.
- **Atlas selection, methods and provenance:** preserves full series identities, source labels, original values, settings, and fit provenance as JSON. It excludes original workbook archives.

Missing cells remain blank. Zero remains zero. All selected concentrations are included even if custom axes clip them from the graph. Technical well slots are not matched subjects across concentrations. No pairing is inferred. Conditions, compound batches, assays and plate groups remain separate datasets.

This is a data handoff, not a Prism graph or analysis project. Atlas colors and independent fit settings are recorded as context; the file does not run a Prism fit or reproduce graph styling in Prism. Graph PNG/SVG downloads retain Atlas's chosen colors and settings.

## Automatic graph creation

GraphPad documents Mac automation through `.pzc` scripts opened by double-click or AppleScript. Scripts can import data into an existing project/template, recalculate analyses, save projects and export graphs. The graph design and analysis model must already exist in that template.

The remaining requirements are a blank Prism template containing the owner's graph and 4PL settings, its intended table/subcolumn structure, a resolved local file path, and validation on the owner's Mac. Atlas does not currently launch or control Prism. No untested launcher or fabricated `.prism` project is included. A static GitHub Pages site cannot silently control an installed Mac app.

For the one-time setup, open an Atlas comparison in Prism 11. Choose **Analyze → Nonlinear regression → Dose-response curves – Stimulation → [Agonist] vs. response – Variable slope**. The exported X values are actual concentrations in µM: set the graph X axis logarithmic, rather than choosing a model that expects already log-transformed X values. Review the analysis's selected series, weighting, constraints and replicate basis. The DMSO 100% reference is not a reason to fix the fitted baseline or plateau. Format the graph and save a blank template retaining the analysis and graph; Prism 11's template format is `.prismt`, and a data-cleared PZFX project is also useful for the documented XML replacement workflow.

The owner's BDR deck contains six embedded native Prism projects on slide 39. They were inspected locally. Their analyses use a log(inhibitor) variable-slope model with log-transformed X, and contain example measurements, cached results and opaque graph data. They are not a verified concentration-based agonist template for Atlas. The embedded projects and their example measurements are not included in the repository or website.

References:

- [GraphPad integration and template workflow](https://www.graphpad.com/support/faq/prism-integrated-saves-prism-files-instruments/)
- [Prism scripting overview](https://www.graphpad.com/guides/prism/latest/user-guide/overview.htm)
- [Launching Prism from AppleScript](https://www.graphpad.com/guides/prism/latest/user-guide/launching_prism_from_applescript.htm)
- [Open a template and import data](https://www.graphpad.com/guides/prism/latest/user-guide/script_example_4__open_a_template_and_import_data.htm)
- [XML data tables](https://www.graphpad.com/guides/prism/latest/user-guide/using_exporting_from_data_tables.htm)

## Validation

Automated checks cover exact supplied well values, separate batches/conditions, biological mean subcolumns, 96-well reference exports, mean/SD/n, missing cells, zero, XML escaping, provenance and immutability. Browser checks exercise both download buttons and compare downloaded cells with the selected source measurements. XML/schema checks are distinct from opening the result in Prism 11; the Mac application is unavailable in this Cloud environment.
