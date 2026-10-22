/* Prism XML data tables. Never fabricates Prism graph/analysis objects or changes source data. */
(function(root){
 'use strict';
 const finite=Number.isFinite;
 const xml=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
 const clean=v=>finite(v)?v:null;
 const title=q=>[q.series_label||q.compound,q.benchling_id,q.condition_label,q.plate_group?'Plate/group '+q.plate_group:null].filter(Boolean).join(' · ');
 function observationColumns(q){
  const doses=q.doses||[],biological=!!q.summary_components&&q.summary_kind!=='pooled_wells',pooled=q.summary_kind==='pooled_wells';
  const components=[...new Map(doses.flatMap(d=>(d.components||[]).map(c=>[c.series_id,c]))).values()];
  if(biological)return components.map(c=>({label:'Biological replicate '+c.replicate,source_series_id:c.series_id,values:doses.map(d=>clean(d.components?.find(v=>v.series_id===c.series_id)?.mean))}));
  if(pooled&&components.some(c=>doses.some(d=>d.components?.find(v=>v.series_id===c.series_id)?.well_values?.length))){
   return components.flatMap(c=>Array.from({length:Math.max(0,...doses.map(d=>d.components?.find(v=>v.series_id===c.series_id)?.well_values?.length||0))},(_,i)=>({label:'Biological replicate '+c.replicate+' · technical well slot '+(i+1),source_series_id:c.series_id,values:doses.map(d=>clean(d.components?.find(v=>v.series_id===c.series_id)?.well_values?.[i]))})));
  }
  const count=Math.max(0,...doses.map(d=>d.wells?.length||0));
  if(count)return Array.from({length:count},(_,i)=>({label:(pooled?'Pooled well':'Technical well')+' slot '+(i+1),values:doses.map(d=>clean(d.wells?.[i]))}));
  // A supplied mean is retained as a mean, never represented as an individual well.
  return [{label:'Supplied dose mean · individual wells unavailable',values:doses.map(d=>clean(d.mean))}];
 }
 function aligned(columns,doses,x){
  const positions=new Map();
  doses.forEach((d,i)=>{if(!finite(d.x))return;if(positions.has(d.x))throw new Error('Duplicate concentration within one series; keep source series separate before exporting.');positions.set(d.x,i);});
  return columns.map(c=>({...c,values:x.map(v=>positions.has(v)?c.values[positions.get(v)]:null)}));
 }
 function tableXML(table,index){
  // Prism 7+ uses HugeTable when the old 52-subcolumn limit is exceeded.
  const count=Math.max(1,...table.datasets.map(d=>d.columns.length)),tag=count>52?'HugeTable':'Table';
  const sub=(column)=>'<Subcolumn>'+ (column.label?'<Title>'+xml(column.label)+'</Title>':'')+column.values.map(v=>finite(v)?'<d>'+String(v)+'</d>':'<d/>').join('')+'</Subcolumn>';
  return `<${tag} ID="Table${index}" XFormat="numbers" YFormat="${table.format}" Replicates="${count}" TableType="XY" EVFormat="AsteriskAfterNumber"><Title>${xml(table.title)}</Title><XColumn Width="100" Decimals="9" Subcolumns="1"><Title>Concentration (µM)</Title>${sub({values:table.x})}</XColumn>`+table.datasets.map(d=>`<YColumn Width="100" Decimals="9" Subcolumns="${count}"><Title>${xml(d.title)}</Title>`+Array.from({length:count},(_,i)=>sub(d.columns[i]||{label:'Unused subcolumn',values:table.x.map(()=>null)})).join('')+'</YColumn>').join('')+`</${tag}>`;
 }
 function delimited(table,separator){
  const count=Math.max(1,...table.datasets.map(d=>d.columns.length));
  const headers=['Concentration (µM)',...table.datasets.flatMap(d=>Array.from({length:count},(_,i)=>d.title+' · '+(d.columns[i]?.label||'Unused subcolumn')))];
  const rows=table.x.map((x,r)=>[x,...table.datasets.flatMap(d=>Array.from({length:count},(_,i)=>d.columns[i]?.values[r]??null))]);
  const cell=v=>v==null?'':typeof v==='number'?String(v):'"'+String(v).replaceAll('"','""')+'"';
  return [headers,...rows].map(r=>r.map(cell).join(separator)).join('\r\n')+'\r\n';
 }
 function datasetLetter(index){let name='';for(let n=index+1;n>0;n=Math.floor((n-1)/26))name=String.fromCharCode(65+(n-1)%26)+name;return name;}
 function columnGuide(table,series,{native=false,context={}}={}){
  const unknown='Not supplied',map=[],sections=[];
  const slots=Math.max(native?48:1,...table.datasets.map(d=>d.columns.length));
  table.datasets.forEach((dataset,i)=>{
   const q=series[i],letter=datasetLetter(i),biological=!!q.summary_components&&q.summary_kind!=='pooled_wells';
   const columns=dataset.columns.map((column,j)=>{
    const member=q.summary_components?.find(c=>c.series_id===column.source_series_id)||q;
    const fallback=column.label.startsWith('Supplied dose mean'),kind=biological?'Biological-run mean':fallback?'Supplied dose mean':'Individual well value';
    const entry={prism_column:letter+':Y'+(j+1),dataset:letter,series_title:dataset.title,observation:column.label,observation_type:kind,
     biological_replicate:member.biological_replicate??member.replicate??unknown,run_date:member.run_date??member.measurement_date??unknown,
     benchling_id:q.benchling_id??unknown,compound_batch:q.compound??unknown,target:q.target??unknown,condition:q.condition_label??unknown,
     plate_group:q.plate_group??unknown,physical_plate:member.physical_plate??unknown,source_compound:member.source_compound??unknown,
     source_series_id:column.source_series_id??q.series_id??unknown,source_files:(member.sources||q.sources||[]).join('; ')||unknown,
     populated_doses:column.values.filter(finite).length,missing_doses:column.values.filter(v=>!finite(v)).length};
    map.push(entry);
    return `${entry.prism_column} = ${kind}; ${column.label}; run ${entry.biological_replicate}; date ${entry.run_date}; plate ${entry.physical_plate}. ${entry.populated_doses} populated dose rows${entry.missing_doses?'; '+entry.missing_doses+' blank dose rows':''}.`;
   });
   const method=biological?'One technical-well mean per biological run and concentration. The displayed mean gives each contributing run equal weight; sample SD is between run means; n counts runs.':q.summary_kind==='pooled_wells'?'Each included well is a separate observation. The displayed mean and sample SD pool wells across runs; n counts wells. Runs with more wells contribute more. These wells are not independent biological replicates.':dataset.columns[0]?.label.startsWith('Supplied dose mean')?'Only supplied dose means are available. These are not individual wells; one mean per dose cannot reconstruct technical variability.':'Each subcolumn contains a well value at that concentration. The displayed mean and sample SD are within this run; n counts wells. Compare biological runs keeps separate run datasets and does not turn these bars into between-run SD.';
   sections.push(`DATASET ${letter}: ${dataset.title}\nCompound/batch: ${q.compound||unknown}\nAssay/target: ${q.target||unknown}\nBenchling ID: ${q.benchling_id||unknown}\nCondition: ${q.condition_label||unknown}\nPlate group: ${q.plate_group||unknown}\n${method}\n${columns.join('\n')}`+(dataset.columns.length<slots?`\n${letter}:Y${dataset.columns.length+1}${dataset.columns.length+1<slots?' through '+letter+':Y'+slots:''} = unused template slots; blank, not extra replicates.`:''));
  });
  const intro=[
   'ATLAS COLUMN GUIDE & ANALYSIS',
   'Read this sheet alongside the Selected observations table. A, B, C identify separate selected datasets; Y1, Y2, etc. identify observation subcolumns inside that dataset. Y1 does NOT automatically mean biological replicate 1. The exact map for this export is below.',
   'Selected display mode: '+({technical:'Compare technical wells',individual:'Compare biological runs (technical means)',summary:'Combine biological means',pooled:'Combine technical + biological wells'}[context.display_mode]||'See the dataset-specific input descriptions below')+'.',
   native?'X = log10 concentration in molar units: log10(concentration in µM) - 6. Thus -6 = 1 µM and -5 = 10 µM. Each row is one tested concentration.':'X = concentration in µM. Each row is one tested concentration; these X values are not already log-transformed.',
   'Y = exported response values on the supplied measurement basis. '+(context.response_basis?'Source basis: '+context.response_basis+'. ':'')+'Atlas does not renormalize values during export. The NanoBRET normalized response (%) label is a presentation label; source context is retained in provenance.',
   'Technical well slots follow source value order at each concentration. They are not matched subjects across concentrations. Physical well coordinates are not retained in this plotted-value export, so a slot cannot be interpreted as a coordinate such as B03. Blank cells mean missing or unused, never zero. No concentrations are interpolated.',
   'Mean = arithmetic average. Sample SD = sqrt(sum((value - mean)^2)/(n - 1)); no SD with fewer than two observations. SD describes spread, not SEM, a confidence interval or a significance test. In biological-mean mode the values in this formula are run means; in well modes they are well values.',
   'The D1/CypA RMC-0741051 reference can already contain up to 48 wells per dose across plates within one run. Two pooled runs can contribute 96 wells, but still only two biological runs. Separately supplied plate groups, assays, batches and conditions are not merged.',
   native?'PRISM ANALYSIS: Prism recalculates an independent agonist 4PL for each dataset using unweighted least squares on its nonblank exported observations. Bottom, Top, LogEC50 and HillSlope are free; no baseline is fixed at 100%. Y = Bottom + (Top - Bottom)/(1 + 10^((LogEC50 - X)*HillSlope)). Bottom and Top are fitted response plateaus, HillSlope controls steepness, and LogEC50 is log10(EC50 in M). EC50 in µM = 10^(LogEC50 + 6). This is not a GDS-reported fit.':'ANALYSIS: This data-only .pzfx contains tables, not a Prism analysis or graph. The other table, Displayed mean, SD and n, preserves the Atlas summaries. Its columns mean exactly Mean, Sample SD and n; they are not three observations.',
   native?'FIT INPUTS: Biological-mean mode fits the separate run means; well modes fit individual exported wells. All observations have equal weight, so a dose with more observations contributes more to the fit. Atlas combined-mode fits instead use one displayed mean per concentration. Prism and Atlas EC50 values can therefore differ. Inspect Prism Results for convergence, warnings and confidence intervals; a smooth line does not establish a reliable EC50.':'Reported GDS and Atlas independent fits are retained as provenance only; no fitted parameters are imported as Prism results.',
   native?'GRAPH ERROR BARS: The native graph inherits the Prism template settings. Check Format Graph to confirm SD versus SEM before presenting. Do not infer this from the appearance of the bars. Exact Atlas mean, sample SD and n are in the companion selected-data.pzfx.':'The sample size n counts the units described for each dataset below, not necessarily independent biological replicates.'
  ];
  const text=[...intro,...sections].join('\n\n');
  const keys=Object.keys(map[0]||{}),cell=v=>'"'+String(v??'').replaceAll('"','""')+'"';
  const csv=[keys,...map.map(row=>keys.map(k=>row[k]))].map(row=>row.map(cell).join(',')).join('\r\n')+'\r\n';
  return {text,map,csv};
 }
 function build(series,{title:projectTitle='Target Atlas selected comparison',context={}}={}){
  if(!Array.isArray(series)||!series.length)throw new Error('Choose at least one measured series before exporting to Prism.');
  const x=[...new Set(series.flatMap(q=>(q.doses||[]).map(d=>d.x).filter(finite)))].sort((a,b)=>a-b);
  if(!x.length)throw new Error('No finite concentration values are available for this selection.');
  const observations={title:'Selected observations · '+projectTitle,format:'replicates',x,datasets:series.map(q=>({series_id:q.series_id,title:title(q),columns:aligned(observationColumns(q),q.doses||[],x)}))};
  const summaries={title:'Displayed mean, SD and n · '+projectTitle,format:'SDN',x,datasets:series.map(q=>({series_id:q.series_id,title:title(q)+' · '+(q.error_bar_basis||'Supplied SD'),columns:aligned(['mean','sd','n'].map(key=>({label:key==='mean'?'Mean':key==='sd'?'Sample SD':'n',values:(q.doses||[]).map(d=>clean(d[key]))})),q.doses||[],x)}))};
  const notes=[
   'Data-only Prism XML export. Open the .pzfx file in Prism 11. No Prism graphs, analyses, fitted parameters or styling are created by this file.',
   'Selected observations contains supplied wells, biological-run means, or pooled wells according to the chosen Atlas comparison. The second table preserves the displayed mean, SD and n.',
   'Technical well slots identify subcolumns at each concentration, not paired subjects or matched technical replicates across concentrations. Do not enable repeated-measures pairing on this basis.',
   'Biological mean mode uses one mean per biological run. Pooled-well mode gives each well equal weight; its n is wells, not independent biological replicates.',
   'Conditions, batches, assays and plate groups are separate Y datasets. Missing measurements are blank, never zero. Source values are not rounded; Decimals controls display only.',
   'Zero or negative concentrations are retained in the tables. They cannot be placed on a logarithmic X axis. No doses are interpolated.',
   'Reported GDS fits, supplied independent fits and derived fits remain in provenance only. Run a Prism analysis using an agreed model/template; Atlas does not claim its fit settings equal Prism defaults.',
   'All selected concentrations are exported, including those outside custom graph axis limits. No experimental files are uploaded.',
   'The exact source labels and measurement context are embedded below as JSON. Original workbook archives are not included.'
  ];
  const guide=columnGuide(observations,series,{context});
  const provenance={format:'Target Atlas Prism data export',version:1,concentration_unit:'µM',project_title:projectTitle,context,notes,column_map:guide.map,observations:observations.datasets.map(d=>({series_id:d.series_id,title:d.title,subcolumns:d.columns.map(c=>({title:c.label,source_series_id:c.source_series_id}))})),series:series.map(q=>({...q,doses:(q.doses||[]).map(d=>({...d}))}))};
  const tables=[observations,summaries],readme=notes.join('\n\n');
  const pzfx='<?xml version="1.0" encoding="UTF-8"?>\n<GraphPadPrismFile PrismXMLVersion="5.00">'+
   '<InfoSequence><Ref ID="Info0" Selected="1"/></InfoSequence><TableSequence>'+tables.map((_,i)=>`<Ref ID="Table${i}"${i===0?' Selected="1"':''}/>`).join('')+'</TableSequence>'+
   '<Info ID="Info0"><Title>Atlas column guide and analysis</Title><Notes>'+xml(readme+'\n\n'+guide.text+'\n\nFULL SOURCE PROVENANCE\n'+JSON.stringify(provenance,null,2))+'</Notes></Info>'+tables.map(tableXML).join('')+'</GraphPadPrismFile>\n';
  return {tables,pzfx,tsv:delimited(observations,'\t'),csv:delimited(observations,','),provenance,readme};
 }
 function save(text,name,type){const url=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 function download(series,name='target-atlas-prism',options={}){const result=build(series,options);save(result.pzfx,name.replace(/[^a-z0-9._-]/gi,'_')+'.pzfx','application/xml;charset=utf-8');return result;}
 const api={build,download,columnGuide,observationCount:q=>observationColumns(q).length};root.AtlasPrismExport=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
