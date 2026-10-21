/* GDS classifications are supplied labels, independent of the activity cutoffs. */
const AtlasClassificationCounts=(()=>{
 const states=new WeakMap();
 const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const mode=q=>q.report?.source_mode||'Not reported';
 function render({host,data,curves,benchling,includeReference}){
  const previous=states.get(host);
  if(previous?.data===data&&previous.includeReference===includeReference&&previous.panel===host.firstElementChild)return;
  const dimension=benchling==='EXP26007104'?'configuration':'target',targets=data.targets;
  const modes=[...new Set(curves.map(mode))].sort(),compounds=new Set(curves.map(q=>q.compound));
  const increasing=curves.filter(q=>mode(q)==='increasing'),uniqueIncreasing=new Set(increasing.map(q=>q.compound));
  const selections=[];
  function countButton(number,target='',classification='',unit='results'){
   const index=selections.push({target,classification})-1;
   const label=`Show ${number} ${unit}: ${target||'all '+dimension+'s'} · ${classification||'all GDS classifications'}`;
   return `<button type="button" class="classification-count" data-classification-count="${index}" aria-label="${escape(label)}" aria-controls="classificationList" aria-expanded="false">${number}</button>`;
  }
  const label=`Benchling ID: ${benchling} · Replicate ${data.biological_replicate??'not identified'} · ${data.run_date||'Date not reported'}`;
  const identity=benchling==='EXP26007301'?'<p class="classification-identity"><strong>Compound count in the supplied data</strong> Each plate contains 13 other compounds plus RMC-0741051: 14 per plate × 2 plates = 28 compound placements, representing 27 unique compounds. Its original labels RMC-0741051-001 and RMC-0741051-002 both identify batch 001 in this Benchling ID. RMC-0769903-001 and RMC-0769904-001 are each counted separately within the 27. The selected reference plate supplies its result here; both plate measurements remain available separately.</p>':'';
  host.innerHTML=`<section class="panel source-classification-panel"><h2>GDS classifications · compound–${dimension} results</h2><p class="section-note"><strong>${countButton(compounds.size,'','','compound batches')} unique compounds × ${targets.length} ${dimension}s${curves.length===compounds.size*targets.length?' = '+curves.length+' results':''}.</strong> ${escape(label)}. Each compound has a separate GDS classification for each tested ${dimension}.</p>${identity}${increasing.length?`<p class="classification-explanation"><strong>${countButton(increasing.length,'','increasing')} increasing results across ${countButton(uniqueIncreasing.size,'','increasing','compound batches')} of ${countButton(compounds.size,'','','compound batches')} unique compounds.</strong> One compound can be increasing on more than one ${dimension}, so it can contribute several results.</p>`:''}<div class="table-scroll"><table><caption>Click a number to see its compounds. Each cell counts compound batches within that ${dimension}; different batches stay separate.</caption><thead><tr><th>${dimension==='target'?'Target':'Configuration'}</th>${modes.map(m=>`<th class="num">${escape(m)}</th>`).join('')}<th class="num">Compounds tested</th></tr></thead><tbody>${targets.map(target=>{const rows=curves.filter(q=>q.target===target);return `<tr><th>${escape(target)}</th>${modes.map(m=>`<td class="num">${countButton(rows.filter(q=>mode(q)===m).length,target,m,'compound batches')}</td>`).join('')}<td class="num">${countButton(rows.length,target,'','compound batches')}</td></tr>`;}).join('')}</tbody><tfoot><tr><th>All compound–${dimension} results</th>${modes.map(m=>`<td class="num">${countButton(curves.filter(q=>mode(q)===m).length,'',m)}</td>`).join('')}<td class="num">${countButton(curves.length)}</td></tr></tfoot></table></div><p class="section-note">The total row counts results across all ${dimension}s. GDS Data Mode labels are separate from the active-compound rule based on the selected Cmax and EC50 cutoffs.</p><section id="classificationList" class="classification-list" hidden aria-labelledby="classificationListTitle"><div class="panel-heading"><h3 id="classificationListTitle" tabindex="-1"></h3><button type="button" class="secondary" id="closeClassificationList">Close compound list</button></div><p class="section-note">${escape(label)}${benchling==='EXP26007301'?' · Reference plate '+escape(data.reference_plate):''}. Click a compound ID to see its dose–response curves.</p><label class="classification-search">Find compound<input type="search" id="classificationSearch" placeholder="Partial ID, e.g. 051" autocomplete="off"></label><p id="classificationListCount" role="status"></p><div id="classificationListTable" class="table-scroll"></div></section></section>`;
  states.set(host,{data,includeReference,panel:host.firstElementChild});
  const $=id=>host.querySelector('#'+id);let selected=null,opener=null;
  function update(){
   const all=curves.filter(q=>(!selected.target||q.target===selected.target)&&(!selected.classification||mode(q)===selected.classification));
   const query=$('classificationSearch').value.trim().toLowerCase();
   const visible=all.filter(q=>q.compound.toLowerCase().includes(query)||(q.source_compound||'').toLowerCase().includes(query));
   const groups=new Map();for(const q of visible){if(!groups.has(q.compound))groups.set(q.compound,[]);groups.get(q.compound).push(q);}
   $('classificationListCount').textContent=`${groups.size} of ${new Set(all.map(q=>q.compound)).size} compound batches shown · ${visible.length} matching compound–${dimension} results. Each row is one batch; its ${dimension} results remain separate.`;
   $('classificationListTable').innerHTML=groups.size?`<table><thead><tr><th>Compound</th><th>Batch</th><th>${dimension==='target'?'Target':'Configuration'} · GDS classification · plate</th><th>Original source ID</th></tr></thead><tbody>${[...groups].sort(([a],[b])=>a.localeCompare(b)).map(([id,rows])=>{const parsed=AtlasCompoundBatches.parse(id);return `<tr data-classification-compound="${escape(id)}"><td><button type="button" class="compound-link" data-compound="${escape(id)}" ${selected.target?`data-target="${escape(selected.target)}"`:''}>${escape(parsed.base)}</button></td><td>${escape(parsed.batch||'Unspecified')}</td><td>${rows.map(q=>`<div class="classification-result" data-classification-target="${escape(q.target)}" data-classification-mode="${escape(mode(q))}">${escape(q.target)} · ${escape(mode(q))}${q.physical_plate?' · '+escape(q.physical_plate):''}</div>`).join('')}</td><td>${[...new Set(rows.map(q=>q.source_compound||q.compound))].map(escape).join('<br>')}</td></tr>`;}).join('')}</tbody></table>`:'<p>No compounds match this classification and search.</p>';
  }
  $('classificationSearch').oninput=update;
  $('closeClassificationList').onclick=()=>{$('classificationList').hidden=true;host.querySelectorAll('[data-classification-count]').forEach(b=>b.setAttribute('aria-expanded','false'));opener?.focus();};
  host.onclick=e=>{
   const button=e.target.closest('[data-classification-count]');if(!button)return;
   opener=button;selected=selections[Number(button.dataset.classificationCount)];
   host.querySelectorAll('[data-classification-count]').forEach(b=>b.setAttribute('aria-expanded',String(b===button)));
   $('classificationListTitle').textContent=(selected.target||'All '+dimension+'s')+' · '+(selected.classification||'All GDS classifications');
   $('classificationSearch').value='';$('classificationList').hidden=false;update();
   $('classificationListTitle').focus({preventScroll:true});$('classificationList').scrollIntoView({block:'start'});
  };
 }
 return {render};
})();
