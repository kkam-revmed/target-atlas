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
