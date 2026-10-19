(function(root){
  'use strict';
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const states=new WeakMap();
  const defaultGroup=study=>({'EXP26007301':'selectivity','EXP26007104':'orientation','EXP26003438':'d1',trfret:'tr_fret',crosslink:'crosslinking'}[study]||study||'selectivity');
  const datasetLabels={
    'sample.json':'Selectivity results · biological replicate 1',
    'selectivity-rep2.json':'Selectivity results · biological replicate 2',
    'selectivity-rep2-normalization.json':'Selectivity normalization check · replicate 2',
    'selectivity-rep2-normalization.csv':'Selectivity normalization check · replicate 2',
    'cyclin-panel-normalization-recheck.csv':'Selectivity normalization check · replicate 1',
    'normalization-verification.json':'Raw signal and normalization checks',
    'normalization-audit.json':'Normalization audit',
    'cyclind1.json':'Cyclin D1/CypA · replicate 1 · with inhibitor',
    'cyclind1-bio1-A.json':'Cyclin D1/CypA · replicate 1 · no inhibitor',
    'cyclind1-bio2-A.json':'Cyclin D1/CypA · replicate 2 · no inhibitor',
    'cyclind1-bio2-B.json':'Cyclin D1/CypA · replicate 2 · with inhibitor',
    'cyclind1-instrument.json':'Cyclin D1/CypA raw instrument readings',
    'cyclind1-source-parameters.json':'Cyclin D1/CypA reported parameters · replicate unassigned',
    'cypa-dependency.json':'CypA inhibitor comparison',
    'orientation-rep1-gds.json':'Tag configurations · replicate 1 · GDS corrected results',
    'orientation-rep2-gds.json':'Tag configurations · replicate 2 · GDS corrected results',
    'orientation-rep1-ratio.json':'Tag configurations · replicate 1 · independent ratio reanalysis',
    'orientation-rep2-ratio.json':'Tag configurations · replicate 2 · independent ratio reanalysis',
    'orientation-instrument.json':'Tag-configuration raw instrument readings',
    'orientation-normalization.json':'Tag-configuration normalization check',
    'supporting-assays.json':'Kd1 time points, detailed TR-FRET and NanoBRET source summaries',
    'crosslinking.json':'Crosslinking results and assay context'
  };
  const uses=record=>[...new Set(record.atlas_datasets.map(filename=>datasetLabels[filename]||'Historical assay reference'))];
  let request;
  async function load(){
    if(!request)request=fetch('./data-sources.json?v=sources-1').then(response=>{if(!response.ok)throw new Error('Source registry could not be loaded.');return response.json();}).catch(error=>{request=null;throw error;});
    return request;
  }
  async function render({host,study='EXP26007301',group}={}){
    if(typeof host==='string')host=document.getElementById(host);
    if(!host)return;
    const token={};host.atlasSourcesRequest=token;
    try{
      const registry=await load();if(host.atlasSourcesRequest!==token)return;
      const wanted=defaultGroup(group||study),valid=registry.groups.some(item=>item.id===wanted)?wanted:'all';
      let state=states.get(host);
      if(!state||state.study!==study||group){state={study,group:valid,query:'',audit:false,older:false};states.set(host,state);}
      const labels={current:'Current source',audit:'Audit only',superseded:'Older / superseded',missing:'Older original unavailable'};
      host.innerHTML=`<section class="panel atlas-sources"><div class="eyebrow">DATA ORIGINS</div><h2>Trace each result to its source</h2><p class="sources-intro">See which original files support each assay, with their exact filenames and workbook sheets.</p><p class="sources-library-note">${escape(registry.availability)}</p><div class="sources-controls"><label>Assay / experiment<select data-source-group><option value="all">All six assay groups</option>${registry.groups.map(item=>`<option value="${escape(item.id)}" ${state.group===item.id?'selected':''}>${escape(item.label)}</option>`).join('')}</select></label><label>Find a file<input type="search" data-source-search value="${escape(state.query)}" placeholder="Filename, role or plate number"></label><label class="sources-check"><input type="checkbox" data-source-audit ${state.audit?'checked':''}>Show audit-only files</label><label class="sources-check"><input type="checkbox" data-source-older ${state.older?'checked':''}>Show older / unavailable originals</label></div><p class="sources-help">Current source identifies the files used for the current Atlas results. Audit and older files are labelled separately; these labels describe data use.</p><div data-source-context></div><p data-source-count class="section-note" role="status" aria-live="polite"></p><div data-source-cards class="sources-cards"></div><p data-source-copy-status class="section-note" role="status" aria-live="polite"></p></section>`;
      const panel=host.querySelector('.atlas-sources'),get=selector=>panel.querySelector(selector);
      get('[data-source-group]').value=state.group;
      function draw(){
        const selected=registry.groups.filter(item=>state.group==='all'||item.id===state.group);
        get('[data-source-context]').innerHTML=selected.map(item=>`<section class="sources-assay-context"><h3>${escape(item.label)}</h3><p>${escape(item.description)}</p>${item.assay_details?.length?`<details><summary>Workbook sheets and source cells</summary><div class="table-scroll"><table><thead><tr><th>Series</th><th>Exact sheet name</th><th>Source cells / slides</th><th>Source notes</th></tr></thead><tbody>${item.assay_details.map(detail=>`<tr><th>${escape(detail.label)}</th><td><code class="sources-verbatim">${escape(detail.sheet)}</code></td><td>${escape(detail.source_cells)}</td><td>${escape(detail.records?detail.records+' source records. ':'')}${escape(detail.notes)}</td></tr>`).join('')}</tbody></table></div></details>`:''}</section>`).join('');
        const groupRows=registry.records.filter(record=>state.group==='all'||record.groups.includes(state.group));
        const rows=groupRows.filter(record=>(record.status==='current'||record.status==='audit'&&state.audit||['superseded','missing'].includes(record.status)&&state.older)&&(!state.query||[record.filename,record.role,record.library_path,...record.atlas_datasets].join(' ').toLowerCase().includes(state.query.toLowerCase())));
        const hidden=groupRows.length-rows.length;
        get('[data-source-count]').textContent=`${rows.length} source files shown${hidden?` · ${hidden} hidden by the current filters`:''}. ${groupRows.filter(record=>record.status==='current').length} current sources in the selected assay group${state.group==='all'?'s':''}.`;
        get('[data-source-cards]').innerHTML=rows.length?rows.map(record=>{
          const folder=record.library_path?.split('/').slice(0,-1).join('/');
          return `<article class="source-card source-status-${escape(record.status)}"><div class="source-card-top"><span class="source-status">${escape(labels[record.status])}</span><span>${escape(record.study)}</span></div><h3>${escape(record.filename)}</h3><p class="source-role">${escape(record.role)}</p>${record.sheets.length?`<p><strong>Workbook sheets:</strong> ${record.sheets.map(sheet=>`<code class="sources-verbatim">${escape(sheet)}</code>`).join(' · ')}</p>`:''}<div class="source-uses"><strong>Used for:</strong> ${uses(record).length?`<ul>${uses(record).map(label=>`<li>${escape(label)}</li>`).join('')}</ul>`:'Historical reference; no current assay results.'}</div>${record.atlas_datasets.length?`<details class="source-dataset-references"><summary>Dataset references</summary><p>Generated Atlas datasets supported by this source:</p><ul>${record.atlas_datasets.map(filename=>`<li><code>${escape(filename)}</code></li>`).join('')}</ul></details>`:''}${record.notes?`<details class="source-notes"><summary>Source notes</summary><p>${escape(record.notes)}</p></details>`:''}${folder?`<details><summary>Locate original in the source library</summary><p>Relative folder:</p><code class="source-folder">${escape(folder)}</code><button type="button" class="secondary" data-copy-source-folder="${escape(record.id)}">Copy relative folder</button><p class="sources-help">Open this folder inside the owner’s local Target Atlas source library. This is not a website address.</p>${record.sha256?`<p><strong>SHA-256:</strong> <code class="source-hash">${escape(record.sha256)}</code></p>`:''}</details>`:'<p class="sources-missing">Original workbook not located. No replacement file is presented as an original.</p>'}</article>`;
        }).join(''):'<p class="empty">No source files match these filters.</p>';
      }
      panel.addEventListener('change',event=>{if(event.target.matches('[data-source-group]'))state.group=event.target.value;if(event.target.matches('[data-source-audit]'))state.audit=event.target.checked;if(event.target.matches('[data-source-older]'))state.older=event.target.checked;draw();});
      panel.addEventListener('input',event=>{if(event.target.matches('[data-source-search]')){state.query=event.target.value.trim();draw();}});
      panel.addEventListener('click',async event=>{
        const id=event.target.closest('[data-copy-source-folder]')?.dataset.copySourceFolder;if(!id)return;
        const record=registry.records.find(item=>item.id===id),folder=record?.library_path?.split('/').slice(0,-1).join('/');if(!folder)return;
        try{await navigator.clipboard.writeText(folder);get('[data-source-copy-status]').textContent='Relative source-library folder copied.';}catch(error){get('[data-source-copy-status]').textContent='Copy this relative source-library folder: '+folder;}
      });
      draw();
      return {getFilters:()=>({...state})};
    }catch(error){if(host.atlasSourcesRequest===token){host.innerHTML=`<section class="panel atlas-sources"><h2>Data sources</h2><p role="alert">${escape(error.message)}</p><button type="button" class="secondary" data-source-retry>Retry loading sources</button></section>`;host.querySelector('[data-source-retry]').addEventListener('click',()=>render({host,study,group}));}}
  }
  root.AtlasSources={render,load,defaultGroup};
})(typeof globalThis!=='undefined'?globalThis:this);
