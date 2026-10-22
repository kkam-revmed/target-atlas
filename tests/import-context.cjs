const assert=require('node:assert/strict');
require('../parse.js');require('../engine.js');
const parse=text=>AtlasInput.parse({name:'audit-input.csv',bytes:Buffer.from(text)});
const header='compound,target,concentration_um,response,biological_replicate,condition,plate_id';
(async()=>{
 for(const rows of [
  ['C-001,T,1,100,1,A,P1','C-001,T,1,200,2,B,P1'],
  ['C-001,T,1,100,1,A,P1','C-001,T,1,200,1,A,P2'],
  ['C-001,T,1,100,1,A,P1','D-001,T,1,200,2,A,P1'],
  ['C-001,T,1,100,1,A,P1','C-001,T,1,200,,A,P1']
 ])await assert.rejects(parse(header+'\n'+rows.join('\n')),/Import each biological run.*No rows from this file were imported/);
 const single=await parse(header+'\nC-001,T,1,100,1,A,P1\nD-001,T,1,200,1,A,P1');
 assert.equal(single.wells.length,2);assert.deepEqual(single.wells[0].import_context,{biological_run:'1',condition:'A',plate:'P1'});
 assert(single.notes[0].includes('biological_run=1'));assert(single.wells[0].transfection.includes('P1'));
 const analyzed=AtlasCore.analyze([{name:'audit-input.csv',...single}]);
 assert.equal(analyzed.curves.length,2);assert.equal(analyzed.curves[0].doses[0].mean,100);assert.equal(analyzed.curves[1].doses[0].mean,200);
 // Different explicit contexts in separate input files must not be pooled either.
 const other=await parse(header+'\nC-001,T,1,200,2,A,P1');
 assert.throws(()=>AtlasCore.analyze([{name:'one.csv',...single},{name:'two.csv',...other}]),/multiple transfection groups.*separately/);
 const original=await parse('compound,target,concentration_um,response,replicate\nC-001,T,1,100,well1\nC-001,T,1,200,well2');
 assert.equal(original.wells[0].transfection,'T');assert.deepEqual(original.wells.map(w=>w.replicate),['well1','well2']);assert.deepEqual(original.notes,[]);
 assert.equal(AtlasCore.analyze([{name:'technical.csv',...original}]).curves[0].doses[0].mean,150);
 const aliases=await parse('compound,target,concentration_um,response,Biological replicate,condition_code,physical_plate\nC-001,T,1,100,1,A,P1');
 assert.equal(aliases.wells[0].transfection,single.wells[0].transfection,'Equivalent column aliases retain equivalent context');
 await assert.rejects(parse('compound,target,concentration_um,response,biological_replicate,run_id\nC-001,T,1,100,1,2'),/conflicting biological_run context.*No rows/);
 const d1csv=await parse('compound,target,concentration_um,response\nRMC-0741051-001,Cyclin D1/CypA,1,100');
 const local=AtlasCore.analyze([{name:'audit-input.csv',...d1csv}]);
 assert(!local.curves[0].is_reference,'A compound/target name alone cannot establish its reference role');
 assert(!local.curves[0].curve_note);assert(!local.notes.some(note=>/24 source plates|B-plate inhibitor|Positive reference/.test(note)));
 const sourceName='EXP26003438_CyclinD1_plate.xlsx';
 const raw=[{compound:'RMC-0741051-001',plate_id:'P1',source:sourceName}];
 const gds=AtlasCore.analyze([{name:sourceName,...d1csv,raw_plate_records:raw}]);
 assert(gds.curves[0].is_reference);assert(gds.curves[0].curve_note.includes('one supplied source plate'));
 const multi=AtlasCore.analyze([{name:sourceName,...d1csv,raw_plate_records:[...raw,{...raw[0],plate_id:'P2'}]}]);
 assert(multi.curves[0].curve_note.includes('2 supplied source plates'));
 console.log('PASS: mixed runs/conditions/plates and missing context rejected; same-context compounds separate; explicit metadata retained; cross-file contexts cannot pool; technical replicate labels unchanged');
})().catch(e=>{console.error(e);process.exitCode=1;});
