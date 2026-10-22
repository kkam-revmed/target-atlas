"""Validate the owner's Prism-saved result against the supplied source measurements."""
import csv
import io
import json
import math
from pathlib import Path
import sys
import zipfile

repo = Path(__file__).resolve().parents[1]
source = json.loads((repo / 'cypa-dependency.json').read_bytes())
q = next(q for q in source['curves'] if q['compound'] == 'RMC-0741051-001'
         and q['replicate'] == 'bio1' and q['condition_code'] == 'A')
with zipfile.ZipFile(sys.argv[1]) as z:
    doc = json.loads(z.read('document.json'))
    assert doc['modifiedBy']['platform'] == 'Mac'
    assert doc['modifiedBy']['version'].startswith('11.')
    data_id = doc['sheets']['data'][0]
    sheet = json.loads(z.read(f'data/sheets/{data_id}/sheet.json'))
    table_id = sheet['table']['uid']
    rows = list(csv.reader(io.StringIO(z.read(f'data/tables/{table_id}/data.csv').decode())))
    assert len(rows) == len(q['doses']) == 10
    for row, dose in zip(rows, q['doses']):
        assert len(row) == len(dose['wells']) + 1 == 49
        assert float(row[0]) == math.log10(dose['x']) - 6
        assert [float(v) for v in row[1:]] == [w['normalized'] for w in dose['wells']]
    aid = doc['sheets']['analyses'][0]
    params = json.loads(z.read(f'analyses/{aid}/parameters.json'))['content']
    assert params['model']['constraints'] == {}
    assert params['data']['handleReplicatesAs'] == 'INDIVIDUAL'
    assert params['method']['fittingMethod'] == 'LS'
    assert params['method']['weighting']['type'] == 'NO_WEIGHTING'
    results = json.loads(z.read(f'analyses/{aid}/results.json'))['content']
    assert results['status'] == {'error': 'VALID', 'warning': []}
    summary = next(iter(results['dataSummary'].values()))['value']
    assert summary == {'xValuesAnalyzed': 480, 'yValuesAnalyzed': 480, 'yValuesSkipped': 0}
    fit = next(iter(results['models'].values()))['value']
    def estimate(name):
        return next(iter(fit['parameters'][name].values()))['value']['estimate']
    bottom, top, logec50, slope = map(estimate, ('Bottom', 'Top', 'LogEC50', 'HillSlope'))
    assert math.isclose(estimate('EC50_uM'), 10 ** (logec50 + 6), rel_tol=1e-14)
    sse = sum((float(y) - (bottom + (top-bottom)/(1 + 10**((logec50-float(r[0]))*slope))))**2
              for r in rows for y in r[1:])
    reported_sse = next(iter(fit['goodnessOfFit']['ss'].values()))['value']
    assert math.isclose(sse, reported_sse, rel_tol=1e-12)
    assert fit['goodnessOfFit']['df'] == 480 - 4
print('PASS: Prism 11 Mac round trip; all 480 exact source values; 10 doses; 4 free parameters; unweighted well fit; no skipped points; residual sum and EC50 unit conversion verified.')
