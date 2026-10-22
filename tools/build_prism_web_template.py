"""Extract an empty linked Prism family from the locally approved project.

The original attachment stays local. The web asset has no input measurements,
cached results or workbook archives. Graph formatting is retained byte for byte.
"""
import argparse
import json
from pathlib import Path
import tempfile
import zipfile
from build_prism_native_probe import build, ANALYSIS, INFO, X


def empty_template(template, repo, output):
    with tempfile.TemporaryDirectory() as tmp:
        native, _ = build(template, repo, Path(tmp) / 'probe')
        with zipfile.ZipFile(native) as z:
            files = {n: z.read(n) for n in z.namelist()}
    notes = ('Target Atlas Prism 11 graph export. Run Open_in_Prism.command to insert '
             'the selected data and calculate separate independent agonist 4PL fits. '
             'This input file intentionally contains no measurements or fitted results. '
             'See provenance.json and selected-data.pzfx in the same download for '
             'the exact selection, original labels, units, sources and displayed SD/n. '
             'Native template colors and error-bar settings are retained: review them '
             'in Prism. Fits are unweighted, unconstrained, and distinct from GDS '
             'and Atlas estimates. Review confidence intervals and warnings in Results.')
    for name in list(files):
        if name.endswith('/data.csv'):
            files[name] = b''
        elif name.endswith('.json'):
            obj = json.loads(files[name])
            if name.startswith('data/tables/'):
                obj['numberOfRows'] = 0
            if name.startswith('data/sets/'):
                if 'title' in obj:
                    obj['title'] = 'log10 concentration (M)' if name == f'data/sets/{X}.json' else 'Selected series'
                for r in obj.get('replicates', []) + [x['replicate'] for x in obj.get('replicate ranges', [])]:
                    r.update(firstRow=-1, lastRow=-1)
            if name.endswith('sheet.json'):
                obj['title'] = 'Atlas selected comparison'
            if name == f'info/{INFO}/sheet.json':
                obj['notesText'] = notes
            if name == f'analyses/{ANALYSIS}/sheet.json':
                obj['title'] = 'Independent agonist 4PL'
                obj.pop('alertText', None)
                for entry in obj['inputDataSets'] + obj['inputSheets']:
                    entry['title'] = 'Atlas selected comparison'
            if name == f'analyses/{ANALYSIS}/parameters.json':
                equation = obj['content']['model']['equation']
                equation['name'] = 'Independent log(agonist) vs. response - variable slope 4PL'
                equation['description'] = 'X: log10 concentration (M). Y: selected response basis; see companion provenance.json.'
                equation['tip'] = 'Independent Prism fit. Review confidence intervals and diagnostics; baseline and plateau are free.'
            if name == 'document.json':
                for field in ('createdBy', 'modifiedBy'):
                    if field in obj:
                        obj[field] = {k: v for k, v in obj[field].items() if k in ('version', 'platform')}
                for attrs in obj.get('sheetAttributesMap', {}).values():
                    attrs['title'] = 'Atlas selected comparison'
            files[name] = json.dumps(obj, ensure_ascii=False).encode()
    assert not any(n.endswith('/results.json') for n in files)
    assert all(not v for n, v in files.items() if n.endswith('/data.csv'))
    output.parent.mkdir(parents=True, exist_ok=True)
    # Stored entries let browsers fill the first series with exact CSV values
    # without a third-party decompression library. The outer package is a ZIP.
    with zipfile.ZipFile(output, 'w', zipfile.ZIP_STORED) as z:
        for name, value in sorted(files.items()):
            z.writestr(name, value)


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--template', required=True, type=Path)
    p.add_argument('--output', required=True, type=Path)
    args = p.parse_args()
    empty_template(args.template, Path(__file__).resolve().parents[1], args.output)
