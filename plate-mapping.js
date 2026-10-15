/* User-confirmed physical plate assignments for EXP26007301. */
(function(root){
 const targets={A:'Cyclin D3',B:'Cyclin E1',C:'Cyclin K',D:'CDK4'};
 const note='EXP26007301: target assignments follow the confirmed physical plate key A = Cyclin D3, B = Cyclin E1, C = Cyclin K, D = CDK4 for plates 01 and 02. Parameter reports follow their matched original well groups; original labels are retained for traceability. Replicate 1 had reversed 02A/02B labels; replicate 2 labels match the physical plate key.';
 function assignment(id){const m=/^Cyclins-28-0([12])([ABCD])$/.exec(id||'');return m?{target:targets[m[2]],transfection:targets[m[2]]+' Plate '+m[1]}:null;}
 function apply(inputs){
  const records=inputs.flatMap(f=>f.raw_plate_records||[]),lookup=new Map();
  for(const r of records){const a=assignment(r.plate_id);if(!a||!r.compound||r.well_type!=='Sample')continue;const k=JSON.stringify([r.compound,r.source_transfection??r.transfection]);const prev=lookup.get(k);if(prev&&prev.transfection!==a.transfection)throw new Error('Ambiguous physical plate assignment for '+r.compound);lookup.set(k,a);}
  function mapped(r,a){return a?{...r,source_target:r.source_target??r.target,source_transfection:r.source_transfection??r.transfection,...a}:r;}
  return inputs.map(f=>({...f,wells:(f.wells||[]).map(r=>mapped(r,lookup.get(JSON.stringify([r.compound,r.source_transfection??r.transfection])))),parameters:(f.parameters||[]).map(r=>mapped(r,lookup.get(JSON.stringify([r.compound,r.source_transfection??r.transfection])))),raw_plate_records:(f.raw_plate_records||[]).map(r=>mapped(r,assignment(r.plate_id))),notes:[...new Set([...(f.notes||[]),...(lookup.size?[note]:[])])]}));
 }
 root.AtlasPlateMapping={apply,assignment,note};if(typeof module!=='undefined')module.exports=root.AtlasPlateMapping;
})(globalThis);
