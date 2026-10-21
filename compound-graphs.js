/* Compare supplied curves only: no fitting, pooled measurements or identity changes. */
const AtlasCompoundGraphs=(()=>{
 'use strict';
 const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const finite=v=>typeof v==='number'&&Number.isFinite(v);
 const F=v=>finite(v)?Number(v.toPrecision(4)).toString():'—';
 const palette=['#0d4242','#378158','#637d25','#148b85','#677c70','#24624a'];
 const mounts=new WeakMap(),limit=6;
 const label=id=>AtlasCompoundBatches.label(id);
 const wrap=(value,max=95)=>{const lines=[];let line='';for(const word of String(value).split(/\s+/)){if(line.length+word.length+1>max&&line){lines.push(line);line='';}line+=(line?' ':'')+word;}if(line)lines.push(line);return lines;};
 const text=(x,y,value,extra='')=>`<text x="${x}" y="${y}" ${extra}>${E(value)}</text>`;
 const line=(x1,y1,x2,y2,color='#dae5df',extra='')=>`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" ${extra}/>`;
 function marker(x,y,i,color,r=4){
  const attrs=`fill="${color}" stroke="${color}"`;
  switch(i%6){
   case 1:return `<rect x="${x-r}" y="${y-r}" width="${2*r}" height="${2*r}" ${attrs}/>`;
   case 2:return `<path d="M${x},${y-r-1} L${x+r+1},${y+r} L${x-r-1},${y+r} Z" ${attrs}/>`;
   case 3:return `<path d="M${x},${y-r-1} L${x+r+1},${y} L${x},${y+r+1} L${x-r-1},${y} Z" ${attrs}/>`;
   case 4:return line(x-r,y-r,x+r,y+r,color,'stroke-width="2.5"')+line(x-r,y+r,x+r,y-r,color,'stroke-width="2.5"');
   case 5:return `<path d="M${x-r-1},${y-r} L${x+r+1},${y-r} L${x},${y+r+1} Z" ${attrs}/>`;
   default:return `<circle cx="${x}" cy="${y}" r="${r}" ${attrs}/>`;
  }
 }
 function context(data,benchling){
  return ['Benchling ID: '+benchling,data.biological_replicate?'Replicate '+data.biological_replicate:null,data.run_date||data.date_label,data.condition_label,data.time_hours!=null?data.time_hours+' h':null,data.response_label||'Corrected response',data.reference_plate?'RMC-0741051 · Batch 001 · reference physical plate '+data.reference_plate:null].filter(Boolean).join(' · ');
 }
 function source(q){return [q.source_compound?'Original source ID: '+q.source_compound:null,q.physical_plate?'Plate: '+q.physical_plate:null,q.identity_note,q.curve_note,...(q.sources||[]),q.report?.source,q.report?.source_row!=null?'Source row: '+q.report.source_row:null].filter(Boolean).join(' · ');}
 function graph({data,benchling,selected,target,wells=false,fits=true,connect=false,series=null,contextLabel=null,notesOverride=null}){
  const rows=series||selected.map(id=>data.curves.find(q=>q.compound===id&&q.target===target));
  const seriesLabel=(q,i)=>q?.series_label||label(selected[i]);
  const doses=rows.flatMap(q=>q?.doses||[]).filter(d=>finite(d.x)&&d.x>0&&finite(d.mean));
  if(!doses.length)return '';
  const width=800,left=64,right=22,ctx=contextLabel||context(data,benchling),header=wrap(ctx),top=55+header.length*16,bottom=top+280;
  const log=doses.map(d=>Math.log10(d.x)),xmin=Math.min(...log),xmax=Math.max(...log),pad=xmin===xmax?.5:(xmax-xmin)*.03,xd=[xmin-pad,xmax+pad];
  const values=[0,...doses.flatMap(d=>[d.mean,...(finite(d.sd)?[d.mean-d.sd,d.mean+d.sd]:[]),...(wells?(d.wells||[]).filter(finite):[])])];
  if(fits)for(const q of rows)if(q){const ds=q.doses.filter(d=>d.x>0&&finite(d.mean)),lo=Math.min(...ds.map(d=>d.x)),hi=Math.max(...ds.map(d=>d.x));values.push(...(q.fit?.line||[]).filter(([d,v])=>finite(d)&&finite(v)&&d>=lo&&d<=hi).map(p=>p[1]));}
  const low=Math.min(...values),high=Math.max(...values),yp=Math.max(10,(high-low)*.08),yd=[low<0?low-yp:0,high+yp];
  const x=v=>left+(Math.log10(v)-xd[0])/(xd[1]-xd[0])*(width-left-right),y=v=>bottom-(v-yd[0])/(yd[1]-yd[0])*(bottom-top);
  let body=text(20,25,target,'class="heading"')+header.map((s,i)=>text(20,47+i*16,s)).join('');
  for(let i=0;i<=5;i++){const v=yd[0]+(yd[1]-yd[0])*i/5;body+=line(left,y(v),width-right,y(v))+text(left-8,y(v)+4,F(v),'text-anchor="end"');}
  let xt=[];for(let z=Math.ceil(xd[0]);z<=Math.floor(xd[1]);z++)xt.push(10**z);if(xt.length<2)xt=[10**xmin,10**xmax];
  for(const v of [...new Set(xt)])body+=line(x(v),bottom,x(v),bottom+5,'#55716c')+text(x(v),bottom+21,F(v),'text-anchor="middle"');
  body+=text((left+width-right)/2,bottom+43,'Concentration (µM, log scale)','text-anchor="middle"')+`<text transform="translate(16 ${(top+bottom)/2}) rotate(-90)" text-anchor="middle">${E(data.response_mode==='ratio'?'Ratio-normalized response (%)':'Corrected response')}</text>`;
  const path=points=>points.map(([d,v],i)=>(i?'L':'M')+x(d).toFixed(3)+','+y(v).toFixed(3)).join(' ');
  const omitted=[];
  rows.forEach((q,i)=>{
   if(!q){omitted.push(label(selected[i])+': no result for this target');return;}
   const c=q.series_color||palette[i%palette.length],shape=q.series_marker??i,ds=q.doses.filter(d=>finite(d.x)&&d.x>0&&finite(d.mean)).sort((a,b)=>a.x-b.x);
   const missing=q.doses.length-ds.length;if(missing)omitted.push(label(q.compound)+': '+missing+' dose(s) omitted from log plot (nonpositive dose or missing mean)');
   if(!ds.length)return;
   body+=`<g data-graph-compound="${E(q.compound)}" data-run-series="${E(q.series_id||q.compound)}">`;
   if(fits){const points=(q.fit?.line||[]).filter(([d,v])=>finite(d)&&finite(v)&&d>=ds[0].x&&d<=ds.at(-1).x);if(points.length)body+=`<path data-series="independent-fit" d="${path(points)}" fill="none" stroke="${c}" stroke-width="2.2" ${connect?'stroke-dasharray="6 4"':''}/>`;else omitted.push(label(q.compound)+': no independent 4PL curve available; measured points only');}
   if(connect)body+=`<path data-series="dose-means" d="${path(ds.map(d=>[d.x,d.mean]))}" fill="none" stroke="${c}" stroke-width="2"/>`;
   for(const d of ds){
    const px=x(d.x),py=y(d.mean);
    if(finite(d.sd))body+=line(px,y(d.mean-d.sd),px,y(d.mean+d.sd),c)+line(px-3,y(d.mean-d.sd),px+3,y(d.mean-d.sd),c)+line(px-3,y(d.mean+d.sd),px+3,y(d.mean+d.sd),c);
    if(wells)(d.wells||[]).filter(finite).forEach(v=>{body+=`<circle data-series="well" cx="${px}" cy="${y(v)}" r="2.5" fill="white" stroke="${c}"><title>${E(seriesLabel(q,i)+' · '+d.x+' µM · well '+v)}</title></circle>`;});
    body+=`<g data-dose="${d.x}" data-mean="${d.mean}" data-sd="${d.sd??''}"><title>${E(seriesLabel(q,i)+' · '+d.x+' µM · mean '+d.mean+' · SD '+(d.sd??'not reported')+' · n '+(d.n??'not reported'))}</title>${marker(px,py,shape,c)}</g>`;
   }
   body+='</g>';
  });
  let foot=bottom+72;
  if(series){rows.forEach((q,i)=>{const c=q.series_color||palette[i%palette.length];body+=line(24,foot,52,foot,c,'stroke-width="2"')+marker(38,foot,q.series_marker??i,c);for(const l of wrap(seriesLabel(q,i),100)){body+=text(62,foot+4,l);foot+=18;}foot+=5;});foot+=10;}else{
  selected.forEach((id,i)=>{const lx=24+(i%2)*390,ly=foot+Math.floor(i/2)*24;body+=line(lx,ly,lx+28,ly,palette[i],'stroke-width="2"')+marker(lx+14,ly,i,palette[i])+text(lx+38,ly+4,label(id)+(!rows[i]?' · no result':''));});
  foot+=Math.ceil(selected.length/2)*24+10;
  }
  const notes=notesOverride?[...notesOverride,...omitted]:['Symbols: supplied dose means ± SD across measured wells; pooled references can span plates. '+(wells?'Open circles: individual wells.':''),fits?(connect?'Solid lines connect measured means; dashed lines show existing independent 4PL fits.':'Solid lines: existing independent 4PL fits, within the tested dose range; not GDS-reported fits.'):'Solid lines connect measured dose means. Independent 4PL fits are hidden.','Each batch, target, run and condition stays separate. No statistical significance is inferred.',...rows.flatMap(q=>q?.fit_flags?.length?[label(q.compound)+' · Independent-fit warnings: '+q.fit_flags.join('; ')]:[]),...omitted];
  for(const s of notes.flatMap(n=>wrap(n))){body+=text(20,foot,s);foot+=16;}
  const provenance={error_bar_basis:series?data.error_bar_basis:'Sample SD across supplied wells per concentration',benchling_id:benchling,context:ctx,target,line_basis:fits?(connect?'Connected measured dose means and existing independent 4PL fit':'Existing independent 4PL fit'):'Connected measured dose means',selected_batches:selected,curves:rows.filter(Boolean).map(q=>({series_id:q.series_id,series_label:q.series_label,benchling_id:q.benchling_id,biological_replicate:q.biological_replicate,run_date:q.run_date,condition:q.condition_label,summary_components:q.summary_components,compound:q.compound,source_compound:q.source_compound,physical_plate:q.physical_plate,source:source(q),independent_4pl:q.fit?{ec50_um:q.fit.ec50,baseline:q.fit.s0,plateau:q.fit.sinf,hill_slope:q.fit.hill,r2:q.fit.r2}:null,fit_flags:q.fit_flags}))};
  return `<svg xmlns="http://www.w3.org/2000/svg" class="compound-comparison-graph" viewBox="0 0 ${width} ${foot+14}" width="${width}" height="${foot+14}" role="img" aria-label="${E(target+' dose–response comparison of '+selected.map(label).join(', '))}"><title>${E(target+' · '+ctx)}</title><metadata>${E(JSON.stringify(provenance))}</metadata><style>.compound-comparison-graph text{font:12px Arial,sans-serif;fill:#0d4242}.compound-comparison-graph .heading{font-size:18px;font-weight:600}</style><rect width="100%" height="100%" fill="white"/>${body}</svg>`;
 }
 function save(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 async function exportGraph(svg,name,format){
  if(format==='svg'){save(new Blob([svg],{type:'image/svg+xml'}),name+'.svg');return;}
  const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));
  try{const img=new Image();await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(new Error('Graph image could not be prepared. Try SVG.'));img.src=url;});const canvas=document.createElement('canvas');canvas.width=img.naturalWidth*2;canvas.height=img.naturalHeight*2;canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw new Error('PNG export unavailable. Try SVG.');save(blob,name+'.png');}finally{URL.revokeObjectURL(url);}
 }
 function render({host,data,benchling,compound}){
  let s=mounts.get(host);if(s?.data===data&&s.benchling===benchling)return;
  const previous=s?.selected||[];
  if(!s){s={selected:data.compounds.includes(compound)?[compound]:[],query:'',target:'',wells:false,style:'4pl'};mounts.set(host,s);}
  const changed=s.data&&s.data!==data;s.data=data;s.benchling=benchling;s.selected=s.selected.filter(id=>data.compounds.includes(id));if(!data.targets.includes(s.target))s.target='';
  if(changed)s.query='';
  const groups=AtlasCompoundBatches.index(data.compounds);
  host.innerHTML=`<section class="panel compound-graphs-panel"><h2>Compare compounds on the same graph</h2><p>Select up to ${limit} compound batches. Each graph compares one target or configuration in the Benchling ID, replicate and condition selected above.</p><div class="toolbar graph-picker"><div class="graph-search-field"><label>Find compound<input id="graphSearch" type="search" placeholder="Try 051 or an RMC ID" autocomplete="off" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="graphSuggestions" aria-describedby="graphSearchStatus"></label><div id="graphSuggestions" class="graph-suggestions" role="listbox" aria-label="Matching compounds" hidden></div></div><label>Compound<select id="graphCompound"></select></label><label>Batch<select id="graphBatch"></select></label><button type="button" class="primary" id="graphAdd">Add to comparison</button></div><p id="graphSearchStatus" class="section-note" role="status"></p><div id="graphSelected" class="graph-selections" aria-label="Selected compound batches"></div><div class="toolbar graph-options"><label>Target / configuration<select id="graphTarget"><option value="">All targets / configurations</option>${data.targets.map(t=>`<option>${E(t)}</option>`).join('')}</select></label><label class="check"><input id="graphWells" type="checkbox">Show individual wells</label><label>Graph style<select id="graphStyle" aria-label="Graph style"><option value="measured">Measured curve (connect points)</option><option value="4pl">4PL fit (smooth curve)</option><option value="both">Both</option></select></label><button type="button" class="secondary" id="graphClear">Clear selection</button></div><p id="graphStatus" class="section-note" role="status"></p><p class="section-note">Graph exports include the selected batches, target, run context and legend. PNG works in slides; SVG is editable vector artwork. Source values and fit warnings are available below each graph. Activity filters do not remove selected curves.</p><details class="graph-fit-help"><summary>What is the 4PL fit?</summary><p>A four-parameter logistic dose–response model estimates the <strong>baseline, plateau, EC50 and Hill slope</strong>. This is the model family used by Prism’s “log(agonist) vs. response — Variable slope”.</p><p>Atlas displays its existing independent fits: unweighted least squares on individual positive-dose wells, with free baseline and plateau, Hill slope bounded to 0.1–5, and an EC50 search extending 100-fold beyond the tested dose range. These settings can differ from Prism or GDS. No new fits are calculated here; reported GDS values remain separate.</p><p>Choose <strong>Measured curve</strong> to connect the measured means, <strong>4PL fit</strong> for smooth fitted lines, or <strong>Both</strong> for solid measured curves with dashed fits. All styles retain measured means ± SD. Curves are drawn only within the tested range. If the plateau is not reached, EC50 may be poorly determined; check the fit warnings.</p></details><div id="graphCards"></div></section>`;
  const $=id=>host.querySelector('#'+id);
  $('graphSearch').value=s.query;$('graphTarget').value=s.target;$('graphWells').checked=s.wells;$('graphStyle').value=s.style;
  function matches(){const term=s.query.trim().toLowerCase();return data.compounds.filter(id=>id.toLowerCase().includes(term));}
  function syncAdd(){const id=$('graphBatch').value,added=s.selected.includes(id);$('graphAdd').disabled=!id||added||s.selected.length>=limit;$('graphAdd').textContent=added?'Already added':s.selected.length>=limit?'Six batches selected':'Add to comparison';}
  function batches(){const ids=matches().filter(id=>AtlasCompoundBatches.parse(id).base===$('graphCompound').value);$('graphBatch').innerHTML=ids.map(id=>`<option value="${E(id)}">${E(AtlasCompoundBatches.parse(id).batch||'Unspecified')}</option>`).join('');$('graphBatch').disabled=!ids.length;syncAdd();}
  let activeSuggestion=-1;
  function closeSuggestions(){
   $('graphSuggestions').hidden=true;$('graphSearch').setAttribute('aria-expanded','false');$('graphSearch').removeAttribute('aria-activedescendant');activeSuggestion=-1;
  }
  function search(open=true){
   s.query=$('graphSearch').value;
   const ids=matches(),bases=groups.filter(g=>ids.some(id=>AtlasCompoundBatches.parse(id).base===g.base));
   $('graphCompound').innerHTML=(bases.length>1&&s.query.trim()?'<option value="">Choose a matching compound</option>':'')+bases.map(g=>`<option>${E(g.base)}</option>`).join('');
   $('graphCompound').disabled=!bases.length;
   $('graphSearchStatus').textContent=!bases.length?'No matching compound batch. Check the ID or clear the search.':s.query.trim()?bases.length+' matching compound'+(bases.length===1?'':'s')+'. Choose a suggestion, then its batch.':'';
   $('graphSuggestions').innerHTML=bases.map((g,i)=>`<button type="button" role="option" tabindex="-1" aria-selected="false" id="graphSuggestion${i}" data-graph-suggestion="${E(g.base)}"><strong>${E(g.base)}</strong><small>Batch ${E(g.members.filter(m=>ids.includes(m.id)).map(m=>m.batch||'unspecified').join(', '))}</small></button>`).join('');
   closeSuggestions();
   if(open&&s.query.trim()&&bases.length){$('graphSuggestions').hidden=false;$('graphSearch').setAttribute('aria-expanded','true');}
   batches();
  }
  function chooseSuggestion(base){
   const exact=matches().find(id=>id.toLowerCase()===s.query.trim().toLowerCase());
   $('graphSearch').value=base;search(false);$('graphCompound').value=base;batches();
   if(exact){$('graphBatch').value=exact;syncAdd();}
   $('graphSearchStatus').textContent=base+' selected. Choose its batch and add it to the comparison.';
   $('graphSearch').focus();closeSuggestions();
  }
  $('graphSearch').onfocus=()=>{if(s.query.trim()&&$('graphSuggestions').children.length){$('graphSuggestions').hidden=false;$('graphSearch').setAttribute('aria-expanded','true');}};
  $('graphSearch').onkeydown=e=>{
   if(e.key==='Escape'){e.preventDefault();closeSuggestions();return;}
   if(e.key==='ArrowDown'||e.key==='ArrowUp'){
    e.preventDefault();if($('graphSuggestions').hidden)search();
    const options=[...$('graphSuggestions').querySelectorAll('[data-graph-suggestion]')];if(!options.length)return;
    activeSuggestion=activeSuggestion<0?(e.key==='ArrowDown'?0:options.length-1):(activeSuggestion+(e.key==='ArrowDown'?1:-1)+options.length)%options.length;
    options.forEach((option,i)=>option.setAttribute('aria-selected',String(i===activeSuggestion)));
    $('graphSearch').setAttribute('aria-activedescendant',options[activeSuggestion].id);options[activeSuggestion].scrollIntoView({block:'nearest'});
   }else if(e.key==='Enter'&&!$('graphSuggestions').hidden&&activeSuggestion>=0){e.preventDefault();chooseSuggestion($('graphSuggestions').children[activeSuggestion].dataset.graphSuggestion);}
  };
  $('graphSuggestions').onpointerdown=e=>{if(e.target.closest('[data-graph-suggestion]'))e.preventDefault();};
  host.onfocusout=e=>{if(!e.relatedTarget||!host.querySelector('.graph-search-field').contains(e.relatedTarget))closeSuggestions();};

  let cards=[];
  function draw(){
   closeSuggestions();
   $('graphSelected').innerHTML=s.selected.map((id,i)=>`<span class="graph-chip"><span style="color:${palette[i]}">${E(label(id))}</span><button type="button" data-graph-remove="${E(id)}" aria-label="Remove ${E(label(id))}">×</button></span>`).join('');
   $('graphStatus').textContent=s.selected.length+' of '+limit+' batches selected. '+(s.selected.length<2?'Add '+(s.selected.length?'another compound batch':'compound batches')+' to compare.':context(data,benchling));$('graphClear').disabled=!s.selected.length;syncAdd();
   cards=(s.target?[s.target]:data.targets).map(target=>({target,svg:graph({data,benchling,selected:s.selected,target,wells:s.wells,fits:s.style!=='measured',connect:s.style!=='4pl'})}));
   $('graphCards').innerHTML=s.selected.length?cards.map((c,i)=>`<section class="graph-card"><div class="panel-heading"><h3>${E(c.target)}</h3><div class="graph-downloads"><button type="button" class="secondary" data-graph-export="${i}" data-format="png" ${c.svg?'':'disabled'}>Download PNG</button><button type="button" class="secondary" data-graph-export="${i}" data-format="svg" ${c.svg?'':'disabled'}>Download SVG</button></div></div>${c.svg?'<div class="graph-scroll">'+c.svg+'</div>':'<p>No measured dose responses are available for the selected batches and target.</p>'}<details><summary>Measurements, fit warnings and source files</summary><div class="table-scroll"><table><thead><tr><th>Compound batch</th><th>Reported GDS EC50 (µM)</th><th>Independent 4PL EC50 (µM)</th><th>4PL baseline</th><th>4PL plateau</th><th>4PL Hill slope</th><th>Warnings and source</th></tr></thead><tbody>${s.selected.map(id=>{const q=data.curves.find(q=>q.compound===id&&q.target===c.target);return `<tr><th>${E(label(id))}</th><td>${q?.report?.ec50!=null?E((q.report.qualifier||'')+' '+q.report.ec50):'Not reported for this run'}</td><td>${q?.fit?.ec50!=null?E(q.fit.ec50):'Unavailable'}</td><td>${q?.fit?.s0!=null?E(q.fit.s0):'Unavailable'}</td><td>${q?.fit?.sinf!=null?E(q.fit.sinf):'Unavailable'}</td><td>${q?.fit?.hill!=null?E(q.fit.hill):'Unavailable'}</td><td>${q?E([q.report?.source_qc,...(q.fit_flags||[]),source(q)].filter(Boolean).join(' · ')):'No result for this target'}</td></tr>`;}).join('')}</tbody></table></div></details></section>`).join(''):'<p class="empty">Find a compound above and add its batch to start a comparison.</p>';
  }
  $('graphSearch').oninput=()=>search();$('graphCompound').onchange=()=>{closeSuggestions();batches();};$('graphBatch').onchange=()=>{closeSuggestions();syncAdd();};
  $('graphAdd').onclick=()=>{const id=$('graphBatch').value;if(id&&!s.selected.includes(id)&&s.selected.length<limit){s.selected.push(id);draw();}};
  $('graphTarget').onchange=()=>{s.target=$('graphTarget').value;draw();};$('graphWells').onchange=()=>{s.wells=$('graphWells').checked;draw();};$('graphStyle').onchange=()=>{s.style=$('graphStyle').value;draw();};$('graphClear').onclick=()=>{s.selected=[];draw();};
  host.onclick=async e=>{
   const suggestion=e.target.closest('[data-graph-suggestion]');if(suggestion)chooseSuggestion(suggestion.dataset.graphSuggestion);
   const remove=e.target.closest('[data-graph-remove]');if(remove){s.selected=s.selected.filter(id=>id!==remove.dataset.graphRemove);draw();$('graphAdd').focus();}
   const button=e.target.closest('[data-graph-export]');if(button){const card=cards[Number(button.dataset.graphExport)],selectedCount=s.selected.length;if(!card?.svg)return;button.disabled=true;try{await exportGraph(card.svg,[benchling,data.biological_replicate?'rep'+data.biological_replicate:'',data.condition_code,card.target,'comparison'].filter(Boolean).join('_').replace(/[^a-z0-9_-]/gi,'_'),button.dataset.format);$('graphStatus').textContent='Downloaded '+selectedCount+' selected batches · '+card.target+'.';}catch(err){$('graphStatus').textContent=err.message;}finally{if(button.isConnected)button.disabled=false;}}
  };
  search(false);draw();if(changed&&previous.length!==s.selected.length)$('graphStatus').textContent+=' '+(previous.length-s.selected.length)+' unavailable batch(es) removed for this Benchling ID.';
 }
 return {render,graph,exportGraph};
})();
