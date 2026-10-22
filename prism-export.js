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
  const provenance={format:'Target Atlas Prism data export',version:1,concentration_unit:'µM',project_title:projectTitle,context,notes,observations:observations.datasets.map(d=>({series_id:d.series_id,title:d.title,subcolumns:d.columns.map(c=>({title:c.label,source_series_id:c.source_series_id}))})),series:series.map(q=>({...q,doses:(q.doses||[]).map(d=>({...d}))}))};
  const tables=[observations,summaries],readme=notes.join('\n\n');
  const pzfx='<?xml version="1.0" encoding="UTF-8"?>\n<GraphPadPrismFile PrismXMLVersion="5.00">'+
   '<InfoSequence><Ref ID="Info0" Selected="1"/></InfoSequence><TableSequence>'+tables.map((_,i)=>`<Ref ID="Table${i}"${i===0?' Selected="1"':''}/>`).join('')+'</TableSequence>'+
   '<Info ID="Info0"><Title>Atlas selection, methods and provenance</Title><Notes>'+xml(readme+'\n\n'+JSON.stringify(provenance,null,2))+'</Notes></Info>'+tables.map(tableXML).join('')+'</GraphPadPrismFile>\n';
  return {tables,pzfx,tsv:delimited(observations,'\t'),csv:delimited(observations,','),provenance,readme};
 }
 function save(text,name,type){const url=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 function download(series,name='target-atlas-prism',options={}){const result=build(series,options);save(result.pzfx,name.replace(/[^a-z0-9._-]/gi,'_')+'.pzfx','application/xml;charset=utf-8');return result;}
 const api={build,download};root.AtlasPrismExport=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
