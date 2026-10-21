/* Overview summaries use the same source values and EC50 bands as activity calls. */
(function(root){
 'use strict';
 const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const F=v=>Number.isFinite(v)?v.toLocaleString('en-US',{maximumFractionDigits:2}):'—';
 const S=v=>Number.isFinite(v)?Number(v).toPrecision(3):'—';
 function exactEC50(q){const r=q.report;if(!r||r.ec50==null)return null;const v=Number(r.ec50),op=String(r.qualifier??'').trim();return Number.isFinite(v)&&v>0&&['','='].includes(op)?v:null;}
 function leaders(qs,endpoint,order='max'){
  const get=endpoint==='ec50'?exactEC50:q=>Number.isFinite(q.cmax)?q.cmax:null;
  const valid=qs.map(q=>({q,value:get(q)})).filter(p=>p.value!==null);
  if(!valid.length)return [];
  const best=(order==='min'?Math.min:Math.max)(...valid.map(p=>p.value));
  return valid.filter(p=>p.value===best).map(p=>p.q).sort((a,b)=>a.compound.localeCompare(b.compound)||a.target.localeCompare(b.target));
 }
 function category(q,basis='gds'){
  if(basis==='gds')return root.AtlasPotency.category(q);
  const v=q.fit?.ec50;
  return !Number.isFinite(v)||v<=0?'unreported':v<=1?'le1':v<=3?'one3':v<=10?'three10':'gt10';
 }
 function cmax(q,basis='gds'){return basis==='refit'?q.peak_mean:q.cmax;}
 function cmaxBasis(q,basis='gds'){return basis==='refit'?'Observed peak dose mean':q.cmax_basis;}
 function members(qs,target,band,threshold,basis='gds'){return qs.filter(q=>q.target===target&&Number.isFinite(cmax(q,basis))&&cmax(q,basis)>threshold&&category(q,basis)===band).sort((a,b)=>a.compound.localeCompare(b.compound));}
 function compoundButton(q){return '<button type="button" class="compound-link" data-compound="'+E(q.compound)+'" data-target="'+E(q.target)+'">'+E(q.compound)+'</button>';}
 function winnerHTML(qs,endpoint,order,overall){
  const wins=leaders(qs,endpoint,order);
  if(!wins.length)return '<span class="section-note">'+(endpoint==='ec50'?'No exact reported EC50':'No Cmax available')+'</span>';
  return wins.map(q=>'<div class="overview-winner"><strong>'+E(endpoint==='ec50'?S(exactEC50(q))+' µM':F(q.cmax))+'</strong> '+compoundButton(q)+(overall?'<span class="overview-context">'+E(q.target)+'</span>':'')+(q.report?.source_qc?'<span class="overview-context overview-qc">GDS QC: '+E(q.report.source_qc)+'</span>':'')+'</div>').join('');
 }
 function leaderTable(qs,targets,dimension){
  const groups=targets.map(t=>({label:t,qs:qs.filter(q=>q.target===t),overall:false}));
  if(targets.length>1)groups.unshift({label:'Across all '+dimension+'s',qs,overall:true});
  const cmaxCell=(rows,overall)=>{const bases=[...new Set(rows.map(q=>q.cmax_basis||'Cmax'))];return bases.length>1?bases.map(b=>'<div class="overview-context">'+E(b)+'</div>'+winnerHTML(rows.filter(q=>(q.cmax_basis||'Cmax')===b),'cmax','max',overall)).join(''):winnerHTML(rows,'cmax','max',overall);};
  return '<table class="overview-leaders-table"><thead><tr><th>'+E(dimension[0].toUpperCase()+dimension.slice(1))+'</th><th>Highest Cmax</th><th>Lowest exact EC50<br><small>Strongest reported potency</small></th><th>Highest exact EC50<br><small>Weaker reported potency</small></th></tr></thead><tbody>'+groups.map(g=>'<tr><th>'+E(g.label)+'</th><td>'+cmaxCell(g.qs,g.overall)+'</td><td>'+winnerHTML(g.qs,'ec50','min',g.overall)+'</td><td>'+winnerHTML(g.qs,'ec50','max',g.overall)+'</td></tr>').join('')+'</tbody></table>';
 }
 function potencyTable(qs,targets,dimension,threshold,selected,basis='gds'){
  const bands=[...root.AtlasPotency.ranges,'unreported',...(basis==='gds'?['unresolved']:[])];
  const label=b=>b==='unreported'?(basis==='gds'?'Not reported':'Fit unavailable'):root.AtlasPotency.labels[b];
  return '<table class="potency-table"><thead><tr><th>'+E(dimension[0].toUpperCase()+dimension.slice(1))+'</th>'+bands.map(b=>'<th class="num '+(selected===b?'selected-band':'')+'">'+E(label(b))+'</th>').join('')+'</tr></thead><tbody>'+targets.map(t=>{
   const available=qs.some(q=>q.target===t&&category(q,basis)!=='unreported');
   return '<tr><th>'+E(t)+'</th>'+bands.map(b=>{
    const rows=members(qs,t,b,threshold,basis),n=rows.length,flags=basis==='refit'?rows.filter(q=>q.fit_flags?.length).length:0;
    // No linked measurements cannot establish a zero count in any potency band.
    const cell=!available&&b!=='unreported'?'<span aria-label="Unavailable: no linked EC50">—</span>':n?'<button type="button" class="potency-count" data-overview-basis="'+basis+'" data-overview-target="'+E(t)+'" data-overview-band="'+b+'" aria-label="Show '+n+' compound batches in '+E(t)+', '+(basis==='gds'?'GDS-reported':'independent-fit')+' EC50 '+E(label(b))+'; Cmax greater than '+E(threshold)+'">'+n+'</button>'+(flags?'<small class="potency-fit-warning">'+flags+' flagged</small>':''):'<span>0</span>';
    return '<td class="num '+(selected===b?'selected-band':'')+'">'+cell+'</td>';
   }).join('')+'</tr>';
  }).join('')+'</tbody></table>';
 }
 function reportedText(q){const r=q.report;return r?.ec50!=null?String(r.qualifier||'=')+' '+S(Number(r.ec50))+' µM':'Not reported';}
 function sourceText(q,basis){const r=q.report||{};return basis==='gds'&&r.source?[r.source,r.source_row!=null?'row '+r.source_row:''].filter(Boolean).join(' · '):(q.sources||[]).join('; ');}
 function detailTable(qs,dimension,basis='gds'){
  const refit=basis==='refit';
  return '<table><thead><tr><th>Compound</th><th>'+E(dimension[0].toUpperCase()+dimension.slice(1))+'</th><th>Cmax</th><th>Cmax basis</th><th>'+(refit?'Independent-fit':'GDS-reported')+' EC50</th>'+(refit?'<th>Independent-fit warnings</th>':'<th>Source classification</th><th>GDS QC / Valid</th>')+'<th>Source</th></tr></thead><tbody>'+qs.map(q=>'<tr><td>'+compoundButton(q)+'</td><td>'+E(q.target)+'</td><td class="num">'+F(cmax(q,basis))+'</td><td>'+E(cmaxBasis(q,basis))+'</td><td>'+E(refit?(Number.isFinite(q.fit?.ec50)?S(q.fit.ec50)+' µM':'Fit unavailable'):reportedText(q))+'</td>'+(refit?'<td class="qc-cell">'+E(q.fit_flags?.join('; ')||'No automated fit flags; inspect curve')+'</td>':'<td>'+E(q.report?.source_mode||'Not reported')+'</td><td class="qc-cell">'+E(q.report?.source_qc||'No source QC flag')+' · Valid: '+E(q.report?.source_valid||'not marked')+'</td>')+'<td class="qc-cell">'+E(sourceText(q,basis))+'</td></tr>').join('')+'</tbody></table>';
 }
 function listCSV(qs,context){
  const basis=context.basis||'gds',refit=basis==='refit';
  const keys=['benchling_id','biological_replicate','run_date','condition','response_source','target','ec50_band','cmax_cutoff','compound','cmax','cmax_basis','ec50_basis',...(refit?['independent_refit_ec50_um','independent_refit_flags']:['reported_ec50_qualifier','reported_ec50_um','source_classification','source_qc','source_valid']),'source_file','source_row','original_source_target','original_source_transfection'];
  const rows=[keys,...qs.map(q=>[context.experiment,context.replicate,context.date,context.condition,context.response,q.target,context.band,context.threshold,q.compound,cmax(q,basis),cmaxBasis(q,basis),refit?'Independent 4PL refit':'GDS reported',...(refit?[q.fit?.ec50,q.fit_flags?.join('; ')]:[q.report?.qualifier,q.report?.ec50,q.report?.source_mode,q.report?.source_qc,q.report?.source_valid]),basis==='gds'&&q.report?.source?q.report.source:(q.sources||[]).join('; '),basis==='gds'?q.report?.source_row:null,q.source_target,q.source_transfection])];
  return rows.map(r=>r.map(v=>{if(v==null)return '';let s=String(v);if(typeof v==='string'&&/^[=+\-@]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';}).join(',')).join('\r\n');
 }
 const api={exactEC50,leaders,category,cmax,members,leaderTable,potencyTable,detailTable,listCSV};
 root.AtlasOverview=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
