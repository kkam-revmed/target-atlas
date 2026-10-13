/* Read cached Excel values locally. Workbook text never executes as code. */
globalThis.AtlasInput = (() => {
  const decoder = new TextDecoder('utf-8');
  const num = v => v === null || v === undefined || String(v).trim() === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null;
  const yes = v => ['true','yes','1','masked','x'].includes(String(v ?? '').trim().toLowerCase());
  function csvRows(text) {
    text = text.replace(/^\uFEFF/,'');
    const separator = text.split(/\r?\n/)[0].includes('\t') ? '\t' : ',';
    const rows=[]; let row=[],field='',quoted=false;
    for(let i=0;i<text.length;i++) {
      const ch=text[i];
      if(ch==='"') { if(quoted&&text[i+1]==='"'){field+='"';i++;}else if(quoted||field==='')quoted=!quoted;else field+=ch; }
      else if(ch===separator&&!quoted){row.push(field);field='';}
      else if((ch==='\n'||ch==='\r')&&!quoted){if(ch==='\r'&&text[i+1]==='\n')i++;row.push(field);if(row.some(x=>x.trim()))rows.push(row);row=[];field='';}
      else field+=ch;
    }
    if(quoted)throw new Error('Unclosed quote in the pasted/CSV table.');
    row.push(field);if(row.some(x=>x.trim()))rows.push(row);
    return rows;
  }
  async function unzip(bytes) {
    const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
    let end=-1;
    for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(view.getUint32(i,true)===0x06054b50){end=i;break;}
    if(end<0)throw new Error('Invalid XLSX ZIP file.');
    const count=view.getUint16(end+10,true);let pos=view.getUint32(end+16,true);
    if(count>2000)throw new Error('This workbook has too many ZIP entries.');
    const files=new Map();let total=0;
    for(let i=0;i<count;i++) {
      if(view.getUint32(pos,true)!==0x02014b50)throw new Error('Invalid XLSX directory.');
      const flags=view.getUint16(pos+8,true),method=view.getUint16(pos+10,true),size=view.getUint32(pos+20,true),plain=view.getUint32(pos+24,true),nl=view.getUint16(pos+28,true),el=view.getUint16(pos+30,true),cl=view.getUint16(pos+32,true),offset=view.getUint32(pos+42,true);
      const name=decoder.decode(bytes.subarray(pos+46,pos+46+nl));pos+=46+nl+el+cl;
      if(flags&1)throw new Error('Password-protected Excel files are not supported.');
      if(!name.endsWith('.xml')&&!name.endsWith('.rels'))continue;
      total+=plain;if(plain>35*1024*1024||total>100*1024*1024)throw new Error('Uncompressed workbook is too large for browser analysis.');
      if(view.getUint32(offset,true)!==0x04034b50)throw new Error('Invalid XLSX entry.');
      const start=offset+30+view.getUint16(offset+26,true)+view.getUint16(offset+28,true);
      let out=bytes.subarray(start,start+size);
      if(method===8) {
        if(typeof DecompressionStream==='undefined')throw new Error('This browser cannot read compressed Excel files. Use a current Chrome, Edge, Firefox or Safari, or upload CSV.');
        let ds;try{ds=new DecompressionStream('deflate-raw');}catch{throw new Error('This browser does not support Excel decompression. Use a current browser or upload CSV.');}
        out=new Uint8Array(await new Response(new Blob([out]).stream().pipeThrough(ds)).arrayBuffer());
      } else if(method!==0)throw new Error('Unsupported Excel compression method.');
      if(out.length!==plain)throw new Error('Corrupted XLSX entry size.');
      files.set(name,decoder.decode(out));
    }
    return files;
  }
  function xml(text,label) {
    if(!text)throw new Error(`Excel file is missing ${label}.`);
    const doc=new DOMParser().parseFromString(text,'application/xml');
    if(doc.getElementsByTagName('parsererror').length)throw new Error(`Invalid XML in ${label}.`);
    return doc;
  }
  const elems=(root,name)=>Array.from(root.getElementsByTagNameNS('*',name));
  const first=(root,name)=>elems(root,name)[0];
  function normalize(path){const out=[];for(const p of path.split('/'))if(p==='..')out.pop();else if(p&&p!=='.')out.push(p);return out.join('/');}
  async function excelRows(bytes) {
    const zip=await unzip(bytes),book=xml(zip.get('xl/workbook.xml'),'workbook.xml'),rels=xml(zip.get('xl/_rels/workbook.xml.rels'),'workbook relationships');
    const sheet=elems(book,'sheet').find(s=>s.getAttribute('name')==='Results');
    if(!sheet)throw new Error('No Results sheet. Use the analyzer export or the tidy CSV template.');
    const rid=sheet.getAttribute('r:id')||sheet.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id');
    const relationship=elems(rels,'Relationship').find(r=>r.getAttribute('Id')===rid);
    if(!relationship)throw new Error('Results sheet relationship is missing.');
    const target=relationship.getAttribute('Target');
    const path=normalize(target.startsWith('/')?target.slice(1):'xl/'+target);
    const strings=zip.has('xl/sharedStrings.xml')?elems(xml(zip.get('xl/sharedStrings.xml'),'shared strings'),'si').map(s=>elems(s,'t').map(t=>t.textContent).join('')):[];
    const doc=xml(zip.get(path),'Results sheet'),rows=[];
    for(const r of elems(doc,'row')) {
      const rn=Number(r.getAttribute('r'));
      if(rn>110000)throw new Error('Results sheet exceeds the browser row limit.');
      const row=[];
      for(const c of elems(r,'c')) {
        const ref=c.getAttribute('r')||'',match=/^([A-Z]+)\d+$/.exec(ref);if(!match)continue;
        let col=0;for(const ch of match[1])col=col*26+ch.charCodeAt(0)-64;col--;
        const type=c.getAttribute('t'),v=first(c,'v')?.textContent;
        let value=null;
        if(type==='s')value=strings[Number(v)]??null;
        else if(type==='inlineStr')value=elems(c,'t').map(t=>t.textContent).join('');
        else if(type==='b')value=v==='1';
        else if(type==='str'||type==='e')value=v??null;
        else if(v!==undefined)value=num(v);
        row[col]=value;
      }
      if(rn>0)rows[rn-1]=row;
    }
    return rows;
  }
  async function parse(file) {
    const name=file.name,bytes=file.bytes instanceof Uint8Array?file.bytes:new Uint8Array(file.bytes),ext=name.toLowerCase().split('.').pop();
    if(ext==='csv') {
      const rows=csvRows(decoder.decode(bytes)),headers=(rows.shift()||[]).map(v=>v.trim().toLowerCase());
      for(const col of ['compound','target','concentration_um','response'])if(!headers.includes(col))throw new Error('CSV needs compound,target,concentration_um,response headers. Optional: replicate,masked,ignored.');
      const wells=rows.map((r,i)=>{const v=key=>r[headers.indexOf(key)],compound=String(v('compound')||'').trim(),target=String(v('target')||'').trim(),x=num(v('concentration_um')),y=num(v('response'));
        if(!compound||!target||x===null||x<0||y===null)throw new Error(`${name}, row ${i+2}: identifiers, nonnegative concentration and numeric response are required.`);
        return {compound,target,transfection:target,x,y,replicate:v('replicate')||'',excluded:yes(v('masked'))||yes(v('ignored')),source:name,source_row:i+2};});
      return {wells,parameters:[],notes:[]};
    }
    if(ext!=='xlsx')throw new Error('Upload .xlsx analyzer exports or a tidy .csv file.');
    const rows=await excelRows(bytes),groups=rows[0]||[],headers=rows[1]||[],columns=new Map(headers.map((h,i)=>[String(h),i]));
    const val=(r,key,def='')=>columns.has(key)?r[columns.get(key)]??def:def;
    if(!columns.has('Sample ID'))throw new Error(`${name}: Sample ID is missing.`);
    if(columns.has('Conc. [μM]')||columns.has('Conc. [µM]')) {
      let channel='',corrected=null;headers.forEach((h,i)=>{if(groups[i])channel=groups[i];if(channel==='QC Layer'&&h==='Corrected')corrected=i;});
      if(corrected===null)throw new Error(`${name}: QC Layer Corrected is missing.`);
      const wells=[];rows.forEach((r,i)=>{if(i<2||!r||val(r,'Well Type')!=='Sample')return;const compound=String(val(r,'Sample ID')).trim(),trans=String(val(r,'Cyclins - Transfections')).trim(),x=num(val(r,columns.has('Conc. [μM]')?'Conc. [μM]':'Conc. [µM]',null)),y=num(r[corrected]);
        if(!compound||!trans||x===null||x<0||y===null)throw new Error(`${name}, Results row ${i+1}: sample identifiers, concentration or corrected response missing.`);
        wells.push({compound,target:trans.replace(/ Plate [^]*$/,''),transfection:trans,x,y,replicate:String(val(r,'Row'))+String(val(r,'Column')),excluded:!!val(r,'Masked')||yes(val(r,'Ignored')),source:name,source_row:i+1});});
      return {wells,parameters:[],notes:[]};
    }
    if(columns.has('Activity (cmax)')&&columns.has('qAC50 [M]')) {
      const parameters=[];rows.forEach((r,i)=>{if(i<2||!r||!val(r,'Sample ID'))return;const trans=String(val(r,'Cyclins - Transfections')),ec=num(val(r,'qAC50 [M]',null));if(!trans)throw new Error(`${name}, row ${i+1}: transfection missing.`);
        parameters.push({compound:String(val(r,'Sample ID')),target:trans.replace(/ Plate [^]*$/,''),transfection:trans,cmax:num(val(r,'Activity (cmax)',null)),ec50:ec===null?null:ec*1e6,qualifier:String(val(r,'qAC50 Mode')),source_r2:num(val(r,'R²',null)),source_s0:num(val(r,'S0',null)),source_sinf:num(val(r,'Sinf',null)),source_valid:String(val(r,'Valid')),source_mode:String(val(r,'Data Mode')),source_qc:String(val(r,'Potential Issues')),exclude_from_reporting:yes(val(r,'Exclude From Reporting')),source:name,source_row:i+1});});
      return {wells:[],parameters,notes:[]};
    }
    throw new Error(`${name}: unrecognized Results columns. Use a supported analyzer export or tidy CSV.`);
  }
  return {parse,csvRows,excelRows};
})();
