(function(root){
  'use strict';
  const batches=root.AtlasCompoundBatches||(typeof require==='function'?require('./compound-batches.js'):null);
  const categories=['gds_parameters','nanobret_summary','nanobret_doses','atlas_refits','kd1','tr_fret','primary_screen','source_summary','crosslinking'];
  // A context is a descriptive alignment, not a pooled estimate or an inferred replicate pair.
  // Plate/well/source-row identifiers stay attached to every individual value on each side.
  const matchingFields=['category','assay','target','configuration','metric','condition','time_hours','concentration_um','biological_replicate','source_replicate','run_date','response_basis','unit'];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const present=v=>v!==null&&v!==undefined&&v!=='';
  const num=v=>typeof v==='number'&&Number.isFinite(v)?Number(v.toPrecision(6)).toLocaleString('en-US',{maximumSignificantDigits:6}):String(v??'Not reported');
  function sourceScope(row){return row.experiment?['experiment',row.experiment]:['source',row.source_file||'',row.source_sheet||''];}
  function contextKey(row){return JSON.stringify([sourceScope(row),...matchingFields.map(k=>row[k]??null)]);}
  function align(rows,left,right){
    const groups=new Map();
    for(const row of rows){
      if(row.compound!==left&&row.compound!==right)continue;
      const key=contextKey(row);if(!groups.has(key))groups.set(key,{key,context:row,left:[],right:[]});
      groups.get(key)[row.compound===left?'left':'right'].push(row);
    }
    return [...groups.values()].map(group=>({...group,status:group.left.length&&group.right.length?'Both batches':group.left.length?'Batch A only':'Batch B only'}));
  }
  function exportRows(groups){return groups.flatMap((group,i)=>['left','right'].flatMap(side=>group[side].map(row=>({comparison_context:i+1,comparison_status:group.status,comparison_side:side==='left'?'A':'B',...row}))));}
  function csv(rows){
    const columns=[...new Set(rows.flatMap(r=>Object.keys(r)))],cell=value=>{
      let text=String(value??'');
      // Match the catalog export's spreadsheet-safe text handling. Numbers, including
      // negative measured values, retain full precision; '=' alone is a qualifier.
      if(typeof value==='string'&&text!=='='&&(/^[\t\r\n]/.test(text)||/^[\s\uFEFF]*[=+\-@]/.test(text)))text="'"+text;
      return '"'+text.replaceAll('"','""')+'"';
    };
    return columns.map(cell).join(',')+'\r\n'+rows.map(r=>columns.map(k=>cell(r[k])).join(',')).join('\r\n');
  }
  function contextHTML(row){
    const items=[row.experiment||'Source-scoped comparison',row.target,row.configuration,row.condition,present(row.time_hours)?row.time_hours+' h':null,present(row.concentration_um)?num(row.concentration_um)+' µM dose':null,present(row.biological_replicate)?'Biological replicate '+row.biological_replicate:null,present(row.source_replicate)?'Source replicate '+row.source_replicate+' (type unspecified)':null,row.run_date,row.response_basis];
    return items.filter(present).map(esc).join('<br>');
  }
  function measurementsHTML(rows){
    if(!rows.length)return '<span class="batch-unavailable">No measurement in this context</span>';
    return rows.map(r=>`<div class="batch-measurement"><strong>${esc(present(r.value)?[r.qualifier,num(r.value),r.unit].filter(present).join(' '):'Not reported')}</strong>${present(r.sd)?`<span>SD ${esc(num(r.sd))}${present(r.n)?' · n='+esc(r.n):''}</span>`:''}${r.qc_flags?`<span class="batch-qc">QC: ${esc(r.qc_flags)}</span>`:''}<details><summary>Source &amp; plate</summary><p>${esc(r.source_compound||r.compound)}${r.plate?'<br>Plate: '+esc(r.plate):''}${r.well?'<br>Well: '+esc(r.well):''}<br>${esc(r.source_file||'Source file unspecified')}${r.source_sheet?'<br>'+esc(r.source_sheet):''}${r.source_row?'<br>Row '+esc(r.source_row):''}${r.source_range?'<br>'+esc(r.source_range):''}${r.provenance?'<br>'+esc(r.provenance):''}</p></details></div>`).join('');
  }
  function tableHTML(groups,left,right){
    if(!groups.length)return '<p class="section-note">No measurements match these filters.</p>';
    return `<table class="batch-comparison-table"><thead><tr><th>Assay / measurement</th><th>Matched context</th><th>Batch ${esc(batches.parse(left).batch||'unspecified')} · A</th><th>Batch ${esc(batches.parse(right).batch||'unspecified')} · B</th><th>Coverage</th></tr></thead><tbody>${groups.map(g=>`<tr><td><strong>${esc(g.context.assay)}</strong><br>${esc(g.context.metric)}</td><td>${contextHTML(g.context)}</td><td>${measurementsHTML(g.left)}</td><td>${measurementsHTML(g.right)}</td><td>${esc(g.status)}${g.left.length>1||g.right.length>1?'<br>Multiple source records retained':''}</td></tr>`).join('')}</tbody></table>`;
  }
  async function render({host,compound,onCompound}={}){
    if(typeof host==='string')host=document.getElementById(host);
    if(!host)return;
    const token={};host._batchRenderToken=token;
    host.innerHTML='<section class="panel"><h2>Compare Compound Management batches</h2><p role="status">Loading supplied assay results…</p></section>';
    let rows;
    try{rows=await root.AtlasDataCatalog.load({categoryIds:categories});}catch(error){if(host._batchRenderToken===token)host.innerHTML='<section class="panel"><h2>Batch comparison unavailable</h2><p>'+esc(error.message)+'</p></section>';return;}
    if(host._batchRenderToken!==token)return;
    const groups=batches.index(rows.map(r=>r.compound).filter(id=>/^RMC-/i.test(id||''))),old=host._batchSelection||{};
    const requested=batches.parse(compound).base;
    const selected=groups.find(g=>g.base===requested)||groups.find(g=>g.base===old.base)||groups[0];
    if(!selected){host.innerHTML='<section class="panel"><p>No compound batch identities are available in the supplied data.</p></section>';return;}
    let selection={base:selected.base,left:compound||old.left,right:old.right,category:old.category||'',metric:old.metric||'',coverage:old.coverage||'all'};
    host.innerHTML=`<section class="panel batch-comparison-panel"><div class="panel-heading"><div><h2>Compare batches of the same compound</h2><p>Batch 001, 002 and later suffixes identify Compound Management batches. Physical plates and biological or technical replicates remain separate.</p></div></div><div class="toolbar"><label>Compound<select data-batch-control="base">${groups.map(g=>`<option value="${esc(g.base)}">${esc(g.base)}${g.members.length>1?' · '+g.members.length+' batches':''}</option>`).join('')}</select></label><label>Batch A<select data-batch-control="left"></select></label><label>Batch B<select data-batch-control="right"></select></label><button class="secondary" type="button" data-batch-export>Export displayed records CSV</button></div><p data-batch-status class="section-note" role="status" aria-live="polite"></p><div class="toolbar" data-batch-filters><label>Data category<select data-batch-control="category"></select></label><label>Measurement<select data-batch-control="metric"></select></label><label>Coverage<select data-batch-control="coverage"><option value="all">All contexts</option><option value="both">Measured in both batches</option><option value="unmatched">Measured in one batch only</option></select></label></div><p class="section-note">Results use all supplied experiments and assay sources. Matching requires the same assay, target/configuration, measurement, condition, time, dose, run/replicate, response basis and unit. Unassigned experiments are matched only within the same source file and sheet. Plates and source records remain individually labeled; no values are averaged and no significance is inferred. Missing context fields are not evidence of equivalent assay conditions.</p><p data-batch-count class="section-note" role="status"></p><div data-batch-table class="table-scroll"></div></section>`;
    const control=name=>host.querySelector(`[data-batch-control="${name}"]`);
    const options=(values,all)=>'<option value="">'+esc(all)+'</option>'+values.map(([id,label])=>`<option value="${esc(id)}">${esc(label)}</option>`).join('');
    let shown=[];
    function update(changed){
      const group=groups.find(g=>g.base===selection.base),members=group.members.filter(m=>m.batch);
      if(!members.some(m=>m.id===selection.left))selection.left=members[0]?.id||group.members[0]?.id||'';
      if(!members.some(m=>m.id===selection.right&&m.id!==selection.left))selection.right=members.find(m=>m.id!==selection.left)?.id||'';
      for(const side of ['left','right']){control(side).innerHTML=members.length?members.filter(m=>side==='left'||m.id!==selection.left).map(m=>`<option value="${esc(m.id)}">Batch ${esc(m.batch)}</option>`).join(''):'<option value="">Batch unspecified</option>';if(side==='right'&&!selection.right)control(side).innerHTML='<option value="">No second batch available</option>';control(side).value=selection[side];control(side).disabled=side==='right'?!selection.right:members.length<2;}
      control('base').value=selection.base;
      const available=rows.filter(r=>r.compound===selection.left||r.compound===selection.right),availableCategories=[...new Set(available.map(r=>r.category))];
      control('category').innerHTML=options(availableCategories.map(id=>[id,root.AtlasDataCatalog.categories.find(c=>c.id===id)?.label||id]),'All data categories');
      if(!availableCategories.includes(selection.category))selection.category='';control('category').value=selection.category;
      const scoped=available.filter(r=>!selection.category||r.category===selection.category),metrics=[...new Set(scoped.map(r=>r.metric))].sort();
      control('metric').innerHTML=options(metrics.map(m=>[m,m]),'All measurements');if(!metrics.includes(selection.metric))selection.metric='';control('metric').value=selection.metric;control('coverage').value=selection.coverage;
      host._batchSelection={...selection};
      if(changed&&onCompound)onCompound(selection.left);
      const table=host.querySelector('[data-batch-table]'),count=host.querySelector('[data-batch-count]'),note=host.querySelector('[data-batch-status]'),exportButton=host.querySelector('[data-batch-export]');
      host.querySelector('[data-batch-filters]').hidden=!selection.right;
      if(!selection.right){note.textContent=selection.base+' has '+(members.length?'only Batch '+members[0].batch:'no specified batch')+' in the supplied data. No second batch is available to compare. Plate 1/2 and replicate 1/2 do not create extra batches.';table.innerHTML='';count.textContent='';shown=[];exportButton.disabled=true;return;}
      const matched=align(scoped.filter(r=>!selection.metric||r.metric===selection.metric),selection.left,selection.right);
      shown=matched.filter(g=>selection.coverage==='all'||(selection.coverage==='both'?g.left.length&&g.right.length:!g.left.length||!g.right.length));
      note.textContent=selection.base+' · Batch '+batches.parse(selection.left).batch+' versus Batch '+batches.parse(selection.right).batch+'. Each source measurement stays separate.';
      const both=matched.filter(g=>g.left.length&&g.right.length).length;
      count.textContent=shown.length+' displayed contexts · '+both+' contexts measured in both batches · '+(matched.length-both)+' measured in one batch only.'+(both?'':' No matched context is available for these filters.');
      table.innerHTML=tableHTML(shown,selection.left,selection.right);exportButton.disabled=!shown.length;
    }
    host.querySelectorAll('[data-batch-control]').forEach(el=>el.addEventListener('change',()=>{const key=el.dataset.batchControl;selection[key]=el.value;if(key==='base'){selection.left='';selection.right='';}update(key==='base'||key==='left');}));
    host.querySelector('[data-batch-export]').addEventListener('click',()=>{const blob=new Blob(['\uFEFF'+csv(exportRows(shown))],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=selection.base+'_batch_'+batches.parse(selection.left).batch+'_vs_'+batches.parse(selection.right).batch+'.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1500);});
    update(false);
  }
  const api={render,align,contextKey,exportRows,csv,matchingFields,categories};
  root.AtlasBatchComparison=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
