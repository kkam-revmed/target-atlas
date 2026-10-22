/* Presentation choices only. Color overrides never touch supplied curves. */
const AtlasGraphOptions=(()=>{
 'use strict';
 const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const valid=c=>/^#[0-9a-f]{6}$/i.test(c||'');
 function applyColors(series,overrides){return series.map(q=>({...q,series_color:valid(overrides[q.series_id])?overrides[q.series_id]:q.series_color}));}
 // Explicit graph RGB guidance (slides 4/7) and secondary palette (slide 42).
 // Colors are presentation choices; they do not assign a drug identity or assay role.
 const bdrPalette=[
  ['Progressive Green','#13d377'],['Blue-Violet','#5136e0'],['Purple','#a24dff'],
  ['Balanced Green','#1f6b5d'],['Light Blue-Violet','#8d9bff'],['Approachable','#7affe5'],
  ['Black','#000000'],['Light Purple','#d1a6ff'],['Dark Purple','#5c2c91'],
  ['Dark Blue-Violet','#2b1980'],['Light Red-Orange','#ff9966'],['Red-Orange','#ff5400'],
  ['Dark Red-Orange','#c44202'],['Light Yellow-Orange','#ffcd69'],['Yellow-Orange','#ffaa00'],['Dark Yellow-Orange','#c28100']
 ];
 function colors(host,series,overrides,redraw){
  const signature=JSON.stringify(series.map(q=>[q.series_id,q.series_label]));
  if(host.dataset.colorSeries!==signature){
   host.dataset.colorSeries=signature;
   const swatches=id=>bdrPalette.map(([name,color])=>`<button type="button" class="bdr-swatch" data-bdr-series="${E(id)}" data-bdr-color="${color}" style="--swatch:${color}" aria-label="${E(name)} (${color.toUpperCase()})" aria-pressed="false" title="${E(name)} · ${color.toUpperCase()}"></button>`).join('');
   host.innerHTML=series.length?'<div class="bdr-palette-intro"><strong>BDR graph palette</strong><div class="bdr-palette-preview" aria-label="BDR color swatches">'+bdrPalette.map(([name,color])=>`<span style="--swatch:${color}" title="${E(name)} · ${color.toUpperCase()}"></span>`).join('')+'</div><button type="button" data-apply-bdr class="secondary">Apply BDR palette</button><small>Presentation slides 4, 7 and 42</small></div><div class="graph-color-list">'+series.map(q=>`<div class="graph-color-row"><label><input type="color" data-graph-color="${E(q.series_id)}" value="${E(q.series_color)}"><span>${E(q.series_label)}</span></label><details class="bdr-series-palette"><summary>Choose a BDR color</summary><div class="bdr-swatches" role="group" aria-label="BDR colors for ${E(q.series_label)}">${swatches(q.series_id)}</div></details></div>`).join('')+'</div><button type="button" data-reset-colors class="secondary">Reset colors</button>':'<p>No plotted series selected.</p>';
  }
  host.querySelectorAll('[data-graph-color]').forEach(input=>{input.value=series.find(q=>q.series_id===input.dataset.graphColor).series_color;});
  host.querySelectorAll('[data-bdr-color]').forEach(button=>button.setAttribute('aria-pressed',String(series.find(q=>q.series_id===button.dataset.bdrSeries).series_color.toLowerCase()===button.dataset.bdrColor)));
  host.onchange=e=>{const input=e.target.closest('[data-graph-color]');if(input&&valid(input.value)){overrides[input.dataset.graphColor]=input.value;redraw();}};
  host.onclick=e=>{
   const swatch=e.target.closest('[data-bdr-color]');
   if(swatch){overrides[swatch.dataset.bdrSeries]=swatch.dataset.bdrColor;redraw();}
   else if(e.target.closest('[data-apply-bdr]')){series.forEach((q,i)=>overrides[q.series_id]=bdrPalette[i%bdrPalette.length][1]);redraw();}
   else if(e.target.closest('[data-reset-colors]')){for(const key of Object.keys(overrides))delete overrides[key];redraw();}
  };
 }
 const modes=[['technical','Compare technical wells'],['individual','Compare biological runs (technical means)'],['summary','Combine biological means'],['pooled','Combine technical + biological wells']];
 const help={technical:'Each open symbol is a measured well. Wells are compared at each concentration, without pairing them across concentrations.',individual:'Technical wells are averaged within each run. Error bars show within-run sample SD.',summary:'Each biological run contributes one mean per concentration. Error bars show between-run sample SD; n counts biological runs.',pooled:'Each supplied well has equal weight within its condition and plate group. Error bars show pooled-well SD; n counts wells, not independent biological runs.'};
 function controls(prefix){return `<label>Compare or combine<select id="${prefix}Mode">${modes.map(([key,label])=>`<option value="${key}">${label}</option>`).join('')}</select></label><label>Curve display<select id="${prefix}Style"><option value="measured">Measured curves · no 4PL</option><option value="4pl">4PL curves</option><option value="both">Measured curves + 4PL</option></select></label><label class="check"><input type="checkbox" id="${prefix}Wells">Show individual wells</label><p id="${prefix}ModeHelp" class="workspace-mode-help"></p><details open class="graph-colors"><summary>Series colors</summary><div id="${prefix}Colors"></div></details>`;}
 return {applyColors,colors,controls,help,bdrPalette};
})();
