/* In-vitro presentation conventions; never transforms measurements or fits. */
const AtlasGraphFormat=(()=>{
 'use strict';
 const finite=Number.isFinite;
 const css=`.atlas-scientific-graph text{font:12px Arial,sans-serif;fill:#000}
 .atlas-scientific-graph .axis-tick,.atlas-scientific-graph .axis-ticks text{font-size:11pt;font-weight:bold}
 .atlas-scientific-graph .axis-title{font-size:12pt;font-weight:bold;fill:#000}
 .atlas-scientific-graph .heading{font-size:18px;font-weight:bold}
 .atlas-scientific-graph .graph-axis{stroke:#000;stroke-width:2pt;fill:none}
 .atlas-scientific-graph [data-reference="normalization-100"]{stroke:#000}
 .atlas-scientific-graph .graph-error{stroke-width:.5pt;fill:none}`;
 const axes=(left,top,right,bottom)=>`<path class="graph-axis" d="M${left},${top}V${bottom}H${right}"/>`;
 function concentrationDomain(curves){
  const values=curves.flatMap(q=>q?.doses||[]).filter(d=>finite(d.x)&&d.x>0&&finite(d.mean)).map(d=>Math.log10(d.x));
  if(!values.length)return null;
  const lo=Math.min(...values),hi=Math.max(...values),pad=lo===hi?.5:(hi-lo)*.03;
  return [lo-pad,hi+pad];
 }
 function sampleSize(q){
  const ds=(q?.doses||[]).filter(d=>finite(d.x)&&d.x>0&&finite(d.mean));
  if(!ds.length)return 'No measured concentrations';
  const counts=ds.map(d=>d.n).filter(n=>finite(n)&&n>=0),lo=Math.min(...counts),hi=Math.max(...counts);
  const basis=q.summary_kind==='pooled_wells'?'pooled wells':q.summary_components?'biological runs':'measured wells';
  if(!counts.length)return 'n not reported';
  return `n = ${lo===hi?lo:lo+'–'+hi} ${basis} per concentration${counts.length<ds.length?'; n unavailable at some concentrations':''}`;
 }
 const plots=new Map();
 const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function limits(auto,options,prefix,log=false){
  const lo=options[prefix+'Min']??auto[0],hi=options[prefix+'Max']??auto[1];
  if(!finite(lo)||!finite(hi)||!finite(hi-lo)||lo>=hi||(log&&lo<=0))throw new Error(prefix.toUpperCase()+' minimum must be less than maximum'+(log?', and both must be positive for a log axis.':'.'));
  return [lo,hi];
 }
 function quickAxes(options){
  return ['y','x'].map(axis=>`<div class="inline-axis-control" data-inline-axis="${axis}"><button type="button" data-axis-toggle aria-label="Edit ${axis.toUpperCase()} axis" aria-expanded="false">${axis.toUpperCase()} <span aria-hidden="true">▾</span></button><section class="inline-axis-panel" role="dialog" aria-label="${axis.toUpperCase()} axis settings" hidden><div class="inline-axis-heading"><strong>${axis.toUpperCase()} axis</strong><button type="button" data-axis-close aria-label="Close ${axis.toUpperCase()} axis settings">×</button></div>${axis==='y'?'<label>Range preset<select data-quick-preset><option value="custom">Custom range</option><option value="auto">Automatic range</option><option value="0,150">0–150%</option><option value="0,200">0–200%</option><option value="0,250">0–250%</option><option value="0,300">0–300%</option></select></label>':`<label>Concentration labels<select data-quick-labels><option value="logM" ${!options.xLabels||options.xLabels==='logM'?'selected':''}>log₁₀(M) · −6 = 1 µM</option><option value="um" ${options.xLabels==='um'?'selected':''}>µM values · log spacing</option><option value="logUM" ${options.xLabels==='logUM'?'selected':''}>log₁₀(µM) · 0 = 1 µM</option></select></label>`}<div class="inline-axis-fields">${['Min','Max'].map(end=>`<label>${end==='Min'?'Minimum':'Maximum'} (${axis==='x'?'µM':'%'})<input type="number" step="any" data-quick-field="${axis+end}" value="${escape(options[axis+end])}" placeholder="Auto"></label>`).join('')}</div><p>${axis==='x'?'Enter limits in µM, including when labels show log₁₀(M).':'Changes the displayed range only.'} Leave blank for automatic.</p><div class="inline-axis-actions"><button type="button" data-quick-action="apply">Apply ${axis.toUpperCase()} axis</button><button type="button" data-quick-action="reset">Reset ${axis.toUpperCase()} axis</button></div><p data-quick-status role="status"></p></section></div>`).join('');
 }
 function syncAxisInputs(host,options){
  for(const input of host.querySelectorAll('[data-axis-field],[data-quick-field]'))input.value=options[input.dataset.axisField||input.dataset.quickField]??'';
  for(const select of host.querySelectorAll('[data-x-labels],[data-quick-labels]'))select.value=options.xLabels||'logM';
  const preset=host.querySelector('[data-quick-preset]');if(preset){const range=options.yMin===undefined&&options.yMax===undefined?'auto':options.yMin+','+options.yMax;preset.value=[...preset.options].some(o=>o.value===range)?range:'custom';}
 }
 function closeAxis(control,focus=false){
  control.querySelector('.inline-axis-panel').hidden=true;const button=control.querySelector('[data-axis-toggle]');button.setAttribute('aria-expanded','false');if(focus)button.focus();
 }
 document.addEventListener('click',event=>{
  const control=event.target.closest('[data-inline-axis]');
  document.querySelectorAll('[data-inline-axis]').forEach(el=>{if(el!==control)closeAxis(el);});
  if(!control)return;
  const host=control.closest('[data-graph-editor]'),record=plots.get(host.dataset.graphEditor),axis=control.dataset.inlineAxis,panel=control.querySelector('.inline-axis-panel'),status=control.querySelector('[data-quick-status]');
  if(event.target.closest('[data-axis-toggle]')){const open=panel.hidden;syncAxisInputs(host,record.options);panel.hidden=!open;control.querySelector('[data-axis-toggle]').setAttribute('aria-expanded',String(open));if(open){status.textContent='';panel.querySelector('select,input').focus();}return;}
  if(event.target.closest('[data-axis-close]')){closeAxis(control,true);return;}
  const action=event.target.closest('[data-quick-action]');if(!action)return;
  try{
   const options={...record.options};delete options[axis+'Min'];delete options[axis+'Max'];
   if(axis==='x')delete options.xLabels;
   if(action.dataset.quickAction==='apply'){
    for(const input of control.querySelectorAll('[data-quick-field]')){if(input.validity.badInput)throw new Error('Enter a valid number or leave the box blank.');if(input.value.trim()){const value=Number(input.value);if(!finite(value))throw new Error('Axis limits must be finite numbers.');options[input.dataset.quickField]=value;}}
    const labels=control.querySelector('[data-quick-labels]');if(labels&&labels.value!=='logM')options.xLabels=labels.value;
   }
   const svg=record.factory(options);record.options=options;host.querySelector('.editable-graph-image > svg').outerHTML=tag(svg,host.dataset.graphEditor);syncAxisInputs(host,options);status.textContent=axis.toUpperCase()+' axis updated. Measurements and fits are unchanged.';
  }catch(error){status.textContent=error.message;}
 });
 document.addEventListener('change',event=>{const preset=event.target.closest('[data-quick-preset]');if(!preset)return;const control=preset.closest('[data-inline-axis]');if(preset.value==='custom')return;const values=preset.value==='auto'?['','']:preset.value.split(',');control.querySelectorAll('[data-quick-field]').forEach((input,i)=>input.value=values[i]);});
 document.addEventListener('keydown',event=>{if(event.key!=='Escape')return;const control=event.target.closest('[data-inline-axis]');if(control&&!control.querySelector('.inline-axis-panel').hidden){event.preventDefault();closeAxis(control,true);}});
 const axisImages=new Set();
 function positionAxisControls(image){
  const svg=image.querySelector('svg'),axis=svg?.querySelector('.graph-axis'),title=svg?.querySelector('.concentration-axis-title');if(!axis||!title||!image.clientWidth)return;
  const box=image.getBoundingClientRect(),a=axis.getBoundingClientRect(),t=title.getBoundingClientRect(),yControl=image.querySelector('[data-inline-axis="y"]'),xControl=image.querySelector('[data-inline-axis="x"]');
  if(yControl){yControl.style.left='0px';yControl.style.top=Math.max(0,a.top-box.top-32)+'px';}
  if(xControl){xControl.style.left=Math.max(0,Math.min(box.width-40,t.right-box.left+8))+'px';xControl.style.top=Math.max(0,t.top-box.top-5)+'px';}
 }
 const axisResize=new ResizeObserver(entries=>entries.forEach(e=>positionAxisControls(e.target)));
 function editable(key,factory,{xOnly=false}={}){
  const previous=plots.get(key),options=previous?.options||{};
  const record={factory,options};plots.set(key,record);
  let svg;
  try{svg=factory(options);}catch{record.options={};svg=factory({});}
  if(!svg)return '';
  const concentration=svg.includes('data-concentration-axis="true"');
  svg=tag(svg,key);
  return `<div class="editable-graph" data-graph-editor="${escape(key)}"><details class="graph-axis-editor"><summary>Axes &amp; export</summary><p>Set the displayed range; leave a box blank for automatic. Measurements, SD and fits are unchanged. Data CSV exports keep all selected concentrations.</p>${concentration?`<label class="graph-x-labels">Concentration axis labels<select data-x-labels><option value="um" ${record.options.xLabels==='um'?'selected':''}>µM values · logarithmic spacing</option><option value="logM" ${!record.options.xLabels||record.options.xLabels==='logM'?'selected':''}>log₁₀(M) · −6 = 1 µM</option><option value="logUM" ${record.options.xLabels==='logUM'?'selected':''}>log₁₀(µM) · 0 = 1 µM</option></select></label><p class="section-note">X minimum and maximum are entered in µM in every mode. Only the tick labels change; spacing and fitted curves stay the same.</p>`:''}<div class="graph-axis-fields">${[['xMin','X minimum'],['xMax','X maximum'],['yMin','Y minimum'],['yMax','Y maximum']].filter(([name])=>!xOnly||name.startsWith('x')).map(([name,label])=>`<label>${label}${concentration&&name.startsWith('x')?' (µM)':''}<input type="number" step="any" data-axis-field="${name}" value="${escape(record.options[name])}" placeholder="Auto"></label>`).join('')}</div><div class="graph-axis-actions"><button type="button" data-axis-action="apply">Apply axes</button><button type="button" data-axis-action="reset">Reset to automatic</button><button type="button" data-axis-action="png">Download PNG</button><button type="button" data-axis-action="svg">Download SVG</button></div><p class="graph-axis-status" role="status"></p></details><div class="editable-graph-image">${svg}${concentration?quickAxes(record.options):''}</div></div>`;
 }
 const tag=(svg,key)=>svg.replace('<svg ',`<svg data-axis-key="${escape(key)}" `);
 function current(svg){
  const key=new DOMParser().parseFromString(svg,'image/svg+xml').documentElement.getAttribute('data-axis-key');
  const record=plots.get(key);return record?tag(record.factory(record.options),key):svg;
 }
 document.addEventListener('click',async event=>{
  const button=event.target.closest('[data-axis-action]');if(!button)return;
  const host=button.closest('[data-graph-editor]'),key=host.dataset.graphEditor,record=plots.get(key),status=host.querySelector('.graph-axis-status');
  try{
   if(button.dataset.axisAction==='apply'||button.dataset.axisAction==='reset'){
    const options={};if(button.dataset.axisAction==='apply')for(const input of host.querySelectorAll('[data-axis-field]')){
     if(input.validity.badInput)throw new Error('Enter a valid number or leave the box blank.');
     if(input.value.trim()){const v=Number(input.value);if(!finite(v))throw new Error('Axis limits must be finite numbers.');options[input.dataset.axisField]=v;}
    }
    const labels=host.querySelector('[data-x-labels]');if(button.dataset.axisAction==='apply'&&labels&&labels.value!=='logM')options.xLabels=labels.value;
    const svg=record.factory(options);record.options=options;
    if(labels)labels.value=options.xLabels||'logM';
    host.querySelector('.editable-graph-image > svg').outerHTML=tag(svg,key);
    syncAxisInputs(host,options);
    for(const input of host.querySelectorAll('[data-axis-field]'))input.value=options[input.dataset.axisField]??'';
    status.textContent=Object.keys(options).length?'Custom axes applied. Values outside the range are hidden in the graph only.':'Automatic axes restored.';
   }else{
    button.disabled=true;await AtlasCompoundGraphs.exportGraph(host.querySelector('svg').outerHTML,key.replace(/[^a-z0-9_-]/gi,'_'),button.dataset.axisAction);status.textContent='Downloaded this graph with its current axis limits.';
   }
  }catch(error){status.textContent=error.message;}finally{button.disabled=false;}
 });
 function tickStep([lo,hi]){const raw=(hi-lo)/5,power=10**Math.floor(Math.log10(raw));return raw>0&&power>0?[1,2,5,10].find(n=>n*power>=raw)*power:hi-lo;}
 function niceDomain(domain){const step=tickStep(domain);return [Math.floor(domain[0]/step)*step,Math.ceil(domain[1]/step)*step];}
 function linearTicks([lo,hi]){const step=tickStep([lo,hi]),values=[lo],first=Math.ceil(lo/step)*step;for(let i=0;i<8;i++){const v=first+i*step;if(v>=hi)break;if(v>lo&&v>values.at(-1))values.push(v);}values.push(hi);return values;}
 function logTicks([lo,hi]){const step=Math.max(1,Math.ceil((hi-lo)/5)),values=[];for(let z=Math.ceil(lo);z<=hi;z+=step)values.push(10**z);return values.length>1?values:[10**lo,10**hi];}
 // Every remaining SVG figure gets the same standalone PNG/SVG export support.
 const seen=new WeakSet();
 function discoverExports(){
  for(const image of axisImages)if(!image.isConnected){axisResize.unobserve(image);axisImages.delete(image);}
  document.querySelectorAll('.editable-graph-image:has([data-inline-axis])').forEach(image=>{if(!axisImages.has(image)){axisImages.add(image);axisResize.observe(image);}positionAxisControls(image);});
  document.querySelectorAll('main svg[role="img"]').forEach(svg=>{
   if(svg.closest('[data-graph-editor]')||seen.has(svg))return;seen.add(svg);
   const toolbar=document.createElement('div');toolbar.className='graph-downloads standalone-graph-exports';
   for(const format of ['png','svg']){const button=document.createElement('button');button.type='button';button.className='secondary';button.textContent='Download '+format.toUpperCase();button.onclick=async()=>{button.disabled=true;try{await AtlasCompoundGraphs.exportGraph(svg.outerHTML,(svg.getAttribute('aria-label')||'atlas-graph').replace(/[^a-z0-9_-]/gi,'_').slice(0,150),format);}catch(error){toolbar.querySelector('[role="status"]').textContent=error.message;}finally{button.disabled=false;}};toolbar.append(button);}
   const status=document.createElement('span');status.setAttribute('role','status');toolbar.append(status);svg.after(toolbar);
  });
 }
 new MutationObserver(discoverExports).observe(document.documentElement,{childList:true,subtree:true});
 return {css,axes,concentrationDomain,sampleSize,limits,editable,current,linearTicks,logTicks,niceDomain};
})();
