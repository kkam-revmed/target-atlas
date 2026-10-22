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
   const swatches=bdrPalette.map(([name,color])=>`<button type="button" class="bdr-swatch" data-bdr-color="${color}" style="--swatch:${color}" aria-label="${E(name)} (${color.toUpperCase()})" aria-pressed="false" title="${E(name)} · ${color.toUpperCase()}"></button>`).join('');
   host.innerHTML=series.length?'<div class="bdr-palette-intro"><strong>BDR graph palette</strong><label>Curve to recolor<select data-color-series>'+series.map(q=>`<option value="${E(q.series_id)}">${E(q.series_label)}</option>`).join('')+'</select></label><small data-selected-curve></small><p>Click a color below to change this curve.</p><div class="bdr-swatches" role="group" aria-label="BDR colors">'+swatches+'</div><small data-color-status role="status"></small><button type="button" data-apply-bdr class="secondary">Apply BDR palette to all curves</button><small>Assigns colors in palette order. Slides 4, 7 and 42.</small></div><div class="graph-color-list">'+series.map(q=>`<div class="graph-color-row"><div class="graph-color-choice"><button type="button" class="curve-color-button" data-select-curve="${E(q.series_id)}" style="--swatch:${E(q.series_color)}" aria-label="Select ${E(q.series_label)} for the palette" aria-pressed="false"></button><span>${E(q.series_label)}</span></div><details class="custom-curve-color"><summary>Custom hex color</summary><label>Hex code<input type="text" data-graph-color="${E(q.series_id)}" value="${E(q.series_color)}" maxlength="7" spellcheck="false" autocomplete="off" aria-label="Custom hex color for ${E(q.series_label)}"></label></details></div>`).join('')+'</div><button type="button" data-reset-colors class="secondary">Reset colors</button>':'<p>No plotted series selected.</p>';
  }
  const selector=host.querySelector('[data-color-series]');
  const syncSwatches=()=>{
   const selected=series.find(q=>q.series_id===selector?.value);
   host.querySelectorAll('[data-bdr-color]').forEach(button=>button.setAttribute('aria-pressed',String(selected?.series_color.toLowerCase()===button.dataset.bdrColor)));
   host.querySelectorAll('[data-select-curve]').forEach(button=>{const q=series.find(q=>q.series_id===button.dataset.selectCurve);button.style.setProperty('--swatch',q.series_color);button.setAttribute('aria-pressed',String(q.series_id===selector.value));});
   const group=host.querySelector('.bdr-swatches');
   if(group){group.setAttribute('aria-label',`BDR colors for ${selected.series_label}`);host.querySelector('[data-selected-curve]').textContent=selected.series_label;}
  };
  const announce=message=>{const status=host.querySelector('[data-color-status]');if(status)status.textContent=message;};
  host.querySelectorAll('[data-graph-color]').forEach(input=>{input.value=series.find(q=>q.series_id===input.dataset.graphColor).series_color;});
  syncSwatches();
  const customColor=e=>{const input=e.target.closest('[data-graph-color]');if(input&&valid(input.value)){selector.value=input.dataset.graphColor;overrides[input.dataset.graphColor]=input.value;redraw();announce('Curve color updated.');}};
  host.oninput=customColor;
  host.onchange=e=>{if(e.target.matches('[data-color-series]')){syncSwatches();announce('Click a swatch to change this curve.');}else customColor(e);};
  host.onclick=e=>{
   const curve=e.target.closest('[data-select-curve]');
   if(curve&&selector){selector.value=curve.dataset.selectCurve;syncSwatches();announce('Curve selected. Choose a color from the palette.');host.querySelector('.bdr-swatches').scrollIntoView({block:'nearest'});return;}
   const swatch=e.target.closest('[data-bdr-color]');
   if(swatch&&selector){overrides[selector.value]=swatch.dataset.bdrColor;redraw();announce(`Curve color changed to ${bdrPalette.find(p=>p[1]===swatch.dataset.bdrColor)[0]}.`);}
   else if(e.target.closest('[data-apply-bdr]')){series.forEach((q,i)=>overrides[q.series_id]=bdrPalette[i%bdrPalette.length][1]);redraw();announce('BDR palette applied to all curves. Select a curve above to customize its color.');}
   else if(e.target.closest('[data-reset-colors]')){for(const key of Object.keys(overrides))delete overrides[key];redraw();announce('Default curve colors restored.');}
  };
 }
 const modes=[['technical','Compare technical wells'],['individual','Compare biological runs (technical means)'],['summary','Combine biological means'],['pooled','Combine technical + biological wells']];
 const help={technical:'See individual wells and their run mean at each concentration. Error bars show within-run sample SD; n counts wells.',individual:'Compare a separate mean curve for each biological run. Technical wells are averaged within each run; error bars show within-run SD, not between-run SD.',summary:'Combine run means with equal weight at each concentration. Error bars show between-run sample SD; n counts biological runs.',pooled:'Combine all included wells with equal weight at each concentration. Error bars show pooled-well SD; n counts wells, not independent biological runs.'};
 function modeGuide(){return `<details class="replicate-mode-guide"><summary>What do these four modes mean?</summary>
  <p><strong>Start with your question:</strong></p><ul>
   <li>Do the wells agree within a run? Choose <strong>Compare technical wells</strong>.</li>
   <li>Do the repeated experiments agree? Choose <strong>Compare biological runs</strong>.</li>
   <li>What is the average response across experiments? Choose <strong>Combine biological means</strong>; each run has equal weight.</li>
   <li>What is the distribution of all measured wells together? Choose <strong>Combine technical + biological wells</strong>; this does not increase the number of independent experiments.</li>
  </ul>
  <p><strong>Technical replicates</strong> are repeated wells within the same assay run, usually on the same physical plate. They show how much the well measurements vary.</p>
  <p><strong>Biological replicates</strong> here are the separate runs labeled Replicate 1 and Replicate 2 in the supplied datasets. They represent repeats of the experiment and may share the same Benchling ID. Compound batch numbers are not replicate numbers.</p>
  <section><h4>Compare technical wells</h4><p>Inspect individual well values alongside each run’s mean at every concentration. Bars show sample SD across wells within that run; n counts wells. Wells are not paired across concentrations.</p></section>
  <section><h4>Compare biological runs (technical means)</h4><p>Average technical wells separately within each run, then overlay the run curves. Use this to see whether Replicate 1 and Replicate 2 agree. Bars still show the spread of wells <strong>within each run</strong>, not the difference between runs.</p></section>
  <section><h4>Combine biological means</h4><p>First average the technical wells within each run. Then average those run means with <strong>equal weight per run</strong> at each concentration. Bars show sample SD between run means; n counts biological runs. With both runs present, n = 2. With only one, n = 1 and no between-run SD is shown.</p></section>
  <section><h4>Combine technical + biological wells</h4><p>Put all included wells together at each concentration and calculate one mean and sample SD. Every well has equal weight, so a run with more wells contributes more. The SD mixes variation within and between runs. n counts wells, <strong>not independent biological replicates</strong>.</p></section>
  <p><strong>D1/CypA reference exception:</strong> RMC-0741051 already combines up to 48 wells per concentration across plates within each run. Its within-run SD is therefore not a single-plate technical SD. Pooling two runs can give 96 wells, but there are still only two biological runs.</p>
  <p>Calculations keep compounds, batches, assays, conditions and plate groups separate. Plate 1 and Plate 2 remain separate summaries where supplied separately. Only matching concentrations are combined; missing doses are not interpolated.</p>
  <p><strong>SD means standard deviation:</strong> it describes the spread of the included values. It is not SEM, a confidence interval or a test of statistical significance.</p>
 </details>`;}
 function fitSummary(series,mode,style){
  if(!series.length)return '';
  if(style==='measured')return '<p><strong>Measured curves:</strong> lines connect observed means. No 4PL curves are displayed.</p>';
  const missing=series.filter(q=>!Number.isFinite(q.fit?.ec50));
  const flagged=series.filter(q=>q.fit_flags?.length);
  const combined=mode==='summary'||mode==='pooled';
  const lowN=combined&&series.some(q=>q.doses.some(d=>(mode==='summary'?d.n:d.n_biological)<2));
  return `<p><strong>4PL review:</strong> ${series.length-missing.length} of ${series.length} series have fitted EC50 values; ${flagged.length} have warnings${missing.length?`; ${missing.length} have no fitted EC50`:''}. ${combined?'Atlas fits one displayed mean per concentration.':'Atlas shows supplied independent per-run fits.'}</p>
   ${lowN?'<p>Some concentrations have fewer than two biological runs. They cannot establish between-run variability.</p>':''}
   <p>A smooth curve or no automatic warning does not establish a reliable EC50. Check plateaus, dose range and fit warnings.</p>
   ${flagged.length||missing.length?'<details><summary>Show affected series</summary><ul>'+series.filter(q=>flagged.includes(q)||missing.includes(q)).map(q=>'<li><strong>'+E(q.series_label)+'</strong>: '+E([...(q.fit_flags||[]),...(missing.includes(q)?['No fitted EC50 available']:[])].join('; '))+'</li>').join('')+'</ul></details>':''}
   <button type="button" class="secondary" data-review-fits>Review activity &amp; fit parameters</button>`;
 }
 function controls(prefix){return `<label>Compare or combine<select id="${prefix}Mode">${modes.map(([key,label])=>`<option value="${key}">${label}</option>`).join('')}</select></label><label>Curve display<select id="${prefix}Style"><option value="measured">Measured curves · no 4PL</option><option value="4pl">4PL curves</option><option value="both">Measured curves + 4PL</option></select></label><label class="check"><input type="checkbox" id="${prefix}Wells">Show individual wells</label><p id="${prefix}ModeHelp" class="workspace-mode-help"></p>${modeGuide()}<details open class="graph-colors"><summary>Series colors</summary><div id="${prefix}Colors"></div></details>`;}
 return {applyColors,colors,controls,help,modeGuide,fitSummary,bdrPalette};
})();
