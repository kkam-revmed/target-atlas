// Independent audit of stored dose statistics; does not use Atlas mean/SD helpers.
// Some datasets expose the same source observations in different views. Counts
// below are checked stored rows, not unique experiments or biological replicates.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const expectedScope={
 'cyclind1-bio1-A.json':3070,'cyclind1-bio2-A.json':3070,'cyclind1-bio2-B.json':3070,'cyclind1.json':3070,
 'cypa-dependency.json':12280,
 'orientation-rep1-gds.json':560,'orientation-rep1-ratio.json':560,'orientation-rep2-gds.json':560,'orientation-rep2-ratio.json':560,
 'sample.json':1120,'selectivity-rep2.json':1120
};
const tolerance=1e-7,results=[],skippedFiles=[];
let totalRows=0,totalWells=0,skippedDoseRows=0,curvesWithoutDoses=0;
function near(actual,expected,label){
 assert(Number.isFinite(actual),label+' must be a finite supplied value');
 assert(Math.abs(actual-expected)<=tolerance*Math.max(1,Math.abs(expected)),`${label}: supplied ${actual}; independently calculated ${expected}`);
}
for(const file of fs.readdirSync(root).filter(name=>name.endsWith('.json')).sort()){
 const data=JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
 if(!Array.isArray(data.curves)){skippedFiles.push({file,reason:'No top-level curves array; not a stored dose-summary dataset'});continue;}
 assert(Object.hasOwn(expectedScope,file),'New curve dataset requires explicit audit-scope review: '+file);
 const row={file,curves:data.curves.length,checkedDoseRows:0,checkedWells:0,numericWells:0,normalizedObjectWells:0,skippedDoseRows:0};
 for(const q of data.curves){
  if(!Array.isArray(q.doses)){curvesWithoutDoses++;continue;}
  for(const d of q.doses){
   const label=`${file}: ${q.compound} / ${q.target||data.target||'target unspecified'} / ${d.x} µM`;
   if(!Array.isArray(d.wells)||!d.wells.length){row.skippedDoseRows++;skippedDoseRows++;continue;}
   const values=d.wells.map(w=>{
    if(typeof w==='number'){row.numericWells++;assert(Number.isFinite(w),label+' has nonfinite numeric well');return w;}
    row.normalizedObjectWells++;assert(w&&Number.isFinite(w.normalized),label+' has an unsupported or nonfinite normalized well');return w.normalized;
   });
   const mean=values.reduce((sum,v)=>sum+v,0)/values.length;
   const sd=values.length>1?Math.sqrt(values.reduce((sum,v)=>sum+(v-mean)**2,0)/(values.length-1)):null;
   near(d.mean,mean,label+' mean');assert.equal(d.n,values.length,label+' n must exactly count included wells');
   if(sd===null)assert(d.sd==null,label+' SD must be unavailable for one well');else near(d.sd,sd,label+' sample SD');
   row.checkedDoseRows++;row.checkedWells+=values.length;
  }
 }
 assert.equal(row.checkedDoseRows,expectedScope[file],file+' audited row coverage changed');
 results.push(row);totalRows+=row.checkedDoseRows;totalWells+=row.checkedWells;
}
assert.deepEqual(results.map(r=>r.file).sort(),Object.keys(expectedScope).sort(),'All expected curve datasets were checked');
assert.equal(totalRows,29040);assert.equal(skippedDoseRows,0);assert.equal(curvesWithoutDoses,0);
console.log(JSON.stringify({tolerance:'absolute difference <= 1e-7 * max(1, abs(expected)); n exact',datasets:results,skippedFiles,totalRows,totalWells,skippedDoseRows,curvesWithoutDoses},null,2));
console.log('PASS: 29,040 stored dose rows independently reproduce mean, sample SD (n-1) and n across 11 explicitly scoped datasets. Other JSON files have no top-level dose curves; repeated source views are not independent observations.');
