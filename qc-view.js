/* Plate QC display. Raw measurements never fall back to corrected responses. */
globalThis.AtlasQCView = (() => {
  'use strict';
  const saved = new WeakMap();
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const finite = v => typeof v === 'number' && Number.isFinite(v);
  const fmt = (v, digits = 2) => finite(v) ? v.toLocaleString('en-US', {maximumFractionDigits:digits}) : '—';
  const rawFmt = (v, compact=false) => finite(v) ? v.toLocaleString('en-US', {maximumSignificantDigits:compact?3:5, ...(compact?{notation:'compact'}:{})}) : '—';
  const mean = a => a.length ? a.reduce((s,v)=>s+v,0)/a.length : null;
  const median = a => {const b=a.filter(finite).sort((x,y)=>x-y);return b.length ? (b[Math.floor((b.length-1)/2)]+b[Math.ceil((b.length-1)/2)])/2 : null;};
  const quantile = (a,p) => {if(!a.length)return null;const i=(a.length-1)*p,j=Math.floor(i);return a[j]+(a[Math.min(j+1,a.length-1)]-a[j])*(i-j);};
  const cvLabel = s => finite(s?.cv_percent) ? `${fmt(s.cv_percent)}%` : `—${s?.cv_reason ? ' ('+esc(s.cv_reason)+')' : ''}`;
  const role = w => w.column===22 ? (w.well_type==='Neutral Control'?'DMSO control, column 22':'Column 22 DMSO control position; no matching source control assignment') : w.column===23 ? (w.well_type==='Inhibitor Control'?'Inhibitory control, column 23; without HaloTag per experiment setup':'Column 23 inhibitory control position; no matching source control assignment') : w.well_type || 'Unassigned';
  const cellTitle = (w,channel) => !w ? 'No exported record for this well.' : [
    `${w.well || w.row+w.column} · ${w.plate_id}`,role(w),w.compound ? `ID: ${w.compound}` : '',
    finite(w.x) ? `Concentration: ${fmt(w.x,8)} µM` : '',
    `${channel} raw measurement: ${finite(w.raw?.[channel])?String(w.raw[channel]):'missing'}`,
    `Corrected response: ${fmt(w.corrected,6)} (not used for raw CV)`,
    `Source well type: ${w.well_type || 'not recorded'}`,
    w.excluded ? 'Masked/ignored: excluded from QC statistics' : 'Unmasked'
  ].filter(Boolean).join('\n');

  function heatmap(plate,channel) {
    const wells=plate.wells || [],lookup=new Map(wells.map(w=>[`${w.row}:${w.column}`,w]));
    const values=wells.filter(w=>!w.excluded).map(w=>w.raw?.[channel]).filter(finite).sort((a,b)=>a-b);
    const lo=quantile(values,.05),hi=quantile(values,.95);
    const color=v=> {if(!finite(v))return '';const f=hi===lo?.5:Math.max(0,Math.min(1,(v-lo)/(hi-lo)));return `rgb(${Math.round(245-193*f)},${Math.round(249-137*f)},${Math.round(253-66*f)})`;};
    let out=`<div class="qc-legend"><span><i class="qc-scale"></i> Raw ${esc(channel)}: ${rawFmt(lo)} to ${rawFmt(hi)} (5th–95th percentile scale)</span><span><i class="qc-key dmso"></i> ${esc(plate.controls?.dmso?.title||'Column 22 DMSO')}</span><span><i class="qc-key inhibitory"></i> Column 23 inhibitory</span><span><i class="qc-key missing"></i> Missing / unassigned</span><span><i class="qc-key masked"></i> Masked / ignored</span></div><div class="table-scroll"><table class="qc-plate-grid" aria-label="384-well raw measurement map"><thead><tr><th scope="col">Row</th>`;
    for(let col=1;col<=24;col++)out+=`<th scope="col">${col}</th>`;
    out+='</tr></thead><tbody>';
    for(const row of 'ABCDEFGHIJKLMNOP') {
      out+=`<tr><th scope="row">${row}</th>`;
      for(let col=1;col<=24;col++) {
        const w=lookup.get(`${row}:${col}`),v=w?.raw?.[channel],missing=!finite(v);
        const clazz=[col===22?'dmso':col===23?'inhibitory':'',missing?'missing':'',w?.excluded?'masked':''].filter(Boolean).join(' ');
        const title=`${row}${col}: ${cellTitle(w,channel)}`;
        out+=`<td class="${clazz}"><button type="button" class="qc-well" data-qc-well="${row}:${col}" title="${esc(title)}" aria-label="${esc(title)}" style="${missing?'':`background:${color(v)};color:${hi===lo||v<lo+(hi-lo)*.65?'#0d4242':'#fff'}`}">${missing?'—':rawFmt(v,true)}${w?.excluded?'<small>×</small>':''}</button></td>`;
      }
      out+='</tr>';
    }
    return out+'</tbody></table></div><p class="section-note">The complete A–P × 1–24 layout is shown. Hover, focus or click a well to inspect its exported values. Colors are clipped at the 5th and 95th percentiles for visibility; the numbers keep their original values. Control outlines indicate plate position, not QC status.</p><div class="qc-well-detail" role="status" aria-live="polite">Select a well for its raw measurement, corrected response and source assignment.</div>';
  }

  function controls(plate,channel,threshold) {
    const groups=[['dmso','DMSO control — column 22'],['inhibitory','Inhibitory control — column 23']];
    let out='<div class="table-scroll"><table><thead><tr><th>Control</th><th>Source label</th><th class="num">Used / exported</th><th class="num">Raw mean</th><th class="num">Raw SD</th><th class="num">Raw CV</th><th>Review</th></tr></thead><tbody>';
    for(const [key,defaultLabel] of groups) {
      const c=plate.controls?.[key],label=c?.title||defaultLabel,s=c?.stats?.[channel];
      out+=`<tr><th scope="row">${esc(label)}</th><td>${esc(c?.label || 'Not recorded')}</td><td class="num">${fmt(s?.n,0)} / ${fmt(c?.n_total,0)}${c?.n_excluded ? `<small class="qc-sub">${c.n_excluded} excluded</small>` : ''}</td><td class="num">${rawFmt(s?.mean)}</td><td class="num">${rawFmt(s?.sd)}</td><td class="num">${cvLabel(s)}</td><td>${finite(s?.cv_percent)?`<span class="pill ${s.cv_percent>=threshold?'qc-review':'neutral'}">${s.cv_percent>=threshold?'At/above review threshold':'Within review threshold'}</span>`:'Not assessable'}</td></tr>`;
    }
    return out+`</tbody></table></div><p class="section-note">${esc(plate.control_note||'Column 23 is the inhibitory control, described as without HaloTag in the experiment setup. Its original export label is retained above.')} CV = sample SD / positive mean × 100, calculated separately for each raw channel and excluding masked/ignored or missing wells. SD requires at least two wells; CV is unavailable for a nonpositive mean. These are review thresholds, not validated assay acceptance limits.</p>`;
  }

  function pairsTable(plate,channel,threshold,flaggedOnly) {
    const pairs=(plate.sample_pairs || []).filter(p=>!flaggedOnly || (finite(p.raw_stats?.[channel]?.cv_percent) && p.raw_stats[channel].cv_percent>=threshold));
    pairs.sort((a,b)=>(b.raw_stats?.[channel]?.cv_percent ?? -Infinity)-(a.raw_stats?.[channel]?.cv_percent ?? -Infinity));
    if(!pairs.length)return '<div class="empty">No matched sample pairs meet the selected raw CV review threshold on this plate.</div>';
    return '<div class="table-scroll qc-pairs-scroll"><table><thead><tr><th>Compound</th><th class="num">Dose (µM)</th><th>Wells</th><th class="num">Raw block 1</th><th class="num">Raw block 2</th><th class="num">Raw mean</th><th class="num">Raw SD</th><th class="num">Raw CV</th><th class="num">Corrected gap</th></tr></thead><tbody>'+pairs.map(p=>{const s=p.raw_stats?.[channel];return `<tr><td>${esc(p.compound)}</td><td class="num">${fmt(p.x,6)}</td><td>${esc(p.well1)} / ${esc(p.well2)}</td><td class="num">${rawFmt(s?.replicate1)}</td><td class="num">${rawFmt(s?.replicate2)}</td><td class="num">${rawFmt(s?.mean)}</td><td class="num">${rawFmt(s?.sd)}</td><td class="num ${finite(s?.cv_percent)&&s.cv_percent>=threshold?'qc-attention':''}">${cvLabel(s)}</td><td class="num">${fmt(p.corrected_gap)}</td></tr>`;}).join('')+'</tbody></table></div>';
  }

  function patterns(plate,channel,threshold) {
    const source=(plate.patterns || []).filter(p=>p.channel===channel);
    const paired=(plate.sample_pairs || []).map(p=>p.raw_stats?.[channel]).filter(s=>s?.n===2&&finite(s?.replicate1)&&finite(s?.replicate2));
    const pairedMean=mean(paired.map(s=>(s.replicate1+s.replicate2)/2)),bias=mean(paired.map(s=>s.replicate2-s.replicate1));
    const biasPercent=pairedMean!==null&&pairedMean>0&&bias!==null?bias/Math.abs(pairedMean)*100:null;
    const lower=paired.filter(s=>s.replicate2<s.replicate1).length;
    let out=`<p class="section-note">Matched samples in columns 2–11 are compared with the same compound and dose in columns 12–21. This pairing does not treat different compounds or concentrations as replicates.</p><div class="qc-pattern-metrics"><div><strong>${fmt(biasPercent)}${finite(biasPercent)?'%':''}</strong><span>Mean signed block difference / paired mean<br>Block 2 minus block 1 · n = ${paired.length}</span></div><div><strong>${paired.length?`${lower} / ${paired.length}`:'—'}</strong><span>Pairs with lower raw signal in block 2</span></div></div>`;
    if(finite(biasPercent)&&Math.abs(biasPercent)>threshold)out+=`<p class="qc-observation">The overall raw block difference exceeds the ${fmt(threshold)}% review threshold for this channel. Check dispensing, position and readout context before interpreting it as biology.</p>`;
    if(source.length)out+='<ul class="qc-pattern-list">'+source.map(p=>`<li>${esc(p.text)}${p.n!=null?` <span class="qc-sub-inline">(n = ${esc(p.n)})</span>`:''}</li>`).join('')+'</ul>';
    else out+='<p class="section-note">No additional pattern summary is available for this channel. Use the well map to inspect position effects; a visual pattern alone does not identify its cause.</p>';
    return out;
  }

  function render(options={}) {
    const host=typeof options.host==='string'?document.getElementById(options.host):options.host || document.getElementById('plateQC');
    if(!host)return;
    const data=options.data,qc=data?.plate_qc;
    if(!qc?.available||!qc.plates?.length) {
      host.innerHTML=`<section class="panel"><div class="panel-heading"><div><h2>Raw plate QC</h2><p>Raw sample measurements and control wells are required.</p></div></div><div class="empty">${esc(qc?.reason || 'This dataset does not include raw plate measurements. Upload the full well export containing raw channels, row/column assignments and control wells to calculate sample and control CV.')}</div><p class="section-note">Corrected dose–response values remain available in the other views. They are not substituted for raw measurements in this QC view.</p></section>`;
      return;
    }
    let s=saved.get(host);
    if(!s||s.data!==data) {s={data,plate:qc.plates[0].plate_id,channel:qc.channels?.includes('QC Layer')?'QC Layer':qc.channels?.[0],sampleCV:options.thresholds?.sampleCV??20,controlCV:options.thresholds?.controlCV??20,blockBias:options.thresholds?.blockBias??10,flaggedOnly:true};saved.set(host,s);}
    const plate=qc.plates.find(p=>p.plate_id===s.plate)||qc.plates[0],channels=qc.channels || Object.keys(plate.wells?.find(w=>w.raw)?.raw || {});
    if(!channels.includes(s.channel))s.channel=channels[0];
    const channel=s.channel,samples=plate.sample_pairs || [],cvs=samples.map(p=>p.raw_stats?.[channel]?.cv_percent).filter(finite),flagged=cvs.filter(v=>v>=s.sampleCV).length;
    host.innerHTML=`<div class="toolbar qc-toolbar"><label>Plate<select data-qc-setting="plate">${qc.plates.map(p=>`<option value="${esc(p.plate_id)}"${p.plate_id===plate.plate_id?' selected':''}>${esc(p.target)} · ${esc(p.plate_id)}</option>`).join('')}</select></label><label>Raw channel<select data-qc-setting="channel">${channels.map(c=>`<option value="${esc(c)}"${c===channel?' selected':''}>${esc(c)} — exported Raw</option>`).join('')}</select></label><label>Sample CV review (%)<input type="number" min="0" step="1" data-qc-setting="sampleCV" value="${esc(s.sampleCV)}"></label><label>Control CV review (%)<input type="number" min="0" step="1" data-qc-setting="controlCV" value="${esc(s.controlCV)}"></label><label>Block difference review (%)<input type="number" min="0" step="1" data-qc-setting="blockBias" value="${esc(s.blockBias)}"></label></div><p class="section-note">Raw channels are exported measurements before corrected-response normalization. CV is calculated within a compound–dose pair or control group, never across the dose series. Review thresholds are adjustable discussion flags; they do not establish assay pass/fail.</p><div class="metrics qc-metrics"><div class="metric"><div class="metric-label">Sample pairs assessed</div><div class="metric-value">${cvs.length}</div><div class="metric-note">${samples.length} matched pairs · ${esc(channel)}</div></div><div class="metric"><div class="metric-label">Median raw sample CV</div><div class="metric-value">${fmt(median(cvs),1)}${cvs.length?'%':''}</div><div class="metric-note">Two technical wells per pair</div></div><div class="metric"><div class="metric-label">At/above sample CV review</div><div class="metric-value">${flagged}</div><div class="metric-note">CV ≥ ${fmt(s.sampleCV)}% · selected plate</div></div><div class="metric"><div class="metric-label">Maximum raw sample CV</div><div class="metric-value">${fmt(cvs.length?Math.max(...cvs):null,1)}${cvs.length?'%':''}</div><div class="metric-note">Inspect pair-level values below</div></div></div><section class="panel"><div class="panel-heading"><div><h2>Raw control variability</h2><p>${esc(plate.target)} · ${esc(plate.plate_id)} · ${esc(channel)}</p></div></div>${controls(plate,channel,s.controlCV)}</section><section class="panel qc-section"><div class="panel-heading"><div><h2>Raw well map</h2><p>${esc(plate.transfection || plate.target)} · ${esc(channel)}</p></div></div>${heatmap(plate,channel)}</section><section class="panel qc-section"><div class="panel-heading"><div><h2>Position and replicate-block patterns</h2><p>Descriptive observations from raw measurements on this plate.</p></div></div>${patterns(plate,channel,s.blockBias)}</section><section class="panel qc-section"><div class="panel-heading"><div><h2>Raw sample technical pairs</h2><p>CV uses the selected raw channel; corrected gap is displayed separately in response units.</p></div><label class="qc-check"><input type="checkbox" data-qc-setting="flaggedOnly"${s.flaggedOnly?' checked':''}> At/above CV review only</label></div>${pairsTable(plate,channel,s.sampleCV,s.flaggedOnly)}<p class="section-note">Two-well CV estimates are imprecise. A review flag helps prioritize inspection; repeat decisions also depend on corrected curves, control performance and plate patterns. Excluded wells are omitted from raw statistics.</p></section>${qc.notes?.length?`<section class="panel qc-section"><h2>Raw QC provenance</h2><ul class="qc-pattern-list">${qc.notes.map(n=>`<li>${esc(n)}</li>`).join('')}</ul></section>`:''}`;
    host.onchange=e=> {
      const key=e.target.dataset.qcSetting;if(!key)return;
      if(['sampleCV','controlCV','blockBias'].includes(key)) {const v=Number(e.target.value);if(!e.target.value.trim()||!finite(v)||v<0){e.target.setCustomValidity('Enter a nonnegative review threshold.');e.target.reportValidity();return;}s[key]=v;}
      else s[key]=key==='flaggedOnly'?e.target.checked:e.target.value;
      render(options);
    };
    host.onclick=e=> {
      const cell=e.target.closest('[data-qc-well]');if(!cell)return;
      const [row,col]=cell.dataset.qcWell.split(':'),w=plate.wells.find(w=>w.row===row&&w.column===Number(col));
      host.querySelector('.qc-well-detail').textContent=cellTitle(w,channel);
    };
  }
  return {render};
})();
