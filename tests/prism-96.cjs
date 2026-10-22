const assert=require('node:assert/strict'),fs=require('node:fs');
const native=require('../prism-native.js'),runs=require('../run-comparison.js');
const source=require('../cypa-dependency.json');
const ids=['RMC-0741051-001','RMC-0707407-001'];
const measured=source.curves.filter(q=>ids.includes(q.compound)&&q.condition_code==='A').map(q=>({...q,
 series_id:q.compound+'|'+q.replicate,series_label:q.compound+' '+q.replicate,
 biological_replicate:q.replicate==='bio1'?1:2,benchling_id:source.experiment_id,
 condition_label:'No inhibitor',plate_group:'Supplied across-plate aggregate',
 doses:q.doses.map(d=>({...d,wells:d.wells.map(w=>w.normalized)}))}));
const before=JSON.stringify(measured),pooled=runs.pooledSummary(measured);
const seed=fs.readFileSync(require('node:path').join(__dirname,'../assets/prism/atlas-empty.prism'));
function unzip(bytes){
 const files={};let p=0;bytes=Buffer.from(bytes);
 while(bytes.readUInt32LE(p)===0x04034b50){
  assert.equal(bytes.readUInt16LE(p+8),0);
  const size=bytes.readUInt32LE(p+18),n=bytes.readUInt16LE(p+26),extra=bytes.readUInt16LE(p+28),start=p+30+n+extra;
  files[bytes.subarray(p+30,p+30+n).toString()]=bytes.subarray(start,start+size);p=start+size;
 }return files;
}
const reference=pooled.find(q=>q.compound===ids[0]),library=pooled.find(q=>q.compound===ids[1]);
assert.equal(Math.max(...reference.doses.map(d=>d.n)),96);
let exact=0;
// Exercise both a large first dataset and a smaller first dataset followed by 96 wells.
for(const series of [[reference,library],[library,reference]]){
 const result=native.build(series),files=unzip(native.populateInput(seed,result.table,result.provenance));
 const json=name=>JSON.parse(files[name]);
 const sheet=json('data/sheets/58C3734F-A41D-42C1-9347-2A825697B8BD/sheet.json');
 const meta=json('data/tables/A8CB8A16-CF2B-4606-A7F4-3BCC05585DF7/content.json');
 const reps=json('data/sets/61BE1DFA-EF80-4CA9-8C5B-4D7F68FBE468.json').replicates;
 assert.equal(sheet.table.replicatesCount,96);assert.equal(meta.numberOfColumns,97);assert.equal(reps.length,96);
 const rows=files['data/tables/A8CB8A16-CF2B-4606-A7F4-3BCC05585DF7/data.csv'].toString().trimEnd().split('\n').map(r=>r.split(','));
 assert.equal(rows.length,result.table.x.length);assert.equal(meta.numberOfRows,rows.length);
 rows.forEach((row,r)=>{
  assert.equal(row.length,97);assert.equal(Number(row[0]),Math.log10(result.table.x[r])-6);
  for(let i=0;i<96;i++){
   const value=result.table.datasets[0].columns[i]?.values[r];
   if(Number.isFinite(value)){assert.equal(Number(row[i+1]),value);exact++;}else assert.equal(row[i+1],'','Missing observations stay blank');
  }
 });
 reps.forEach((rep,i)=>{
  const positions=(result.table.datasets[0].columns[i]?.values||[]).map((v,r)=>Number.isFinite(v)?r:-1).filter(r=>r>=0);
  assert.equal(rep.firstRow,positions[0]??-1);assert.equal(rep.lastRow,positions.at(-1)??-1);
 });
 const cells=new Map([...result.script.matchAll(/InsertData (\d+), (\d+), (\d+)\n<Data>\n([^\n]+)\n<\/Data>/g)].map(m=>[m.slice(1,4).join('|'),m[4]]));
 result.table.datasets[1].columns.forEach((col,i)=>col.values.forEach((v,r)=>{
  const key=`${r+1}|2|${i+1}`;
  if(Number.isFinite(v)){assert.equal(Number(cells.get(key)),v);exact++;}else assert(!cells.has(key));
 }));
 // Styling and analysis settings are untouched; Prism recalculates from selected observations.
 const original=unzip(seed);
 for(const name of Object.keys(original).filter(n=>n.startsWith('graphs/')||n.startsWith('analyses/')))assert.deepEqual(files[name],original[name],name);
 assert(result.script.includes('RecalcAll'));assert.equal(native.availability(series).available,true);
 assert.match(result.provenance.native_notes.join(' '),/native Prism 11 confirmation is pending/);
 if(series[0]===reference)fs.writeFileSync('/tmp/atlas-prism-96-test.zip',native.zip([...result.entries,{name:'Atlas_Input.prism',data:native.populateInput(seed,result.table,result.provenance)}]));
}
assert.equal(JSON.stringify(measured),before);
const tooMany=structuredClone(reference);tooMany.doses[0].components[0].well_values.push(1);
assert.equal(native.availability([tooMany]).count,97);assert.equal(native.availability([tooMany]).available,false);
assert.throws(()=>native.build([tooMany]),/96 observations/);
console.log(`PASS: 96 native replicate definitions, 97 table columns, ${exact} exact observation checks across both series orders, missing blanks, unchanged graph/4PL setup, 97-column guard and source immutability`);
