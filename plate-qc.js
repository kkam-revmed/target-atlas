/* Descriptive plate QC from explicitly exported Raw fields. No corrected-to-raw fallback. */
(function(root) {
  'use strict';
  const finite=v=>typeof v==='number'&&Number.isFinite(v);
  const mean=a=>a.reduce((s,v)=>s+v,0)/a.length;
  const median=a=>{if(!a.length)return null;const b=[...a].sort((x,y)=>x-y),m=Math.floor(b.length/2);return b.length%2?b[m]:(b[m-1]+b[m])/2;};
  function stats(values) {
    const a=values.filter(finite),n=a.length,m=n?mean(a):null,sd=n>1?Math.sqrt(a.reduce((s,v)=>s+(v-m)**2,0)/(n-1)):null;
    return {n,mean:m,sd,cv_percent:n>1&&m>0?100*sd/m:null,cv_reason:n<2?'Fewer than two unmasked numeric Raw values':m<=0?'Raw mean is nonpositive':''};
  }
  const wellKey=r=>JSON.stringify([r.plate_id,r.row,r.column]);
  function analyze(records=[]) {
    const channels=[...new Set(records.flatMap(r=>Object.keys(r.raw||{})))];
    const valid=records.filter(r=>r.plate_id&&r.row&&Number.isInteger(r.column));
    const available=valid.some(r=>!r.excluded&&r.well_type!=='Undefined'&&Object.values(r.raw||{}).some(finite));
    if(!available)return {available:false,reason:'Raw well measurements and physical plate positions are unavailable. Upload a GDS well-level export with Raw channel fields; corrected responses are not used as raw values.',channels,plates:[],notes:[]};
    const byPlate=new Map();for(const r of valid){if(!byPlate.has(r.plate_id))byPlate.set(r.plate_id,[]);byPlate.get(r.plate_id).push(r);}
    const plates=[];
    for(const [plate_id,wells] of byPlate) {
      const unique=new Map(),duplicates=[];for(const r of wells){const k=wellKey(r);if(unique.has(k)){duplicates.push(k);unique.delete(k);}else if(!duplicates.includes(k))unique.set(k,r);}
      // Ambiguous duplicate positions are retained for inspection but omitted from all statistics.
      const retained=[...unique.values()].filter(r=>!r.excluded),samples=retained.filter(r=>r.well_type==='Sample');
      const transfections=[...new Set(retained.map(r=>r.transfection).filter(Boolean))];
      const controls={};
      for(const [id,column,well_type,label] of [['dmso',22,'Neutral Control','DMSO — source Neutral Control'],['inhibitory',23,'Inhibitor Control','Inhibitory control — source Inhibitor Control']]) {
        const all=wells.filter(r=>r.column===column&&r.well_type===well_type),active=retained.filter(r=>r.column===column&&r.well_type===well_type);
        controls[id]={label,column,well_type,n_total:all.length,n_excluded:all.filter(r=>r.excluded).length,n_retained:active.length,unexpected_positions:wells.filter(r=>r.well_type===well_type&&r.column!==column).map(r=>r.well),stats:Object.fromEntries(channels.map(ch=>[ch,stats(active.map(r=>r.raw?.[ch]))]))};
      }
      const grouped=new Map();for(const r of samples){const k=JSON.stringify([r.compound,r.transfection,r.x]);if(!grouped.has(k))grouped.set(k,[]);grouped.get(k).push(r);}
      const sample_pairs=[],unmatched_sample_groups=[];
      for(const rs of grouped.values()) {
        rs.sort((a,b)=>a.column-b.column);const [a,b]=rs;
        if(rs.length!==2||!a.compound||!a.transfection||!finite(a.x)||a.row!==b.row||a.column<2||a.column>11||b.column-a.column!==10){unmatched_sample_groups.push({compound:a.compound,target:a.target,transfection:a.transfection,x:a.x,wells:rs.map(r=>r.well),reason:'Expected two unmasked wells in the same row and dose, in columns 2–11 and 12–21, exactly ten columns apart.'});continue;}
        const raw_stats=Object.fromEntries(channels.map(ch=>{const va=a.raw?.[ch],vb=b.raw?.[ch];return [ch,{...stats([va,vb]),replicate1:finite(va)?va:null,replicate2:finite(vb)?vb:null,signed_difference:finite(va)&&finite(vb)?vb-va:null}];}));
        sample_pairs.push({compound:a.compound,target:a.target,transfection:a.transfection,plate_id,x:a.x,well1:a.well,well2:b.well,corrected1:finite(a.corrected)?a.corrected:null,corrected2:finite(b.corrected)?b.corrected:null,corrected_gap:finite(a.corrected)&&finite(b.corrected)?Math.abs(b.corrected-a.corrected):null,signed_corrected_difference:finite(a.corrected)&&finite(b.corrected)?b.corrected-a.corrected:null,raw_stats});
      }
      const patterns=[];
      for(const ch of channels) {
        const paired=sample_pairs.filter(p=>p.raw_stats[ch]?.n===2&&p.raw_stats[ch].mean>0);
        if(paired.length){const signed=paired.map(p=>100*p.raw_stats[ch].signed_difference/p.raw_stats[ch].mean),lower=signed.filter(v=>v<0).length;
          patterns.push({channel:ch,type:'sample_block_difference',text:`Matched sample wells: block 2 is lower than block 1 in ${lower}/${paired.length} pairs; median signed difference is ${median(signed).toFixed(1)}% of the pair mean.`,value:median(signed),n:paired.length,lower_count:lower});
        }
        for(const [control,label] of [['dmso','DMSO'],['inhibitory','Inhibitory']]) {
          const c=controls[control],vs=retained.filter(r=>r.column===c.column&&r.well_type===c.well_type&&finite(r.raw?.[ch])).sort((a,b)=>a.row.localeCompare(b.row));
          if(vs.length>=6){const early=mean(vs.slice(0,3).map(r=>r.raw[ch])),late=mean(vs.slice(-3).map(r=>r.raw[ch]));if(early>0){const change=100*(late-early)/early;
            patterns.push({channel:ch,type:'control_row_change',text:`${label} controls: last three measured rows versus first three differ by ${change.toFixed(1)}% in Raw mean. This describes position and does not establish a plate effect.`,value:change,n:vs.length,control});}}
        }
      }
      const doses=[...new Set(sample_pairs.map(p=>p.x))].sort((a,b)=>a-b);
      for(const x of doses){const ps=sample_pairs.filter(p=>p.x===x&&finite(p.signed_corrected_difference));if(ps.length<5)continue;const lower=ps.filter(p=>p.signed_corrected_difference<0).length,med=median(ps.map(p=>p.signed_corrected_difference));if(Math.max(lower,ps.length-lower)/ps.length>=.8&&Math.abs(med)>=20)patterns.push({channel:'Corrected response',type:'corrected_dose_block_difference',text:`At ${x.toPrecision(3)} µM, block 2 is lower in ${lower}/${ps.length} pairs; median block 2 minus block 1 is ${med.toFixed(1)} corrected response units. Check plate layout/readout before attributing this to compounds.`,value:med,n:ps.length,x,lower_count:lower});}
      plates.push({plate_id,target:[...new Set(retained.map(r=>r.target).filter(Boolean))].join(' / '),transfection:transfections.join(' / '),transfections,wells,controls,sample_pairs,unmatched_sample_groups,patterns,counts:{wells_total:wells.length,excluded:wells.filter(r=>r.excluded).length,undefined:wells.filter(r=>r.well_type==='Undefined').length,sample_wells:samples.length,sample_pairs:sample_pairs.length,duplicate_positions:duplicates.length,unmatched_sample_groups:unmatched_sample_groups.length}});
    }
    return {available:true,reason:'',channels,plates,notes:['CV (%) = 100 × sample SD / positive Raw mean (SD uses n − 1). Fewer than two values or a nonpositive mean gives unavailable CV. With n = 2, sample CV is only a descriptive review measure.','Masked/ignored wells and ambiguous duplicate positions are excluded from statistics. Undefined wells remain visible but are excluded. Controls must match both source Well Type and configured columns 22 or 23.','Samples pair by physical plate, full compound ID, transfection and dose; the two wells must share a row and be exactly ten columns apart in columns 2–11 versus 12–21. Other layouts are listed as unmatched.','Control variability and block/row patterns are descriptive. No formal plate pass/fail limit is imposed. Raw channel names are preserved from the source; biochemical channel assignments require assay documentation.']};
  }
  const api={analyze,stats};root.AtlasPlateQC=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
