/* Presentation choices only. Color overrides never touch supplied curves. */
const AtlasGraphOptions=(()=>{
 'use strict';
 const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const valid=c=>/^#[0-9a-f]{6}$/i.test(c||'');
 function applyColors(series,overrides){return series.map(q=>({...q,series_color:valid(overrides[q.series_id])?overrides[q.series_id]:q.series_color}));}
 function colors(host,series,overrides,redraw){
  const signature=JSON.stringify(series.map(q=>[q.series_id,q.series_label]));
  if(host.dataset.colorSeries!==signature){
   host.dataset.colorSeries=signature;
   host.innerHTML=series.length?'<div class="graph-color-list">'+series.map(q=>`<label><input type="color" data-graph-color="${E(q.series_id)}" value="${E(q.series_color)}"><span>${E(q.series_label)}</span></label>`).join('')+'</div><button type="button" data-reset-colors class="secondary">Reset colors</button>':'<p>No plotted series selected.</p>';
  }
  host.querySelectorAll('[data-graph-color]').forEach(input=>{input.value=series.find(q=>q.series_id===input.dataset.graphColor).series_color;});
  host.onchange=e=>{const input=e.target.closest('[data-graph-color]');if(input&&valid(input.value)){overrides[input.dataset.graphColor]=input.value;redraw();}};
  host.onclick=e=>{if(e.target.closest('[data-reset-colors]')){for(const key of Object.keys(overrides))delete overrides[key];redraw();}};
 }
 const modes=[['technical','Compare technical wells'],['individual','Compare biological runs (technical means)'],['summary','Combine biological means'],['pooled','Combine technical + biological wells']];
 const help={technical:'Each open symbol is a measured well. Wells are compared at each concentration, without pairing them across concentrations.',individual:'Technical wells are averaged within each run. Error bars show within-run sample SD.',summary:'Each biological run contributes one mean per concentration. Error bars show between-run sample SD; n counts biological runs.',pooled:'Each supplied well has equal weight within its condition and plate group. Error bars show pooled-well SD; n counts wells, not independent biological runs.'};
 function controls(prefix){return `<label>Compare or combine<select id="${prefix}Mode">${modes.map(([key,label])=>`<option value="${key}">${label}</option>`).join('')}</select></label><label>Curve display<select id="${prefix}Style"><option value="measured">Measured curves · no 4PL</option><option value="4pl">4PL curves</option><option value="both">Measured curves + 4PL</option></select></label><label class="check"><input type="checkbox" id="${prefix}Wells">Show individual wells</label><p id="${prefix}ModeHelp" class="workspace-mode-help"></p><details open class="graph-colors"><summary>Series colors</summary><div id="${prefix}Colors"></div></details>`;}
 return {applyColors,colors,controls,help};
})();
