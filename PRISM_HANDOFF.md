# Prism 11 on Windows and Mac

In **Compound Workspace → Graph & export**, or the matched CypA comparison,
choose **Prism graph + 4PL**. Unzip the package, keep its files together,
and run **Open_in_Prism.bat** on Windows or **Open_in_Prism.command** on Mac. Open **Atlas_Result.prism** when it finishes.
Do not open the intermediate Atlas_Input.prism directly: the script adds the
remaining series, recalculates and applies labels and axes.

The package contains a native editable XY table, independent agonist 4PL analysis
and template graph, plus full-precision original values, selected-data.pzfx and
provenance.json. No server or new service is required. Data stay in the browser
and downloaded files. The original supplied templates and workbook archives are
not published; the site serves only an extracted empty linked graph family.

## Reusable Mac launcher

In the graph options, expand **Open the graph in Prism 11 · Windows or Mac**
and choose **Download reusable Mac launcher**. Extract the ZIP, save
`Atlas_Prism_Launcher.command` in a permanent folder, and approve that file once
through Privacy & Security if macOS asks. Keep the same approved copy.

For later exports, extract the Prism package, open the saved launcher and choose
its `Atlas_Prism` folder. The launcher checks for the input project and Prism
script, then uses the existing launch steps with that folder. It does not change
security settings, strip quarantine attributes or execute the new package's shell
launcher. Managed Mac policy may still require IT approval. The chooser has shell
and browser-download tests here; its native Mac behavior still needs confirmation.

## Data and analysis behavior

Each selected assay/compound batch/condition/plate group is a separate Y dataset.
Technical/individual-run mode uses supplied wells as subcolumns. Biological mean
mode uses one mean per biological run; pooled mode uses every selected well.
Missing values remain blank and zero remains zero. Well slots are not paired
subjects across concentrations. Original source labels, qualifiers and sources
remain in the companion data and provenance. The reference plate-label exception
is preserved by the existing selection model, not inferred from suffixes here.

Prism performs a **new independent unweighted 4PL** on selected observations,
with Bottom, Top, LogEC50 and HillSlope free. It does not reuse reported GDS or
Atlas fitted parameters; Atlas fits to concentration means can differ. Review
Prism's confidence intervals and fit warnings. A completed smooth fit is not
evidence of a well-constrained EC50. The 100% control does not fix a fit parameter.

X values are converted from supplied µM to log10(M); the original µM values remain
in companion files. Automatic axes cover the selected dose range and means ±
sample SD. Applied manual limits take precedence without removing any data.
The native CypA graph uses NanoBRET normalized (%); the workspace export labels
its supplied corrected-response basis explicitly.

The first series is inserted as full-precision native CSV using the same
metadata structure as the validated single-compound generator. Prism registers
additional series through its supported InsertData commands. Scripts contain
full source precision; Prism 11 itself was observed to import at 15 significant
digits (maximum difference in the returned test: 3.7e-13 response units).

## Current limits

- The graph download always creates 4PL analyses, independently of the Atlas
  measured-only display choice. The button explicitly says graph + 4PL.
- Native graph colors and error-bar settings come from the approved template.
  Atlas style overrides are retained in provenance, not applied silently to the
  native graph. Check Format Graph in Prism; exact Atlas mean/SD/n are included
  in selected-data.pzfx. The binary graph SD/SEM setting is not independently
  verified by the structural tests. PNG/SVG exports retain Atlas appearance.
- Maximum 96 observations per concentration per series. Larger pooled reference
  selections show the required observation count beside the export buttons before
  downloading; the graph-export button is disabled. Choose **Compare biological
  runs separately** to change the graph explicitly, or **Download all selected
  Prism data** to retain every pooled well in .pzfx tables without changing the
  graph. No observations are truncated. The native input expands its replicate
  definitions, table width and data columns together for 49–96 observations;
  these expanded files have structural/data tests but still await native Prism 11
  confirmation. The existing ≤48-column Mac workflow remains validated.
- Nonpositive doses and series with fewer than four measured concentrations are
  rejected for this log-dose 4PL export. The data-only download remains available.
- The owner verified the single-compound and two-compound native workflows in
  Prism 11.1 on Mac. Arbitrary browser selections are checked structurally and
  in Chromium, not executed in Prism in this Linux Cloud environment.

## Verification evidence

The owner returned Atlas_NanoBRET_Result.prism and Atlas_Overlay_Result.prism.
The first has all 480 source values exact, no skipped measurements, and a completed
unweighted unconstrained four-parameter analysis. The overlay has two separate
analyses and four linked graph datasets (two measured and two fitted). Reference
480 values are exact; RMC-0707407's 20 values exhibit Prism's 15-significant-digit
import precision. The 460 unused cells remain blank, not measured zeros.

For both overlay series, tests recompute the residual sum of squares from saved
parameters, check degrees of freedom and EC50 unit conversion, and verify all
2,000 generated curve points against the corresponding model. RMC-0707407 has
incomplete LogEC50/HillSlope confidence intervals and Prism's INCOMPLETE_CI
warning; this is preserved rather than treating COMPLETED as a quality flag.

Commands:

```sh
python tests/prism-roundtrip.py /local/path/Atlas_NanoBRET_Result.prism
python tests/prism-overlay-roundtrip.py /local/path/Atlas_Overlay_Result.prism
node tests/prism-native.cjs
NODE_PATH=/workspace/target-atlas-tools/node_modules node tests/prism-native-browser.cjs
NODE_PATH=/workspace/target-atlas-tools/node_modules node tests/prism-handoff-browser.cjs
```

Browser checks exercise desktop/mobile native downloads, selection identity,
reference plate source labels, biological means, full-precision input serialization,
manual axes, response labels, fetch failures and oversized pooled selections.
The retained site helper verifies catalog count 270659, all views and reloads,
no JavaScript errors or failed/external requests. All 22 supplied dataset SHA256
checks remain unchanged.

The web seed can be rebuilt locally using tools/build_prism_web_template.py with
--template pointing to the approved single-compound Result and --output
assets/prism/atlas-empty.prism. It clears all CSV measurements, cached fitted
results and source author names, retains the graph binary, and preserves the
linked IDs. The original attachment remains local.

## References

- https://www.graphpad.com/guides/prism/latest/user-guide/including_data_and_info_constants_in_the_script_file.htm
- https://www.graphpad.com/guides/prism/latest/user-guide/adding_a_line_of_identity.htm
- https://www.graphpad.com/guides/prism/latest/user-guide/changing_graphs.htm
- https://www.graphpad.com/guides/prism/latest/user-guide/general_commands.htm

## Windows launcher

The same ZIP now includes Open_in_Prism.bat. It uses built-in Windows PowerShell
to find Prism 11 in standard Program Files locations, or ask for its prism.exe
through a file picker. It checks version 11, writes an explicit local SetPath
with UTF-8 BOM, and invokes the documented prism.exe @script.pzc command. The
shared analysis script and all data are the same as the Mac package. It does not
change execution policies, permissions, registry associations or install software.

If Windows blocks the launcher, retain the displayed error and consult local IT;
no security-policy bypass is included. Native completion needs a Windows Prism 11
user to return Atlas_Result.prism (or the first error from the script log). The
owner has a Mac only; no Windows-native verification is claimed.

Reference: https://www.graphpad.com/guides/prism/latest/user-guide/command_line_switches.htm
