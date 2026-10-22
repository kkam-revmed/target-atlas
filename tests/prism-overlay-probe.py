"""Check script destinations and every source value before a native Mac test."""
import csv
import hashlib
import io
import json
from pathlib import Path
import re
import sys
import tempfile
import zipfile

repo = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(repo / 'tools'))
from build_prism_overlay_probe import overlay
from build_prism_native_probe import TABLE

source_path = repo / 'cypa-dependency.json'
before = hashlib.sha256(source_path.read_bytes()).hexdigest()
source = json.loads(source_path.read_bytes())
curves = [next(q for q in source['curves'] if q['compound'] == compound
               and q['replicate'] == 'bio1' and q['condition_code'] == 'A')
          for compound in ('RMC-0741051-001', 'RMC-0707407-001')]
with tempfile.TemporaryDirectory() as tmp:
    out = Path(tmp) / 'package'
    bundle = overlay(Path(sys.argv[1]), repo, out)
    with zipfile.ZipFile(out / 'Atlas_Overlay_Input.prism') as z:
        names = [n for n in z.namelist() if TABLE in n and n.endswith('.csv')]
        assert len(names) == 1, names
        data = list(csv.reader(io.StringIO(z.read(names[0]).decode())))
        # The validated builder writes the ten numeric rows without a header.
        assert len(data) == 10
        for row, dose in zip(data, sorted(curves[0]['doses'], key=lambda d: d['x'])):
            assert [float(v) for v in row[1:]] == [w['normalized'] for w in dose['wells']]
    script = (out / 'Open_in_Prism.pzc').read_text()
    inserted = {}
    titles = {}
    for row, col, subcol, value in re.findall(
            r'InsertData (\d+), (\d+), (\d+)\n<Data>\n([^\n]+)\n</Data>', script):
        row, col, subcol = map(int, (row, col, subcol))
        if row == 0:
            titles[col] = value
        else:
            assert col == 2, 'Never overwrite reference or X measurements'
            assert (row, subcol) not in inserted
            inserted[row, subcol] = float(value)
    expected = {(r, s): w['normalized']
                for r, d in enumerate(sorted(curves[1]['doses'], key=lambda d: d['x']), 1)
                for s, w in enumerate(d['wells'], 1)}
    assert inserted == expected and len(inserted) == 20
    assert all(q['compound'] in titles[i] for i, q in enumerate(curves, 1))
    assert script.index('RecalcAll') > script.rindex('</Data>')
    assert 'Save "Atlas_Overlay_Result.prism"' in script
    assert 'DeleteAllDataSets' not in script
    provenance = json.loads((out / 'provenance.json').read_text())
    assert provenance['source_series'] == curves
    original = list(csv.DictReader(io.StringIO((out / 'original-values.csv').read_text())))
    assert len(original) == 500
    with zipfile.ZipFile(bundle) as z:
        assert any(n.endswith('Open_in_Prism.command') for n in z.namelist())
        assert not any(n.endswith('Atlas_NanoBRET_Test.prism') for n in z.namelist())
assert hashlib.sha256(source_path.read_bytes()).hexdigest() == before
print('PASS: 480 reference values + 20 distinct compound values; separate destinations, provenance, source unchanged. Native graph/fit registration still requires Prism 11.')
