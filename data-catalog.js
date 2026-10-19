/* Complete, source-preserving result catalog. One row is one parameter or measured signal.
 * Values are never averaged across batches, runs, conditions or response bases.
 * load is lazy and cached; files are fetched sequentially to limit peak JSON memory.
 * Optional categoryIds restricts the returned rows and avoids unrelated file downloads.
 */
(function(root){
  'use strict';
  const categories = [
    ['gds_parameters','GDS reported EC50 & fit parameters','Reported EC50/qAC50, Cmax and GDS fit metadata. Unassigned source reports retain an unknown biological replicate.'],
    ['nanobret_summary','NanoBRET observed responses','Observed peak mean and peak concentration for each biological replicate, target and condition.'],
    ['nanobret_doses','NanoBRET dose responses','Every concentration mean, with SD and well count, for each response basis.'],
    ['atlas_refits','Independent NanoBRET refits','Independent 4PL parameters, distinct from GDS reported values.'],
    ['kd1','Kd1 · all time points','CypA competition NanoBRET GMean qAC50 and Cmax at 2, 6, 24 and 48 hours. Kd1 is the assay name, not a reported dissociation constant.'],
    ['tr_fret','TR-FRET','Detailed phosphorylated and unphosphorylated qAC50 and Sinf. Rep 1/2 type is unspecified in the source.'],
    ['primary_screen','Primary screen responses','Pharmaron and RevMed primary-screen corrected responses.'],
    ['source_summary','Mastersheet NanoBRET summaries','Source mean/GMean results and hit labels; kept separate from individual run measurements.'],
    ['crosslinking','Crosslinking','Adduct distributions, total crosslinking, folds and differences from the detailed context sheets.'],
    ['nanobret_wells','Individual corrected NanoBRET wells','All measured sample and control wells, including excluded wells and their exclusion flags.'],
    ['nanobret_raw','Raw NanoBRET channels & QC layer','Source raw channels and QC-layer signal, with plate, well, source row and layout provenance.']
  ].map(([id,label,description])=>({id,label,description}));
  const specs = [
    ['base_compound','Compound'],['batch','Batch'],['compound','Full compound batch ID'],['source_compound','Original source compound label'],['plate_number','Physical plate number','number'],['category','Data category'],['assay','Assay'],['metric','Measurement'],['value','Value','number'],['qualifier','Qualifier'],['unit','Unit'],['target','Target / configuration'],
    ['time_hours','Time (hours)','number'],['biological_replicate','Biological replicate','number'],['source_replicate','Source replicate (type unspecified)','number'],['condition','Condition'],['configuration','Configuration'],['experiment','Experiment'],['run_date','Run date'],['measured_at','Instrument measurement timestamp'],['response_basis','Response basis'],['concentration_um','Concentration (µM)','number'],['sd','SD','number'],['n','Well count','number'],['source_file','Source file'],['source_sheet','Source sheet'],['source_row','Source row','number'],['source_range','Source cells / range'],['provenance','Source notes'],['qc_flags','QC flags'],['raw_value','Source potency text'],['plate','Plate'],['well','Well'],['well_type','Well type'],['excluded','Excluded','boolean'],['masking_reason','Masking reason'],['layout_source_file','Layout source file'],['layout_source_row','Layout source row','number'],['source_target','Original source target'],['source_transfection','Original source transfection'],['source_custom_settings','Source fit settings'],['source_mode','Source classification'],['source_valid','Source fit valid'],['exclude_from_reporting','Source reporting exclusion','boolean']
  ];
  const standard = new Set(['base_compound','batch','source_compound','plate','plate_number','assay','metric','value','qualifier','unit','target','time_hours','biological_replicate','source_replicate','condition','experiment','response_basis','source_file','source_sheet','source_row','source_range','provenance']);
  const columns = specs.map(([key,label,type='text'])=>({key,label,type,default:standard.has(key)}));
  const keys=specs.map(s=>s[0]);
  const blank=Object.fromEntries(keys.map(k=>[k,null]));
  const caches=new Map();
  const instrumentCaches=new Map();
  const available=v=>v!==null&&v!==undefined&&!(typeof v==='number'&&!Number.isFinite(v));
  const text=v=>v===null||v===undefined||v===''?null:String(v);
  // Numeric RMC suffixes are Compound Management batch identifiers. Identity
  // always retains the full ID; experiment-specific corrections occur upstream.
  function identity(compound){
    const id=text(compound),m=/^(RMC-\d+)-(\d{3,})$/i.exec(id||'');
    return {compound:id,base_compound:m?m[1]:id,batch:m?m[2]:null,source_compound:id};
  }
  function row(context,category,metric,value,extra={}){
    return {...blank,...context,category,metric,value:available(value)?value:null,...extra};
  }
  const join=a=>Array.isArray(a)?a.filter(Boolean).join('; '):text(a);
  function parameters(out,p,context){
    const ctx={...context,...identity(p.compound),source_compound:text(p.source_compound??context.source_compound??p.compound),plate:text(p.physical_plate??p.plate_id??context.plate),plate_number:p.plate_number??context.plate_number??null,source_file:text(p.source),source_row:p.source_row??null,source_sheet:p.source_sheet??null,source_target:text(p.source_target),source_transfection:text(p.source_transfection??p.transfection),source_custom_settings:text(p.source_custom_settings),source_mode:text(p.source_mode),source_valid:text(p.source_valid),exclude_from_reporting:p.exclude_from_reporting??null,qc_flags:text(p.source_qc)};
    for(const [key,label,unit] of [['ec50','Reported EC50 / qAC50','µM'],['cmax','Reported Cmax','%'],['source_r2','GDS R²',null],['source_s0','GDS S0','%'],['source_sinf','GDS Sinf','%'],['source_wells','GDS source well count','wells']]){
      // Include missing reported potency explicitly; do not manufacture a numeric value.
      out.push(row(ctx,'gds_parameters',label,p[key],{unit,qualifier:key==='ec50'?text(p.qualifier):null}));
    }
  }
  function curveData(data,file,config,instruments){
    const out=[];
    const ctx={assay:'NanoBRET',experiment:data.experiment??data.experiment_id??config.experiment??null,biological_replicate:data.biological_replicate??config.biological_replicate??null,run_date:data.run_date??config.run_date??null,time_hours:data.time_hours??config.time_hours??null,condition:data.condition_label??config.condition??null,response_basis:data.response_label??config.response_basis??'Corrected response',provenance:`Catalog data: ${file}. ${data.response_basis||''} ${data.source_date_note||''} ${file==='sample.json'?'Replicate 1 experiment/date follow the Atlas run configuration. Shipped row-level filenames may be anonymized or generic; see Data sources for the supplied original files and experiment provenance.':''}`.trim()};
    const rawSeen=new Set();
    for(const c of data.curves||[]){
      const cx={...ctx,...identity(c.compound),source_compound:text(c.source_compound??c.compound),plate:text(c.physical_plate??c.plate_id),plate_number:c.plate_number??null,target:text(c.target),configuration:text(c.configuration),source_file:join(c.sources),source_target:text(c.source_target),source_transfection:text(c.source_transfection??c.transfection),qc_flags:join(c.fit_flags),provenance:[ctx.provenance,text(c.curve_note),text(c.identity_note)].filter(Boolean).join(' ')};
      if(c.report&&!config.independent)parameters(out,c.report,{...cx,response_basis:'GDS reported parameters'});
      out.push(row(cx,'nanobret_summary','Observed peak dose mean',c.peak_mean,{unit:'%'}));
      out.push(row(cx,'nanobret_summary','Concentration at observed peak',c.peak_dose,{unit:'µM'}));
      for(const [k,label,unit] of [['n_wells','Included curve well count','wells'],['excluded_wells','Excluded curve well count','wells'],['n_doses','Dose count','concentrations'],['min_dose','Minimum tested concentration','µM'],['max_dose','Maximum tested concentration','µM']])out.push(row(cx,'nanobret_summary',label,c[k],{unit}));
      for(const dose of c.doses||[])out.push(row(cx,'nanobret_doses','Corrected dose mean',dose.mean,{unit:'%',concentration_um:dose.x??null,sd:dose.sd??null,n:dose.n??null}));
      if(c.fit)for(const [k,label,unit] of [['ec50','Independent 4PL EC50','µM'],['log_ec50_um','Independent log10 EC50 (µM)',null],['hill','Independent Hill slope',null],['s0','Independent S0','%'],['sinf','Independent Sinf','%'],['amplitude','Independent amplitude','percentage points'],['r2','Independent R²',null],['rmse','Independent RMSE','%']])out.push(row(cx,'atlas_refits',label,c.fit[k],{unit}));
      if(c.fit)out.push(row(cx,'atlas_refits','Independent curve direction',text(c.fit.direction)));
    }
    for(const plate of data.plate_qc?.plates||[])for(const w of plate.wells||[]){
      // Empty plate positions are not measurements. Keep missing corrected values for measured raw wells.
      if(!available(w.corrected)&&!Object.values(w.raw||{}).some(available)&&!available(w.qc_raw))continue;
      // One source workbook spells plate 14B as Cyclins-DR14B. All 308
      // acceptor signals match the original Cyclins-DR-14B CSV exactly.
      const originalPlate=String(w.plate_id??plate.plate_id??'').replace(/^Cyclins-DR(?=\d)/,'Cyclins-DR-');
      const original=instruments?.get(w.source)||instruments?.get(`${data.source_folder??config.source_folder}|${originalPlate}`);
      const wx={...ctx,...identity(w.compound),source_compound:text(w.source_compound??w.compound),plate_number:w.plate_number??null,target:text(w.target??plate.target),configuration:text(w.configuration),plate:text(w.plate_id??plate.plate_id),well:text(w.well),well_type:text(w.well_type),concentration_um:w.x??null,source_file:text(w.source),source_row:w.source_row??null,source_sheet:w.source_sheet??null,excluded:w.excluded??null,masking_reason:text(w.masking_reason),layout_source_file:text(w.layout_source),layout_source_row:w.layout_source_row??null,source_target:text(w.source_target),source_transfection:text(w.source_transfection??w.transfection),measured_at:text(w.measured_at??original?.measured_at),provenance:[ctx.provenance,text(w.role_basis),text(w.identity_note)].filter(Boolean).join(' ')};
      out.push(row(wx,'nanobret_wells','Corrected well response',w.corrected,{unit:'%'}));
      // Independent ratio files repeat the same physical raw measurements as the GDS files.
      if(config.independent)continue;
      for(const [channel,value] of Object.entries(w.raw||{})){
        if(!available(value))continue;
        const sig=JSON.stringify([w.source,w.plate_id,w.well,channel]);if(rawSeen.has(sig))continue;rawSeen.add(sig);
        out.push(row({...wx,response_basis:'Source raw signal',source_file:text(w.raw_source??w.source),source_row:w.raw_source?null:wx.source_row},'nanobret_raw',channel,value,{unit:/ratio/i.test(channel)?'ratio':null,provenance:[wx.provenance,w.raw_source?`GDS mapping: ${w.source}, row ${w.source_row??'unavailable'}.`:null].filter(Boolean).join(' ')}));
      }
      if(available(w.qc_raw))out.push(row({...wx,response_basis:'Source QC layer raw'},'nanobret_raw','QC Layer raw',w.qc_raw));
      // The rep1 B GDS workbook retains rounded exported raw values. Preserve the
      // original physical CSV signal separately, without repeating the other 72
      // instrument CSVs already represented by their reconstructed run files.
      if(original&&w.source!==original.file){
        for(const [channel,values] of Object.entries(original.channels||{})){
          const value=values[w.well];if(!available(value))continue;
          out.push(row({...wx,source_file:original.file,source_row:null,source_sheet:null,response_basis:'Original instrument raw signal'},'nanobret_raw',channel,value,{unit:channel==='ratio'?'ratio':null,provenance:`Catalog data: cyclind1-instrument.json. Original physical instrument signal. Compound/layout assignment follows ${w.source}, row ${w.source_row??'unavailable'}, plate ${wx.plate}, well ${wx.well}. Rounded GDS-exported values remain separately identified.`}));
        }
      }
    }
    return out;
  }
  function supporting(data,file){
    const out=[];
    for(const r of data.records||[]){
      const cx={...identity(r.compound),source_file:text(data.source),provenance:`Catalog data: ${file}. Full Compound Management batch IDs and source means/geometric means remain separate from run-specific measurements.`,target:'Cyclin D1/CypA'};
      for(const q of r.competition||[]){
        const qx={...cx,assay:'Kd1 · CypA competition NanoBRET',target:'CypA',time_hours:q.time_hours??null,condition:'RMC0727964 tracer · HEK293T_CYPA_KO',source_sheet:text(q.sheet),source_range:text(q.source_range),source_row:rangeRow(q.source_range),provenance:`${cx.provenance} ${data.assay_context?.competition_metric||''}`};
        out.push(row(qx,'kd1','GMean qAC50',q.qac50?.value_um,{unit:'µM',qualifier:text(q.qac50?.qualifier),raw_value:text(q.qac50?.raw),qc_flags:text(q.qac50?.note)}));
        out.push(row(qx,'kd1','Mean Cmax',q.cmax,{unit:'%'}));
      }
      for(const q of r.trfret||[]){
        const qx={...cx,assay:'TR-FRET',source_replicate:q.replicate??null,condition:text(q.condition),source_sheet:text(q.sheet),source_range:text(q.source_range),source_row:rangeRow(q.source_range),provenance:`${cx.provenance} TR-FRET replicate type and Sinf units are unspecified. Source qAC50 [M] converted to µM.`};
        out.push(row(qx,'tr_fret','qAC50',q.qac50?.value_um,{unit:'µM',qualifier:text(q.qac50?.qualifier),raw_value:text(q.qac50?.raw),qc_flags:text(q.qac50?.note)}));
        out.push(row(qx,'tr_fret','Sinf',q.sinf));
      }
      if(r.master){
        const m=r.master,mx={...cx,assay:'NanoBRET mastersheet summary',time_hours:24,source_sheet:text(m.sheet),source_row:m.row??null};
        for(const [k,label,range] of [['no_inhibitor','No CypA inhibitor','I:J'],['with_inhibitor','With CypA inhibitor','L:M']]){
          const q=m[k]||{},sx={...mx,condition:label,source_range:`${range} row ${m.row}`};
          out.push(row(sx,'source_summary','GMean qAC50',q.qac50?.value_um,{unit:'µM',qualifier:text(q.qac50?.qualifier),raw_value:text(q.qac50?.raw),qc_flags:text(q.qac50?.note)}));
          out.push(row(sx,'source_summary','Mean Cmax',q.cmax,{unit:'%'}));
        }
        out.push(row(mx,'source_summary','ΔCmax (without − with inhibitor)',m.delta_cmax,{unit:'percentage points'}));
        for(const [k,label] of [['trfret_label','TR-FRET source hit label'],['nanobret_label','NanoBRET source hit label']])out.push(row(mx,'source_summary',label,text(m[k])));
        for(const [k,label,col] of [['primary_pharmaron','Pharmaron','F'],['primary_revmed','RevMed','G']])out.push(row({...mx,assay:'Primary NanoBRET',condition:label,source_range:col+m.row},'primary_screen','Mean corrected response',m[k],{unit:'%'}));
      }
      out.push(row({...cx,assay:'Mastersheet hit-list membership'},'source_summary','Exact batch-ID source hit lists',join(r.source_lists)));
      out.push(row({...cx,assay:'Mastersheet hit-list membership',provenance:`${cx.provenance} Validated list membership is by base compound ID; that list does not specify a batch.`},'source_summary','Base-ID validated list membership',r.base_id_validated_list??null));
    }
    return out;
  }
  function rangeRow(range){const m=/\d+/.exec(range||'');return m?Number(m[0]):null;}
  function crosslinking(data,file){
    const out=[],meta=data.metadata||{};
    for(const r of data.records||[]){
      const cx={...identity(r.compound),assay:'Crosslinking',target:text(r.context),time_hours:meta.incubation_hours??null,concentration_um:meta.concentration_um??null,source_file:text(data.source),source_sheet:text(r.sheet),source_row:r.source_row??null,qc_flags:join(r.flags),provenance:`Catalog data: ${file}. Detailed context sheets imported once. Full Compound Management batch IDs remain distinct. ${meta.protocol_source||''}. Target concentration ${meta.target_concentration_um??'unspecified'} µM; +CypA concentration ${meta.cypa_concentration_um??'unspecified'} µM. Source n=${meta.n_reported??'unspecified'}; biological versus technical replicate type unspecified.`.trim()};
      for(const [key,q] of Object.entries(r.conditions||{})){
        const qx={...cx,condition:key==='no_cypa'?'No CypA':key==='with_cypa'?'+CypA':key,source_range:text(q.source_range)};
        for(let i=0;i<(q.adduct_percent||[]).length;i++)out.push(row(qx,'crosslinking',i===0?'Unmodified (0 adducts)':`${i} adduct${i===1?'':'s'}`,q.adduct_percent[i],{unit:'%'}));
        out.push(row(qx,'crosslinking','Total crosslinking',q.total_percent,{unit:'%',source_range:text(q.total_cell??q.source_range)}));
      }
      for(const [key,q] of Object.entries(r.comparison||{})){
        const labels={total_fold:'Total fold (+CypA / No CypA)',single_fold:'Single adduct fold (+CypA / No CypA)',total_delta_pp:'Total difference (+CypA − No CypA)',single_delta_pp:'Single adduct difference (+CypA − No CypA)'};
        out.push(row(cx,'crosslinking',labels[key]||key,q.value,{unit:key.endsWith('_pp')?'percentage points':'fold',source_range:text(q.source_cell),provenance:[cx.provenance,text(q.undefined_reason)].filter(Boolean).join(' ')}));
      }
    }
    return out;
  }
  const curveCategories=['gds_parameters','nanobret_summary','nanobret_doses','atlas_refits','nanobret_wells','nanobret_raw'];
  const files=[
    ['sample.json','curves',{experiment:'EXP26007301',biological_replicate:1,run_date:'2026-10-09',time_hours:24,response_basis:'GDS corrected response'}],
    ['selectivity-rep2.json','curves',{time_hours:24,response_basis:'GDS corrected response'}],
    ['cyclind1.json','curves',{experiment:'EXP26003438',biological_replicate:1,run_date:'2026-09-02',source_folder:'20260902',condition:'+25 µM CypA inhibitor',time_hours:24}],
    ['cyclind1-bio1-A.json','curves',{time_hours:24,response_basis:'Independent ratio-normalized response'}],
    ['cyclind1-bio2-A.json','curves',{time_hours:24,response_basis:'Independent ratio-normalized response'}],
    ['cyclind1-bio2-B.json','curves',{time_hours:24,response_basis:'Independent ratio-normalized response'}],
    ['orientation-rep1-gds.json','curves',{}],['orientation-rep2-gds.json','curves',{}],
    ['orientation-rep1-ratio.json','curves',{independent:true}],['orientation-rep2-ratio.json','curves',{independent:true}],
    ['cyclind1-source-parameters.json','parameters',{}],['supporting-assays.json','supporting',{}],['crosslinking.json','crosslinking',{}]
  ];
  function idsFor(kind,config){return kind==='curves'?curveCategories.filter(id=>!config.independent||!['gds_parameters','nanobret_raw'].includes(id)):kind==='parameters'?['gds_parameters']:kind==='supporting'?['kd1','tr_fret','primary_screen','source_summary']:['crosslinking'];}
  async function load({baseUrl='.',categoryIds,onProgress}={}){
    const wanted=new Set(categoryIds||categories.map(c=>c.id)),out=[];
    let completed=0;
    for(const [file,kind,config] of files){
      if(!idsFor(kind,config).some(id=>wanted.has(id)))continue;
      const url=String(baseUrl).replace(/\/$/,'')+'/'+file;
      if(!caches.has(url))caches.set(url,(async()=>{
        const response=await fetch(url);if(!response.ok)throw new Error(`Could not load ${file} (${response.status}). No partial export was created.`);
        let data=await response.json();
        if(kind==='curves'){
          if(file==='sample.json'||file==='selectivity-rep2.json'){
            const identities=root.AtlasSelectivityIdentity||(typeof require==='function'?require('./selectivity-identity.js'):null);
            if(!identities)throw new Error('Selectivity compound/plate identity rules could not be loaded. No partial export was created.');
            // The user confirmed the selectivity reference's source suffix 002
            // identifies plate 2 of the same batch. Preserve every plate curve,
            // original identifier and original value; never pool reference plates.
            data=identities.prepare({...data,experiment:'EXP26007301'},{referencePlate:'all'});
          }
          let instruments;
          if(file.startsWith('cyclind1')){
            const instrumentURL=String(baseUrl).replace(/\/$/,'')+'/cyclind1-instrument.json';
            if(!instrumentCaches.has(instrumentURL))instrumentCaches.set(instrumentURL,(async()=>{
              const result=await fetch(instrumentURL);if(!result.ok)throw new Error('Original Cyclin D1 instrument sources could not be loaded. No partial export was created.');
              const items=await result.json(),map=new Map();for(const p of items){map.set(p.file,p);map.set(`${p.file.split('/')[0]}|${p.plate_id}`,p);}return map;
            })().catch(error=>{instrumentCaches.delete(instrumentURL);throw error;}));
            instruments=await instrumentCaches.get(instrumentURL);
          }
          return curveData(data,file,config,instruments);
        }
        if(kind==='supporting')return supporting(data,file);
        if(kind==='crosslinking')return crosslinking(data,file);
        const rows=[];for(const p of data)parameters(rows,p,{assay:'NanoBRET',target:text(p.target),experiment:'EXP26003438',biological_replicate:null,time_hours:24,condition:'No CypA inhibitor',response_basis:'GDS reported parameters; replicate unassigned',provenance:`Catalog data: ${file}. Confirmed no-inhibitor workbook; source parameter export contains no plate or biological replicate identifier. No replicate or run date inferred.`});return rows;
      })().catch(error=>{caches.delete(url);throw error;}));
      for(const r of await caches.get(url))if(wanted.has(r.category))out.push(r);
      completed++;if(typeof onProgress==='function')onProgress({file,completed,records:out.length});
    }
    return out;
  }
  const notes=[
    'This catalog uses only the existing data files supplied for Target Atlas. Adding another source requires a user-directed data update; no external experiment data is searched for or imported.',
    'Within EXP26007301, the user confirmed the RMC-0741051 source suffix 002 identifies the second physical plate of batch 001. Canonical batch identity, original source label and plate are retained separately; no plate values are pooled.',
    'RMC suffixes such as -001, -002 and -003 identify distinct Compound Management batches. The base compound and batch are shown separately, and full batch IDs remain the matching and export keys. Supporting assays and crosslinking results retain their exact source batch IDs.'
  ];
  root.AtlasDataCatalog={load,categories,columns,notes,identify:identity};
  if(typeof module!=='undefined'&&module.exports)module.exports=root.AtlasDataCatalog;
})(globalThis);
