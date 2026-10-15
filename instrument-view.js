/* Source instrument matrices. Exported ratios are preserved, never replaced by division. */
globalThis.AtlasInstrumentView = (() => {
  'use strict';
  const states=new WeakMap();
  const channelNames={acceptor_645:'Acceptor — 645 / 75',donor_460:'Donor — 460 / 80',ratio:'Exported ratio'};
  const finite=v=>typeof v==='number'&&Number.isFinite(v);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=(v,compact=false)=>finite(v)?v.toLocaleString('en-US',{maximumSignificantDigits:compact?3:6,...(compact?{notation:'compact'}:{})}):'—';
  const full=v=>finite(v)?String(v):'Missing';
  const date=r=>String(r.measured_at||'Date not recorded').slice(0,10);
  const group=r=>/[AB]$/.exec(r.plate_id||'')?.[0]||'Other';
  const recKey=r=>`${r.file}|${r.measured_at}`;
  const sorted=rs=>[...rs].sort((a,b)=>String(a.plate_id).localeCompare(String(b.plate_id),undefined,{numeric:true})||String(a.measured_at).localeCompare(String(b.measured_at)));
  const stats=values=>{const a=values.filter(finite),n=a.length,mean=n?a.reduce((s,v)=>s+v,0)/n:null,sd=n>1?Math.sqrt(a.reduce((s,v)=>s+(v-mean)**2,0)/(n-1)):null;return {n,mean,sd,cv:n>1&&mean>0?100*sd/mean:null};};
  const calculated=(r,well)=>finite(r.channels?.acceptor_645?.[well])&&finite(r.channels?.donor_460?.[well])&&r.channels.donor_460[well]!==0?r.channels.acceptor_645[well]/r.channels.donor_460[well]:null;
  const mismatch=(r,well)=>r.ratio_mismatch?.wells?.includes(well);
  const matchLabel=r=>({matched_exact:'Both intensity channels match the September 2 GDS export',different_measurements:'Different measurements from the supplied GDS export',not_in_export:'No matching plate in the supplied GDS export'}[r.gds_match?.status]||'GDS source matching has not been established');

  function wellText(r,well,compare) {
    const a=r.channels?.acceptor_645?.[well],d=r.channels?.donor_460?.[well],ratio=r.channels?.ratio?.[well],calc=calculated(r,well),col=Number(well.replace(/[A-P]/g,''));
    return [`${r.plate_id} · ${well}`,`Measured: ${r.measured_at}`,`Acceptor 645 / 75: ${full(a)}`,`Donor 460 / 80: ${full(d)}`,`Exported ratio: ${full(ratio)}`,
      ...(compare?[`Calculated acceptor / donor: ${full(calc)}`,`Exported minus calculated: ${finite(ratio)&&finite(calc)?String(ratio-calc):'Not assessable'}`]:[]),
      mismatch(r,well)?'Ratio difference exceeds the source precision allowance; exported value retained':'',
      col===22||col===23?col===22?'Column 22 DMSO control (experiment setup)':'Column 23 no-HaloTag control (experiment setup)':'No compound identity assigned in this instrument view',
      r.column_labels_valid===false?'Column coordinates follow ordinal matrix positions; source header labels require review':''
    ].filter(Boolean).join('\n');
  }

  function map(r,channel,compare) {
    const values=Object.values(r.channels?.[channel]||{}).filter(finite).sort((a,b)=>a-b),q=p=>values.length?values[Math.floor((values.length-1)*p)]:null,lo=q(.05),hi=q(.95);
    const color=v=>{const p=hi===lo?.5:Math.max(0,Math.min(1,(v-lo)/(hi-lo)));return {background:`rgb(${Math.round(246-194*p)},${Math.round(249-137*p)},${Math.round(253-66*p)})`,color:p>.65?'#fff':'#172b45'};};
    let out=`<div class="instrument-legend"><span><i class="instrument-scale"></i>${esc(channelNames[channel])}: ${fmt(lo)} to ${fmt(hi)} (5th–95th percentile scale)</span><span><i class="instrument-key position"></i> Column 22 DMSO · column 23 no HaloTag</span><span><i class="instrument-key missing"></i> Missing value</span>${compare?'<span><i class="instrument-key mismatch"></i> Ratio source review</span>':''}</div><div class="table-scroll"><table class="instrument-grid" aria-label="384-well instrument matrix"><thead><tr><th scope="col">Row</th>`;
    for(let col=1;col<=24;col++)out+=`<th scope="col">${col}</th>`;
    out+='</tr></thead><tbody>';
    for(const row of 'ABCDEFGHIJKLMNOP') {
      out+=`<tr><th scope="row">${row}</th>`;
      for(let col=1;col<=24;col++) {
        const well=`${row}${col}`,v=r.channels?.[channel]?.[well],c=finite(v)?color(v):null;
        const classes=[finite(v)?'':'missing',col===22||col===23?'position':'',compare&&channel==='ratio'&&mismatch(r,well)?'mismatch':''].filter(Boolean).join(' ');
        out+=`<td class="${classes}"><button type="button" data-instrument-well="${well}" title="${esc(wellText(r,well,compare))}" aria-label="${esc(wellText(r,well,compare))}"${c?` style="background:${c.background};color:${c.color}"`:''}>${finite(v)?fmt(v,true):'—'}${compare&&channel==='ratio'&&mismatch(r,well)?'<small>!</small>':''}</button></td>`;
      }
      out+='</tr>';
    }
    return out+'</tbody></table></div><p class="section-note">All 384 physical positions are shown; the file normally contains 308 numeric positions (B–O, columns 2–23). Missing positions remain blank. Colors are clipped for visibility; hover, focus or click a well to inspect the original numeric value.</p><div class="instrument-well-detail" role="status" aria-live="polite">Select a well to inspect its raw intensity channels and exported ratio.</div>';
  }

  function positionalTable(r,channel,threshold) {
    let out='<div class="table-scroll"><table><thead><tr><th>Control group (experiment setup)</th><th class="num">Numeric wells</th><th class="num">Mean</th><th class="num">Sample SD</th><th class="num">CV (%)</th><th>Review threshold</th></tr></thead><tbody>';
    for(const col of [22,23]) {
      const s=stats('ABCDEFGHIJKLMNOP'.split('').map(row=>r.channels?.[channel]?.[`${row}${col}`]));
      out+=`<tr><th scope="row">Column ${col} · ${col===22?'DMSO':'without HaloTag'}</th><td class="num">${s.n}</td><td class="num">${fmt(s.mean)}</td><td class="num">${fmt(s.sd)}</td><td class="num">${fmt(s.cv)}</td><td><span class="pill ${finite(s.cv)&&s.cv>threshold?'instrument-review':'neutral'}">${finite(s.cv)?s.cv>threshold?'Above review threshold':'Within review threshold':'Not assessable'}</span></td></tr>`;
    }
    return out+'</tbody></table></div><p class="section-note">CV = sample SD / positive mean × 100; SD uses n − 1. Column 22 is DMSO and column 23 is without HaloTag, as confirmed for this experiment setup. The instrument file provides the raw positions and numeric measurements. No mask metadata is present in the instrument CSV; all numeric positions are included here. Matching GDS masks are handled in the separate curve and plate-QC views.</p>';
  }

  function ratioTable(r) {
    const wells=r.ratio_mismatch?.wells||[];
    const intro=`<p class="section-note">Calculated ratio = exported acceptor intensity / exported donor intensity. This comparison uses the displayed intensity values and a source-precision allowance; it does not reproduce undocumented instrument processing. Exported ratios remain the source values throughout this view. ${esc(r.ratio_mismatch?.threshold_note||'Differences are assessed with the precision allowance supplied by the source audit.')}</p>`;
    if(!wells.length)return intro+'<p class="section-note">No values on this reading exceed the source precision allowance.</p>';
    return intro+'<div class="table-scroll"><table><thead><tr><th>Well</th><th class="num">Exported ratio</th><th class="num">Calculated acceptor / donor</th><th class="num">Exported − calculated</th></tr></thead><tbody>'+wells.map(w=>{const exp=r.channels?.ratio?.[w],calc=calculated(r,w);return `<tr><th scope="row">${esc(w)}</th><td class="num">${fmt(exp)}</td><td class="num">${fmt(calc)}</td><td class="num">${finite(exp)&&finite(calc)?fmt(exp-calc):'—'}</td></tr>`;}).join('')+'</tbody></table></div>';
  }

  function render(options={}) {
    const host=typeof options.host==='string'?document.getElementById(options.host):options.host||document.getElementById('instrumentReadings');
    if(!host)return;
    const rs=Array.isArray(options.data)?options.data:options.data?.readings;
    if(!rs?.length){host.innerHTML='<section class="panel"><h2>Raw instrument readings</h2><div class="empty">Instrument files have not been loaded. Raw channels and exported ratios require their source instrument data.</div></section>';return;}
    const dates=[...new Set(rs.map(date))].sort();
    let s=states.get(host);
    if(!s||s.data!==options.data){s={data:options.data,date:dates.includes('2026-09-02')?'2026-09-02':dates[0],group:'B',reading:'',channel:'ratio',compare:false,cv:20};states.set(host,s);}
    if(!dates.includes(s.date))s.date=dates[0];
    let available=sorted(rs.filter(r=>date(r)===s.date&&(s.group==='all'||group(r)===s.group)));
    if(!available.length){s.group='all';available=sorted(rs.filter(r=>date(r)===s.date));}
    const r=available.find(r=>recKey(r)===s.reading)||available[0];s.reading=recKey(r);
    const mismatchCount=rs.reduce((n,r)=>n+(r.ratio_mismatch?.count||0),0),badFiles=rs.filter(r=>r.column_labels_valid===false),selectedValues=Object.values(r.channels?.[s.channel]||{}).filter(finite);
    const warnings=[...(r.warnings||[])];
    if(r.column_labels_valid===false&&!warnings.some(w=>/ordinal/i.test(w)))warnings.push('Source column labels are malformed. Values use ordinal matrix positions and require source review.');
    const globalNote=badFiles.length?`<p class="instrument-alert">Source audit: ${badFiles.map(r=>`${esc(r.plate_id)} on ${esc(date(r))}`).join(', ')} has duplicated or malformed matrix column headers. Those values are retained by ordinal position and require review. Across the collection, ${mismatchCount} exported ratios exceed the source precision allowance.</p>`:'';
    host.innerHTML=`<section class="panel instrument-intro"><div class="panel-heading"><div><h2>Raw instrument readings</h2><p>${rs.length} source readings · ${dates.length} measurement dates · acceptor, donor and exported ratio matrices</p></div></div><p class="section-note">This view preserves measurements by instrument date and plate. The supplied B-plate well export Header states +25 µM CypA inhibitor. Per user-confirmed layout, A is compound without CypA inhibitor and B is the matched compound +25 µM CypA inhibitor; each A/B pair has the same compounds and concentrations. The two dates are biological replicates and remain separate. Folder 20260902 contains Sep 2 measurements; folder 20260904 contains Sep 3 measurements. September 2 B-plate readings match the supplied corrected export.</p>${globalNote}</section><div class="toolbar instrument-toolbar"><label>Measurement date / run<select data-instrument-setting="date">${dates.map(d=>`<option value="${esc(d)}"${d===s.date?' selected':''}>${esc(d)} · ${rs.filter(r=>date(r)===d).length} readings</option>`).join('')}</select></label><label>Plate series<select data-instrument-setting="group">${[['all','All A and B plates'],['A','A plates · no inhibitor'],['B','B plates · +25 µM CypA inhibitor']].map(([v,l])=>`<option value="${v}"${v===s.group?' selected':''}>${l}</option>`).join('')}</select></label><label>Plate / reading<select data-instrument-setting="reading">${available.map(p=>`<option value="${esc(recKey(p))}"${p===r?' selected':''}>${esc(p.plate_id)} · ${esc(String(p.measured_at).slice(11,19))}</option>`).join('')}</select></label><label>Measurement channel<select data-instrument-setting="channel">${Object.entries(channelNames).map(([v,l])=>`<option value="${v}"${v===s.channel?' selected':''}>${esc(l)}</option>`).join('')}</select></label><label>Control CV review (%)<input type="number" min="0" step="1" value="${s.cv}" data-instrument-setting="cv"></label><label class="check"><input type="checkbox" data-instrument-setting="compare"${s.compare?' checked':''}> Compare with calculated acceptor / donor</label></div><div class="metrics instrument-metrics"><div class="metric"><div class="metric-label">Selected numeric values</div><div class="metric-value">${selectedValues.length}</div><div class="metric-note">${esc(channelNames[s.channel])}</div></div><div class="metric"><div class="metric-label">Instrument measurement date</div><div class="metric-value instrument-date">${esc(date(r))}</div><div class="metric-note">${esc(String(r.measured_at).slice(11))}</div></div><div class="metric"><div class="metric-label">Exported ratio review</div><div class="metric-value">${r.ratio_mismatch?.count??'—'}</div><div class="metric-note">of ${r.ratio_mismatch?.n_compared??'—'} comparisons · precision-aware allowance</div></div><div class="metric"><div class="metric-label">Matrix column labels</div><div class="metric-value instrument-date">${r.column_labels_valid===false?'Review needed':'Source labels valid'}</div><div class="metric-note">${r.column_labels_valid===false?'Ordinal positions retained':'Positions retained as exported'}</div></div></div>${warnings.length?`<section class="panel instrument-section"><h2>Source observations for this reading</h2><ul class="instrument-warnings">${warnings.map(w=>`<li>${esc(w)}</li>`).join('')}</ul></section>`:''}<section class="panel instrument-section"><div class="panel-heading"><div><h2>${esc(r.plate_id)} · ${esc(channelNames[s.channel])}</h2><p>${esc(matchLabel(r))}<br>${group(r)==='B'?'B condition: compound +25 µM CypA inhibitor':'A condition: compound, no CypA inhibitor'}</p></div></div>${map(r,s.channel,s.compare)}</section><section class="panel instrument-section"><div class="panel-heading"><div><h2>DMSO and no-HaloTag control variability</h2><p>${esc(channelNames[s.channel])} · descriptive CV · adjustable review threshold, not an assay acceptance limit</p></div></div>${positionalTable(r,s.channel,s.cv)}</section>${s.compare?`<section class="panel instrument-section"><h2>Exported ratio versus calculated acceptor / donor</h2>${ratioTable(r)}</section>`:''}<section class="panel instrument-section"><h2>Source provenance</h2><p class="section-note">File: <strong>${esc(r.file)}</strong><br>Instrument Measurement Date: ${esc(r.measured_at)}<br>Source plate identifiers: ${esc((r.source_plate_ids||[r.plate_id]).join(', '))}<br>${esc(matchLabel(r))}. Folder names are retained as provenance; instrument measurement dates determine the run selector.</p></section>`;
    host.onchange=e=>{const k=e.target.dataset.instrumentSetting;if(!k)return;if(k==='cv'){const n=Number(e.target.value);if(!e.target.value.trim()||!finite(n)||n<0){e.target.setCustomValidity('Enter a nonnegative CV review threshold.');e.target.reportValidity();return;}s.cv=n;}else s[k]=k==='compare'?e.target.checked:e.target.value;render(options);};
    host.onclick=e=>{const b=e.target.closest('[data-instrument-well]');if(b)host.querySelector('.instrument-well-detail').textContent=wellText(r,b.dataset.instrumentWell,s.compare);};
  }
  return {render};
})();
