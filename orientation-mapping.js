/* EXP26007104: configuration is an assay dimension, not a different protein target. */
(function(root){
 const configurations=[
  {code:'A',target:'A · NLN/HTC',nanoluc:'N terminus (NLN)',halotag:'C terminus (HTC)'},
  {code:'B',target:'B · NLN/HTN',nanoluc:'N terminus (NLN)',halotag:'N terminus (HTN)'},
  {code:'C',target:'C · NLC/HTN',nanoluc:'C terminus (NLC)',halotag:'N terminus (HTN)'},
  {code:'D',target:'D · NLC/HTC',nanoluc:'C terminus (NLC)',halotag:'C terminus (HTC)'}
 ];
 function fromAnnotation(s){const nl=/\b(NLN|NLC)\b/i.exec(s||'')?.[1].toUpperCase(),ht=/\b(HTN|HTC)\b/i.exec(s||'')?.[1].toUpperCase();return configurations.find(c=>c.target.endsWith(nl+'/'+ht));}
 function apply(inputs){return inputs.map(f=>{
  if(!/EXP26007104/i.test(f.name||''))return f;
  function map(r){const a=fromAnnotation(r.source_transfection||r.transfection);if(!a){if(!r.transfection)return r;throw new Error('Unknown orientation annotation: '+r.transfection);}const plate=/Cyclin-14-01([ABCD])$/.exec((r.plate_id||'').trim());if(plate&&plate[1]!==a.code)throw new Error('Plate/configuration mismatch for '+r.plate_id);return {...r,source_target:r.source_target||r.target,source_transfection:r.source_transfection||r.transfection,target:a.target,transfection:a.target,configuration:a.code};}
  return {...f,wells:(f.wells||[]).map(map),parameters:(f.parameters||[]).map(map),raw_plate_records:(f.raw_plate_records||[]).map(map),notes:[...(f.notes||[]),'EXP26007104 configurations: A NLN/HTC; B NLN/HTN; C NLC/HTN; D NLC/HTC. NanoLuc tags are on Cyclin D1; HaloTag tags are on CypA. Source annotations and the user-provided plate key agree.']};
 });}
 root.AtlasOrientationMapping={configurations,fromAnnotation,apply};if(typeof module!=='undefined')module.exports=root.AtlasOrientationMapping;
})(globalThis);
