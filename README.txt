TARGET ATLAS — SHAREABLE BROWSER VERSION

This version can be hosted on GitHub Pages or any static HTTPS web host.
It needs no Python server, accounts, database, or external JavaScript library.
Keep every file in this folder together when publishing it.

Original source identifiers and filenames are retained for provenance.
Compound Management suffixes identify compound batches: -001 = batch 1, -002 = batch 2, -003 = batch 3. Distinct suffixes remain distinct identities and measurements are never pooled across batches. Physical plates and biological/technical replicates are separate fields. The sole user-confirmed source-label exception is EXP26007301 RMC-0741051: source labels -001/-002 identify its plate-1/plate-2 readings of the same batch -001. Original source identifiers remain unchanged for traceability.
Uploaded Excel/CSV values are read and analyzed inside the visitor's browser.
The analysis engine runs in a Web Worker. No uploaded data is sent to the host.
The Data & export view provides a source-linked catalog across the included
experiments, GDS parameters, observed NanoBRET responses, dose means, individual
wells and raw signals, independent refits, Kd1 time points, TR-FRET, mastersheet
summaries, primary screens and crosslinking. Select datasets and measurements,
filter compounds/batches, time points, targets, conditions and replicates, and
choose the table columns. CSV and Excel downloads contain every matching measurement
(not just the paginated preview), plus export settings. PDF reports have an
explicit first-200/all-matching-rows selector and use the browser print dialog.
Wide PDF selections use readable measurement cards. Source fields, units and
qualifiers stay attached to results; missing source metadata remains unavailable.
Unassigned GDS parameters and unspecified TR-FRET replicate types remain separate
from known biological runs. Original instrument values and rounded GDS values
retain distinct response bases. The catalog includes the published datasets;
the existing parameter CSV controls can export newly uploaded local analyses.
Export displayed table CSV follows exactly the current parameter-table filters.
Selections in Data & export change only the table and downloads. They do not add,
replace or publish data. New source files require the owner's explicit selection.

Data sources lists the exact original filenames, workbook sheets, source roles
and the data they supply for selectivity, orientation, Cyclin D1/CypA, Kd1,
TR-FRET and crosslinking. Source metadata contains no absolute private paths.
Original Excel/CSV/PPTX files stay in the owner's separate local source library;
the website does not publish that archive. Current, audit-only and older sources
are labelled separately. No unavailable historical original is fabricated.

Global compound search accepts a base ID such as RMC-0741051 and provides a
separate batch selector. A single available batch selects automatically;
multiple batches require a choice. Full batch IDs are also accepted. Batches
are never averaged or combined into one curve.

For the selectivity screen, RMC-0741051 source labels -001 and -002 are the same
batch -001 on physical plate groups 1 and 2, as confirmed by the user. Choose the
reference plate above the analysis. Both original plate measurements remain in
Raw plate QC and the all-data catalog; no source measurement or fit is changed.

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
Editable assay title, description, Benchling ID and optional Benchling link are saved only in browser storage. EXP numbers are labeled Benchling ID throughout the selectors, result tables and exports; original source metadata and existing section links retain their stored keys. Replicate 2 Header describes 26 selected compounds plus two analogs of RMC-0741051, totaling 28 full IDs.
Raw plate QC preserves four raw channels, physical plate positions, source controls and mask state. It reports per-channel sample SD/positive mean CV for paired wells and controls in columns 22 and 23. Review thresholds are exploratory; no automatic exclusions. Technical replicate review combines raw CV, corrected gaps and observed peak cutoff disagreements.

Confirmed physical plate mapping for EXP26007301
Cyclins-28-01A/02A = Cyclin D3; 01B/02B = Cyclin E1; 01C/02C = Cyclin K; 01D/02D = CDK4. The user confirmed this key on 14 October 2026. The replicate 1 02A/02B transfection labels are reversed; replicate 2 labels match this key. The included sample and future imports containing these exact plate IDs apply the confirmed mapping to wells, matched parameter reports and raw QC together. Original export labels remain in curve details and parameter CSV. Parameter files have no physical plate IDs, so they are matched by compound plus original transfection group before reassignment. Other plate IDs and tidy CSV are unchanged.

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


EXP26007301 SELECTIVITY BIOLOGICAL REPLICATE 2
Replicate 1 (9 Oct 2026) and replicate 2 (15 Oct 2026) are retained separately. Each has 28 compounds, four targets, eight plates and 2,240 sample wells in technical duplicates. Use the biological replicate selector for run-specific curves, parameters, raw plate QC and technical replicate review. The Biological replicates view overlays both runs and exports paired parameters. The comparison defaults to reported GDS Cmax in both runs and applies the selected reported EC50 range. An optional observed peak comparison uses Cmax only; the observed peak definition remains distinct from GDS Activity (cmax). All disagreements are descriptive review signals.
The two Downloads replicate 2 files are well exports with identical corrected values; they are imported once. The identically named unsuffixed XLSX in the Egnyte experiment folder is a separate GDS parameter report, containing 112 rows matched by full compound ID and transfection. Its qAC50 [M] is converted to µM, qualifiers and source QC retained, and Activity (cmax) is used for the official activity calls. Independent refits remain separate. The initial missing-parameter statement was an import omission and has been corrected. All corrected wells, refits and raw QC remain unchanged by the parameter addition.
All 2,464 measured wells reproduce ratio-based QC Layer Corrected within 0.00000875 units. Channel 2 is acceptor, Channel 1 NanoLuc donor, Channel 3 acceptor/donor ratio, QC Raw is 1000 times the ratio. QC Normalized equals Corrected. The final response uses each plate own median column 22 DMSO and column 23 no-HaloTag controls. All raw intensity values match the instrument CSVs and the ratios agree with the intensity quotient within five-decimal rounding. The GDS normalization view includes the numerical audit and a well-by-well CSV. The exported correction-factor fields match pooled neutral-control medians and must not be mistaken for the final QC formula.


CYCLIN D1 RUN SELECTORS
The main EXP26003438 analysis now provides selectors for both biological replicates and both inhibitor conditions. Rep1 = folder20260902/read2September; Rep2 = folder20260904/read3September. Condition A is no inhibitor; B adds25uM CypA inhibitor. Original rep1B GDS corrected values remain unchanged. Other three views use the previously verified source-ratio reconstruction with their own controls and raw QC. Reported GDS parameters remain unassigned because that export has no replicate identifier. The Biological replicates view displays all four curves together, as does CypA inhibitor comparison. Reference wells remain pooled across24plates within the selected run only. Source GDS masks apply only to rep1B. Bio2B source-ratio discrepancies remain flagged. CSV exports carry experiment, biological replicate, read date and inhibitor condition.


EXP26007104 LATEST RATIO-BASED CONFIGURATION EXPORTS
The latest replicate 1 and 2 GDS exports replace the previous acceptor-based responses. All 2,464 measured wells reproduce plate-control normalization of QC Raw = 1000 times the acceptor/donor ratio. All 2,240 sample wells and 224 controls are retained without masks. Each run has 14 compounds and four configurations, with 56 matched GDS qAC50/Cmax rows. Replicate 1 uses the corrected source assignments: A NLN/HTC, B NLN/HTN, C NLC/HTN, D NLC/HTC. The corrected assignments match replicate 2. Independent ratio refits remain separate from GDS reported parameters. The replicate 1 source filename contains 20240925; matching original instrument measurements identify the run as 25 Sep 2026. Original filenames are preserved.

Release overview-crosslink-1: Overview ranks highest Cmax and lowest/highest exact reported EC50, with clickable searchable potency-band lists and CSV export. Crosslinking adds 150 exact full IDs across three source contexts, paired No CypA/+CypA distributions and source-cell provenance. Unknown dose, incubation and replicate metadata are not inferred. Structures and warhead annotations are excluded.

Crosslinking context comparison: roster of three contexts, exact full-ID membership overlaps and unique lists, searchable side-by-side response table, selectable No CypA/+CypA/change scatter, numerical difference sorting, CSV and SVG exports. The same 150 full IDs occur in all three contexts. Differences are descriptive and do not establish selectivity or activity; construct, dose, incubation and replicate metadata remain unverified. Adduct category coverage is 0–5 for CyclinD1 Rb and 0–3 for the other contexts.

Crosslinking hit correction from the supplied 15 Oct presentation (slides 8/10): require +CypA total >20% AND +CypA/No CypA total fold >2. Counts reproduce D1(CDK4)10, D1Rb11, CDK4(D1)1; D1–Rb shared7, D1only3, Rbonly4. The default comparison shows shared hits, with tested-ID coverage separate. Slides4/7/13 provide construct identity,10µMcompound,1µMtarget,10µMCypA,6hours,n=1. This supersedes earlier missing-protocol/threshold statements. No source measurement values changed.

SCIENTIST START AND SECTION SHARING
Start with a question provides routes to compound curves, experiment selection,
assay evidence, original-source guidance, and data exports. Navigation is grouped
by task. Copy section link keeps the current section and applicable included
experiment/run/condition/response/reference-plate/activity settings. Individual
compound selections and table-specific filters are not included; share an Excel
export with its Export details sheet for an exact data selection. Locally
uploaded analyses cannot be shared through a section link.
Reset filters in Data & export clears result filters while retaining selected
datasets, measurements and columns. Numeric table previews use six significant
digits; CSV and Excel retain the full stored numeric precision.

Compare compounds and download graphs
The Compare compounds view overlays up to six explicitly selected compound batches, with a separate graph for each target/configuration. It uses only the current Benchling ID, biological replicate, condition and response basis. Changing those controls replaces the plotted run; runs are never pooled. Selections remain separate by full batch ID, with unavailable selections removed explicitly.
Graphs show existing independent 4PL fits by default, with supplied dose means and SD; individual wells are optional. The Graph style menu offers Measured curve (connect points), 4PL fit (smooth curve), and Both (solid measured curve with dashed fit). All three retain the measured points and SD bars; PNG/SVG downloads use the selected style. Fit lines are restricted to the measured concentration range. The four stored parameters and fit warnings remain inspectable, with reported GDS potency separate. Fit warnings, source IDs/files and physical plate details remain available. Missing results are not plotted as zero. Green colors and distinct marker shapes identify compounds. PNG and SVG downloads contain exactly the selected graph, its compound/batch legend and run context; SVG metadata also retains source provenance. No experimental dataset is modified or regenerated.
