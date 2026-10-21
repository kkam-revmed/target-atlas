/* Independent crosslinking evidence retains compound batches and every source row. */
const AtlasCrosslink=(()=>{
 const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const F=(v,n=2)=>v==null||!Number.isFinite(Number(v))?'—':Number(v).toLocaleString('en-US',{maximumFractionDigits:n});
 const palette=['#dddddd','#1c6a5c','#5136e0','#c28100','#a24dff','#ff5400'];
 const identity=id=>{const m=/^(RMC-\d+)-(\d{3,})$/i.exec(id||'');return globalThis.AtlasCompoundBatches?.parse(id)||{id,base:m?m[1]:id,batch:m?m[2]:null};};
 const batchLabel=id=>{const q=identity(id);return globalThis.AtlasCompoundBatches?.label?.(id)||q.base+(q.batch?' · Batch '+q.batch:'');};
 const matchingRecords=(data,id)=>data.records.filter(r=>r.compound===id);
 const batchNote='RMC suffixes such as -001, -002 and -003 identify distinct Compound Management batches. Results are matched by the full batch ID; measurements from different batches remain separate.';
 let pending;
 function load(){if(!pending)pending=fetch('./crosslinking.json?v=crosslink-hits-1').then(r=>{if(!r.ok)throw new Error('Crosslinking results could not be loaded.');return r.json();}).catch(e=>{pending=null;throw e;});return pending;}
 const delta=r=>r.comparison.total_delta_pp.value;
 const fold=r=>r.comparison.total_fold.value;
 function foldText(item){return item.value==null?'— ('+(item.undefined_reason||'unavailable')+')':F(item.value,3)+'×';}
 function tip(t){return 'data-tip="'+E(t)+'"';}
 function scatter(records,context,selected){
  const w=740,h=415,l=62,r=22,t=24,b=89,max=Math.max(100,...records.flatMap(q=>[q.conditions.no_cypa.total_percent,q.conditions.with_cypa.total_percent]));
  const X=v=>l+v/max*(w-l-r),Y=v=>h-b-v/max*(h-t-b);let s='';
  for(let i=0;i<=5;i++){const v=max*i/5;s+='<path d="M'+X(v)+','+t+'V'+(h-b)+'M'+l+','+Y(v)+'H'+(w-r)+'" stroke="#e5eaf1"/><text x="'+X(v)+'" y="'+(h-b+20)+'" text-anchor="middle">'+F(v,0)+'</text><text x="'+(l-9)+'" y="'+(Y(v)+4)+'" text-anchor="end">'+F(v,0)+'</text>';}
  s+='<path d="M'+X(0)+','+Y(0)+'L'+X(max)+','+Y(max)+'" stroke="#8f9eb1" stroke-dasharray="5 4"/>';
  for(const q of [...records].sort((a,b)=>Number(a.compound===selected)-Number(b.compound===selected))){const no=q.conditions.no_cypa.total_percent,yes=q.conditions.with_cypa.total_percent,active=q.compound===selected;s+='<circle cx="'+X(no)+'" cy="'+Y(yes)+'" r="'+(active?5:3.3)+'" fill="'+(active?'#c28100':'#1c6a5c')+'" opacity="'+(active?'1':'.66')+'" stroke="white" tabindex="0" role="button" data-xlink-compound="'+E(q.compound)+'" aria-label="'+E(batchLabel(q.compound)+': '+F(no)+'% No CypA; '+F(yes)+'% +CypA')+'" '+tip(batchLabel(q.compound)+' · '+context+'\nNo CypA: '+F(no)+'% · +CypA: '+F(yes)+'%\nDifference: '+F(delta(q))+' percentage points')+'/>';}
  s+='<text x="'+((l+w-r)/2)+'" y="'+(h-45)+'" text-anchor="middle">No CypA · total crosslinking (%)</text><text transform="translate(17 '+((t+h-b)/2)+') rotate(-90)" text-anchor="middle">+CypA · total crosslinking (%)</text><text x="'+l+'" y="15">'+E(context)+' · dashed diagonal: equal responses</text>';
  s+='<text x="'+l+'" y="'+(h-9)+'">Source: 20261015 Cyclin xlink mastersheet n1 ZA 3.xlsx · '+records.length+' compound batches</text>';
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+w+' '+h+'" role="img" aria-label="Crosslinking No CypA versus +CypA"><style>text{font:11px Arial;fill:#55716c}</style>'+s+'</svg>';
 }
 function adductPlot(q){
  const w=640,h=195,left=95,right=16,totals=Object.values(q.conditions).map(c=>c.adduct_percent.reduce((a,v)=>a+v,0)),max=Math.max(100,...totals),X=v=>left+v/max*(w-left-right);let s='<text x="16" y="13">'+E(batchLabel(q.compound)+' · '+q.context)+'</text>';
  Object.entries(q.conditions).forEach(([key,c],j)=>{const y=23+j*43;let acc=0;s+='<text x="'+(left-10)+'" y="'+(y+17)+'" text-anchor="end">'+(key==='no_cypa'?'No CypA':'+CypA')+'</text>';c.adduct_percent.forEach((v,i)=>{s+='<rect x="'+X(acc)+'" y="'+y+'" width="'+Math.max(0,X(acc+v)-X(acc))+'" height="25" fill="'+palette[i]+'" '+tip((i===0?'No adduct':i+' adduct'+(i>1?'s':''))+': '+F(v,3)+'%')+'/>';acc+=v;});});
  for(let i=0;i<=5;i++)s+='<text x="'+X(i*20)+'" y="118" text-anchor="middle">'+(i*20)+'</text>';
  q.conditions.no_cypa.adduct_percent.forEach((_,i)=>{const x=left+i*87;s+='<rect x="'+x+'" y="139" width="9" height="9" fill="'+palette[i]+'"/><text x="'+(x+14)+'" y="147">'+(i===0?'No adduct':i+' adduct'+(i>1?'s':''))+'</text>';});
  s+='<text x="16" y="172">Adduct distribution (%) · Source: 20261015 Cyclin xlink mastersheet n1 ZA 3.xlsx</text>';
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+w+' '+h+'" role="img" aria-label="'+E(q.context+' adduct distributions, percentages')+'"><style>text{font:11px Arial;fill:#55716c}</style>'+s+'</svg>';
 }
 function compact({host,data,compound}){
  if(typeof host==='string')host=document.getElementById(host);if(!host)return;
  const rows=matchingRecords(data,compound);
  if(!rows.length){host.innerHTML='<section class="panel xlink-panel"><h2>Crosslinking evidence</h2><p class="section-note">No crosslinking result for this exact compound and batch.</p><button type="button" class="secondary" data-crosslink-open="">Browse crosslinking results</button></section>';return;}
  host.innerHTML='<section class="panel xlink-panel"><h2>Crosslinking evidence · '+E(batchLabel(compound))+'</h2><p class="section-note">Sources: '+E(data.source)+'. '+E(batchNote)+' Independent assay results retain their original source labels. No CypA and +CypA are the crosslinking conditions; these are separate from the NanoBRET CypA-inhibitor conditions.</p>'+comparisonTable(rows)+'<button type="button" class="secondary" data-crosslink-open="'+E(compound)+'">Open crosslinking plots and adduct details</button></section>';
 }
 function comparisonTable(rows){return '<div class="table-scroll"><table><thead><tr><th>Compound</th><th>Batch</th><th>Source context</th><th>No CypA total (%)</th><th>+CypA total (%)</th><th>Difference (pp)</th><th>Fold change</th><th>Hit status</th></tr></thead><tbody>'+rows.map(q=>'<tr><td>'+E(identity(q.compound).base)+'</td><td>'+E(identity(q.compound).batch||'—')+'</td><th>'+E(q.context)+'</th><td>'+F(q.conditions.no_cypa.total_percent)+'</td><td>'+F(q.conditions.with_cypa.total_percent)+'</td><td>'+F(delta(q))+'</td><td>'+E(foldText(q.comparison.total_fold))+'</td><td>'+E(AtlasCrosslinkHits.status(q))+'</td></tr>').join('')+'</tbody></table></div><p class="section-note">Hit requires +CypA total crosslinking &gt;20% AND total fold &gt;2, using presentation slides 8 and 10.</p>';}
 function adductTable(q){
  const no=q.conditions.no_cypa,yes=q.conditions.with_cypa;
  const cell=v=>'<td title="'+E(v==null?'Not reported':String(v)+'%')+'">'+(v==null?'—':F(v,4)+'%')+'</td>';
  const count=Math.max(no.adduct_percent.length,yes.adduct_percent.length);
  return '<table class="xlink-adduct-table"><caption>Reported adduct distribution · '+E(q.context)+'</caption><thead><tr><th scope="col">Adduct count</th><th scope="col">No CypA</th><th scope="col">+CypA</th></tr></thead><tbody>'+Array.from({length:count},(_,i)=>'<tr><th scope="row"><span class="xlink-swatch" style="background:'+palette[i]+'" aria-hidden="true"></span>'+i+(i===0?' — unmodified':i===1?' adduct':' adducts')+'</th>'+cell(no.adduct_percent[i])+cell(yes.adduct_percent[i])+'</tr>').join('')+'</tbody><tfoot><tr><th scope="row">Total with ≥1 adduct</th>'+cell(no.total_percent)+cell(yes.total_percent)+'</tr></tfoot></table>';
 }
 function summaryTable(data){
  const count=(qs,predicate)=>{const n=qs.filter(predicate).length;return n+' / '+qs.length+' ('+(qs.length?F(100*n/qs.length,1)+'%':'—')+')';};
  const cell=(qs,context,mode)=>'<button type="button" class="compound-link" data-xlink-list="'+mode+'" data-xlink-context="'+E(context)+'">'+count(qs,q=>listMatches(q,mode))+'</button>';
  const hits=new Set(data.records.filter(AtlasCrosslinkHits.isHit).map(q=>q.compound));
  return '<section class="panel xlink-panel" id="xlinkSummary"><h2>How many tested batches have an adduct signal?</h2><p>Each percentage below is a share of the tested compound batches in that target context. A nonzero signal means reported total crosslinking &gt;0%; it includes small signals and is not a hit call. Click a count to browse those batches.</p><div class="table-scroll"><table><thead><tr><th>Target context</th><th>Tested batches</th><th>Nonzero signal<br>No CypA</th><th>Nonzero signal<br>+CypA</th><th>CypA-dependent hits</th></tr></thead><tbody>'+data.contexts.map(c=>{const qs=data.records.filter(q=>q.context===c);return '<tr><th>'+E(c)+'</th><td>'+qs.length+'</td><td>'+cell(qs,c,'no_signal')+'</td><td>'+cell(qs,c,'with_signal')+'</td><td>'+cell(qs,c,'hits')+'</td></tr>';}).join('')+'</tbody></table></div><p><strong>'+hits.size+' / '+data.compounds.length+' batches ('+F(100*hits.size/data.compounds.length,1)+'%) meet the hit rule in at least one target context.</strong> Each full batch ID is counted once in this overall total.</p><p class="section-note">Hit rule from the supplied presentation, slides 8 and 10: +CypA total crosslinking &gt;20% AND total fold (+CypA / No CypA) &gt;2. Missing measurements are not zero; an unavailable fold cannot establish a hit. These batch percentages are different from the adduct-distribution percentages for an individual sample.</p></section>';
 }
 function listMatches(q,mode){
  if(mode==='hits')return AtlasCrosslinkHits.isHit(q);
  if(mode==='with_signal'||mode==='no_signal'){const v=q.conditions[mode==='with_signal'?'with_cypa':'no_cypa'].total_percent;return v!=null&&v>0;}
  return true;
 }
 function compoundDetails(data,compound,context){
  const qs=matchingRecords(data,compound),q=qs.find(r=>r.context===context);
  if(!q)return '<section class="panel xlink-panel"><h2>No result for this compound batch and target context</h2><p>Choose another context. Missing measurements are not zero.</p></section>';
  return `<section class="panel xlink-panel xlink-inspector" aria-labelledby="xlinkSelectedHeading">
    <div class="eyebrow">SELECTED COMPOUND · BATCH ${E(identity(compound).batch||'Unspecified')}</div>
    <h2 id="xlinkSelectedHeading" tabindex="-1">${E(batchLabel(compound))} · ${E(context)}</h2>
    <p class="xlink-reading-guide"><strong>0 = unmodified protein. 1, 2, 3… = attached compound molecules.</strong> Read each condition column separately.</p>
    <div class="xlink-adduct-layout"><div>${adductTable(q)}<p class="section-note">Percentages describe the adduct distribution within this sample, not the fraction of tested compounds. Total crosslinking is the reported total for one or more adducts. Source percentages are not forced to sum to 100. A dash means not reported.</p></div>
    <div><div class="plot" id="xlink-adduct-0">${adductPlot(q)}</div><button type="button" class="export-svg" data-plot="xlink-adduct-0">Export distribution SVG</button></div></div>
    <p><strong>${E(AtlasCrosslinkHits.status(q))}</strong> · Total fold (+CypA / No CypA): ${E(foldText(q.comparison.total_fold))} · Difference: ${F(delta(q))} percentage points.</p>
    <p class="section-note">A hit requires +CypA total crosslinking &gt;20% AND total fold &gt;2. A nonzero adduct signal alone does not meet this rule. The study reports n = 1; these results do not establish statistical significance or a binding site.</p>
    <button type="button" class="secondary" id="xlinkSelectedCSV">Export this batch and context CSV</button>
    <div class="xlink-source section-note"><p>Original source ID: ${E(q.compound)} · ${E(data.source)} / ${E(q.sheet)} · row ${q.source_row}.</p><p>No CypA source cells: ${E(q.sheet+'!'+q.conditions.no_cypa.source_range)}<br>+CypA source cells: ${E(q.sheet+'!'+q.conditions.with_cypa.source_range)}.</p><p>Single-adduct fold: ${E(foldText(q.comparison.single_fold))}; single-adduct difference: ${F(q.comparison.single_delta_pp.value)} pp.</p>${q.flags?.length?'<p>Source flags: '+E(q.flags.join('; '))+'</p>':''}</div>
    <details><summary>Compare this batch’s totals across all target contexts</summary>${comparisonTable(qs)}<p class="section-note">Change Target context above to see that context’s adduct percentages.</p></details>
  </section>`;
 }
 function csvRows(records,source){
  const h=['base_compound','batch','full_batch_id','source_context','condition','total_crosslinking_percent','no_adduct_percent','one_adduct_percent','two_adduct_percent','three_adduct_percent','four_adduct_percent','five_adduct_percent','total_fold_plus_over_no','total_fold_source_value','total_fold_undefined_reason','total_difference_pp','single_adduct_fold','single_adduct_fold_source_value','single_adduct_fold_undefined_reason','single_adduct_difference_pp','source_file','source_sheet','source_row','source_range','hit_status','hit_rule'];
  return [h,...records.flatMap(q=>Object.entries(q.conditions).map(([key,c])=>[identity(q.compound).base,identity(q.compound).batch,q.compound,q.context,key==='no_cypa'?'No CypA':'+CypA',c.total_percent,...Array.from({length:6},(_,i)=>c.adduct_percent[i]??null),fold(q),q.comparison.total_fold.source_value,q.comparison.total_fold.undefined_reason,delta(q),q.comparison.single_fold.value,q.comparison.single_fold.source_value,q.comparison.single_fold.undefined_reason,q.comparison.single_delta_pp.value,source,q.sheet,q.source_row,c.source_range,AtlasCrosslinkHits.status(q),AtlasCrosslinkHits.rule]))];
 }
 function downloadCSV(data,records){const safe=v=>{if(v==null)return '';let s=String(v);if(typeof v==='string'&&/^[=+\-@]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};const text=csvRows(records,data.source).map(r=>r.map(safe).join(',')).join('\r\n'),a=document.createElement('a'),url=URL.createObjectURL(new Blob(['\ufeff'+text],{type:'text/csv;charset=utf-8'}));a.href=url;a.download='crosslinking_shown_results.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 function render({host,data,compound,onCompound}){
  if(typeof host==='string')host=document.getElementById(host);if(!host)return;
  let selected=data.compounds.includes(compound)?compound:data.compounds[0],shown=[];
  const bases=[...new Set(data.compounds.map(c=>identity(c).base))].sort();
  host.innerHTML=`<section class="panel xlink-panel" id="xlinkChoose">
    <div class="eyebrow">CROSSLINKING · INDEPENDENT ASSAY DATASET</div><h2>See adduct percentages for a compound</h2>
    <p>Choose a compound, its batch, and a target context. The table immediately below shows each adduct percentage with and without CypA.</p>
    <div class="toolbar xlink-picker"><label>Compound<select id="xlinkCompoundSelect">${bases.map(c=>'<option>'+E(c)+'</option>').join('')}</select></label><label>Batch<select id="xlinkBatchSelect"></select></label><label>Target context<select id="xlinkContext">${data.contexts.map(c=>'<option>'+E(c)+'</option>').join('')}</select></label></div>
    <p class="section-note">${data.compounds.length} tested compound batches (${bases.length} base compounds) · ${data.contexts.length} target contexts. Batches 001, 002 and 003 remain separate. The selected NanoBRET experiment, Cmax and EC50 filters do not change these results.</p>
    <div class="xlink-jumps"><a href="#xlinkSummary">Batch counts and percentages</a><a href="#xlinkBrowse">Find a compound or browse results</a><a href="#xlinkAdvanced">Compare contexts and shared hits</a><button type="button" class="secondary" data-source-group="crosslinking">View source files</button></div>
  </section>
  <div id="xlinkSelected"></div>
  ${summaryTable(data)}
  <section class="panel xlink-panel" id="xlinkBrowse"><h2>Find a compound or browse results</h2><p>Search a full or partial RMC ID, then choose <strong>View adducts</strong>. The batch number identifies which measurements you will open.</p>
    <div class="toolbar"><label>Find compound<input id="xlinkSearch" type="search" list="xlinkNames" placeholder="Full or partial RMC ID"></label><datalist id="xlinkNames">${data.compounds.map(c=>'<option value="'+E(c)+'"></option>').join('')}</datalist>
    <label>Show batches<select id="xlinkListFilter"><option value="all">All tested batches</option><option value="no_signal">Nonzero signal · No CypA</option><option value="with_signal">Nonzero signal · +CypA</option><option value="hits">CypA-dependent hits</option></select></label>
    <label>Sort results<select id="xlinkSort"><option value="plus">+CypA total, highest first</option><option value="delta">Difference, highest first</option><option value="fold">Fold change, highest first</option><option value="name">Compound ID</option></select></label><button id="xlinkClear" class="secondary">Show all batches</button><button id="xlinkCSV" class="secondary">Export shown results CSV</button></div>
    <p id="xlinkCount" class="section-note" role="status"></p><div class="table-scroll xlink-results" id="xlinkTable"></div>
    <details><summary>Plot total crosslinking with and without CypA</summary><div class="panel-heading"><h3 id="xlinkPlotTitle"></h3><button class="export-svg" data-plot="xlinkScatter">Export SVG</button></div><p>Each point is a compound batch in the target context selected above. Above the diagonal: more total crosslinking with CypA. Click a point to view its adduct percentages.</p><div class="plot" id="xlinkScatter"></div></details>
  </section>
  <details class="panel xlink-panel" id="xlinkAdvanced"><summary>Compare contexts and shared hits</summary><div id="xlinkCompare"></div></details>
  <details class="panel xlink-panel"><summary>Assay setup and source notes</summary><p>10 µM compound, 1 µM target, 10 µM CypA in the +CypA condition, 6 hours, n = 1. No biological significance tests or error bars are inferred.</p><ul class="xlink-notes">${data.notes.map(n=>'<li>'+E(n)+'</li>').join('')}</ul></details>`;
  const $=id=>host.querySelector('#'+id);
  function syncPicker(){
    $('xlinkCompoundSelect').value=identity(selected).base;
    $('xlinkBatchSelect').innerHTML=data.compounds.filter(c=>identity(c).base===identity(selected).base).map(c=>'<option value="'+E(c)+'">'+E(identity(c).batch||'Unspecified')+'</option>').join('');
    $('xlinkBatchSelect').value=selected;
  }
  function select(c,jump=false){
    selected=c;onCompound?.(c);syncPicker();
    $('xlinkSelected').innerHTML=compoundDetails(data,c,$('xlinkContext').value);
    $('xlinkScatter').innerHTML=scatter(shown,$('xlinkContext').value,selected);
    const exportButton=$('xlinkSelectedCSV');if(exportButton)exportButton.onclick=()=>downloadCSV(data,matchingRecords(data,selected).filter(q=>q.context===$('xlinkContext').value));
    if(jump){$('xlinkSelectedHeading')?.focus({preventScroll:true});$('xlinkChoose').scrollIntoView({block:'start',behavior:'smooth'});}
  }
  function update(){
    const term=$('xlinkSearch').value.trim().toLowerCase(),context=$('xlinkContext').value,sort=$('xlinkSort').value,mode=$('xlinkListFilter').value;
    const tested=data.records.filter(q=>q.context===context);
    shown=tested.filter(q=>q.compound.toLowerCase().includes(term)&&listMatches(q,mode));
    const metric=q=>sort==='delta'?delta(q):sort==='fold'?fold(q):q.conditions.with_cypa.total_percent;
    shown.sort((a,b)=>sort==='name'?a.compound.localeCompare(b.compound):(metric(b)??-Infinity)-(metric(a)??-Infinity)||a.compound.localeCompare(b.compound));
    $('xlinkCount').textContent=shown.length+' of '+tested.length+' tested compound batches in '+context+' shown. Export includes exactly these rows, both conditions, all reported adduct classes and source details.';
    $('xlinkCSV').disabled=!shown.length;
    $('xlinkPlotTitle').textContent=context+' · total crosslinking (%)';
    $('xlinkScatter').innerHTML=scatter(shown,context,selected);
    $('xlinkTable').innerHTML=shown.length?'<table><thead><tr><th>Compound</th><th>Batch</th><th>Adduct details</th><th>No CypA total (%)</th><th>+CypA total (%)</th><th>Difference (pp)</th><th>Fold change</th><th>Hit status</th><th>Source</th></tr></thead><tbody>'+shown.map(q=>'<tr><td>'+E(identity(q.compound).base)+'</td><td>'+E(identity(q.compound).batch||'—')+'</td><td><button type="button" class="compound-link" data-xlink-compound="'+E(q.compound)+'" aria-label="View adducts for '+E(batchLabel(q.compound))+'">View adducts</button></td><td>'+F(q.conditions.no_cypa.total_percent)+'</td><td>'+F(q.conditions.with_cypa.total_percent)+'</td><td>'+F(delta(q))+'</td><td>'+E(foldText(q.comparison.total_fold))+'</td><td>'+E(AtlasCrosslinkHits.status(q))+'</td><td>'+E(q.sheet)+' · row '+q.source_row+'</td></tr>').join('')+'</tbody></table>':'<p>No batches match this search and filter in '+E(context)+'. Clear the search or choose another filter.</p>';
  }
  $('xlinkCompoundSelect').onchange=()=>select(data.compounds.find(c=>identity(c).base===$('xlinkCompoundSelect').value));
  $('xlinkBatchSelect').onchange=()=>select($('xlinkBatchSelect').value);
  $('xlinkSearch').oninput=update;$('xlinkListFilter').onchange=update;
  $('xlinkContext').onchange=()=>{update();select(selected);};$('xlinkSort').onchange=update;
  $('xlinkClear').onclick=()=>{$('xlinkSearch').value='';$('xlinkListFilter').value='all';update();};$('xlinkCSV').onclick=()=>downloadCSV(data,shown);
  host.onclick=e=>{
    const batch=e.target.closest('[data-xlink-compound]');if(batch)select(batch.dataset.xlinkCompound,true);
    const count=e.target.closest('[data-xlink-list]');if(count){$('xlinkContext').value=count.dataset.xlinkContext;$('xlinkListFilter').value=count.dataset.xlinkList;$('xlinkSearch').value='';update();select(selected);$('xlinkSearch').focus({preventScroll:true});$('xlinkBrowse').scrollIntoView({block:'start',behavior:'smooth'});}
    const jump=e.target.closest('a[href="#xlinkAdvanced"]');if(jump)$('xlinkAdvanced').open=true;
  };
  host.onkeydown=e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('circle[data-xlink-compound]')){e.preventDefault();select(e.target.dataset.xlinkCompound,true);}};
  AtlasCrosslinkCompare.render({host:$('xlinkCompare'),data});
  update();select(selected);
 }
 return {load,render,compact,scatter,adductPlot,compoundDetails,csvRows,matchingRecords};
})();
