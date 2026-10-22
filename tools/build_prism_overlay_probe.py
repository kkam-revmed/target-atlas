"""Build a two-compound native Prism test; requires a Mac round trip before release.

Prism's documented InsertData command adds the second dataset to the linked
table. This deliberately does not fabricate dataset IDs or native graph records.
"""
import argparse
import json
from pathlib import Path
import zipfile

from build_prism_native_probe import build, axis_limits, graph_format_commands, csv_text


def overlay(template, repo, output):
    first, second = 'RMC-0741051-001', 'RMC-0707407-001'
    source = json.loads((repo / 'cypa-dependency.json').read_bytes())
    curves = [next(q for q in source['curves'] if q['compound'] == compound
                   and q['replicate'] == 'bio1' and q['condition_code'] == 'A')
              for compound in (first, second)]
    doses = [sorted(q['doses'], key=lambda d: d['x']) for q in curves]
    if [d['x'] for d in doses[0]] != [d['x'] for d in doses[1]]:
        raise ValueError('This probe requires exactly matching supplied doses; no interpolation.')
    native, _ = build(template, repo, output, compound=first)
    native.rename(output / 'Atlas_Overlay_Input.prism')
    axes = axis_limits(doses)
    title = f'{first} vs {second} - D1/CypA - Replicate 1 - No inhibitor'
    script = ['CreateLog', 'SetScriptDialogTitle "Atlas: test two separate compound fits"',
              'Open "Atlas_Overlay_Input.prism"', 'GoTo D 1']
    # One subcolumn per insertion avoids delimiter/blank handling assumptions.
    # The first dataset and its X values are already populated by the validated
    # builder. Each second-compound well goes to Y dataset 2, never dataset 1.
    for index, curve in enumerate(curves, 1):
        script += [f'InsertData 0, {index}, 1', '<Data>',
                   f'{curve["compound"]} - Replicate 1 - No inhibitor', '</Data>']
    nslots = max(len(d['wells']) for d in doses[1])
    if nslots > max(len(d['wells']) for d in doses[0]):
        raise ValueError('Second series exceeds the retained table subcolumn capacity.')
    for slot in range(nslots):
        for row, dose in enumerate(doses[1], 1):
            if slot < len(dose['wells']):
                value = dose['wells'][slot]['normalized']
                script += [f'InsertData {row}, 2, {slot + 1}', '<Data>', str(value), '</Data>']
    script += ['RecalcAll', *graph_format_commands(axes, title),
               'Save "Atlas_Overlay_Result.prism"', '']
    (output / 'Open_in_Prism.pzc').write_text('\n'.join(script))
    provenance = json.loads((output / 'provenance.json').read_text())
    provenance.pop('source_series')
    provenance.update(status='unvalidated-two-compound-overlay', source_series=curves,
                      graph_axes=axes, notes=(
        'Two distinct compound batches, biological run 1, condition A. '
        'Each compound is fitted separately using its unchanged normalized wells. '
        'The reference has 48 wells per dose pooled across plates within this run; '
        'RMC-0707407-001 has two wells per dose. No between-compound pooling. '
        'Prism must register the added dataset in both analysis and graph. '
        'Native inspection of both fits, graph series and error-bar settings is required.'))
    (output / 'provenance.json').write_text(json.dumps(provenance, indent=2))
    (output / 'original-values.csv').write_text(csv_text([
        ['Compound batch', 'Biological run', 'Condition', 'Concentration (uM)',
         'Well slot (not a paired subject)', 'Normalized response'],
        *[[q['compound'], q['replicate'], q['condition_code'], d['x'], i + 1, w['normalized']]
          for q in curves for d in q['doses'] for i, w in enumerate(d['wells'])]]))
    (output / 'Fix_Atlas_Graph.pzc').unlink()
    (output / 'README.txt').write_text(
        'Atlas two-compound Prism 11 test\n\n'
        '1. Unzip and keep the files together.\n'
        '2. Run Open_in_Prism.command, as for the successful single-compound test.\n'
        '3. Review Atlas_Overlay_Result.prism. Do not open the Input file directly.\n\n'
        'Expected: RMC-0741051-001 and RMC-0707407-001 on one graph, each with its '
        'own linked 4PL result. Both are D1/CypA, biological replicate 1, no inhibitor. '
        'There are 480 reference wells and 20 RMC-0707407 wells at 10 concentrations. '
        'They remain separate datasets. Missing subcolumns must be blank, never zero.\n\n'
        'Send Atlas_Overlay_Result.prism back so the data, separate fits, graph '
        'membership and error-bar settings can be checked. If it stops, send the '
        'first error in the script dialog instead. This is a compatibility test, '
        'not yet a website release. It opens a separate project and saves a new '
        'result in this folder. It does not modify the original uploaded project.\n')
    bundle = output.parent / 'Atlas_Prism_Overlay_Test.zip'
    with zipfile.ZipFile(bundle, 'w', zipfile.ZIP_DEFLATED) as archive:
        for path in sorted(output.iterdir()):
            if path.is_file():
                archive.write(path, f'Atlas_Prism_Overlay_Test/{path.name}')
    return bundle


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--template', type=Path, required=True)
    parser.add_argument('--repo', type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    print(overlay(args.template, args.repo, args.output))
