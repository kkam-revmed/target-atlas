// Match and export checks use only supplied measurements, including reference-plate aliases.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const comparison=require('../campaign-comparison.js'),identity=require('../selectivity-identity.js');
const read=name=>JSON.parse(fs.readFileSync(path.resolve(__dirname,'..',name),'utf8'));
const d1=read('cyclind1-source-parameters.json');
function parseCSV(text){const rows=[];let row=[],field='',quoted=false;for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){row.push(field);field='';}else if(c==='\n'&&!quoted){row.push(field.replace(/\r$/,''));rows.push(row);row=[];field='';}else field+=c;}row.push(field);rows.push(row);return rows;}
for(const rep of [1,2])for(const plate of [1,2]){
 const data=identity.prepare(read(rep===1?'sample.json':'selectivity-rep2.json'),{referencePlate:String(plate)});
 for(const target of data.targets){
  const source=data.curves.filter(q=>q.target===target),left=source.map(q=>({...q.report,compound:q.compound,cmax:q.cmax,cmax_basis:q.cmax_basis,physical_plate:q.physical_plate,source_compound:q.source_compound}));
  const rows=comparison.join(left,d1);assert.equal(rows.length,27);assert.equal(rows.filter(r=>r.right).length,24);
  const mismatch=rows.find(r=>r.left.compound==='RMC-0732120-002');assert.equal(mismatch.right,null);assert.deepEqual(mismatch.otherBatches,['RMC-0732120-001']);assert.equal(mismatch.status,'Different batch only');
  for(const id of ['RMC-0769903-001','RMC-0769904-001']){const missing=rows.find(r=>r.left.compound===id);assert.equal(missing.right,null);assert.equal(missing.status,'Not present in comparison source');}
  const ref=rows.find(r=>r.left.compound==='RMC-0741051-001');assert.equal(ref.left.source_compound,'RMC-0741051-00'+plate);assert.equal(ref.right.compound,'RMC-0741051-001');
  const leftContext={benchling_id:'EXP26007301',biological_replicate:rep,run_date:data.run_date},rightContext={benchling_id:'EXP26003438',biological_replicate:'',condition:'No CypA inhibitor'};
  const [headers,...records]=parseCSV(comparison.csv(rows,leftContext,rightContext));assert.equal(records.length,27);
  for(let i=0;i<rows.length;i++){
   const got=Object.fromEntries(headers.map((key,j)=>[key,records[i][j]])),expected=rows[i];
   assert.equal(got.selectivity_compound,expected.left.compound);assert.equal(Number(got.selectivity_cmax),expected.left.cmax);assert.equal(got.selectivity_source_compound,expected.left.source_compound);assert.equal(got.selectivity_biological_replicate,String(rep));
   assert.equal(got.cyclind1_biological_replicate,'');
   if(expected.right){assert.equal(Number(got.cyclind1_cmax),expected.right.cmax);assert.equal(Number(got.cyclind1_ec50_um),expected.right.ec50);assert.equal(got.cyclind1_qualifier.replace(/^'/,''),expected.right.qualifier);assert.equal(got.cyclind1_source,expected.right.source);assert.equal(Number(got.cyclind1_source_row),expected.right.source_row);assert.equal(got.cyclind1_source_qc,expected.right.source_qc);}else{assert.equal(got.cyclind1_cmax,'');assert.equal(got.cyclind1_ec50_um,'');}
  }
  const selected=rows.filter(r=>r.left.compound.includes('9892'));assert.equal(parseCSV(comparison.csv(selected,leftContext,rightContext)).length,2);
 }
}
// Both biological replicates are independent measurements; concatenating them cannot choose a run implicitly.
const duplicated=[...read('cyclind1-bio1-A.json').curves,...read('cyclind1-bio2-A.json').curves];
const duplicate=comparison.join([duplicated[0]],duplicated)[0];assert.equal(duplicate.right,null);assert.match(duplicate.status,/Multiple source records/);
console.log('PASS: 24 exact matches per target across both replicates/reference plates; missing analogs and batch mismatch preserved; exact values, bounds, QC, provenance and selected-only CSV; no implicit replicate selection');
