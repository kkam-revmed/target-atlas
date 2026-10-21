const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const api=require('../run-comparison.js'),identity=require('../selectivity-identity.js');
const read=f=>JSON.parse(fs.readFileSync(path.resolve(__dirname,'..',f),'utf8'));
const raw1=read('sample.json'),raw2=read('selectivity-rep2.json'),a=identity.prepare(raw1,{referencePlate:'all'}),b=identity.prepare(raw2,{referencePlate:'all'});
const data={'d1-1':read('cyclind1-bio1-A.json'),'d1-2':read('cyclind1-bio2-A.json'),'sel-1-1':a,'sel-1-2':a,'sel-2-1':b,'sel-2-2':b},before=JSON.stringify(data),enabled=Object.keys(data);
const series=api.buildSeries(data,['RMC-0741051-001'],enabled,'Cyclin D3','A');assert.equal(series.length,6);
for(const q of series)for(const d of q.doses){const mean=d.wells.reduce((a,b)=>a+b,0)/d.wells.length,sd=Math.sqrt(d.wells.reduce((a,b)=>a+(b-mean)**2,0)/(d.wells.length-1));assert(Math.abs(d.sd-sd)<1e-10);assert.equal(d.n,q.benchling_id==='EXP26003438'?48:2);}
assert.equal(series.find(q=>q.choice_key==='sel-1-2').source_compound,'RMC-0741051-002');assert(series.every(q=>q.compound==='RMC-0741051-001'));
const summaries=api.biologicalSummary(series);assert.equal(summaries.length,3);
for(const q of summaries){assert.equal(q.fit,null);assert.equal(q.report,null);assert.equal(q.summary_components.length,2);for(const d of q.doses){assert.equal(d.n,2);assert.equal(d.mean,(d.replicate1_mean+d.replicate2_mean)/2);assert(Math.abs(d.sd-Math.abs(d.replicate2_mean-d.replicate1_mean)/Math.sqrt(2))<1e-10);assert.equal(d.delta_rep2_minus_rep1,d.replicate2_mean-d.replicate1_mean);assert.equal(d.components.length,2);assert.equal(d.components[0].n_wells,q.benchling_id==='EXP26003438'?48:2);}}
const one=api.biologicalSummary(series.filter(q=>q.biological_replicate===1));assert(one.every(q=>q.doses.every(d=>d.n===1&&d.sd===null&&d.delta_rep2_minus_rep1===null)));
// Removing a supplied observation must not create a zero, interpolated dose, or a second biological sample.
const absent=series.map(q=>q.choice_key==='d1-2'?{...q,doses:q.doses.slice(1)}:q),missing=api.biologicalSummary(absent).find(q=>q.benchling_id==='EXP26003438').doses[0];assert.equal(missing.n,1);assert.equal(missing.sd,null);
assert.throws(()=>api.biologicalSummary([...series,series[0]]),/more than once/);
const bothBatches=api.buildSeries(data,['RMC-0732120-001','RMC-0732120-002'],enabled,'Cyclin D3','A');assert.equal(bothBatches.length,4);assert.equal(api.biologicalSummary(bothBatches).length,2);assert(bothBatches.filter(q=>q.compound.endsWith('002')).every(q=>q.benchling_id==='EXP26007301'));
const differences=api.plateDifferences(series);assert.equal(differences.length,20);for(const d of differences){assert.equal(d.delta_plate2_minus_plate1,d.plate2_mean-d.plate1_mean);assert.equal(d.plate2_source,'RMC-0741051-002');}
assert.equal(api.csv(series).split('\r\n').length,61);assert.equal(api.csv(summaries).split('\r\n').length,31);assert.equal(JSON.stringify(data),before);
console.log('PASS: measured-well sample SD; 48-well D1 reference vs 2-well selectivity; two biological means weighted equally; plate/batch/assay isolation; missing-run SD unavailable; no interpolation; exact plate differences; source data unchanged');
