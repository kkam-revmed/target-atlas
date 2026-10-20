/* Offline, source-preserving data selection and real Excel workbook exports. */
'use strict';
window.AtlasDataExport = (() => {
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const xml = value => esc(String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, ''));
  const list = rows => [...new Set(rows.filter(v => v !== null && v !== undefined && String(v) !== '').map(String))].sort((a,b)=>a.localeCompare(b, undefined, {numeric:true}));
  const sourceKeys = ['source_file','source_sheet','source_row','source_range','provenance'];
  const requiredKeys = [...sourceKeys,'base_compound','batch','assay','metric','value','qualifier','unit','source_compound','plate','plate_number'];
  const fallbackColumns = ['compound','base_compound','batch','category','assay','metric','value','qualifier','unit','target','time_hours','biological_replicate','source_replicate','condition','experiment',...sourceKeys,'qc_flags'].map(key=>({key,label:key.replace(/_/g,' '),default: !['source_replicate','source_row','source_range'].includes(key)}));
  let sequence = 0;
  const encoder = new TextEncoder();
  const crcTable = Array.from({length:256}, (_,i) => {let c=i;for(let j=0;j<8;j++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
  function crc32(bytes){let c=0xffffffff;for(const byte of bytes)c=crcTable[(c^byte)&255]^(c>>>8);return (c^0xffffffff)>>>0;}
  function zip(files){
    const parts=[], directory=[];let offset=0;
    const header=(size)=>{const bytes=new Uint8Array(size);return {bytes,view:new DataView(bytes.buffer)};};
    for(const [path,content] of files){
      const name=encoder.encode(path),body=encoder.encode(content),crc=crc32(body),local=header(30);
      local.view.setUint32(0,0x04034b50,true);local.view.setUint16(4,20,true);local.view.setUint16(6,0x800,true);local.view.setUint32(14,crc,true);local.view.setUint32(18,body.length,true);local.view.setUint32(22,body.length,true);local.view.setUint16(26,name.length,true);
      parts.push(local.bytes,name,body);
      const central=header(46);central.view.setUint32(0,0x02014b50,true);central.view.setUint16(4,20,true);central.view.setUint16(6,20,true);central.view.setUint16(8,0x800,true);central.view.setUint32(16,crc,true);central.view.setUint32(20,body.length,true);central.view.setUint32(24,body.length,true);central.view.setUint16(28,name.length,true);central.view.setUint32(42,offset,true);directory.push(central.bytes,name);offset+=30+name.length+body.length;
    }
    const size=directory.reduce((sum,p)=>sum+p.length,0),end=header(22);end.view.setUint32(0,0x06054b50,true);end.view.setUint16(8,files.length,true);end.view.setUint16(10,files.length,true);end.view.setUint32(12,size,true);end.view.setUint32(16,offset,true);
    return new Blob([...parts,...directory,end.bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  }
  function columnName(index){let name='';for(index++;index;index=Math.floor((index-1)/26))name=String.fromCharCode(65+(index-1)%26)+name;return name;}
  function presetSelection(data,kind){
    const eligible=kind==='potency'?data.filter(row=>row.category!=='atlas_refits'):data;
    const match=metric=>kind==='all'||(kind==='potency'?/(?:EC50|qAC50)/i.test(metric)&&!/(?:log|Independent)/i.test(metric):/Cmax/i.test(metric)||metric==='Observed peak dose mean');
    const metrics=list(eligible.map(row=>row.metric)).filter(match),chosen=new Set(metrics);
    return {metrics,categories:list(eligible.filter(row=>chosen.has(String(row.metric))).map(row=>row.category))};
  }
  function worksheet(headers, rows){
    const cell=(value,row,col,heading=false)=>{const ref=columnName(col)+row,style=heading?' s="1"':'';if(typeof value==='number'&&Number.isFinite(value))return `<c r="${ref}"${style}><v>${value}</v></c>`;if(typeof value==='boolean')return `<c r="${ref}" t="b"${style}><v>${Number(value)}</v></c>`;return `<c r="${ref}" t="inlineStr"${style}><is><t xml:space="preserve">${xml(value)}</t></is></c>`;};
    const lines=[`<row r="1">${headers.map((v,c)=>cell(v,1,c,true)).join('')}</row>`];
    rows.forEach((row,i)=>lines.push(`<row r="${i+2}">${row.map((v,c)=>cell(v,i+2,c)).join('')}</row>`));
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${columnName(headers.length-1)}${rows.length+1}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${headers.map((_,i)=>`<col min="${i+1}" max="${i+1}" width="${i===0?24:22}" customWidth="1"/>`).join('')}</cols><sheetData>${lines.join('')}</sheetData><autoFilter ref="A1:${columnName(headers.length-1)}${rows.length+1}"/></worksheet>`;
  }
  function workbookFiles({rows,columns,details=[],streamSheets=false}){
    if(!columns.length)throw new Error('Choose at least one column.');
    if(rows.length>1048575)throw new Error('Excel supports 1,048,575 data rows per sheet. Narrow your selection.');
    const sheets=[['Selected data',streamSheets?{headers:columns.map(c=>c.label),rows,keys:columns.map(c=>c.key)}:worksheet(columns.map(c=>c.label),rows.map(row=>columns.map(c=>row[c.key])))],['Export details',streamSheets?{headers:['Setting','Value'],rows:details}:worksheet(['Setting','Value'],details)]];
    return [
      ['[Content_Types].xml',`<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`],
      ['_rels/.rels','<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
      ['xl/workbook.xml',`<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map(([name],i)=>`<sheet name="${xml(name)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets></workbook>`],
      ['xl/_rels/workbook.xml.rels',`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
      ['xl/styles.xml','<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>'],
      ...sheets.map(([,content],i)=>[`xl/worksheets/sheet${i+1}.xml`,content])
    ];
  }
  function createWorkbook(options){return zip(workbookFiles(options));}
  function csvCell(value){
    let text=String(value??'');
    // CSV has no cell types: protect text that spreadsheet readers may execute.
    // Actual numeric negatives retain their numeric value and full precision.
    if(typeof value==='string'&&text!=='='&&(/^[\t\r\n]/.test(text)||/^[\s\uFEFF]*[=+\-@]/.test(text)))text="'"+text;
    return '"'+text.replace(/"/g,'""')+'"';
  }
  function csvLine(values){return values.map(csvCell).join(',')+'\r\n';}
  function createCSV({rows,columns}){
    return '\uFEFF'+csvLine(columns.map(c=>c.label))+rows.map(row=>csvLine(columns.map(c=>row[c.key]))).join('');
  }
  async function createCSVBlob({rows,columns}){
    let position=-1;
    const stream=new ReadableStream({async pull(controller){
      if(position===-1){position=0;controller.enqueue(encoder.encode('\uFEFF'+csvLine(columns.map(c=>c.label))));return;}
      if(position>=rows.length){controller.close();return;}
      const stop=Math.min(position+1000,rows.length),lines=[];
      while(position<stop){const row=rows[position++];lines.push(csvLine(columns.map(c=>row[c.key])));}
      controller.enqueue(encoder.encode(lines.join('')));
      if(position%10000===0)await new Promise(resolve=>setTimeout(resolve,0));
    }});
    return new Blob([await new Response(stream).blob()],{type:'text/csv;charset=utf-8'});
  }
  function sheetStream({headers,rows,keys}){
    let position=-1;
    const last=columnName(headers.length-1),range=`A1:${last}${rows.length+1}`;
    const cells=(values,row,heading=false)=>`<row r="${row}">${values.map((value,col)=>{const ref=columnName(col)+row,style=heading?' s="1"':'';if(typeof value==='number'&&Number.isFinite(value))return `<c r="${ref}"${style}><v>${value}</v></c>`;if(typeof value==='boolean')return `<c r="${ref}" t="b"${style}><v>${Number(value)}</v></c>`;return `<c r="${ref}" t="inlineStr"${style}><is><t xml:space="preserve">${xml(value)}</t></is></c>`;}).join('')}</row>`;
    return new ReadableStream({async pull(controller){
      if(position===-1){position=0;controller.enqueue(encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="${range}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${headers.map((_,i)=>`<col min="${i+1}" max="${i+1}" width="${i===0?24:22}" customWidth="1"/>`).join('')}</cols><sheetData>${cells(headers,1,true)}`));return;}
      if(position>=rows.length){controller.enqueue(encoder.encode(`</sheetData><autoFilter ref="${range}"/></worksheet>`));controller.close();return;}
      const stop=Math.min(position+500,rows.length),parts=[];
      while(position<stop){const record=rows[position];parts.push(cells(keys?keys.map(key=>record[key]):record,position+2));position++;}
      controller.enqueue(encoder.encode(parts.join('')));
      // Keep controls and progress responsive even when exporting every raw well.
      if(position%10000===0)await new Promise(resolve=>setTimeout(resolve,0));
    }});
  }
  async function createWorkbookAsync(options){
    const files=workbookFiles({...options,streamSheets:true}),parts=[],directory=[];let offset=0;
    const header=size=>{const bytes=new Uint8Array(size);return {bytes,view:new DataView(bytes.buffer)};};
    for(const [path,content] of files){
      options.onProgress?.(path.includes('sheet1.xml')?`Preparing ${options.rows.length.toLocaleString()} selected measurements for Excel…`:'Building Excel workbook…');
      let crc=0xffffffff,size=0,method=0,compressor;
      try{compressor=new CompressionStream('deflate-raw');method=8;}catch(_){compressor=null;}
      const source=typeof content==='string'?new Blob([content]).stream():sheetStream(content);
      const measured=source.pipeThrough(new TransformStream({transform(bytes,controller){size+=bytes.length;for(const byte of bytes)crc=crcTable[(crc^byte)&255]^(crc>>>8);controller.enqueue(bytes);}}));
      const body=await new Response(compressor?measured.pipeThrough(compressor):measured).blob();
      crc=(crc^0xffffffff)>>>0;
      if(size>0xffffffff||body.size>0xffffffff||offset>0xffffffff)throw new Error('Workbook exceeds ZIP size limits. Narrow your selection.');
      const name=encoder.encode(path),local=header(30);
      local.view.setUint32(0,0x04034b50,true);local.view.setUint16(4,20,true);local.view.setUint16(6,0x800,true);local.view.setUint16(8,method,true);local.view.setUint32(14,crc,true);local.view.setUint32(18,body.size,true);local.view.setUint32(22,size,true);local.view.setUint16(26,name.length,true);parts.push(local.bytes,name,body);
      const central=header(46);central.view.setUint32(0,0x02014b50,true);central.view.setUint16(4,20,true);central.view.setUint16(6,20,true);central.view.setUint16(8,0x800,true);central.view.setUint16(10,method,true);central.view.setUint32(16,crc,true);central.view.setUint32(20,body.size,true);central.view.setUint32(24,size,true);central.view.setUint16(28,name.length,true);central.view.setUint32(42,offset,true);directory.push(central.bytes,name);offset+=30+name.length+body.size;
    }
    const size=directory.reduce((sum,p)=>sum+p.length,0),end=header(22);end.view.setUint32(0,0x06054b50,true);end.view.setUint16(8,files.length,true);end.view.setUint16(10,files.length,true);end.view.setUint32(12,size,true);end.view.setUint32(16,offset,true);
    return new Blob([...parts,...directory,end.bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  }
  function save(blob,filename){const link=document.createElement('a'),url=URL.createObjectURL(blob);link.href=url;link.download=filename;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
  function printReport(rows,columns,details){
    document.getElementById('atlasPrintReport')?.closeReport?.();
    const priorFocus=document.activeElement,scrollX=window.scrollX,scrollY=window.scrollY;
    const cards=columns.length>9,report=document.createElement('section');
    report.id='atlasPrintReport';report.setAttribute('role','dialog');report.setAttribute('aria-modal','true');report.setAttribute('aria-labelledby','atlasPrintReportTitle');
    const content=cards?`<p class="atlas-report-note">Wide selections are arranged as measurement cards so every selected field and source can be read.</p><div class="atlas-report-cards">${rows.map((r,i)=>`<article><h2>Measurement ${i+1}</h2><dl>${columns.map(c=>`<div class="${['source_file','provenance','qc_flags'].includes(c.key)?'atlas-report-wide':''}"><dt>${esc(c.label)}</dt><dd>${esc(r[c.key])||'—'}</dd></div>`).join('')}</dl></article>`).join('')}</div>`:`<table><thead><tr>${columns.map(c=>`<th scope="col">${esc(c.label)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${columns.map(c=>`<td>${esc(r[c.key])}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    report.innerHTML=`<style media="print">@page{size:A3 landscape;margin:12mm}</style><div class="atlas-report-actions"><div><strong>PDF preview · ${rows.length.toLocaleString()} measurements</strong><p>Choose Print / Save as PDF, then select “Save as PDF” in the print dialog. This preview contains ${rows.length.toLocaleString()} rows and ${columns.length} columns.</p></div><div class="atlas-report-buttons"><button type="button" data-report-print>Print / Save as PDF</button><button type="button" class="secondary" data-report-close>Close preview</button></div></div><div class="atlas-report-content"><h1 id="atlasPrintReportTitle">Target Atlas · selected data</h1><div class="atlas-report-notes">${details.map(([key,value])=>`<div><strong>${esc(key)}:</strong> ${esc(value)}</div>`).join('')}</div><p class="atlas-report-note">Source fields identify the origin of each result. Blank fields mean unavailable; assay measurements remain separate.</p>${content}</div>`;
    const close=()=>{document.removeEventListener('keydown',keydown);report.remove();document.body.classList.remove('atlas-report-open');window.scrollTo(scrollX,scrollY);if(priorFocus?.isConnected)priorFocus.focus({preventScroll:true});};
    const keydown=event=>{
      if(event.key==='Escape'){event.preventDefault();close();}
      if(event.key==='Tab'){const buttons=[...report.querySelectorAll('button')],first=buttons[0],last=buttons[buttons.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}
    };
    report.closeReport=close;report.querySelector('[data-report-close]').addEventListener('click',close);report.querySelector('[data-report-print]').addEventListener('click',()=>window.print());document.addEventListener('keydown',keydown);document.body.appendChild(report);document.body.classList.add('atlas-report-open');report.querySelector('[data-report-print]').focus({preventScroll:true});
    return report;
  }
  async function render(options){
    let {host,data,categories,columns}=options;if(typeof host==='string')host=document.getElementById(host);if(!host)return;
    const token=String(++sequence);host.dataset.atlasExportRender=token;host.innerHTML='<section class="panel atlas-export"><p role="status">Loading assay data and source records…</p></section>';
    try{
      if(!data&&options.load){const loaded=await options.load();data=Array.isArray(loaded)?loaded:loaded.records;categories=categories||loaded.categories;columns=columns||loaded.columns;}
      if(host.dataset.atlasExportRender!==token)return;
      data=Array.isArray(data)?data:(data?.records||[]);
      columns=(columns?.length?columns:fallbackColumns).map(c=>typeof c==='string'?{key:c,label:c.replace(/_/g,' '),default:true}:c);
      for(const key of requiredKeys)if(!columns.some(c=>c.key===key))columns.push({key,label:key.replace(/_/g,' '),default:true});
      const categoryCounts=new Map();data.forEach(r=>categoryCounts.set(String(r.category??''),(categoryCounts.get(String(r.category??''))||0)+1));
      categories=categories?.length?categories:list(data.map(r=>r.category)).map(id=>({id,label:id}));
      categories=categories.map(c=>typeof c==='string'?{id:c,label:c}:c);
      const initialCategories=categories.filter(c=>c.default!==false&&!['nanobret_raw','nanobret_wells','nanobret_doses','atlas_refits'].includes(String(c.id)));
      const state={categories:new Set(initialCategories.map(c=>String(c.id))),metrics:new Set(),columns:new Set(columns.filter(c=>c.default!==false||requiredKeys.includes(c.key)).map(c=>c.key)),page:0,filtered:[]};
      const prefix='atlasExport'+token;
      const dimensions=[['target','Target'],['time_hours','Time point (h)'],['experiment','Experiment / run'],['biological_replicate','Biological replicate'],['source_replicate','Source replicate (type not specified)'],['condition','Condition'],['configuration','Configuration'],['plate','Plate'],['plate_number','Plate number']].filter(([key])=>data.some(r=>r[key]!=null&&r[key]!==''));
      const choices=(values)=>values.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');
      host.innerHTML=`<section class="panel atlas-export"><div class="atlas-export-heading"><div><div class="eyebrow">DATA &amp; SOURCES</div><h2>Choose data to view and export</h2><p>Choose assays and measurements, filter the results, then download your current table. Source details stay attached to every result.</p><p class="atlas-export-ownership">This table uses the datasets already included in Target Atlas. Selections change your local table and downloads; they do not upload, replace or publish data.</p></div><span class="atlas-export-badge">${data.length.toLocaleString()} available measurements</span></div><fieldset class="atlas-export-datasets"><legend>1. Choose assays and measurements</legend><div class="atlas-export-presets" aria-label="Measurement shortcuts"><span>Start with:</span><button type="button" class="secondary" data-action="preset-potency" data-preset="potency" aria-pressed="false">Reported potency (EC50 / qAC50)</button><button type="button" class="secondary" data-action="preset-responses" data-preset="responses" aria-pressed="false">Responses (Cmax)</button><button type="button" class="secondary" data-action="preset-all" data-preset="all" aria-pressed="false">All source data</button></div><p class="atlas-export-help">Shortcuts keep your compound, batch and other filters. You can also choose datasets and measurements individually below.</p><div class="atlas-export-small-actions"><button type="button" data-action="all-datasets">Select all</button><button type="button" data-action="none-datasets">Clear all</button></div><div class="atlas-export-dataset-grid">${categories.map(c=>`<label class="atlas-export-dataset"><input type="checkbox" data-category="${esc(c.id)}" ${state.categories.has(String(c.id))?'checked':''}><span><strong>${esc(c.label)}</strong><small>${esc(c.description||'')} <span>${(categoryCounts.get(String(c.id))||0).toLocaleString()} measurements</span></small></span></label>`).join('')}</div><p class="atlas-export-help">Summary and reported results are selected initially. Select dose responses, independent refits, individual wells or raw channels above when needed.</p></fieldset><fieldset><legend>2. Filter results</legend><div class="atlas-export-filters"><label>Compound<input type="search" data-filter="compound" list="${prefix}Compounds" placeholder="e.g. RMC-0741051" autocomplete="off"></label><datalist id="${prefix}Compounds">${list(data.map(r=>r.base_compound||r.compound?.replace(/-\d{3}$/,''))).map(v=>`<option value="${esc(v)}"></option>`).join('')}</datalist><label>Batch<select data-filter="batch"><option value="">All batches</option></select></label>${dimensions.map(([key,label])=>`<label>${esc(label)}<select data-filter="${key}"><option value="">All ${esc(label.toLowerCase())}</option>${data.some(r=>r[key]==null||r[key]==='')?'<option value="__atlas_unreported__">Not reported / unassigned</option>':''}${choices(list(data.map(r=>r[key])))}</select></label>`).join('')}</div><p class="atlas-export-help">Search by base compound ID to see its available batches. Selecting a batch keeps its results separate. Time points, replicates and source-specific values are never averaged together.</p><details class="atlas-export-details"><summary>Choose measurements <span data-metric-summary></span></summary><div class="atlas-export-small-actions"><button type="button" data-action="all-metrics">All measurements</button><button type="button" data-action="none-metrics">Clear measurements</button></div><div class="atlas-export-metrics" data-metrics></div></details><button type="button" class="secondary" data-action="reset">Reset filters</button></fieldset><fieldset><legend>3. Choose table and export columns</legend><details class="atlas-export-details"><summary>Columns <span data-column-summary></span> · compound, plate, original source ID, measurement, qualifier, unit and source fields always included</summary><div class="atlas-export-columns">${columns.map(c=>`<label><input type="checkbox" data-column="${esc(c.key)}" ${state.columns.has(c.key)?'checked':''} ${requiredKeys.includes(c.key)?'disabled':''}>${esc(c.label)}${sourceKeys.includes(c.key)?' · source':requiredKeys.includes(c.key)?' · required':''}</label>`).join('')}</div></details></fieldset><div class="atlas-export-downloads"><div><button type="button" class="primary" data-action="excel">Download selected Excel (.xlsx)</button> <button type="button" class="secondary" data-action="csv">Download selected CSV</button><p class="atlas-export-help">Excel and CSV include all matching rows and selected columns, at full precision. Excel also includes an export details sheet.</p></div><div><label>PDF report rows<select data-pdf-scope><option value="200">First 200 matching rows</option><option value="all">All matching rows</option></select></label><button type="button" class="secondary" data-action="pdf">Preview / save PDF</button><p class="atlas-export-help" data-pdf-note>Preview the report here, then Print / Save as PDF.</p></div></div><p class="atlas-export-status" role="status" aria-live="polite" data-status></p><div class="atlas-export-preview"><div class="atlas-export-preview-heading"><h3>Selected data</h3><p data-count></p></div><p class="atlas-export-help">Preview: up to 50 rows per page. Numeric values are rounded to 6 significant digits for display; hover over a value to see its stored precision. CSV and Excel downloads retain full stored precision and contain all matching rows and selected columns. One row per measurement. Missing fields are shown as —; full source paths and cell references are included where available.</p><div class="atlas-export-table" tabindex="0" aria-label="Selected data preview"><table><thead data-head></thead><tbody data-body></tbody></table></div><div class="atlas-export-pagination"><button type="button" class="secondary" data-action="previous">Previous</button><span data-page></span><button type="button" class="secondary" data-action="next">Next</button></div></div></section>`;
      const root=host.querySelector('.atlas-export'),get=selector=>root.querySelector(selector),all=selector=>[...root.querySelectorAll(selector)];
      const status=message=>{get('[data-status]').textContent=message;};
      const selectedColumns=()=>columns.filter(c=>state.columns.has(c.key));
      function contextColumns(){
        const add=[];
        if(state.categories.has('nanobret_doses'))add.push('concentration_um','sd','n');
        if(state.categories.has('nanobret_wells')||state.categories.has('nanobret_raw'))add.push('concentration_um','plate','well','well_type','excluded','masking_reason','layout_source_file','layout_source_row');
        for(const key of add)if(columns.some(c=>c.key===key)){state.columns.add(key);const checkbox=get(`[data-column="${key}"]`);if(checkbox)checkbox.checked=true;}
      }
      function preset(kind){
        const chosen=presetSelection(data,kind);state.categories=new Set(chosen.categories);state.metrics=new Set(chosen.metrics);state.page=0;
        all('[data-category]').forEach(el=>el.checked=state.categories.has(el.dataset.category));
        if(kind==='all'){state.columns=new Set(columns.map(c=>c.key));all('[data-column]').forEach(el=>el.checked=true);}
        contextColumns();metrics(false);
        all('[data-preset]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.preset===kind)));
        status(kind==='all'?'All supplied source data and columns selected. Existing filters still apply.':kind==='potency'?'Reported EC50 and qAC50 measurements selected. Existing filters still apply.':'Cmax and observed peak responses selected. Existing filters still apply.');
      }
      const compoundMatch=r=>{const query=get('[data-filter="compound"]').value.trim().toUpperCase();return !query||String(r.compound||'').toUpperCase().includes(query)||String(r.base_compound||'').toUpperCase().includes(query)||String(r.source_compound||'').toUpperCase().includes(query);};
      function batches(){const select=get('[data-filter="batch"]'),previous=select.value;select.innerHTML='<option value="">All batches</option>'+choices(list(data.filter(compoundMatch).map(r=>r.batch)));if([...select.options].some(o=>o.value===previous))select.value=previous;}
      function metrics(reset=false,previousMetrics=null){
        const available=list(data.filter(r=>state.categories.has(String(r.category))).map(r=>r.metric));
        if(reset)state.metrics=new Set(available);
        else if(previousMetrics){
          // Changing datasets must not reselect measurements the scientist removed.
          // Select only newly available measurements; keep existing choices intact.
          state.metrics=new Set(available.filter(metric=>state.metrics.has(metric)||!previousMetrics.has(metric)));
        }
        get('[data-metrics]').innerHTML=available.map(metric=>`<label><input type="checkbox" data-metric="${esc(metric)}" ${state.metrics.has(metric)?'checked':''}>${esc(metric)}</label>`).join('')||'<p>No measurements in the selected datasets.</p>';
        get('[data-metric-summary]').textContent=`(${available.filter(m=>state.metrics.has(m)).length} of ${available.length})`;
      }
      function details(){return [['Generated',new Date().toISOString()],['Rows',state.filtered.length],['Datasets',categories.filter(c=>state.categories.has(String(c.id))).map(c=>c.label).join('; ')],['Measurements',[...state.metrics].join('; ')],...all('[data-filter]').map(el=>[el.closest('label')?.childNodes[0]?.textContent?.trim()||el.dataset.filter,el.value==='__atlas_unreported__'?'Not reported / unassigned':el.value||'All']),['Columns',selectedColumns().map(c=>c.label).join('; ')],['Interpretation','One row per measurement. Source qualifiers, units and missing values are retained. Measurements from different batches, experiments, time points and replicates are kept separate. No potency or response cutoffs are applied by this table.'],['Availability','Only data loaded into Target Atlas are included. A blank source field means the source did not provide that detail.']] ;}
      function draw(){
        const filters=all('[data-filter]').filter(el=>el.dataset.filter!=='compound');
        state.filtered=data.filter(r=>state.categories.has(String(r.category))&&state.metrics.has(String(r.metric))&&compoundMatch(r)&&filters.every(el=>!el.value||(el.value==='__atlas_unreported__'?(r[el.dataset.filter]==null||r[el.dataset.filter]===''):String(r[el.dataset.filter]??'')===el.value)));
        const cols=selectedColumns(),pages=Math.max(1,Math.ceil(state.filtered.length/50));state.page=Math.max(0,Math.min(state.page,pages-1));const start=state.page*50,shown=state.filtered.slice(start,start+50);
        get('[data-head]').innerHTML='<tr>'+cols.map(c=>`<th scope="col">${esc(c.label)}</th>`).join('')+'</tr>';
        get('[data-body]').innerHTML=shown.length?shown.map(r=>'<tr>'+cols.map(c=>`<td>${r[c.key]==null||r[c.key]===''?'<span class="atlas-export-missing">—</span>':`<span${typeof r[c.key]==='number'?` title="${esc(r[c.key])}"`:''}>${esc(typeof r[c.key]==='number'&&Number.isFinite(r[c.key])?Number(r[c.key].toPrecision(6)):r[c.key])}</span>`}</td>`).join('')+'</tr>').join(''):`<tr><td colspan="${Math.max(1,cols.length)}" class="empty">No measurements match. Choose a dataset and measurement, or reset the filters.</td></tr>`;
        get('[data-count]').textContent=`${state.filtered.length.toLocaleString()} matching measurements · ${new Set(state.filtered.map(r=>r.base_compound||r.compound).filter(Boolean)).size.toLocaleString()} compounds · ${new Set(state.filtered.map(r=>r.compound).filter(Boolean)).size.toLocaleString()} compound / batch IDs`;
        get('[data-page]').textContent=shown.length?`Rows ${start+1}–${start+shown.length} · page ${state.page+1} of ${pages}`:'0 rows';get('[data-action="previous"]').disabled=state.page===0;get('[data-action="next"]').disabled=state.page>=pages-1;
        get('[data-column-summary]').textContent=`(${cols.length} selected)`;
        for(const action of ['excel','csv','pdf'])get(`[data-action="${action}"]`).disabled=Boolean(state.exporting)||!state.filtered.length||!cols.length;
        get('[data-pdf-scope] option[value="200"]').textContent=state.filtered.length<=200?`All ${state.filtered.length.toLocaleString()} matching rows`:'First 200 matching rows';
        const reportCount=get('[data-pdf-scope]').value==='all'?state.filtered.length:Math.min(200,state.filtered.length);
        get('[data-pdf-note]').textContent=`PDF report: ${reportCount.toLocaleString()} of ${state.filtered.length.toLocaleString()} matching rows. Preview the report here, then Print / Save as PDF.`;
      }
      root.addEventListener('change',event=>{
        const el=event.target;state.page=0;
        if(el.matches('[data-category]')){const previousMetrics=new Set(all('[data-metric]').map(box=>box.dataset.metric));el.checked?state.categories.add(el.dataset.category):state.categories.delete(el.dataset.category);if(el.checked)contextColumns();metrics(false,previousMetrics);}
        if(el.matches('[data-metric]')){el.checked?state.metrics.add(el.dataset.metric):state.metrics.delete(el.dataset.metric);const boxes=all('[data-metric]');get('[data-metric-summary]').textContent=`(${boxes.filter(b=>b.checked).length} of ${boxes.length})`;}
        if(el.matches('[data-category],[data-metric],[data-column]'))all('[data-preset]').forEach(button=>button.setAttribute('aria-pressed','false'));
        if(el.matches('[data-column]'))el.checked?state.columns.add(el.dataset.column):state.columns.delete(el.dataset.column);
        status('');draw();
      });
      root.addEventListener('input',event=>{if(event.target.matches('[data-filter="compound"]')){state.page=0;batches();status('');draw();}});
      root.addEventListener('click',async event=>{
        const action=event.target.closest('[data-action]')?.dataset.action;if(!action)return;
        if(action.startsWith('preset-'))preset(action.slice(7));
        if(['all-datasets','none-datasets','all-metrics','none-metrics'].includes(action))all('[data-preset]').forEach(button=>button.setAttribute('aria-pressed','false'));
        if(action==='all-datasets'||action==='none-datasets'){const checked=action==='all-datasets';all('[data-category]').forEach(el=>{el.checked=checked;});state.categories=new Set(checked?categories.map(c=>String(c.id)):[]);if(checked)contextColumns();state.page=0;metrics(true);}
        if(action==='all-metrics'||action==='none-metrics'){all('[data-metric]').forEach(el=>el.checked=action==='all-metrics');state.metrics=new Set(all('[data-metric]:checked').map(el=>el.dataset.metric));get('[data-metric-summary]').textContent=`(${state.metrics.size} of ${all('[data-metric]').length})`;state.page=0;}
        if(action==='reset'){all('[data-filter]').forEach(el=>el.value='');state.page=0;batches();metrics(false);status('Filters reset. Your datasets, measurements and columns are unchanged.');}
        if(action==='previous')state.page--;if(action==='next')state.page++;
        if(action==='csv'){
          if(state.exporting)return;state.exporting=true;for(const format of ['excel','csv','pdf'])get(`[data-action="${format}"]`).disabled=true;
          const rows=state.filtered.slice(),cols=selectedColumns();status(`Preparing ${rows.length.toLocaleString()} rows for CSV…`);
          try{const blob=await createCSVBlob({rows,columns:cols});save(blob,'Target_Atlas_selected_data_'+new Date().toISOString().slice(0,10)+'.csv');status(`Downloaded ${rows.length.toLocaleString()} measurements with ${cols.length} columns and source details. CSV retains full numeric precision; Excel may infer cell formats when opening CSV.`);}catch(error){status(error.message);}finally{state.exporting=false;draw();}
          return;
        }
        if(action==='excel'){
          if(state.exporting)return;state.exporting=true;const button=get('[data-action="excel"]');button.disabled=true;get('[data-action="csv"]').disabled=true;get('[data-action="pdf"]').disabled=true;status(`Preparing ${state.filtered.length.toLocaleString()} rows for Excel…`);
          try{const rows=state.filtered.slice(),cols=selectedColumns(),meta=details();await new Promise(resolve=>setTimeout(resolve,0));const blob=await createWorkbookAsync({rows,columns:cols,details:meta,onProgress:message=>status(message)});save(blob,'Target_Atlas_selected_data_'+new Date().toISOString().slice(0,10)+'.xlsx');status(`Downloaded ${rows.length.toLocaleString()} measurements with ${cols.length} columns and source details.`);}catch(error){status(error.message);}finally{state.exporting=false;draw();}
          return;
        }
        if(action==='pdf'){try{const full=get('[data-pdf-scope]').value==='all',rows=full?state.filtered:state.filtered.slice(0,200),meta=details();meta.push(['PDF scope',full||rows.length===state.filtered.length?`All ${rows.length} matching rows`:`First ${rows.length} of ${state.filtered.length} matching rows; remaining rows are omitted from this report`]);printReport(rows,selectedColumns(),meta);status(`PDF preview ready with ${rows.length.toLocaleString()} rows. Choose Print / Save as PDF in the preview.`);}catch(error){status(error.message);}return;}
        draw();
      });
      batches();metrics(true);draw();
      return {getFilteredRows:()=>state.filtered.slice(),getSelectedColumns:selectedColumns};
    }catch(error){if(host.dataset.atlasExportRender===token)host.innerHTML=`<section class="panel atlas-export"><h2>Data export</h2><p role="alert">${esc(error.message||'Data could not be loaded.')}</p><button type="button" data-retry>Retry loading data</button></section>`;host.querySelector('[data-retry]')?.addEventListener('click',()=>render(options));}
  }
  return {render,createWorkbook,createWorkbookAsync,createCSV,createCSVBlob,presetSelection,printReport};
})();
