/* Cross-campaign comparisons match full Compound Management IDs, never batch suffixes alone. */
(function(root){
 'use strict';
 const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const base=id=>String(id).replace(/-\d{3,}$/,'');
 const batch=id=>/-([0-9]{3,})$/.exec(String(id))?.[1]||'Unspecified';
 const number=v=>Number.isFinite(v)?v.toLocaleString('en-US',{maximumFractionDigits:3}):'Not reported';
 const potency=r=>Number.isFinite(r?.ec50)?[r.qualifier,Number(r.ec50).toPrecision(3),'µM'].filter(Boolean).join(' '):'Not reported';
 function join(left,right){
  return left.map(q=>{
   const matches=right.filter(r=>r.compound===q.compound);
   const otherBatches=[...new Set(right.filter(r=>base(r.compound)===base(q.compound)&&r.compound!==q.compound).map(r=>r.compound))];
   // Multiple source records need an explicit run/condition choice, never an arbitrary first result.
   const match=matches.length===1?matches[0]:null;
   return {left:q,right:match,otherBatches,status:match?'Exact batch match':matches.length>1?'Multiple source records — choose a specific run':otherBatches.length?'Different batch only':'Not present in comparison source'};
  });
 }
 function source(r){return [r.source,r.source_sheet,r.source_row!=null?'row '+r.source_row:'',r.source_range,r.physical_plate].filter(Boolean).join(' · ');}
 function details(label,r){return `<strong>${escape(label)}</strong><div>Original source ID: ${escape(r.source_compound||r.compound)}</div><div>${escape(source(r)||'Source not specified')}</div><div>Cmax basis: ${escape(r.cmax_basis||'Not specified')}</div><div>Classification: ${escape(r.source_mode||'Not reported')} · QC: ${escape(r.source_qc||'No source QC flag')} · Valid: ${escape(r.source_valid||'Not reported')}</div>`;}
 function table(rows,leftLabel,rightLabel){
  return `<table class="campaign-comparison-table"><thead><tr><th rowspan="2">Compound</th><th colspan="3">${escape(leftLabel)}</th><th colspan="3">${escape(rightLabel)}</th><th rowspan="2">Match / source details</th></tr><tr><th>Batch</th><th>Cmax</th><th>EC50 (µM)</th><th>Batch</th><th>Cmax</th><th>GDS EC50 (µM)</th></tr></thead><tbody>${rows.map(({left:l,right:r,status,otherBatches})=>`<tr data-comparison-compound="${escape(l.compound)}"><td><button type="button" class="compound-link" data-compound="${escape(l.compound)}" data-target="${escape(l.target)}">${escape(base(l.compound))}</button></td><td>${escape(batch(l.compound))}</td><td class="num">${number(l.cmax)}</td><td>${escape(potency(l))}</td><td>${r?escape(batch(r.compound)):'—'}</td><td class="num">${r?number(r.cmax):'Unavailable'}</td><td>${r?escape(potency(r)):'Unavailable'}</td><td><span class="campaign-match ${r?'':'campaign-missing'}">${escape(status)}</span>${otherBatches.length&&!r?`<div>Available source ID: ${otherBatches.map(escape).join(', ')}. Its values are not substituted.</div>`:''}<details><summary>Values, QC and provenance</summary><div>${details(leftLabel,l)}</div>${r?`<div>${details(rightLabel,r)}</div>`:''}</details></td></tr>`).join('')}</tbody></table>`;
 }
 const fields=['benchling_id','biological_replicate','run_date','condition','response_source','target','compound','source_compound','physical_plate','cmax','cmax_basis','ec50','qualifier','source_mode','source_qc','source_valid','source','source_sheet','source_row','source_range','ec50_band','cmax_cutoff'];
 function csv(rows,leftContext,rightContext){
  const headers=['match_status','other_source_batches',...fields.map(k=>'selectivity_'+(k==='ec50'?'ec50_um':k)),...fields.map(k=>'cyclind1_'+(k==='ec50'?'ec50_um':k))];
  const records=rows.map(({left,right,status,otherBatches})=>{
   const l={...leftContext,...left},r={...rightContext,...(right||{})};
   return [status,otherBatches.join('; '),...fields.map(k=>l[k]),...fields.map(k=>r[k])];
  });
  return [headers,...records].map(row=>row.map(v=>{if(v==null)return '';let s=String(v);if(typeof v==='string'&&/^[=+\-@]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';}).join(',')).join('\r\n');
 }
 let pending;
 async function loadSource(){
  if(!pending)pending=fetch('./cyclind1-source-parameters.json').then(r=>{if(!r.ok)throw new Error('Cyclin D1/CypA source could not be loaded.');return r.json();}).catch(e=>{pending=null;throw e;});
  return (await pending).map(r=>({...r,cmax_basis:'Reported Activity (cmax)'}));
 }
 const api={join,table,csv,loadSource};root.AtlasCampaignComparison=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
