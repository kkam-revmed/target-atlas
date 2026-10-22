"""Structural/data checks only; these do not replace opening the probe in Prism 11."""
import csv
import hashlib
import importlib.util
import io
import json
import math
import statistics
from pathlib import Path
import sys
import tempfile
import zipfile

sys.dont_write_bytecode = True
repo = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('probe', repo / 'tools/build_prism_native_probe.py')
probe = importlib.util.module_from_spec(spec)
spec.loader.exec_module(probe)
template = Path(sys.argv[1])
before = {p: hashlib.sha256(p.read_bytes()).hexdigest() for p in repo.glob('*.json')}
template_before = template.read_bytes()
with tempfile.TemporaryDirectory() as tmp:
    native, bundle = probe.build(template, repo, Path(tmp) / 'test')
    with zipfile.ZipFile(template) as original, zipfile.ZipFile(native) as exported:
        doc = json.loads(exported.read('document.json'))
        assert doc['sheets'] == {'data': [probe.SHEET], 'analyses': [probe.ANALYSIS],
                                 'graphs': [probe.GRAPH], 'info': [probe.INFO]}
        assert exported.read(f'graphs/{probe.GRAPH}/data.bin') == original.read(f'graphs/{probe.GRAPH}/data.bin')
        assert not any('/floating_notes/' in n or n.endswith('/results.json') for n in exported.namelist())
        provenance = json.loads((native.parent / 'provenance.json').read_text())
        q = provenance['source_series']
        assert (q['compound'], q['replicate'], q['condition_code']) == ('RMC-0741051-001', 'bio1', 'A')
        rows = list(csv.reader(io.StringIO(exported.read(f'data/tables/{probe.TABLE}/data.csv').decode())))
        doses = sorted(q['doses'], key=lambda d: d['x'])
        assert len(rows) == len(doses) == 10
        for row, dose in zip(rows, doses):
            assert float(row[0]) == math.log10(dose['x']) - 6
            assert [float(v) for v in row[1:]] == [w['normalized'] for w in dose['wells']]
            assert len(row) == 49
        # Source µM remains separately available, without rounded serialization.
        audit = list(csv.reader(io.StringIO((native.parent / 'original-values.csv').read_text())))
        assert [float(r[0]) for r in audit[1:]] == [d['x'] for d in doses]
        metadata = json.loads(exported.read(f'data/tables/{probe.TABLE}/content.json'))
        assert (metadata['numberOfRows'], metadata['numberOfColumns']) == (10, 49)
        ys = json.loads(exported.read(f'data/sets/{probe.Y}.json'))
        assert len(ys['replicates']) == 48
        assert all((r['firstRow'], r['lastRow']) == (0, 9) for r in ys['replicates'])
        for name in exported.namelist():
            if name.startswith('data/tables/') and name.endswith('/data.csv') and probe.TABLE not in name:
                assert exported.read(name) == b'', name
                meta = json.loads(exported.read(name.replace('data.csv', 'content.json')))
                assert meta['numberOfRows'] == 0
        params = json.loads(exported.read(f'analyses/{probe.ANALYSIS}/parameters.json'))['content']
        assert params['model']['equation']['parameters'] == ['Bottom', 'Top', 'LogEC50', 'HillSlope']
        assert 'IC50' not in json.dumps(params)
        assert params['model']['initialValues'] == {}
        assert params['model']['constraints'] == {}
        assert params['method']['weighting']['type'] == 'NO_WEIGHTING'
        assert params['data']['handleReplicatesAs'] == 'INDIVIDUAL'
        assert not json.loads(exported.read(f'analyses/{probe.ANALYSIS}/sheet.json'))['isCalculated']
        assert b'UNVALIDATED' in exported.read(f'info/{probe.INFO}/sheet.json')
    script = (native.parent / 'Open_in_Prism.pzc').read_text()
    assert 'RecalcAll' in script and 'SetAxisTitle Y "NanoBRET normalized (%)"' in script
    bounds = {parts[1] + parts[2]: float(parts[3]) for line in script.splitlines()
              if line.startswith('SetAxisLimits ') for parts in [line.split()]}
    lower, upper, interval = bounds['Xbottom'], bounds['Xtop'], bounds['Xinterval']
    assert lower <= min(math.log10(d['x']) - 6 for d in doses)
    assert upper >= max(math.log10(d['x']) - 6 for d in doses)
    assert interval == 1
    # The user's 125% screenshot hides exactly the last three source means.
    # The repair must include every measured mean and its sample-SD extent.
    means = [statistics.mean(w['normalized'] for w in d['wells']) for d in doses]
    assert sum(m > 125 for m in means) == 3
    for dose, mean in zip(doses, means):
        sd = statistics.stdev(w['normalized'] for w in dose['wells'])
        assert bounds['Ybottom'] <= mean - sd <= mean + sd <= bounds['Ytop']
    repair = (native.parent / 'Fix_Atlas_Graph.pzc').read_text()
    commands = [line.split()[0] for line in repair.splitlines() if line and not line.startswith('//')]
    assert not set(commands) & {'Open', 'Save', 'Import', 'InsertData', 'RecalcAll', 'ClearTable'}
    assert commands.count('SetAxisLimits') == 6
    assert 'CreateLog' in commands
    assert script.index('CreateLog') < script.index('Open "')
    with zipfile.ZipFile(bundle) as zipped:
        assert len(zipped.namelist()) == 7
        assert not any(n.endswith('.xlsx') for n in zipped.namelist())
        launcher = zipped.getinfo('Atlas_Prism_Test/Open_in_Prism.command')
        assert (launcher.external_attr >> 16) & 0o111
assert template.read_bytes() == template_before
assert all(hashlib.sha256(p.read_bytes()).hexdigest() == digest for p, digest in before.items())
print('PASS: linked single family; exact 480 supplied wells; log(M) plus original µM; no example data or cached fits; 4PL metadata; unchanged BDR graph binary; source immutability. Native Prism opening/recalculation NOT tested.')
