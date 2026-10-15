TARGET ATLAS — SHAREABLE BROWSER VERSION

This version can be hosted on GitHub Pages or any static HTTPS web host.
It needs no Python server, accounts, database, or external JavaScript library.
Keep every file in this folder together when publishing it.

The dataset uses original full RMC identifiers. Source filenames are generic.
Uploaded Excel/CSV values are read and analyzed inside the visitor's browser.
The analysis engine runs in a Web Worker. No uploaded data is sent to the host.
Graphs export as SVG, parameter tables as CSV, and curve reports can be printed
or saved as PDF through the browser's print dialog.

Use a current browser supporting DecompressionStream('deflate-raw') to read
XLSX. If a browser cannot decompress XLSX, use tidy CSV instead. Supported
Excel layouts are the well-level and parameter-level Results sheets from the
original analyzer exports. Other Excel layouts should be converted to the
included tidy CSV template. Only cached cell values are read; workbook
formulas, macros and instructions are never executed.

Use one matched experiment at a time. Source Cmax/EC50 remain distinct from
independent 4PL estimates. With wells only, Cmax is the observed peak dose mean.
The full definitions, bounds and scientific limitations appear in the Methods
view. Fit estimates are exploratory; this is not a validated replacement for
Prism. Two technical wells do not provide biological significance testing.

The original Python application is a separate local version. This browser
version runs independently and can be published on any static HTTPS host.

Test locally using a standard static HTTP server. Do not open index.html via
file://: browsers block the worker and sample-file requests in that mode.

EC50 RANGE FILTER
Reported EC50 bins are <=1, >1 to <=3, >3 to <=10, and >10 uM. Selecting
one bin combines it with the Cmax activity rule for counts, highlighting
and active CSV exports. All ranges uses Cmax alone. Missing reported values
are not filled with independent refits. Bounds are classified only when their
full interval fits a bin. The Methods view documents boundary precision.

Experiment context and raw QC
Editable experiment title, description, experiment ID and Benchling reference are saved only in browser storage. EXP26007301 is the export experiment ID and the user-confirmed Benchling ID. The user-described 26-compound selection is not reconciled with the 28 imported full IDs (27 base IDs).
Raw plate QC preserves four raw channels, physical plate positions, source controls and mask state. It reports per-channel sample SD/positive mean CV for paired wells and controls in columns 22 and 23. Review thresholds are exploratory; no automatic exclusions. Technical replicate review combines raw CV, corrected gaps and observed peak cutoff disagreements.

Confirmed physical plate mapping for EXP26007301
Cyclins-28-01A/02A = Cyclin D3; 01B/02B = Cyclin E1; 01C/02C = Cyclin K; 01D/02D = CDK4. The user confirmed this key on 14 October 2026. The original 02A/02B transfection labels are reversed. The included sample and future imports containing these exact plate IDs apply the confirmed mapping to wells, matched parameter reports and raw QC together. Original export labels remain in curve details and parameter CSV. Parameter files have no physical plate IDs, so they are matched by compound plus original transfection group before reassignment. Other plate IDs and tidy CSV are unchanged.

EXP26003438 CYCLIN D1 / CYPA NANOBRET
The included experiment contains 306 library compound IDs plus positive reference RMC-0741051-001. The source parameter report separately classifies 143 library compounds as “increasing”; this is not the total number of compounds in the experiment. Per the user's confirmation, matching A/B plate numbers contain the same compounds and doses: A is no CypA inhibitor, B adds 25 µM CypA inhibitor. Folders 20260902 and 20260904 are biological replicates (instrument measurement dates Sep 2 and Sep 3, respectively). Four separate curves are shown per compound (two conditions in each biological replicate); duplicate wells within a curve are technical replicates and appear as mean ± SD with individual points. Curves are reconstructed from raw acceptor/donor ratios and plate controls. Replicate 1 B curves were checked against 6,596 numeric values in the supplied corrected export, with maximum absolute difference 0.00003 response units. The source parameter export has no plate or replicate assignment, so it remains a separate report and does not define activity calls for the reconstructed curves. The Methods view explains the descriptive limits of n=2.


KD1 AND TR-FRET MASTERSHEET
The Kd1 & TR-FRET view imports CyclinD1 Hit List Mastersheet.xlsx. All 307 master compound IDs match the existing Cyclin D1 atlas exactly. Kd1 is the user-confirmed name for CypA competition NanoBRET with CypA_NLN and RMC0727964 tracer, at 2/6/24/48 hours; its measurement remains source GMean qAC50 (uM), rather than a dissociation constant. Primary-screen means and mastersheet NanoBRET means/geometric means remain separate from GDS source fits and replicate refits.
TR-FRET results use the independently ID-labelled blocks in the detailed TR-FRET Data sheet: 151 full compound IDs and 511 condition/replicate records. Of those IDs, 136 match the atlas and 15 additional batch IDs remain distinct. Phosphorylated/unphosphorylated Rep 1/Rep 2 are shown separately; replicate type and Sinf units are unspecified. qAC50 [M] is converted to uM; blank endpoints remain missing. Summary-only 30 uM/0 values are not substituted for absent detailed records. No bound or precision is inferred for numeric TR-FRET values near 30 uM because the detail sheet has no qualifiers or QC. Original hit classifications and List of Hits membership remain separate annotations.
Supporting results appear in both compound curve views and a searchable comparison table, with CSV export and source cell references. They do not redefine the existing NanoBRET activity calls.


INDEPENDENT NORMALIZATION RECHECK
Direct rereading of the original GDS well export verifies that QC Layer Raw equals 1000 times Channel 3 ratio, and QC Layer Normalized uses per-plate median DMSO/no-HaloTag ratio controls. All 7,392 measured wells on 24 plates reproduce the formula within 0.000025 response units. Channel 1/2/3 Normalized columns duplicate their raw counterparts in this file; only QC Layer Normalized is the final assay response. Original CSV intensities match the GDS export exactly, and 6,596 included sample wells reconstruct it within 0.000030 units.
Across 96 CSVs, 12 control ratios in bio2 plates 15B, 18B and 22B differ from corresponding raw acceptor/donor counts beyond rounding. Source ratios remain the analysis basis. A separate raw-intensity sensitivity comparison changes sample responses by less than 0.8 units; RMC-0741053-001 in bio2 B crosses the 120 threshold (119.96 to 120.41). Affected curves and the normalization audit now expose this source discrepancy.
A separate import bug was corrected: four GDS well masks apply only to bio1 B, not to the same coordinates in other runs. This restores 12 independently measured wells in other conditions. All bio1 B curve values remain unchanged.

The original EXP26007301 panel was also independently checked: 2,464 measured wells on eight plates reproduce ratio normalization within 0.000014 response units, QC Layer Normalized equals Corrected throughout, and ratios match raw acceptor/donor within five-decimal rounding. The GDS normalization view now follows the selected experiment.
