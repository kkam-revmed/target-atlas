"""Validate the owner's two-compound Prism 11 result, not a new experimental dataset.

Usage: python tests/prism-overlay-roundtrip.py /local/Atlas_Overlay_Result.prism
No archive or repository measurements are modified by this check.
"""
import csv
import io
import json
import math
from pathlib import Path
import sys
import zipfile


repo = Path(__file__).resolve().parents[1]
source = json.loads((repo / 'cypa-dependency.json').read_bytes())
compounds = ['RMC-0741051-001', 'RMC-0707407-001']
curves = [next(q for q in source['curves'] if q['compound'] == compound
               and q['replicate'] == 'bio1' and q['condition_code'] == 'A')
          for compound in compounds]


def only_value(values):
    assert len(values) == 1, 'Expected one separate model value, not a pooled fit'
    return next(iter(values.values()))['value']


def prediction(x, parameters):
    bottom, top, logec50, slope = parameters
    return bottom + (top - bottom) / (1 + 10 ** ((logec50 - x) * slope))


with zipfile.ZipFile(sys.argv[1]) as archive:
    def read_json(name):
        return json.loads(archive.read(name))

    def read_csv(name):
        return list(csv.reader(io.StringIO(archive.read(name).decode())))

    doc = read_json('document.json')
    assert doc['modifiedBy']['platform'] == 'Mac'
    assert doc['modifiedBy']['version'].startswith('11.')
    assert len(doc['sheets']['data']) == len(doc['sheets']['analyses']) == len(doc['sheets']['graphs']) == 1
    data_id = doc['sheets']['data'][0]
    sheet = read_json(f'data/sheets/{data_id}/sheet.json')
    table = sheet['table']
    measured_ids = table['dataSets']
    assert len(set(measured_ids)) == 2
    assert table['replicatesCount'] == 48
    rows = read_csv(f'data/tables/{table["uid"]}/data.csv')
    assert len(rows) == 10
    expected_counts = [480, 20]
    for index, curve in enumerate(curves):
        meta = read_json(f'data/sets/{measured_ids[index]}.json')
        assert compounds[index] in meta['title']
        count = 0
        for row, dose in zip(rows, sorted(curve['doses'], key=lambda d: d['x'])):
            assert len(row) == 97
            assert float(row[0]) == math.log10(dose['x']) - 6
            values = row[1 + 48 * index:1 + 48 * (index + 1)]
            expected = [w['normalized'] for w in dose['wells']]
            actual = [float(v) for v in values[:len(expected)]]
            if index == 0:
                assert actual == expected
            else:
                # Prism's InsertData route rounds new values to 15 significant
                # digits. This is observed native behavior, NOT exact source
                # preservation: the original-value sidecar remains necessary.
                assert actual == [float(format(v, '.15g')) for v in expected]
                assert max(abs(a - b) for a, b in zip(actual, expected)) < 4e-13
            assert all(v == '' for v in values[len(expected):]), 'Unused cells must remain blank'
            count += len(expected)
        assert count == expected_counts[index]

    aid = doc['sheets']['analyses'][0]
    analysis = read_json(f'analyses/{aid}/sheet.json')
    assert analysis['isCalculated'] is True
    assert [q['uid'] for q in analysis['inputDataSets']] == measured_ids
    assert [q['uid'] for q in analysis['inputSheets']] == [data_id]
    params = read_json(f'analyses/{aid}/parameters.json')['content']
    assert params['model']['constraints'] == {}
    assert params['model']['equation']['parameters'] == ['Bottom', 'Top', 'LogEC50', 'HillSlope']
    assert params['data']['handleReplicatesAs'] == 'INDIVIDUAL'
    assert not params['data']['range']['minX']['enabled']
    assert not params['data']['range']['maxX']['enabled']
    assert params['method']['fittingMethod'] == 'LS'
    assert params['method']['weighting']['type'] == 'NO_WEIGHTING'
    results = read_json(f'analyses/{aid}/results.json')['content']
    assert results['status']['error'] == 'VALID'
    assert 'INCOMPLETE_CI' in results['status']['warning'], 'Do not silently erase Prism fit warnings'
    models = {q['id']['col']['uid']: q for q in results['models'].values()}
    summaries = {q['id']['col']['uid']: q['value'] for q in results['dataSummary'].values()}
    assert set(models) == set(summaries) == set(measured_ids)
    fitted_parameters = {}
    for index, uid in enumerate(measured_ids):
        assert compounds[index] in models[uid]['id']['col']['title']
        assert summaries[uid] == {'xValuesAnalyzed': 480,
                                  'yValuesAnalyzed': expected_counts[index],
                                  'yValuesSkipped': 480 - expected_counts[index]}
        fit = models[uid]['value']
        assert fit['status'] == 'COMPLETED'
        def parameter(name):
            value = only_value(fit['parameters'][name])
            assert value['dsList'] == [index], 'Each parameter belongs to one compound only'
            return value
        p = tuple(parameter(name)['estimate'] for name in ('Bottom', 'Top', 'LogEC50', 'HillSlope'))
        fitted_parameters[uid] = p
        assert math.isclose(parameter('EC50_M')['estimate'], 10 ** p[2], rel_tol=1e-14)
        assert math.isclose(parameter('EC50_uM')['estimate'], 10 ** (p[2] + 6), rel_tol=1e-14)
        sse = sum((float(y) - prediction(float(row[0]), p)) ** 2
                  for row in rows for y in row[1 + 48 * index:1 + 48 * (index + 1)] if y != '')
        assert math.isclose(sse, only_value(fit['goodnessOfFit']['ss']), rel_tol=1e-12)
        assert fit['goodnessOfFit']['df'] == expected_counts[index] - 4
        if index == 1:
            for name in ('LogEC50', 'HillSlope', 'EC50_uM'):
                assert parameter(name)['ci']['lower'] == parameter(name)['ci']['upper'] == 'undefined'

    # Link the graph's two fitted datasets to their result table, then verify
    # those curves numerically against each separate compound's saved model.
    gid = doc['sheets']['graphs'][0]
    graph = read_json(f'graphs/{gid}/sheet.json')
    plotted = graph['inputDataSets']
    assert len(plotted) == len(set(plotted)) == 4
    assert set(measured_ids).issubset(plotted)
    fit_ids = set(plotted) - set(measured_ids)
    result_tables = []
    for name in archive.namelist():
        if name.startswith('data/sheets/') and name.endswith('/sheet.json'):
            candidate = read_json(name)['table']
            if set(candidate['dataSets']) == fit_ids:
                result_tables.append(candidate)
    assert len(result_tables) == 1
    result_table = result_tables[0]
    xmeta = read_json(f'data/sets/{result_table["xDataSet"]}.json')['replicates'][0]
    assert xmeta['@class'] == 'SeriesReplicate'
    fitted_rows = read_csv(f'data/tables/{result_table["uid"]}/data.csv')
    assert len(fitted_rows) == 1000
    for column, fit_id in enumerate(result_table['dataSets']):
        title = read_json(f'data/sets/{fit_id}.json')['title']
        matches = [i for i, compound in enumerate(compounds) if compound in title]
        assert len(matches) == 1
        p = fitted_parameters[measured_ids[matches[0]]]
        for row_index, row in enumerate(fitted_rows):
            x = xmeta['startValue'] + row_index * xmeta['interval']
            # Prism's generated X series accumulates floating-point increments;
            # allow only the observed sub-nanounit evaluation difference.
            assert math.isclose(float(row[column]), prediction(x, p), rel_tol=0, abs_tol=3e-10)

print('PASS: Prism 11 Mac; 480 exact supplied values + 20 values imported at 15 '
      'significant digits (maximum difference <4e-13); 460 unused slots blank; '
      'two separate 4PL analyses and linked graph curves; SSE, df, EC50 units and all '
      '2,000 fitted-curve points checked. RMC-0707407 EC50/slope confidence intervals '
      'remain undefined and INCOMPLETE_CI is preserved. Native error-bar statistic '
      'is not asserted by this test.')
