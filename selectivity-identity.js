/* Scoped identity correction for the confirmed EXP26007301 physical plate layout.
 * Call only for that experiment. Original source labels and numeric arrays stay intact.
 */
(function(root){
  'use strict';
  const canonical='RMC-0741051-001',aliases=new Set([canonical,'RMC-0741051-002']);
  const targetLetters={'Cyclin D3':'A','Cyclin E1':'B','Cyclin K':'C','CDK4':'D'};
  const note='User-confirmed EXP26007301 identity: RMC-0741051 on physical plate groups 1 and 2 is the same batch -001. Source label -002 distinguishes its plate-2 reading, not a separate batch. Measurements stay separate by physical plate; no values are pooled.';
  const isReference=record=>aliases.has(record?.source_compound||record?.compound);
  function plateNumber(record){
    if(record?.plate_number===1||record?.plate_number===2)return record.plate_number;
    const physical=/^Cyclins-28-0?([12])[ABCD]$/i.exec(String(record?.physical_plate||record?.plate_id||''));
    if(physical)return Number(physical[1]);
    const transfection=/\bPlate\s*([12])\b/i.exec(String(record?.transfection||''));
    if(transfection)return Number(transfection[1]);
    // These are the two fixed, confirmed source aliases, not a general suffix rule.
    const source=record?.source_compound||record?.compound;
    return source===canonical?1:source==='RMC-0741051-002'?2:null;
  }
  function annotate(record,parent={}){
    const source=record.source_compound??record.compound,number=plateNumber(record)??parent.plate_number??null;
    const letter=targetLetters[record.target??parent.target];
    const physical=record.physical_plate??record.plate_id??(number&&letter?`Cyclins-28-0${number}${letter}`:parent.physical_plate??null);
    const result={...record,source_compound:source,plate_number:number,physical_plate:physical};
    if(isReference(record)){result.compound=canonical;result.identity_note=note;}
    return result;
  }
  function prepare(data,{referencePlate='all'}={}){
    referencePlate=String(referencePlate);
    if(!['all','1','2'].includes(referencePlate))throw new Error('Reference plate must be 1, 2 or all.');
    const keep=record=>!isReference(record)||referencePlate==='all'||plateNumber(record)===Number(referencePlate);
    const curves=(data.curves||[]).filter(keep).map(record=>{
      const result=annotate(record);
      if(record.report)result.report=annotate(record.report,result);
      if(record.unassigned_report)result.unassigned_report=annotate(record.unassigned_report,result);
      return result;
    });
    const compounds=[...new Set(curves.map(record=>record.compound))].sort();
    // Existing PCA coordinates are source values. Select the matching original
    // reference point before renaming it; never combine or refit coordinates.
    // The all-plates catalog retains plate 1 as its single reference PCA point.
    const pointPlate=referencePlate==='all'?1:Number(referencePlate);
    const keepPoint=record=>!isReference(record)||plateNumber(record)===pointPlate;
    const pca=data.pca?{...data.pca,points:(data.pca.points||[]).filter(keepPoint).map(record=>annotate(record)),identity_note:`${note} Existing PCA coordinates and variance are retained from the source analysis. Reference PCA point uses plate ${pointPlate}.`}:data.pca;
    const cluster_order=[...new Set((data.cluster_order||compounds).filter(compound=>keepPoint({compound})).map(compound=>aliases.has(compound)?canonical:compound))].filter(compound=>compounds.includes(compound));
    const plate_qc=data.plate_qc?{...data.plate_qc,plates:(data.plate_qc.plates||[]).map(plate=>({...plate,wells:(plate.wells||[]).map(well=>annotate(well,plate))}))}:data.plate_qc;
    const notes=(data.notes||[]).filter(value=>!String(value).startsWith('User-confirmed EXP26007301 identity:')&&!String(value).startsWith('Selectivity reference plate selection:'));
    notes.push(note,`Selectivity reference plate selection: ${referencePlate==='all'?'all physical plates (separate measurements)':`physical plate group ${referencePlate}`}. ${compounds.length} unique compound IDs; ${curves.length} compound–target–plate curves. All raw plate wells remain available.`);
    return {...data,curves,compounds,cluster_order,pca,plate_qc,notes,reference_plate:referencePlate,identity_note:note,wells_total:curves.reduce((sum,record)=>sum+(Number(record.n_wells)||0),0),wells_excluded:curves.reduce((sum,record)=>sum+(Number(record.excluded_wells)||0),0)};
  }
  const api={prepare,canonical,identityNote:note};
  root.AtlasSelectivityIdentity=api;
  if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
