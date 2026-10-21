/* Explicit run/plate series and derived biological summaries. Supplied datasets are never mutated. */
(function(root){
 'use strict';
 const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const F=v=>Number.isFinite(v)?Number(v.toPrecision(5)).toString():'Unavailable';
 const mean=a=>a.reduce((s,v)=>s+v,0)/a.length;
 const sd=a=>a.length>1?Math.sqrt(a.reduce((s,v)=>s+(v-mean(a))**2,0)/(a.length-1)):null;
 const palette=['#0d4242','#378158','#637d25'];
 const choices=[{key:'d1-1',study:'EXP26003438',rep:1,label:'D1/CypA · Replicate 1'},{key:'d1-2',study:'EXP26003438',rep:2,label:'D1/CypA · Replicate 2'},... [1,2].flatMap(rep=>[1,2].map(plate=>({key:`sel-${rep}-${plate}`,study:'EXP26007301',rep,plate,label:`Selectivity · Replicate ${rep} · Plate ${plate}`})))];
 function buildSeries(datasets,selected,enabled,target,condition){
  const result=[];
  selected.forEach((id,index)=>choices.forEach((choice,marker)=>{
   if(!enabled.includes(choice.key))return;
   const data=datasets[choice.key],wanted=choice.study==='EXP26003438'?'Cyclin D1/CypA':target;
   const q=data?.curves.find(q=>q.compound===id&&q.target===wanted&&(!choice.plate||q.plate_number===choice.plate));if(!q)return;
   const plate=choice.plate?String(choice.plate):'Provided D1 plate aggregate';
   const date=choice.study==='EXP26003438'?(choice.rep===1?'2026-09-02':'2026-09-03'):(choice.rep===1?'2026-10-09':'2026-10-15');
   const conditionLabel=choice.study==='EXP26003438'?(condition==='A'?'No CypA inhibitor':'+25 µM CypA inhibitor'):'Selectivity assay';
   result.push({...q,series_id:id+'|'+choice.key,choice_key:choice.key,series_label:`${id} · ${wanted} · Rep ${choice.rep}${choice.plate?' · Plate '+choice.plate:''} · ${date}`,series_color:palette[index],series_marker:marker,benchling_id:choice.study,biological_replicate:choice.rep,run_date:date,condition_label:conditionLabel,plate_group:plate,error_bar_basis:'Sample SD across supplied wells at this dose',source_compound:q.source_compound||q.compound});
  }));
  return result;
 }
 function biologicalSummary(series){
  const groups=new Map();
  for(const q of series){const key=[q.compound,q.benchling_id,q.target,q.condition_label,q.plate_group].join('|');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(q);}
  return [...groups].map(([key,qs])=>{
   if(new Set(qs.map(q=>q.biological_replicate)).size!==qs.length)throw new Error('A biological replicate occurs more than once in a summary group. Choose separate plates.');
   const doses=[...new Set(qs.flatMap(q=>q.doses.map(d=>d.x)))].sort((a,b)=>a-b).map(x=>{
    const components=qs.map(q=>({q,d:q.doses.find(d=>d.x===x)})).filter(({d})=>Number.isFinite(d?.mean));
    const values=components.map(({d})=>d.mean),a=components.find(({q})=>q.biological_replicate===1),b=components.find(({q})=>q.biological_replicate===2);
    return {x,mean:values.length?mean(values):null,sd:sd(values),n:values.length,replicate1_mean:a?.d.mean??null,replicate2_mean:b?.d.mean??null,delta_rep2_minus_rep1:a&&b?b.d.mean-a.d.mean:null,components:components.map(({q,d})=>({series_id:q.series_id,replicate:q.biological_replicate,source_compound:q.source_compound,physical_plate:q.physical_plate,mean:d.mean,technical_sd:d.sd,n_wells:d.n,sources:q.sources}))};
   });
   const first=qs[0];
   return {...first,series_id:'summary|'+key,series_label:`${first.compound} · ${first.target}${first.benchling_id==='EXP26007301'?' · Plate '+first.plate_group:''} · Biological mean ± SD`,biological_replicate:null,run_date:null,source_compound:null,physical_plate:null,report:null,fit:null,fit_flags:[],doses,summary_components:qs.map(q=>({series_id:q.series_id,biological_replicate:q.biological_replicate,run_date:q.run_date,physical_plate:q.physical_plate,source_compound:q.source_compound,sources:q.sources})),error_bar_basis:'Sample SD across equally weighted biological-replicate means; plates kept separate'};
  });
 }
 function pooledSummary(series){
  return biologicalSummary(series).map(q=>{
   const members=series.filter(v=>q.summary_components.some(c=>c.series_id===v.series_id));
   const doses=q.doses.map(d=>{
    const components=d.components.map(c=>({...c,well_values:(members.find(v=>v.series_id===c.series_id)?.doses.find(v=>v.x===d.x)?.wells||[]).filter(Number.isFinite)}));
    const wells=components.flatMap(c=>c.well_values);
    return {...d,mean:wells.length?mean(wells):null,sd:sd(wells),n:wells.length,n_biological:components.filter(c=>c.well_values.length).length,wells,components};
   });
   return {...q,series_id:q.series_id.replace('summary|','pooled|'),series_label:q.series_label.replace('Biological mean ± SD','Pooled well mean ± well SD'),summary_kind:'pooled_wells',doses,error_bar_basis:'Sample SD across pooled measured wells; n is wells, not independent biological replicates'};
  });
 }
 function fitDisplayedMeans(series){
  return series.map(q=>{
   const points=q.doses.filter(d=>Number.isFinite(d.x)&&d.x>0&&Number.isFinite(d.mean)).map(d=>({x:d.x,y:d.mean}));
   // Reuse the established model without changing the supplied source curves.
   const [fit,flags]=points.length<6?[null,['At least six positive concentration means are required for this summary fit.']]:root.AtlasCore.fit4pl(points);
   const fit_flags=[...flags];
   if(q.doses.some(d=>(d.n_biological??d.n)<2))fit_flags.push('Some doses have fewer than two contributing biological runs');
   return {...q,fit,fit_flags,fit_basis:'New 4PL fit to displayed '+(q.summary_kind==='pooled_wells'?'pooled-well':'biological')+' means; one equally weighted point per positive concentration; not GDS or a supplied per-run fit'};
  });
 }
 function plateDifferences(series){
  const pairs=[];
  for(const a of series.filter(q=>q.benchling_id==='EXP26007301'&&q.plate_group==='1')){
   const b=series.find(q=>q.compound===a.compound&&q.benchling_id===a.benchling_id&&q.target===a.target&&q.biological_replicate===a.biological_replicate&&q.plate_group==='2');if(!b)continue;
   for(const d of a.doses){const e=b.doses.find(v=>v.x===d.x);if(!Number.isFinite(d.mean)||!Number.isFinite(e?.mean))continue;pairs.push({compound:a.compound,target:a.target,replicate:a.biological_replicate,dose_um:d.x,plate1_mean:d.mean,plate2_mean:e.mean,delta_plate2_minus_plate1:e.mean-d.mean,plate1_source:a.source_compound,plate2_source:b.source_compound});}
  }
  return pairs;
 }
 function csv(series){
  const headers=['series_id','compound_batch','benchling_id','target','condition','biological_replicate','run_date','plate_group','physical_plate','original_source_id','concentration_um','mean_response','sd','sd_basis','n','n_basis','replicate1_mean','replicate2_mean','delta_rep2_minus_rep1','source_files','summary_components','well_values','n_biological','fit_basis','fit_ec50_um','fit_baseline','fit_plateau','fit_hill','fit_r2','fit_flags'];
  const rows=series.flatMap(q=>q.doses.map(d=>[q.series_id,q.compound,q.benchling_id,q.target,q.condition_label,q.biological_replicate,q.run_date,q.plate_group,q.physical_plate,q.source_compound,d.x,d.mean,d.sd,q.error_bar_basis,d.n,q.summary_kind==='pooled_wells'?'Pooled measured wells':q.summary_components?'Biological replicates':'Measured wells',d.replicate1_mean,d.replicate2_mean,d.delta_rep2_minus_rep1,(q.sources||[]).join('; '),q.summary_components?JSON.stringify(d.components):'',q.summary_components&&!d.wells?'':JSON.stringify(d.wells||[]),d.n_biological??(q.summary_components?d.n:1),q.fit_basis||(q.fit?'Supplied independent per-run fit':''),q.fit?.ec50,q.fit?.s0,q.fit?.sinf,q.fit?.hill,q.fit?.r2,q.fit_flags?.join('; ')]));
  return [headers,...rows].map(r=>r.map(v=>{if(v==null)return '';let s=String(v);if(typeof v==='string'&&/^[=+\-@]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';}).join(',')).join('\r\n');
 }
 const cache=new Map(),mounts=new WeakMap();
 async function file(name){if(!cache.has(name))cache.set(name,fetch('./'+name).then(r=>{if(!r.ok)throw new Error('Unable to load '+name);return r.json();}).catch(e=>{cache.delete(name);throw e;}));return cache.get(name);}
 async function datasets(condition){
  const [d1a,d1b,sa,sb]=await Promise.all([file(condition==='B'?'cyclind1.json':'cyclind1-bio1-A.json'),file('cyclind1-bio2-'+condition+'.json'),file('sample.json'),file('selectivity-rep2.json')]);
  const sel1=AtlasSelectivityIdentity.prepare(sa,{referencePlate:'all'}),sel2=AtlasSelectivityIdentity.prepare(sb,{referencePlate:'all'});
  return {'d1-1':d1a,'d1-2':d1b,'sel-1-1':sel1,'sel-1-2':sel1,'sel-2-1':sel2,'sel-2-2':sel2};
 }
 function saveCSV(text,name){const url=URL.createObjectURL(new Blob(['\uFEFF'+text],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 async function render({host}){
  if(mounts.has(host))return;
  const s={selected:['RMC-0741051-001'],enabled:choices.map(c=>c.key),target:'Cyclin D3',condition:'A',style:'both',wells:false,mode:'individual',version:0};mounts.set(host,s);
  host.innerHTML='<section class="panel">Loading measured runs and plate-specific reference curves…</section>';
  try{s.data=await datasets(s.condition);s.gds=await file('cyclind1-source-parameters.json');}catch(e){mounts.delete(host);host.textContent=e.message+' Reopen this view to retry.';return;}
  const ids=[...new Set(Object.values(s.data).flatMap(d=>d.compounds))].sort();
  host.innerHTML=`<section class="panel run-panel"><h2>Compare screening, plates and biological replicates</h2><p>Choose up to 3 compound batches. Runs below control this view independently of the global Benchling ID and activity filters. Plate 1 and plate 2 are separate measurements of the same RMC-0741051 batch 001.</p><div class="toolbar run-picker"><label>Find compound<input id="runSearch" type="search" placeholder="Type 051 or an RMC ID" autocomplete="off"></label><label>Matching compound batch<select id="runCompound"></select></label><button id="runAdd" type="button" class="primary">Add compound</button></div><p id="runSearchCount" class="section-note" role="status"></p><div id="runSelected" class="graph-selections"></div><div class="toolbar run-options"><label>Selectivity target<select id="runTarget">${s.data['sel-1-1'].targets.map(t=>`<option ${t===s.target?'selected':''}>${E(t)}</option>`).join('')}</select></label><label>D1/CypA condition<select id="runCondition"><option value="A">No CypA inhibitor</option><option value="B">+25 µM CypA inhibitor</option></select></label><label>Replicate display<select id="runMode"><option value="technical">Individual technical wells</option><option value="individual">Technical means by biological run</option><option value="summary">Biological mean ± biological SD</option><option value="pooled">All wells pooled ± well SD</option></select></label><label>Graph style<select id="runStyle"><option value="measured">Measured curves</option><option value="4pl">4PL fit (see fit basis below)</option><option value="both" selected>Both</option></select></label><label class="check"><input type="checkbox" id="runWells">Show individual wells</label></div><fieldset class="run-choices"><legend>Runs and plates to include</legend>${choices.map(c=>`<label><input type="checkbox" data-run-choice="${c.key}" checked>${E(c.label)}</label>`).join('')}</fieldset><p id="runStatus" class="section-note" role="status"></p><div class="run-sd-help"><strong>What is combined, and what do the error bars mean?</strong><p>Compare individual technical wells shows each supplied well as an open symbol, alongside its run’s mean. Technical means averages wells within each run and overlays the biological runs. Wells are compared at each concentration; no technical-replicate pairing across concentrations is assumed.</p><p>Separate runs: mean ± sample SD across measured wells at each concentration. Selectivity curves normally have two technical wells on one physical plate. The D1 RMC-0741051 reference pools 48 wells per dose across plates within each biological run; its supplied SD is not a single-plate technical SD.</p><p>Biological summary: first use each run’s dose mean, then calculate their equally weighted mean and sample SD. With both runs selected, n = 2 biological replicates. Plate 1 and plate 2 remain separate summaries. No concentrations are interpolated; a missing run gives n = 1 and no SD. SD describes variation, not a change in activity or statistical significance.</p><p>Pool technical + biological wells gives every supplied well equal weight across the selected runs. Its SD includes within-run and between-run variation; n counts wells, not independent biological replicates. Unequal well counts give runs unequal weight. This is different from the equally weighted biological mean.</p><p>4PL: individual-run views use existing independent fits. Combined views calculate a new fit to the displayed means, with one equally weighted point per positive concentration. Baseline and plateau are free; Hill slope is bounded to 0.1–5, with an EC50 search up to 100-fold outside the tested range. Fit warnings and parameters are shown below. These derived fits are not GDS results and do not average EC50 values. Source files are unchanged.</p></div><div class="graph-downloads"><button id="runPNG" type="button" class="secondary">Download PNG</button><button id="runSVG" type="button" class="secondary">Download SVG</button><button id="runCSV" type="button" class="secondary">Export displayed dose values CSV</button></div><div id="runGraph" class="graph-scroll"></div><div id="runDisplayedFits"></div><details open><summary>Activity and fit parameters for each selected run</summary><p class="section-note">D1 run-specific Cmax is an observed peak dose mean. Its separate GDS source report is shown below, without a biological replicate assignment. Cmax depends on assay context; differences alone do not establish selectivity.</p><div id="runParameters" class="table-scroll"></div></details><details><summary>D1 screening GDS source report · replicate unassigned</summary><p class="section-note">EXP26003438 · No CypA inhibitor. This report does not change with the D1 condition selector; it is not assigned to any plotted run.</p><div id="runGDS" class="table-scroll"></div></details><details><summary>Values at each concentration · SD and biological-replicate differences</summary><p class="section-note">Δ = replicate 2 mean − replicate 1 mean, in corrected-response units. Biological summaries use the checked runs and keep plate groups separate.</p><div id="runDoseTable" class="table-scroll"></div></details><details><summary>Plate 2 − plate 1 at each concentration</summary><div id="runPlateDelta" class="table-scroll"></div></details></section>`;
  const $=id=>host.querySelector('#'+id);
  function search(){const term=$('runSearch').value.trim().toLowerCase(),matches=ids.filter(id=>id.toLowerCase().includes(term));$('runCompound').innerHTML=matches.map(id=>`<option>${E(id)}</option>`).join('');$('runSearchCount').textContent=matches.length+' matching compound batches. Batches remain separate.';addState();}
  function addState(){$('runAdd').disabled=!$('runCompound').value||s.selected.includes($('runCompound').value)||s.selected.length>=3;}
  function table(headers,rows){return '<table><thead><tr>'+headers.map(h=>'<th>'+E(h)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+r.map(v=>'<td>'+E(v??'Unavailable')+'</td>').join('')+'</tr>').join('')+'</tbody></table>';}
  function draw(){
   if(s.loading)return;
   s.series=buildSeries(s.data,s.selected,s.enabled,s.target,s.condition);const summaries=biologicalSummary(s.series),summary=s.mode==='summary',pooled=s.mode==='pooled',combined=summary||pooled,technical=s.mode==='technical';s.display=summary?summaries:pooled?pooledSummary(s.series):s.series;
   if(combined&&s.style!=='measured')s.display=fitDisplayedMeans(s.display);
   $('runMode').value=s.mode;$('runStyle').disabled=false;$('runWells').disabled=summary||technical;$('runStyle').value=s.style;$('runWells').checked=technical||(!summary&&s.wells);
   $('runSelected').innerHTML=s.selected.map(id=>`<span class="graph-chip">${E(id)}<button type="button" data-run-remove="${E(id)}" aria-label="Remove ${E(id)}">×</button></span>`).join('');addState();
   const absent=s.selected.flatMap(id=>choices.filter(c=>s.enabled.includes(c.key)&&!s.series.some(q=>q.compound===id&&q.choice_key===c.key)).map(c=>id+' · '+c.label));
   const missingD1=s.selected.filter(id=>s.enabled.some(k=>k.startsWith('d1-'))&&!s.series.some(q=>q.compound===id&&q.benchling_id==='EXP26003438'));
   $('runStatus').textContent=s.series.length+' measured series · '+s.display.length+' displayed series. '+(summary?'Equal-weight biological means; SD between run means; n counts biological runs. ':pooled?'Pooled well means; SD across all included wells; n counts wells, not biological runs. ':'Separate biological runs; error bars use within-run measured-well SD. ')+(combined&&s.style!=='measured'?'4PL fits are newly calculated from displayed means. ':'')+'Each compound appears only on plates where it was measured.'+(missingD1.length?' No exact D1 batch match: '+missingD1.join(', ')+'.':'');
   const plottedTargets=[...new Set(s.display.map(q=>q.target))],plottedBenchling=[...new Set(s.display.map(q=>q.benchling_id))],hasD1=plottedBenchling.includes('EXP26003438');
   s.graphTitle=plottedTargets.join(' vs ');
   const notes=[summary?'Filled symbols: equally weighted biological mean ± between-run sample SD; n is biological runs.':pooled?'Symbols: pooled well mean ± well SD. n is measured wells, not independent biological replicates.':'Symbols: supplied dose mean ± within-run measured-well sample SD.',
    summary?'Open circles: replicate 1 mean; open squares: replicate 2 mean. Technical wells are averaged within each run.':technical?'Open symbols: individual supplied wells; symbol shape identifies the run in the legend.':s.wells?'Open circles: individual supplied well measurements.':'Individual wells are hidden.',
    ...(pooled?['Each well has equal weight. Runs with more wells contribute more; SD includes within- and between-run variation.']:[]),
    ...(hasD1?['D1 reference: 48 wells per dose across plates within each run; plate groups are already aggregated in its supplied curve.']:[]),
    s.style==='measured'?'Lines connect measured means; fits are hidden.':combined?'New 4PL fit to displayed means: one equally weighted point per concentration. This is not a supplied per-run or GDS fit.':'4PL curves are supplied independent per-run fits, not GDS-reported fits.',
    ...(s.style==='both'?['Solid lines connect means; dashed lines show 4PL fits.']:[]),
    'Benchling ID'+(plottedBenchling.length>1?'s':'')+': '+plottedBenchling.join(' / ')+'. Assays, batches and plate groups remain separate.',...(hasD1?['D1 condition: '+(s.condition==='A'?'No CypA inhibitor':'+25 µM CypA inhibitor')+'.']:[]),
    ...absent.map(v=>'No result for selected series: '+v),...s.display.flatMap(q=>q.fit_flags?.length&&s.style!=='measured'?[q.series_label+': '+q.fit_flags.join('; ')]:[])];
   s.svg=AtlasCompoundGraphs.graph({data:{response_mode:'corrected',error_bar_basis:summary?'Between-biological-replicate sample SD':pooled?'Pooled measured-well sample SD':'Supplied within-run measured-well sample SD'},benchling:plottedBenchling.join(' / '),selected:s.selected,target:s.graphTitle,series:s.display,contextLabel:(summary?'Biological means':pooled?'Pooled technical and biological wells':'Separate biological runs')+' · '+plottedBenchling.join(' / '),notesOverride:notes,wells:$('runWells').checked,fits:s.style!=='measured',connect:s.style!=='4pl',showComponents:summary,wellMarkersBySeries:technical});
   $('runDisplayedFits').innerHTML=combined&&s.style!=='measured'?'<h3>New 4PL fits to displayed means</h3><p class="section-note">Unweighted concentration means; baseline and plateau free. EC50 is descriptive when plateaus are not established. Original per-run and GDS parameters remain below.</p>'+table(['Series','New fitted EC50 (µM)','Baseline','Plateau','Hill slope','R²','Fit warnings'],s.display.map(q=>[q.series_label,F(q.fit?.ec50),F(q.fit?.s0),F(q.fit?.sinf),F(q.fit?.hill),F(q.fit?.r2),q.fit_flags?.join('; ')||'No automatic flags'])):'';
   $('runGraph').innerHTML=s.svg||'<p>No measured series for this selection.</p>';for(const id of ['runPNG','runSVG','runCSV'])$(id).disabled=!s.svg;
   $('runParameters').innerHTML=table(['Compound batch / run','Cmax','Cmax basis','GDS EC50 (µM)','Independent 4PL EC50 (µM)','Fit warnings','GDS QC / Valid','Original ID / plate / source'],s.series.map(q=>[q.series_label,F(q.cmax),q.cmax_basis,q.report?.ec50!=null?(q.report.qualifier||'')+' '+F(q.report.ec50):'Not assigned to this run',F(q.fit?.ec50),q.fit_flags?.join('; ')||'No automated flags',q.report?(q.report.source_qc||'No source QC flag')+' · Valid: '+(q.report.source_valid||'not reported'):'Not assigned to this run',[(q.source_compound||q.compound),q.physical_plate,...(q.sources||[]),q.report?.source,q.report?.source_row!=null?'row '+q.report.source_row:''].filter(Boolean).join(' · ')]));
   $('runGDS').innerHTML=table(['Compound batch','Reported Cmax','GDS EC50 (µM)','QC / Valid','Source'],s.selected.map(id=>{const r=s.gds.find(q=>q.compound===id);return [id,F(r?.cmax),r?.ec50!=null?(r.qualifier||'')+' '+F(r.ec50):'No exact batch match',r?(r.source_qc||'No QC flag')+' · Valid: '+(r.source_valid||'not reported'):'Unavailable',r?r.source+' · row '+r.source_row:'Unavailable'];}));
   $('runDoseTable').innerHTML=table(['Compound / assay / plate','Dose (µM)','Replicate 1 mean','Replicate 2 mean','Δ rep 2 − rep 1','Biological mean','Between-run SD','n biological runs','Within-run SD / n wells'],summaries.flatMap(q=>q.doses.map(d=>[q.series_label,F(d.x),F(d.replicate1_mean),F(d.replicate2_mean),F(d.delta_rep2_minus_rep1),F(d.mean),F(d.sd),d.n,d.components.map(c=>'Rep '+c.replicate+': SD '+F(c.technical_sd)+'; n='+c.n_wells).join(' · ')])));
   const deltas=plateDifferences(s.series);$('runPlateDelta').innerHTML=deltas.length?table(['Compound batch','Target','Replicate','Dose (µM)','Plate 1 mean','Plate 2 mean','Δ plate 2 − plate 1','Original labels'],deltas.map(d=>[d.compound,d.target,d.replicate,F(d.dose_um),F(d.plate1_mean),F(d.plate2_mean),F(d.delta_plate2_minus_plate1),d.plate1_source+' / '+d.plate2_source])):'<p>Select both plate groups for the same replicate and RMC-0741051 to compare plate measurements.</p>';
  }
  $('runSearch').oninput=search;$('runCompound').onchange=addState;$('runAdd').onclick=()=>{const id=$('runCompound').value;if(id&&!s.selected.includes(id)&&s.selected.length<3){s.selected.push(id);draw();}};
  host.onclick=e=>{const b=e.target.closest('[data-run-remove]');if(b){s.selected=s.selected.filter(id=>id!==b.dataset.runRemove);draw();}};
  host.querySelectorAll('[data-run-choice]').forEach(el=>el.onchange=()=>{s.enabled=[...host.querySelectorAll('[data-run-choice]:checked')].map(e=>e.dataset.runChoice);draw();});
  $('runTarget').onchange=()=>{s.target=$('runTarget').value;draw();};$('runMode').onchange=()=>{s.mode=$('runMode').value;draw();};$('runStyle').onchange=()=>{s.style=$('runStyle').value;draw();};$('runWells').onchange=()=>{s.wells=$('runWells').checked;draw();};
  $('runCondition').onchange=async()=>{const version=++s.version,condition=$('runCondition').value;s.loading=true;$('runStatus').textContent='Loading D1 condition…';$('runGraph').innerHTML='';for(const id of ['runPNG','runSVG','runCSV'])$(id).disabled=true;try{const data=await datasets(condition);if(version!==s.version)return;s.data=data;s.condition=condition;s.loading=false;draw();}catch(e){if(version!==s.version)return;$('runCondition').value=s.condition;s.loading=false;draw();$('runStatus').textContent=e.message;}};
  for(const format of ['PNG','SVG'])$('run'+format).onclick=async()=>{try{await AtlasCompoundGraphs.exportGraph(s.svg,'runs_'+s.graphTitle.replace(/\W+/g,'_')+'_'+s.mode,format.toLowerCase());}catch(e){$('runStatus').textContent=e.message;}};
  $('runCSV').onclick=()=>saveCSV(csv(s.display),'selected_runs_'+s.mode+'_dose_values.csv');
  search();draw();
 }
 const api={buildSeries,biologicalSummary,pooledSummary,fitDisplayedMeans,plateDifferences,csv,render};root.AtlasRunComparison=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
