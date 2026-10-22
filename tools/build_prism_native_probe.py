"""Build a local, unvalidated Prism 11 compatibility probe from the supplied BDR file.

No native graph binary is synthesized. No fit results are calculated or recycled.
This supports one known template family and a selected supplied D1/CypA series.
It is not wired to the website until opening/recalculation is checked in Prism.
"""
import argparse
import copy
import csv
import hashlib
import io
import json
import math
from pathlib import Path
import re
import statistics
import zipfile

ANALYSIS = 'E3E1CA75-F37C-4774-974A-23CF59341DCB'
SHEET = '58C3734F-A41D-42C1-9347-2A825697B8BD'
GRAPH = '84BD5BD7-9D1C-4812-B6DF-E4CAF39C852A'
INFO = '5ECD4190-7FD8-4A46-8F39-1BD3A2DC115F'
TABLE = 'A8CB8A16-CF2B-4606-A7F4-3BCC05585DF7'
Y = '61BE1DFA-EF80-4CA9-8C5B-4D7F68FBE468'
X = '2BF51D2B-DD4A-429A-BDCF-6FF10EC594B4'
TEMPLATE_SHA256 = '448e11be0f5b5d430494a49e23a7507cd894b0505727028c6a41a7b0565610f7'
RESULT_SHA256 = '6d4964429da26df11ad0466944432ac0042c600a9170f1ac5ab8da2c5aa26f29'
UUID = re.compile(r'[0-9A-F]{8}(?:-[0-9A-F]{4}){3}-[0-9A-F]{12}')


def csv_text(rows):
    out = io.StringIO(newline='')
    csv.writer(out, lineterminator='\n').writerows(rows)
    return out.getvalue()


def nice_interval(span):
    raw = span / 5
    scale = 10 ** math.floor(math.log10(raw))
    return next(step * scale for step in (1, 2, 2.5, 5, 10) if step * scale >= raw)


def axis_limits(dose_groups, x_limits_um=None, y_limits=None):
    """Common bounds include every measured mean +/- sample SD and DMSO=100.

    Missing SD (n=1) is not exported as zero; its single value still informs the
    bounds. Manual limits can deliberately clip. Source values are never altered.
    """
    xs, lower, upper = [], [0], [100]
    for doses in dose_groups:
        for d in doses:
            if not math.isfinite(d['x']) or d['x'] <= 0:
                raise ValueError('Log concentration axes require positive finite doses.')
            xs.append(math.log10(d['x']) - 6)
            values = [w['normalized'] for w in d['wells']]
            if not values or any(not math.isfinite(v) for v in values):
                raise ValueError('Axis input must contain finite supplied well values.')
            mean = statistics.mean(values)
            sd = statistics.stdev(values) if len(values) > 1 else 0
            lower.append(mean - sd)
            upper.append(mean + sd)
    if not xs:
        raise ValueError('Choose at least one measured series.')
    def validate(pair, label, positive=False):
        if len(pair) != 2 or not all(math.isfinite(v) for v in pair) or pair[0] >= pair[1]:
            raise ValueError(label + ' limits must be finite and increasing.')
        if positive and pair[0] <= 0:
            raise ValueError(label + ' limits must be positive for a logarithmic axis.')
    if x_limits_um is not None:
        validate(x_limits_um, 'Concentration', True)
        xmin, xmax = [math.log10(v) - 6 for v in x_limits_um]
    else:
        xmin, xmax = math.floor(min(xs)), math.ceil(max(xs))
        if xmin == xmax:
            xmin, xmax = xmin - 1, xmax + 1
    if y_limits is not None:
        validate(y_limits, 'Response')
        ymin, ymax = y_limits
        step = nice_interval(ymax - ymin)
    else:
        low, high = min(lower), max(upper)
        padding = (high - low) * .05
        step = nice_interval(high - low + 2 * padding)
        ymin = math.floor((low - padding) / step) * step if low < 0 else 0
        ymax = math.ceil((high + padding) / step) * step
    return {'x_min_logM': xmin, 'x_max_logM': xmax, 'x_interval': 1,
            'y_min': ymin, 'y_max': ymax, 'y_interval': step,
            'x_mode': 'manual' if x_limits_um is not None else 'auto',
            'y_mode': 'manual' if y_limits is not None else 'auto'}


def graph_format_commands(axes, title):
    """Documented Prism commands; format the retained graph without editing data."""
    return [
        'GoTo G 1',
        f'SetGraphTitle "{title}"',
        'SetAxisTitle X "log10 concentration (M)"',
        # Owner's Prism 11 screenshot renders %% literally inside quoted titles.
        # Use one percent here; older scripting docs describe different escaping.
        'SetAxisTitle Y "NanoBRET normalized (%)"',
        f'SetAxisLimits X bottom {axes["x_min_logM"]:g}',
        f'SetAxisLimits X top {axes["x_max_logM"]:g}',
        f'SetAxisLimits X interval {axes["x_interval"]:g}',
        f'SetAxisLimits Y bottom {axes["y_min"]:g}',
        f'SetAxisLimits Y top {axes["y_max"]:g}',
        f'SetAxisLimits Y interval {axes["y_interval"]:g}',
    ]


def build(template, repo, output, compound='RMC-0741051-001', replicate='bio1', condition='A',
          x_limits_um=None, y_limits=None):
    original = template.read_bytes()
    template_hash = hashlib.sha256(original).hexdigest()
    if template_hash not in (TEMPLATE_SHA256, RESULT_SHA256):
        raise ValueError('Use the inspected BDR template or the approved Prism Result project.')
    source_bytes = (repo / 'cypa-dependency.json').read_bytes()
    source = json.loads(source_bytes)
    series = next((q for q in source['curves'] if q['compound'] == compound
                   and q['replicate'] == replicate and q['condition_code'] == condition), None)
    if series is None:
        raise ValueError('No supplied series matches this compound batch, run and condition.')
    doses = sorted(series['doses'], key=lambda d: d['x'])
    if any(not math.isfinite(d['x']) or d['x'] <= 0 for d in doses):
        raise ValueError('This log(M) probe requires positive supplied concentrations.')
    wells = [[w['normalized'] for w in d['wells']] for d in doses]
    if any(not math.isfinite(v) for row in wells for v in row):
        raise ValueError('Nonfinite input: stop rather than silently dropping a measurement.')
    count = max(map(len, wells))
    xs = [math.log10(d['x']) - 6 for d in doses]
    rows = [[x] + w + [''] * (count - len(w)) for x, w in zip(xs, wells)]
    axes = axis_limits([doses], x_limits_um, y_limits)
    condition_label = 'No inhibitor' if condition == 'A' else '+25 uM CypA inhibitor'
    title = f'TEST - {compound} - D1/CypA - {series["replicate_label"]} - {condition_label}'
    notes = (
        'UNVALIDATED PRISM 11 COMPATIBILITY TEST. Not a finished website export. '
        f'Source: cypa-dependency.json; Benchling ID {source["experiment_id"]}; '
        f'{compound}; {series["replicate_label"]}; condition {condition} ({condition_label}). '
        'Supplied normalized well values are unchanged. X is converted from micromolar '
        'to log10(M): log10(x_uM)-6. Original concentrations and all source context are in provenance.json. '
        'For RMC-0741051, the reference pools wells across plates within this biological run; '
        'its wells are not independent biological replicates or a single-plate set. Well slots are '
        'not paired subjects across concentrations. '
        'Prism must compute the new independent 4PL from these wells (unweighted least squares). '
        'This is not the GDS-reported fit or the existing Atlas fit. LogEC50 is log10(M); '
        'EC50_uM is the derived micromolar concentration. No baseline/plateau is fixed. '
        'The original graph binary is retained. The script changes its labels and limits; '
        'the native graph error-bar statistic and analysis results still require inspection in Prism. '
        'No template example measurements or cached fitted results are retained.'
    )
    provenance = {
        'status': 'unvalidated-native-compatibility-probe', 'notes': notes,
        'source_file': 'cypa-dependency.json',
        'source_sha256': hashlib.sha256(source_bytes).hexdigest(),
        'template_sha256': template_hash, 'benchling_id': source['experiment_id'],
        'normalization': source['normalization'], 'source_series': series,
        'x_conversion': 'log10(source concentration in uM) - 6',
        'graph_axes': axes,
    }
    with zipfile.ZipFile(io.BytesIO(original)) as archive:
        all_files = {n: archive.read(n) for n in archive.namelist() if not n.endswith('/')}

    # Select the existing linked family. Traverse only reference-bearing JSON;
    # cached analysis results are deliberately excluded from the closure.
    keep = set()
    pending = [ANALYSIS, SHEET, GRAPH, INFO]
    visited = set()
    while pending:
        uid = pending.pop()
        if uid in visited:
            continue
        visited.add(uid)
        for name, data in all_files.items():
            if uid not in name or '/floating_notes/' in name or name.endswith('/results.json'):
                continue
            keep.add(name)
            if name.endswith('.json'):
                pending.extend(UUID.findall(data.decode()))
    files = {n: all_files[n] for n in keep}
    files.update({n: b for n, b in all_files.items() if n.startswith('misc/')})

    def get(name):
        return json.loads(files[name])

    def put(name, value):
        files[name] = (json.dumps(value, ensure_ascii=False, indent=2) + '\n').encode()

    # Remove stored warning notes and unrelated template example provenance.
    for name in list(files):
        if name.endswith('.json'):
            obj = get(name)
            obj.pop('floatingNotes', None)
            put(name, obj)
    doc = json.loads(all_files['document.json'])
    doc['sheets'] = {'data': [SHEET], 'analyses': [ANALYSIS], 'graphs': [GRAPH], 'info': [INFO]}
    doc['sheetAttributesMap'] = {uid: {'title': title} for uid in (SHEET, ANALYSIS, GRAPH)}
    doc['sheetAttributesMap'][INFO] = {'title': 'Atlas test provenance'}
    doc['uiSettings']['currentSheetType'] = 'Data'
    doc['uiSettings']['currentSheets'] = {'data': SHEET, 'analysis': ANALYSIS, 'graph': GRAPH, 'info': INFO}
    put('document.json', doc)
    info = get(f'info/{INFO}/sheet.json')
    info.update(title='Atlas test provenance', notesText=notes, constants=[])
    info.pop('experimentDate', None)
    put(f'info/{INFO}/sheet.json', info)

    # Empty every result table and cached result dataset, preserving their IDs.
    for name in list(files):
        if name.startswith('data/tables/') and name.endswith('/content.json'):
            meta = get(name)
            meta['numberOfRows'] = 0
            put(name, meta)
            files[name.replace('content.json', 'data.csv')] = b''
        if name.startswith('data/sets/') and name.endswith('.json'):
            obj = get(name)
            obj.pop('cellAttributes', None)
            obj.pop('cellAlignments', None)
            # Prism 11 compresses repeated column metadata into "replicate ranges".
            for rep in obj.get('replicates', []) + [r['replicate'] for r in obj.get('replicate ranges', [])]:
                rep.pop('cellAttributes', None)
                rep.pop('cellAlignments', None)
                rep.update(firstRow=-1, lastRow=-1)
                if rep.get('@class') == 'SeriesReplicate':
                    rep['startValue'] = min(xs)
                    rep['interval'] = (max(xs) - min(xs)) / 999
            put(name, obj)

    input_sheet = get(f'data/sheets/{SHEET}/sheet.json')
    input_sheet['title'] = title
    input_sheet['table']['replicatesCount'] = count
    put(f'data/sheets/{SHEET}/sheet.json', input_sheet)
    input_meta = get(f'data/tables/{TABLE}/content.json')
    input_meta.update(numberOfColumns=count + 1, numberOfRows=len(rows))
    put(f'data/tables/{TABLE}/content.json', input_meta)
    files[f'data/tables/{TABLE}/data.csv'] = csv_text(rows).encode()
    for uid, label, reps in ((X, 'log10 concentration (M)', 1), (Y, title, count)):
        name = f'data/sets/{uid}.json'
        obj = get(name)
        obj['title'] = label
        prototype = (obj.get('replicates') or [r['replicate'] for r in obj.get('replicate ranges', [])])[0]
        rep = copy.deepcopy(prototype)
        rep.update(firstRow=0, lastRow=len(rows) - 1)
        obj.pop('replicate ranges', None)
        obj['replicates'] = [copy.deepcopy(rep) for _ in range(reps)]
        put(name, obj)

    analysis_path = f'analyses/{ANALYSIS}/'
    params = get(analysis_path + 'parameters.json')
    model = params['content']['model']
    eq = model['equation']
    eq.update(
        name='Atlas test: log(agonist) vs. response - variable slope 4PL',
        definition='Y=Bottom + (Top-Bottom)/(1+10^((LogEC50-X)*HillSlope))',
        description='X: log10 concentration (M). Y: supplied NanoBRET normalized (%).',
        tip='Independent test fit. Inspect fit diagnostics; DMSO=100 does not fix Bottom.',
        parameters=['Bottom', 'Top', 'LogEC50', 'HillSlope'],
        transforms=[{'name': 'EC50_M', 'definition': '10^LogEC50', 'ciMethod': 'ASYMMETRICAL'},
                    {'name': 'EC50_uM', 'definition': '10^(LogEC50+6)', 'ciMethod': 'ASYMMETRICAL'},
                    {'name': 'Span', 'definition': 'Top-Bottom', 'ciMethod': 'SYMMETRICAL'}],
    )
    if 'LogIC50' in eq['initialValueRules']:
        eq['initialValueRules']['LogEC50'] = eq['initialValueRules'].pop('LogIC50')
    model['initialValues'] = {}
    for bound, value in [('minX', min(xs)), ('maxX', max(xs))]:
        params['content']['graph']['curve'][bound] = {'isAuto': True, 'value': value}
    put(analysis_path + 'parameters.json', params)
    analysis = get(analysis_path + 'sheet.json')
    analysis.update(title='TEST - Independent agonist 4PL', isCalculated=False,
                    alertText='UNVALIDATED - recalculate in Prism 11')
    analysis['inputDataSets'][0]['title'] = title
    analysis['inputSheets'][0]['title'] = title
    put(analysis_path + 'sheet.json', analysis)
    graph = get(f'graphs/{GRAPH}/sheet.json')
    graph['title'] = title
    put(f'graphs/{GRAPH}/sheet.json', graph)
    # Keep the original .dt tokens, whose semantics are undocumented. Their
    # behavior on changed JSON/CSV is an explicit native-application test gate.

    output.mkdir(parents=True, exist_ok=True)
    native = output / 'Atlas_NanoBRET_Test.prism'
    with zipfile.ZipFile(native, 'w', zipfile.ZIP_DEFLATED) as archive:
        for name, data in sorted(files.items()):
            archive.writestr(name, data)
    (output / 'provenance.json').write_text(json.dumps(provenance, indent=2))
    (output / 'original-values.csv').write_text(csv_text([
        ['Concentration (uM)'] + [f'Well slot {i + 1}' for i in range(count)],
        *[[d['x']] + w + [''] * (count - len(w)) for d, w in zip(doses, wells)],
    ]))
    # Native graph styling is retained byte-for-byte; use supported Prism
    # commands to change labels and limits after opening, not binary patches.
    formatting = graph_format_commands(axes, title)
    script = '\n'.join([
        '// UNVALIDATED compatibility test. Run Open_in_Prism.command to set the local folder.',
        'CreateLog',
        'SetScriptDialogTitle "Atlas: calculate and format NanoBRET graph"',
        'Open "Atlas_NanoBRET_Test.prism"',
        'RecalcAll', *formatting,
        'Save "Atlas_NanoBRET_Result.prism"', '',
    ])
    (output / 'Open_in_Prism.pzc').write_text(script)
    repair = '\n'.join([
        '// Run only with this Atlas test project active in Prism.',
        '// Changes the first graph only. Does not open, save, import, or recalculate data.',
        'CreateLog',
        'SetScriptDialogTitle "Atlas: repair graph labels and axis limits"',
        *formatting, '',
    ])
    (output / 'Fix_Atlas_Graph.pzc').write_text(repair)
    # Resolve the actual Mac download location rather than guessing ~/Downloads
    # or assuming Prism uses the script's directory as its working directory.
    launcher = '''#!/bin/bash
set -eu
prism_task_dir="$(cd -- "$(dirname -- "$0")" && pwd)"
if [ "$(uname -s)" != "Darwin" ]; then
  echo "This test launcher requires macOS with Prism 11 installed."
  exit 1
fi
prism_task_hfs="$(osascript -e 'on run argv' -e 'return (POSIX file (item 1 of argv) as alias) as text' -e 'end run' "$prism_task_dir/")"
case "$prism_task_hfs" in
  *'"'*|*$'\\n'*|*$'\\r'*|*'%'*)
    echo 'Move this test folder to a path without quotes, percent signs, or line breaks, then retry.'
    exit 1 ;;
esac
prism_task_script="$prism_task_dir/Run_Atlas_Prism.pzc"
{ printf 'SetPath "%s"\\n' "$prism_task_hfs"; cat "$prism_task_dir/Open_in_Prism.pzc"; } > "$prism_task_script"
echo 'Opening the Atlas compatibility test in Prism. No network requests or installations are performed.'
open -b com.GraphPad.Prism "$prism_task_script"
'''
    launch_path = output / 'Open_in_Prism.command'
    launch_path.write_text(launcher)
    launch_path.chmod(0o755)
    readme = (
        'Atlas / BDR Prism 11 compatibility test\n\n'
        'Unzip this folder. Double-click Open_in_Prism.command. This opens Terminal briefly '
        'to locate the folder and ask the installed Prism app to run the supplied script. '
        'Keep all files together. It should open the test project, recalculate its linked '
        '4PL, label the graph and save Atlas_NanoBRET_Result.prism in this folder. '
        'This may fail: native Prism is not available in the Cloud environment.\n\n'
        'The finished file to review is Atlas_NanoBRET_Result.prism. The owner approved '
        'its full-curve appearance. New exports calculate limits from selected values '
        'and sample SD, unless manual limits were supplied. '
        'Atlas_NanoBRET_Test.prism is an intermediate input, not the finished graph.\n\n'
        'Opening Atlas_NanoBRET_Test.prism directly skips the formatting script: '
        'inherited labels and limits may remain, possibly clipping selected measurements. '
        'For this already-open test project, run Fix_Atlas_Graph.pzc in Prism. '
        'It only changes graph 1 labels and axis limits, without altering data, '
        'recalculating fits or automatically saving the project. Expected axes: '
        f'NanoBRET normalized (%), {axes["y_min"]:g} to {axes["y_max"]:g}; '
        f'log10 concentration (M), {axes["x_min_logM"]:g} to {axes["x_max_logM"]:g}. '
        'Use File > Run Script > Open Script File if double-click does not run it. '
        'If a command fails, share the first error from the Script dialog log, '
        'or Run_Atlas_Prism.log / Fix_Atlas_Graph.log beside the script.\n\n'
        'Please check whether Data Tables, Results and Graphs all contain the linked family. '
        'Send a screenshot of the graph and analysis settings, or the first error. '
        'No copying/pasting or building analyses is required.\n\n'
        + notes + '\n\n'
        'This probe is one compound, one biological run and one condition. It does not yet '
        'implement arbitrary multi-compound template exports. The website still exports data only.\n'
    )
    (output / 'README.txt').write_text(readme)
    bundle = output.parent / 'Atlas_Prism_Test.zip'
    with zipfile.ZipFile(bundle, 'w', zipfile.ZIP_DEFLATED) as archive:
        for name in ('Atlas_NanoBRET_Test.prism', 'Open_in_Prism.pzc', 'Open_in_Prism.command', 'Fix_Atlas_Graph.pzc', 'README.txt',
                     'provenance.json', 'original-values.csv'):
            archive.write(output / name, f'Atlas_Prism_Test/{name}')
    return native, bundle


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--template', type=Path, required=True)
    parser.add_argument('--repo', type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--compound', default='RMC-0741051-001')
    parser.add_argument('--replicate', choices=('bio1', 'bio2'), default='bio1')
    parser.add_argument('--condition', choices=('A', 'B'), default='A')
    parser.add_argument('--x-limits-um', nargs=2, type=float)
    parser.add_argument('--y-limits', nargs=2, type=float)
    args = parser.parse_args()
    for artifact in build(args.template, args.repo, args.output, args.compound, args.replicate,
                          args.condition, args.x_limits_um, args.y_limits):
        print(artifact)
