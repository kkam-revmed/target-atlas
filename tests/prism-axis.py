"""Native-export axis bounds and overrides checked against supplied observations."""
import copy
import csv
import importlib.util
import io
import json
import math
from pathlib import Path
import statistics
import sys
import tempfile
import zipfile

sys.dont_write_bytecode = True
repo = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('probe', repo / 'tools/build_prism_native_probe.py')
p = importlib.util.module_from_spec(spec)
spec.loader.exec_module(p)
source = json.loads((repo / 'cypa-dependency.json').read_bytes())
curves = source['curves']
ranges = set()
for q in curves:
    before = copy.deepcopy(q)
    axes = p.axis_limits([q['doses']])
    ranges.add((axes['y_min'], axes['y_max']))
    for d in q['doses']:
        xs = math.log10(d['x']) - 6
        values = [w['normalized'] for w in d['wells']]
        mean = statistics.mean(values)
        sd = statistics.stdev(values) if len(values) > 1 else 0
        assert axes['y_min'] <= mean - sd <= mean + sd <= axes['y_max']
        assert axes['x_min_logM'] <= xs <= axes['x_max_logM']
    assert q == before
assert len(ranges) > 1, 'Automatic limits must respond to activity, not remain fixed at 250%.'
shared = p.axis_limits([q['doses'] for q in curves])
assert shared['y_max'] >= max(y[1] for y in ranges)
manual = p.axis_limits([curves[0]['doses']], (.001, 1), (50, 175))
assert (manual['x_min_logM'], manual['x_max_logM']) == (-9, -6)
assert (manual['y_min'], manual['y_max'], manual['x_mode'], manual['y_mode']) == (50, 175, 'manual', 'manual')
for kwargs in ({'x_limits_um': (0, 1)}, {'x_limits_um': (1, .1)}, {'y_limits': (100, 0)}, {'y_limits': (0, math.inf)}):
    try:
        p.axis_limits([curves[0]['doses']], **kwargs)
    except ValueError:
        pass
    else:
        raise AssertionError('Invalid axis limits accepted: ' + str(kwargs))
# Exercise a different supplied compound/run/condition and intentional clipping.
q = max(curves, key=lambda q: p.axis_limits([q['doses']])['y_max'])
with tempfile.TemporaryDirectory() as tmp:
    native, _ = p.build(Path(sys.argv[1]), repo, Path(tmp) / 'test', q['compound'],
                        q['replicate'], q['condition_code'], (.001, 1), (50, 175))
    with zipfile.ZipFile(native) as z:
        actual = list(csv.reader(io.StringIO(z.read(f'data/tables/{p.TABLE}/data.csv').decode())))
        for row, d in zip(actual, sorted(q['doses'], key=lambda d: d['x'])):
            assert [float(v) for v in row[1:] if v != ''] == [w['normalized'] for w in d['wells']]
        assert len(actual) == len(q['doses']), 'Clipping must never filter exported data.'
    provenance = json.loads((native.parent / 'provenance.json').read_text())
    assert provenance['source_series'] == q
    assert provenance['graph_axes'] == manual
print(f'PASS: {len(curves)} supplied series; {len(ranges)} auto Y ranges; common scales; valid log(M); mean+SD bounds; manual limits; exported data retained outside axes.')
