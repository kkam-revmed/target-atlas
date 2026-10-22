/* Native Prism 11 handoff. Source values stay local; Prism calculates its own fits. */
(function(root){
 'use strict';
 const enc=new TextEncoder(),finite=Number.isFinite,MAX_OBSERVATIONS=96;
 // Stored ZIP entries need no external library, service or network dependency.
 function zip(entries){
  const chunks=[],central=[];let offset=0;
  const table=Array.from({length:256},(_,i)=>{for(let k=0;k<8;k++)i=(i&1)?0xedb88320^(i>>>1):i>>>1;return i>>>0;});
  const crc=data=>{let c=0xffffffff;for(const b of data)c=table[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0;};
  for(const {name,data,executable=false} of entries){
   const n=enc.encode(name),d=typeof data==='string'?enc.encode(data):new Uint8Array(data),sum=crc(d);
   const h=new Uint8Array(30+n.length),v=new DataView(h.buffer);
   v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint16(12,33,true);
   v.setUint32(14,sum,true);v.setUint32(18,d.length,true);v.setUint32(22,d.length,true);v.setUint16(26,n.length,true);h.set(n,30);
   const c=new Uint8Array(46+n.length),w=new DataView(c.buffer);
   w.setUint32(0,0x02014b50,true);w.setUint16(4,0x0314,true);w.setUint16(6,20,true);w.setUint16(8,0x800,true);w.setUint16(14,33,true);
   w.setUint32(16,sum,true);w.setUint32(20,d.length,true);w.setUint32(24,d.length,true);w.setUint16(28,n.length,true);
   w.setUint32(38,((executable?0o100755:0o100644)<<16)>>>0,true);w.setUint32(42,offset,true);c.set(n,46);
   chunks.push(h,d);central.push(c);offset+=h.length+d.length;
  }
  const size=central.reduce((n,c)=>n+c.length,0),end=new Uint8Array(22),v=new DataView(end.buffer);
  v.setUint32(0,0x06054b50,true);v.setUint16(8,entries.length,true);v.setUint16(10,entries.length,true);v.setUint32(12,size,true);v.setUint32(16,offset,true);
  const out=new Uint8Array(offset+size+22);let at=0;for(const chunk of [...chunks,...central,end]){out.set(chunk,at);at+=chunk.length;}return out;
 }
 // Labels are presentation only. Exact original labels remain in provenance.
 const label=value=>String(value??'').replace(/[\r\n\t"<>%,]/g,' ').replace(/\s+/g,' ').trim().slice(0,220);
 function populateInput(seed,table,provenance){
  // Only read the stored-entry template produced by our retained builder.
  const bytes=new Uint8Array(seed),view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),dec=new TextDecoder(),entries=[];
  let p=0;
  while(p+30<=bytes.length&&view.getUint32(p,true)===0x04034b50){
   if(view.getUint16(p+8,true)!==0)throw Error('Unsupported Prism template encoding. Please reload Atlas.');
   const size=view.getUint32(p+18,true),n=view.getUint16(p+26,true),extra=view.getUint16(p+28,true),start=p+30+n+extra;
   if(start+size>bytes.length)throw Error('Incomplete Prism template. Please retry.');
   entries.push({name:dec.decode(bytes.slice(p+30,p+30+n)),data:bytes.slice(start,start+size)});p=start+size;
  }
  const byName=new Map(entries.map(e=>[e.name,e]));
  const get=name=>JSON.parse(dec.decode(byName.get(name)?.data));
  const put=(name,value)=>{byName.get(name).data=JSON.stringify(value);};
  const sheet='data/sheets/58C3734F-A41D-42C1-9347-2A825697B8BD/sheet.json',tablePath='data/tables/A8CB8A16-CF2B-4606-A7F4-3BCC05585DF7/';
  const first=table.datasets[0],slots=Math.max(48,...table.datasets.map(d=>d.columns.length));
  if(slots>MAX_OBSERVATIONS)throw Error('This Prism graph export supports up to '+MAX_OBSERVATIONS+' observations per dose.');
  const csv=table.x.map((x,r)=>[Math.log10(x)-6,...Array.from({length:slots},(_,s)=>first.columns[s]?.values[r]??'')].join(',')).join('\n')+'\n';
  byName.get(tablePath+'data.csv').data=csv;
  const meta=get(tablePath+'content.json');meta.numberOfColumns=slots+1;meta.numberOfRows=table.x.length;put(tablePath+'content.json',meta);
  const input=get(sheet);input.title=label(provenance.project_title);input.table.replicatesCount=slots;put(sheet,input);
  for(const [id,title] of [['2BF51D2B-DD4A-429A-BDCF-6FF10EC594B4','log10 concentration (M)'],['61BE1DFA-EF80-4CA9-8C5B-4D7F68FBE468',label(first.title)]]){
   const name='data/sets/'+id+'.json',obj=get(name);obj.title=title;
   if(!id.startsWith('2BF'))obj.replicates=Array.from({length:slots},(_,i)=>({...(obj.replicates[i]||obj.replicates[0])}));
   for(const [s,rep] of obj.replicates.entries()){
    const values=id.startsWith('2BF')?table.x:first.columns[s]?.values||[];
    const positions=values.map((v,r)=>finite(v)?r:-1).filter(r=>r>=0);
    rep.firstRow=positions.length?positions[0]:-1;rep.lastRow=positions.length?positions.at(-1):-1;
   }
   put(name,obj);
  }
  const infoPath='info/5ECD4190-7FD8-4A46-8F39-1BD3A2DC115F/sheet.json',info=get(infoPath);
  info.title='Atlas column guide and analysis';info.notesText=(provenance.column_guide||'')+'\n\nFULL SOURCE PROVENANCE\n'+JSON.stringify(provenance,null,2);put(infoPath,info);
  return zip(entries);
 }
 const nice=span=>{const raw=span/5,p=10**Math.floor(Math.log10(raw));return [1,2,2.5,5,10].find(n=>n*p>=raw)*p;};
 function limits(series,manual={}){
  const xs=[],lo=[0],hi=[100];
  for(const q of series)for(const d of q.doses||[]){
   if(!finite(d.x)||d.x<=0)throw Error('Prism 4PL requires positive concentrations. Use the data-only download to retain nonpositive doses.');
   xs.push(Math.log10(d.x)-6);
   if(finite(d.mean)){const sd=finite(d.sd)?d.sd:0;lo.push(d.mean-sd);hi.push(d.mean+sd);}
  }
  if(!xs.length)throw Error('Choose measured data before exporting.');
  const low=Math.min(...lo),high=Math.max(...hi),pad=(high-low)*.05,step=nice(high-low+2*pad);
  let xmin=Math.floor(Math.min(...xs)),xmax=Math.ceil(Math.max(...xs));if(xmin===xmax){xmin--;xmax++;}
  const axes={xMin:xmin,xMax:xmax,yMin:low<0?Math.floor((low-pad)/step)*step:0,yMax:Math.ceil((high+pad)/step)*step,yStep:step};
  for(const key of ['xMin','xMax','yMin','yMax'])if(manual[key]!=null&&manual[key]!==''){
   const n=Number(manual[key]);if(!finite(n)||(key.startsWith('x')&&n<=0))throw Error('Axis limits must be finite; X limits must be positive µM values.');
   axes[key]=key.startsWith('x')?Math.log10(n)-6:n;
  }
  if(axes.xMin>=axes.xMax||axes.yMin>=axes.yMax)throw Error('Axis minimum must be less than its maximum.');
  axes.yStep=nice(axes.yMax-axes.yMin);return axes;
 }
 const launcher=`#!/bin/bash
set -eu
prism_task_dir="$(cd -- "$(dirname -- "$0")" && pwd)"
if [ "$(uname -s)" != "Darwin" ]; then
  echo "This launcher requires macOS with Prism 11 installed."
  exit 1
fi
prism_task_hfs="$(osascript -e 'on run argv' -e 'return (POSIX file (item 1 of argv) as alias) as text' -e 'end run' "$prism_task_dir/")"
case "$prism_task_hfs" in
  *'"'*|*$'\\n'*|*$'\\r'*|*'%'*)
    echo 'Move this folder to a path without quotes, percent signs, or line breaks, then retry.'
    exit 1 ;;
esac
prism_task_script="$prism_task_dir/Run_Atlas_Prism.pzc"
{ printf 'SetPath "%s"\\n' "$prism_task_hfs"; cat "$prism_task_dir/Open_in_Prism.pzc"; } > "$prism_task_script"
open -b com.GraphPad.Prism "$prism_task_script"
`;
 // Keep one approved launcher; choose a fresh export instead of opening a new command file.
 const reusableLauncher=launcher
  .replace('prism_task_dir="$(cd -- "$(dirname -- "$0")" && pwd)"','prism_task_dir=""')
  .replace('fi\nprism_task_hfs=',`fi
if ! prism_task_dir="$(osascript -e 'POSIX path of (choose folder with prompt "Choose the Atlas_Prism folder from your extracted Target Atlas download")')"; then
  echo "No folder selected."
  exit 0
fi
if [ ! -f "$prism_task_dir/Atlas_Input.prism" ] || [ ! -f "$prism_task_dir/Open_in_Prism.pzc" ]; then
  echo "Choose the extracted Atlas_Prism folder containing Atlas_Input.prism and Open_in_Prism.pzc."
  exit 1
fi
prism_task_hfs=`);
 const reusableReadme=`TARGET ATLAS — REUSABLE MAC LAUNCHER\n\nONE-TIME SETUP\nExtract this ZIP. Move Atlas_Prism_Launcher.command to a permanent folder, such as Documents/Atlas Prism Launcher. Open it and, if macOS blocks it, approve this file through System Settings > Privacy & Security > Open Anyway. Keep this same copy for later exports; do not replace it with each download.\n\nEACH EXPORT\nDownload Prism graph + 4PL from Target Atlas and extract the entire ZIP. Open your saved Atlas_Prism_Launcher.command and choose the extracted Atlas_Prism folder containing Atlas_Input.prism and Open_in_Prism.pzc. Wait for Prism to finish, then open Atlas_Result.prism in that selected folder. You do not need to open the freshly downloaded Open_in_Prism.command.\n\nUse packages you downloaded from Target Atlas. Requires Prism 11 on Mac. This launcher does not change security settings or remove quarantine flags. Reusing an approved file normally avoids repeated approval, but managed Mac policies may still require IT approval. The reusable folder chooser awaits confirmation on a Mac; the shared Prism launch steps are unchanged.\n`;
 function downloadMacLauncher(){
  const data=zip([{name:'Atlas_Prism_Launcher.command',data:reusableLauncher,executable:true},{name:'README.txt',data:reusableReadme}]);
  const url=URL.createObjectURL(new Blob([data],{type:'application/zip'})),a=document.createElement('a');a.href=url;a.download='Atlas_Mac_Launcher.zip';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 if(typeof document!=='undefined')document.addEventListener('click',event=>{if(event.target.closest('[data-prism-mac-launcher]'))downloadMacLauncher();});
 // Use Windows' built-in PowerShell for path handling and a file picker. The
 // batch file contains readable commands; no policy changes, downloads or admin.
 const windowsCommands=[
  "$ErrorActionPreference = 'Stop'",
  "try {",
  "$folder = [IO.Path]::GetFullPath($env:ATLAS_PRISM_PACKAGE)",
  "if ($folder.IndexOf([char]37) -ge 0 -or $folder.IndexOf([char]34) -ge 0 -or $folder.Contains([char]10) -or $folder.Contains([char]13)) { throw 'Move the extracted folder to a path without percent signs, quotes or line breaks, then retry.' }",
  "$source = Join-Path $folder 'Open_in_Prism.pzc'",
  "if (!(Test-Path -LiteralPath $source -PathType Leaf) -or !(Test-Path -LiteralPath (Join-Path $folder 'Atlas_Input.prism') -PathType Leaf)) { throw 'Extract the entire ZIP first and keep its files together.' }",
  "$exe = $null",
  "foreach ($base in @($env:ProgramFiles, ${env:ProgramFiles(x86)})) { if ($base) { foreach ($relative in @('GraphPad Software\\Prism 11\\prism.exe','GraphPad\\Prism 11\\prism.exe','GraphPad Software\\Prism11\\prism.exe','GraphPad\\Prism11\\prism.exe')) { $candidate = Join-Path $base $relative; if (Test-Path -LiteralPath $candidate -PathType Leaf) { $exe = $candidate; break } }; if ($exe) { break } } }",
  "if (!$exe) { Add-Type -AssemblyName System.Windows.Forms; $picker = New-Object System.Windows.Forms.OpenFileDialog; $picker.Title = 'Select your installed GraphPad Prism 11 prism.exe'; $picker.Filter = 'GraphPad Prism (prism.exe)|prism.exe'; if ($picker.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) { throw 'No Prism program selected. Install Prism 11 or run this launcher again and select prism.exe.' }; $exe = $picker.FileName; $picker.Dispose() }",
  "$version = [Diagnostics.FileVersionInfo]::GetVersionInfo($exe)",
  "if ($version.FileMajorPart -ne 11) { throw 'This export requires GraphPad Prism 11. Select the Prism 11 installation.' }",
  "$scriptPath = Join-Path $folder 'Run_Atlas_Prism_Windows.pzc'",
  "$quote = [char]34",
  "$prefix = 'SetPath ' + $quote + $folder + $quote + [Environment]::NewLine",
  "$encoding = New-Object System.Text.UTF8Encoding($true)",
  "[IO.File]::WriteAllText($scriptPath, $prefix + [IO.File]::ReadAllText($source, [Text.Encoding]::UTF8), $encoding)",
  "Start-Process -FilePath $exe -WorkingDirectory $folder -ArgumentList ('@' + $quote + $scriptPath + $quote)",
  "Write-Host 'Prism has started. When its script finishes, open Atlas_Result.prism in this extracted folder.'",
  "Write-Host 'If Prism reports an error, keep Run_Atlas_Prism_Windows.log and report the first error.'",
  "} catch { Write-Host ('Atlas could not start Prism: ' + $_.Exception.Message); exit 1 }"
 ].join('; ').replaceAll('{;', '{').replaceAll('; } catch', ' } catch');
 const windowsLauncher='@echo off\r\nsetlocal DisableDelayedExpansion\r\nset "ATLAS_PRISM_PACKAGE=%~dp0"\r\n'+
  'powershell.exe -NoLogo -NoProfile -STA -Command "'+windowsCommands.replaceAll('%','%%')+'"\r\n'+
  'if errorlevel 1 (\r\n  echo No security settings were changed. If your organization blocks this launcher, ask your IT team for help.\r\n  pause\r\n  exit /b 1\r\n)\r\npause\r\n';
 function availability(series){
  const exporter=root.AtlasPrismExport||(typeof require==='function'?require('./prism-export.js'):null);
  const count=Math.max(0,...series.map(q=>exporter.observationCount(q)));
  return {available:series.length>0&&count<=MAX_OBSERVATIONS,count,limit:MAX_OBSERVATIONS,message:count>MAX_OBSERVATIONS?`This selection needs ${count} observation columns per series; the Prism graph template supports ${MAX_OBSERVATIONS}. No measurements have been removed. Compare biological runs separately to create graphs, or keep this pooled selection and download all values as Prism data (.pzfx; tables only).`:count>48?`This export includes all ${count} observation columns per series. The expanded native layout has passed data and file-structure checks; confirmation in Prism 11 is still pending.`:''};
 }
 function showAvailability(host,series,{separate,data}){
  const result=availability(series);host.hidden=!result.message;
  host.innerHTML=result.message?'<p>'+result.message+'</p>'+(!result.available?'<div class="graph-downloads"><button type="button" data-prism-separate class="secondary">Compare biological runs separately</button><button type="button" data-prism-all-data class="secondary">Download all selected Prism data</button></div>':''):'';
  if(result.message&&!result.available){host.querySelector('[data-prism-separate]').onclick=separate;host.querySelector('[data-prism-all-data]').onclick=data;}
  return result;
 }
 function build(series,options={}){
  const api=root.AtlasPrismExport||(typeof require==='function'?require('./prism-export.js'):null);
  const exported=api.build(series,options),table=exported.tables[0],axes=limits(series,options.axes);
  if(!table.datasets.length)throw Error('Choose at least one series.');
  const slots=Math.max(...table.datasets.map(d=>d.columns.length));
  if(slots>MAX_OBSERVATIONS)throw Error('This Prism graph export supports up to '+MAX_OBSERVATIONS+' observations per dose. Choose separate biological runs, or download all selected data as .pzfx.');
  // Expand all native table/replicate metadata together when more than 48 slots are needed.
  // Leave unused cells blank; never duplicate or zero-pad the measurements.
  const script=['CreateLog','SetScriptDialogTitle "Atlas: build selected 4PL comparison"',
   'Open "Atlas_Input.prism"','GoTo D 1',`SetTitle "${label(options.title||'Atlas selected comparison')}"`];
  const insert=(r,c,s,value)=>script.push(`InsertData ${r}, ${c}, ${s}`,'<Data>',String(value),'</Data>');
  insert(0,0,1,'log10 concentration (M)');
  for(let i=0;i<table.datasets.length;i++){
   const dataset=table.datasets[i];
   if(table.x.filter((_,r)=>dataset.columns.some(c=>finite(c.values[r]))).length<4)
    throw Error('Each fitted series needs at least four measured concentrations. Use the data-only download for this selection.');
   insert(0,i+1,1,label(dataset.title));
   // First series is written directly to native CSV, as in the validated probe.
   // Prism registers each additional series through its supported script API.
   if(i>0)dataset.columns.forEach((column,s)=>column.values.forEach((value,r)=>{if(finite(value))insert(r+1,i+1,s+1,value);}));
  }
  const yTitle=['NanoBRET normalized (%)','NanoBRET normalized response (%)'].includes(options.yTitle)?options.yTitle:label(options.yTitle||'Corrected response');
  script.push('RecalcAll','GoTo R 1','SetTitle "Independent agonist 4PL"','GoTo G 1',
   `SetTitle "${label(options.title||'Atlas selected comparison')}"`,
   `SetGraphTitle "${label(options.title||'Atlas selected comparison')}"`,
   'SetAxisTitle X "log10 concentration (M)"',
   // Percent must remain literal in this quoted Prism 11 axis command.
   `SetAxisTitle Y "${yTitle}"`,
   `SetAxisLimits X bottom ${axes.xMin}`,`SetAxisLimits X top ${axes.xMax}`,'SetAxisLimits X interval 1',
   `SetAxisLimits Y bottom ${axes.yMin}`,`SetAxisLimits Y top ${axes.yMax}`,`SetAxisLimits Y interval ${axes.yStep}`,
   'Save "Atlas_Result.prism"','');
  const notes=[
   ...(slots>48?['The expanded native layout supports up to 96 observation columns. Every selected value is included; data and file-structure checks pass, but native Prism 11 confirmation is pending.']:[]),
   'This package creates a native Prism 11 table, separate independent agonist 4PL analyses and an editable graph using the approved template.',
   'Prism fits selected observations with unweighted least squares and free Bottom, Top, LogEC50 and HillSlope. It does not reuse GDS or Atlas fitted parameters. Fits can differ from Atlas, particularly when Atlas fits concentration means.',
   'Replicate display determines the inputs: biological summaries use one mean per run; pooled mode uses each selected well. Assays, batches, conditions and plate groups remain separate datasets. Well slots are not paired subjects.',
   'Review Prism Results warnings and confidence intervals. A smooth curve is not evidence of a reliable EC50. No baseline or plateau is fixed at 100%.',
   'The native graph uses template colors and error-bar settings, not Atlas color/point-display overrides. Check Format Graph in Prism. Exact displayed mean, sample SD and n are included in selected-data.pzfx.',
   'X is log10(M). Manual axis limits are respected, without removing measurements. All original µM concentrations, qualifiers, labels and provenance are preserved in the companion files.',
   'The script and companion data retain source precision. Prism 11 script import was observed to save 15 significant digits (maximum difference in the owner test: 3.7e-13 response units). No repository dataset is changed.',
  ];
  const guide=api.columnGuide(table,series,{native:true,context:options.context});
  const provenance={...exported.provenance,format:'Target Atlas native Prism handoff',notes,companion_data_export_notes:exported.provenance.notes,column_guide:guide.text,column_map:guide.map,native_fit:{equation:'Y=Bottom+(Top-Bottom)/(1+10^((LogEC50-X)*HillSlope))',weighting:'unweighted selected observations',constraints:[],x_unit:'log10(M)',axes},native_notes:notes};
  const readme=`TARGET ATLAS — PRISM 11 FOR WINDOWS AND MAC\n\n1. Extract the entire ZIP and keep all files together.\n2. Windows: double-click Open_in_Prism.bat. Mac: double-click Open_in_Prism.command.\n3. Open Atlas_Result.prism from this folder when Prism finishes its script.\n\nWindows uses built-in Windows PowerShell and looks for Prism 11 in standard installation folders. If needed, a picker asks you to select the installed prism.exe. It does not install Prism or change security settings. The console may open before the Prism window; wait for the script to finish.\n\nDo not open Atlas_Input.prism directly: it is an intermediate first-series project; the script adds the other series and applies labels and axes. No copying, pasting or analysis setup is needed.\nIf the script stops, keep Run_Atlas_Prism_Windows.log (Windows) or Run_Atlas_Prism.log (Mac) and report its first error. The launcher uses only your installed Prism; no uploads or installations.\n\nThe native workflow has been verified in Prism 11 on Mac. Windows packaging follows GraphPad's documented prism.exe @script.pzc interface; a Windows Prism result still needs native confirmation.\n\n${notes.join('\n\n')}\n`;
  return {script:script.join('\n'),axes,provenance,table,entries:[
   {name:'Open_in_Prism.command',data:launcher,executable:true},{name:'Open_in_Prism.bat',data:windowsLauncher},{name:'Open_in_Prism.pzc',data:script.join('\n')},
   {name:'README.txt',data:readme+'\nIn Prism, open Info > Atlas column guide and analysis to understand A:Y1, A:Y2 and each dataset. The same guide is in COLUMN_GUIDE.txt; column-map.csv provides a searchable mapping.\n'},{name:'provenance.json',data:JSON.stringify(provenance,null,2)},
   {name:'COLUMN_GUIDE.txt',data:guide.text},{name:'column-map.csv',data:guide.csv},
   {name:'selected-data.pzfx',data:exported.pzfx},{name:'original-values.csv',data:exported.csv}]};
 }
 async function download(series,name='atlas-prism',options={}){
  // Snapshot before asynchronous template loading, so subsequent UI changes do
  // not alter an in-flight selection or its provenance.
  const result=build(series,options);
  const response=await fetch('./assets/prism/atlas-empty.prism');
  if(!response.ok)throw Error('The Prism template could not be loaded. Please retry.');
  const seed=new Uint8Array(await response.arrayBuffer());
  if(seed[0]!==80||seed[1]!==75)throw Error('Invalid Prism template response. Please reload Atlas.');
  const input=populateInput(seed,result.table,result.provenance);
  const data=zip([...result.entries,{name:'Atlas_Input.prism',data:input}].map(e=>({...e,name:'Atlas_Prism/'+e.name})));
  const url=URL.createObjectURL(new Blob([data],{type:'application/zip'})),a=document.createElement('a');a.href=url;a.download=name.replace(/[^a-z0-9._-]/gi,'_')+'.zip';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  return result;
 }
 function help(){return '<details class="prism-handoff"><summary>Open the graph in Prism 11 · Windows or Mac</summary><p>Choose <strong>Prism graph + 4PL</strong> and extract the entire ZIP. <strong>Windows:</strong> double-click <strong>Open_in_Prism.bat</strong>. <strong>Mac:</strong> double-click <strong>Open_in_Prism.command</strong>. Open <strong>Atlas_Result.prism</strong> when Prism finishes. If Windows asks, select your installed Prism 11 program (prism.exe).</p><div class="prism-reusable-mac"><h4>Mac: avoid approving a new launcher each time</h4><button type="button" data-prism-mac-launcher class="secondary">Download reusable Mac launcher</button><p>Set up once: unzip this launcher, save it in a permanent folder and approve it through Privacy &amp; Security if prompted. Keep that same copy.</p><p>For each new export, unzip the Prism package, open your saved <strong>Atlas_Prism_Launcher.command</strong>, and choose the new <strong>Atlas_Prism</strong> folder. There is no need to open the command file inside each new download. Your Mac security settings stay enabled.</p></div><p><strong>Understanding the columns:</strong> in Prism, open <strong>Info → Atlas column guide and analysis</strong>. It maps A:Y1, A:Y2 and the other columns to the exported observations, explains the replicate mode and 4PL inputs, and identifies missing source details. The ZIP also contains COLUMN_GUIDE.txt and column-map.csv.</p><p>Creates a new independent, unweighted 4PL for each selected series. Review fit warnings and confidence intervals in Prism. The native graph uses template colors and error-bar settings; Atlas styling is retained in PNG/SVG exports. X uses log₁₀(M); manual limits carry over.</p><p>Up to 96 observations per dose. Exports above 48 observations are awaiting confirmation in Prism 11. For larger pooled selections, use the data-only .pzfx download. The package also includes original values, displayed mean/SD/n and source provenance. No data are uploaded. Windows native results are awaiting confirmation.</p></details>';}
 const api={zip,build,download,limits,help,populateInput,availability,showAvailability,MAX_OBSERVATIONS,downloadMacLauncher,reusableLauncher};root.AtlasPrismNative=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
