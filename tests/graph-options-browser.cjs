const {chromium}=require('playwright-core');
const {spawn}=require('node:child_process');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),base='http://127.0.0.1:4197/';
const datasetHash=()=>Object.fromEntries(fs.readdirSync(root).filter(n=>n.endsWith('.json')).map(n=>[n,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,n))).digest('hex')]));
const cypaSource=JSON.parse(fs.readFileSync(path.join(root,'cypa-dependency.json'),'utf8'));
const average=values=>values.reduce((total,value)=>total+value,0)/values.length;
const sampleSD=values=>values.length<2?null:Math.sqrt(values.reduce((total,value)=>total+(value-average(values))**2,0)/(values.length-1));
const near=(actual,expected,message)=>{if(expected==null)assert.equal(actual,null,message);else assert(Math.abs(actual-expected)<=1e-11*Math.max(1,Math.abs(expected)),message+': '+actual+' vs '+expected);};
// Expectations are calculated directly from supplied JSON, independently of Atlas summary helpers.
async function verifyCypaValues(plot,compound,mode){
 const actual=await plot.locator('svg').evaluate(svg=>{const meta=JSON.parse(svg.querySelector('metadata').textContent);return meta.curves.map(q=>({...q,doses:[...svg.querySelectorAll('[data-run-series]')].find(e=>e.dataset.runSeries===q.series_id).querySelectorAll('[data-dose]')})).map(q=>({...q,doses:[...q.doses].map(e=>({x:Number(e.dataset.dose),mean:Number(e.dataset.mean),sd:e.dataset.sd===''?null:Number(e.dataset.sd),n:Number(e.querySelector('title').textContent.match(/ · n (\d+)$/)[1])}))}));});
 const sources=cypaSource.curves.filter(q=>q.compound===compound);
 for(const series of actual){
  const condition=series.condition==='No CypA inhibitor'?'A':'B';
  const sourceRows=sources.filter(q=>q.condition_code===condition&&(['summary','pooled'].includes(mode)||q.replicate==='bio'+series.biological_replicate));
  assert.equal(sourceRows.length,['summary','pooled'].includes(mode)?2:1,'Exactly the selected biological runs contribute');
  const concentrations=[...new Set(sourceRows.flatMap(q=>q.doses.filter(d=>d.x>0).map(d=>d.x)))].sort((a,b)=>a-b);
  assert.deepEqual(series.doses.map(d=>d.x),concentrations,'Concentrations remain exact; no interpolation');
  for(const dose of series.doses){
   const components=sourceRows.map(q=>q.doses.find(d=>d.x===dose.x)).filter(Boolean);
   let expected;
   if(mode==='summary'){const values=components.map(d=>d.mean);expected={mean:average(values),sd:sampleSD(values),n:values.length};}
   else if(mode==='pooled'){const values=components.flatMap(d=>d.wells.map(w=>w.normalized).filter(Number.isFinite));expected={mean:average(values),sd:sampleSD(values),n:values.length};}
   else expected=components[0];
   near(dose.mean,expected.mean,compound+' '+mode+' '+condition+' '+dose.x+' mean');near(dose.sd,expected.sd,compound+' '+mode+' '+condition+' '+dose.x+' SD');assert.equal(dose.n,expected.n,'n counts the correct experimental unit');
  }
  if(!['summary','pooled'].includes(mode))near(series.independent_4pl?.ec50_um??null,sourceRows[0].fit?.ec50??null,'Existing independent EC50 unchanged');
 }
 return actual;
}
(async()=>{
 const beforeFiles=datasetHash(),server=spawn('python3',['-m','http.server','4197','--bind','127.0.0.1'],{cwd:root,stdio:'ignore'});let browser;
 try{
  for(let i=0;i<50;i++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const cases=[{name:'workspace',url:'?view=runComparison',prefix:'run',plot:'#runGraph',svg:'#runSVG',counts:[4,4,2,2]},
   {name:'cypa',url:'?view=biologicalReplicates&experiment=EXP26003438',prefix:'cypaGraph',plot:'#cypaPlot',svg:'#cypaExport',counts:[4,4,2,2]}];
  for(const c of cases.filter(c=>!process.env.GRAPH_OPTIONS_WORKSPACE_ONLY||c.name==='workspace')){
   await page.setViewportSize({width:1440,height:1000});await page.goto(base+c.url);const plot=page.locator(c.plot);await plot.locator('svg').waitFor();if(c.name==='cypa')await page.locator('#cypaCompound').selectOption(cypaSource.reference);
   const mode=page.locator('#'+c.prefix+'Mode'),style=page.locator('#'+c.prefix+'Style'),wells=page.locator('#'+c.prefix+'Wells'),colors=page.locator('#'+c.prefix+'Colors');
   await mode.waitFor();await mode.selectOption('individual');await style.selectOption('both');
   const snapshots=()=>plot.locator('svg').evaluate(svg=>({metadata:JSON.parse(svg.querySelector('metadata').textContent),values:[...svg.querySelectorAll('[data-dose]')].map(e=>[e.dataset.dose,e.dataset.mean,e.dataset.sd])}));
   const colorInput=colors.locator('[data-graph-color]').first(),original=await colorInput.inputValue(),key=await colorInput.getAttribute('data-graph-color'),before=await snapshots();
   const seriesColors=()=>plot.locator('[data-run-series]').evaluateAll(es=>Object.fromEntries(es.map(e=>[e.dataset.runSeries,[...new Set([...e.querySelectorAll('[stroke]')].map(n=>n.getAttribute('stroke')))]])));
   const originalColors=await seriesColors();
   await colorInput.evaluate(e=>{e.value='#d52963';e.dispatchEvent(new Event('change',{bubbles:true}));});
   assert.deepEqual(await snapshots(),before,c.name+': recoloring must preserve plotted values, fits and source metadata');
   const recolored=await seriesColors();assert(recolored[key].includes('#d52963'));for(const [id,value] of Object.entries(originalColors))if(id!==key)assert.deepEqual(recolored[id],value,'Only the chosen series may change color');
   let download=page.waitForEvent('download');await page.locator(c.svg).click();let exported=fs.readFileSync(await (await download).path(),'utf8');assert(exported.includes('#d52963'),'SVG uses the current series color');
   await style.selectOption('measured');assert.equal(await plot.locator('[data-series="independent-fit"]').count(),0);assert.equal(await plot.locator('[data-series="dose-means"]').count(),4);
   await style.selectOption('4pl');assert.equal(await plot.locator('[data-series="dose-means"]').count(),0);assert((await plot.locator('[data-series="independent-fit"]').count())>0);assert.equal(await plot.locator('[data-dose]').count(),before.values.length,'Fit display keeps measured means visible');
   await style.selectOption('both');
   for(const [index,value] of ['technical','individual','summary','pooled'].entries()){
    await mode.selectOption(value);assert.equal(await plot.locator('[data-run-series]').count(),c.counts[index]);
    const metadata=(await snapshots()).metadata;
    if(value==='technical')assert((await plot.locator('[data-series="well"]').count())>0);
    if(value==='summary'){
     assert(metadata.curves.every(q=>q.summary_components.length===2));
     assert((await plot.locator('[data-biological-replicate="1"]').count())>0);assert((await plot.locator('[data-biological-replicate="2"]').count())>0);
     assert(metadata.curves.every(q=>/biological runs/.test(q.sample_size)));
    }
    if(value==='pooled')assert(metadata.curves.every(q=>/pooled wells/.test(q.sample_size)));
    if(c.name==='cypa'){
     assert.equal(new Set(metadata.curves.map(q=>q.condition)).size,2,'No-inhibitor and inhibitor conditions stay separate in every mode');
     const checked=await verifyCypaValues(plot,cypaSource.reference,value);
     if(value==='individual')assert(checked.some(q=>q.doses.some(d=>d.n===48)),'Reference retains its supplied 48-well dose');
     if(value==='pooled')assert(checked.some(q=>q.doses.some(d=>d.n===96)),'Two reference runs can contribute 96 wells, not 96 biological replicates');
    }
   }
   await mode.selectOption('individual');assert.equal(await colors.locator('[data-graph-color]').first().inputValue(),'#d52963','Per-run colors survive mode round-trip');
   await wells.uncheck();assert.equal(await plot.locator('[data-series="well"]').count(),0);await wells.check();assert((await plot.locator('[data-series="well"]').count())>0);
   await colors.locator('[data-reset-colors]').click();assert.equal(await colors.locator('[data-graph-color]').first().inputValue(),original);assert.deepEqual(await seriesColors(),originalColors);
   const layout=await plot.evaluate(e=>{const group=e.closest('.graph-with-options'),options=group.querySelector('.graph-options'),a=options.getBoundingClientRect(),b=e.getBoundingClientRect();return {right:a.left>=b.right-1,topAligned:Math.abs(a.top-b.top)<2};});
   assert(layout.right,c.name+': controls should be next to graph at desktop width');
   const scale=await plot.locator('svg').evaluate(svg=>{const r=svg.getBoundingClientRect(),v=svg.viewBox.baseVal;return {actual:r.height,expected:r.width*v.height/v.width};});
   assert(Math.abs(scale.actual-scale.expected)<2,c.name+': full graph artwork should retain its width/aspect ratio, not shrink inside a capped-height viewport');
   await plot.locator('..').screenshot({path:'/tmp/atlas-graph-options-'+c.name+'-1440.png'});
   const beforeResize=await snapshots();
   for(const width of [390,320]){
    await page.setViewportSize({width,height:900});await page.waitForTimeout(250);assert.equal(await mode.inputValue(),'individual','Resize must retain chosen replicate mode');assert.deepEqual(await snapshots(),beforeResize,'Resize must retain selected compound, fits and measurements');await mode.scrollIntoViewIfNeeded();assert(await mode.isVisible());assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),c.name+': no page overflow at '+width);
    const stack=await plot.evaluate(e=>{const group=e.closest('.graph-with-options'),a=group.querySelector('.graph-options').getBoundingClientRect(),b=e.getBoundingClientRect();return a.bottom<=b.top+1;});assert(stack,c.name+': controls should stack immediately above mobile graph');
    if(width===390)await plot.locator('..').screenshot({path:'/tmp/atlas-graph-options-'+c.name+'-390.png'});
   }
   if(c.name==='cypa'){
    await page.setViewportSize({width:1440,height:1000});
    const normal=cypaSource.compounds.map(q=>q.compound).find(id=>{const rows=cypaSource.curves.filter(q=>q.compound===id);return rows.length===4&&rows.every(q=>q.doses.every(d=>d.n===2));});
    assert(normal,'Supplied two-well library compound available');await page.locator('#cypaCompound').selectOption(normal);
    for(const value of ['technical','individual','summary','pooled']){await mode.selectOption(value);const checked=await verifyCypaValues(plot,normal,value);assert(checked.every(q=>q.doses.every(d=>d.n===(value==='pooled'?4:2))),'Library compound retains two technical wells/run, two biological runs, or four pooled wells as appropriate');}
    console.log('PASS CypA independent source checks: every dose mean, sample SD and n for a 48-well reference and two-well library compound; conditions stay separate; no interpolation or fit alteration');
   }
   console.log('PASS '+c.name+': graph-side controls, four replicate modes, separate conditions/plates, per-series colors/reset/persistence, numerical invariance, SVG export, fit toggle, wells, desktop/mobile layout');
  }
  assert.deepEqual(errors,[],'Browser exceptions');assert.deepEqual(datasetHash(),beforeFiles,'Dataset files must remain byte-for-byte unchanged');
 }finally{await browser?.close();server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
