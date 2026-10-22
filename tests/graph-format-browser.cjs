const {chromium}=require('playwright-core'),{spawn}=require('node:child_process'),fs=require('node:fs'),assert=require('node:assert/strict');
const root=require('node:path').resolve(__dirname,'..'),base='http://127.0.0.1:4194/';
(async()=>{const server=spawn('python3',['-m','http.server','4194','--bind','127.0.0.1'],{cwd:root,stdio:'ignore'});let browser;
try{
 for(let i=0;i<50;i++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'?view=runComparison');await require('./select-workspace.cjs')(page);await page.locator('#runGraph svg').waitFor();await page.locator('#runAssay').selectOption('both');
 const editor=page.locator('#runGraph [data-graph-editor]'),meta=()=>editor.locator('metadata').evaluate(e=>JSON.parse(e.textContent));
 const before=await meta(),data=await editor.locator('[data-dose]').evaluateAll(es=>es.map(e=>[e.dataset.dose,e.dataset.mean,e.dataset.sd]));
 const style=await editor.locator('.axis-tick').first().evaluate(e=>{const s=getComputedStyle(e);return [s.fontFamily,s.fontWeight,s.fontSize,s.fill];});
 assert.match(style[0],/Arial/);assert.equal(style[1],'700');assert(Math.abs(parseFloat(style[2])-14.6667)<.01);assert.equal(style[3],'rgb(0, 0, 0)');
 assert.match(await editor.locator('[data-sample-size]').first().textContent(),/48 measured wells/);
 await editor.locator('summary').click();
 for(const [name,value] of Object.entries({xMin:0.001,xMax:10,yMin:0,yMax:200}))await editor.locator(`[data-axis-field="${name}"]`).fill(String(value));
 await editor.locator('[data-axis-action="apply"]').click();
 assert.deepEqual((await meta()).display_axes.custom,{xMin:.001,xMax:10,yMin:0,yMax:200});
 assert.deepEqual(await editor.locator('[data-dose]').evaluateAll(es=>es.map(e=>[e.dataset.dose,e.dataset.mean,e.dataset.sd])),data);
 assert.deepEqual((await meta()).curves,before.curves,'presentation must not change source/fit metadata');
 const coordinate=await editor.locator('svg').evaluate(svg=>{const clip=svg.querySelector('clipPath rect'),control=svg.querySelector('[data-reference="normalization-100"]');return {actual:+control.getAttribute('y1'),expected:+clip.getAttribute('y')+ +clip.getAttribute('height')/2,color:getComputedStyle(control).stroke};});
 assert.equal(coordinate.actual,coordinate.expected);assert.equal(coordinate.color,'rgb(0, 0, 0)');
 let download=page.waitForEvent('download');await page.locator('#runSVG').click();let svg=fs.readFileSync(await (await download).path(),'utf8');
 assert(svg.includes('&quot;yMax&quot;:200')||svg.includes('"yMax":200'));assert(svg.includes('Custom axis limits'));assert(svg.includes('11pt'));assert(svg.includes('clipPath'));
 download=page.waitForEvent('download');await page.locator('#runPNG').click();const png=fs.readFileSync(await (await download).path());assert.equal(png.subarray(1,4).toString(),'PNG');assert.equal(png.readUInt32BE(16),1600);
 const good=await editor.locator('svg').evaluate(e=>e.outerHTML);
 await editor.locator('[data-axis-field="xMin"]').fill('0');await editor.locator('[data-axis-action="apply"]').click();assert.match(await editor.locator('.graph-axis-status').textContent(),/positive/);assert.equal(await editor.locator('svg').evaluate(e=>e.outerHTML),good);
 await editor.locator('[data-axis-field="xMin"]').fill('20');await editor.locator('[data-axis-action="apply"]').click();assert.match(await editor.locator('.graph-axis-status').textContent(),/minimum/);
 await editor.locator('[data-axis-action="reset"]').click();assert.deepEqual((await meta()).display_axes.custom,{});
 await page.setViewportSize({width:390,height:900});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await editor.locator('[data-axis-field="yMin"]').fill('110');await editor.locator('[data-axis-field="yMax"]').fill('200');await editor.locator('[data-axis-action="apply"]').click();assert.equal(await editor.locator('[data-reference]').count(),0,'out-of-range control must not float outside plot');
 await editor.locator('[data-axis-action="reset"]').click();
 await page.setViewportSize({width:1440,height:1000});await editor.locator('summary').click();await editor.locator('svg').screenshot({path:'/tmp/atlas-prism-run.png'});
 for(const [query,selector] of [
  ['view=curves&experiment=EXP26007301','#curve-0'],
  ['view=biologicalReplicates&experiment=EXP26003438','#cypaPlot'],
  ['view=configurationComparison&experiment=EXP26007104','#orientation-plot-1'],
  ['view=crosslinking','#xlinkScatter']
 ]){
  await page.goto(base+'?'+query);const plot=page.locator(selector);if(selector==='#xlinkScatter')await page.getByText('Plot total crosslinking with and without CypA',{exact:true}).click();await plot.locator('svg').waitFor();await plot.locator('.graph-axis-editor summary').click();
  await plot.locator('[data-axis-field="yMin"]').fill('0');await plot.locator('[data-axis-field="yMax"]').fill('200');await plot.locator('[data-axis-action="apply"]').click();
  assert.equal(await plot.locator('.axis-title').first().evaluate(e=>getComputedStyle(e).fill),'rgb(0, 0, 0)');assert.match(await plot.locator('.graph-axis-status').textContent(),/Custom axes applied/);
  download=page.waitForEvent('download');await plot.locator('[data-axis-action="svg"]').click();svg=fs.readFileSync(await (await download).path(),'utf8');assert(/Custom ax(?:es|is)/.test(svg));assert(svg.includes('Arial'));assert(svg.includes('clipPath'));
  await plot.locator('[data-axis-action="reset"]').click();
  await plot.locator('svg').screenshot({path:'/tmp/atlas-prism-'+selector.slice(1)+'.png'});
 }
 await page.goto(base+'?view=compoundGraphs&experiment=EXP26007301');await page.locator('#graphCards svg').first().waitFor();
 const domains=await page.locator('#graphCards metadata').evaluateAll(es=>es.map(e=>JSON.parse(e.textContent).concentration_axis_log10));assert.equal(domains.length,4);domains.forEach(d=>assert.deepEqual(d,domains[0]));
 // Deliberately different dose ranges exercise the shared-range path, rather than relying on equal supplied grids.
 const synthetic=await page.evaluate(()=>{
  const curves=[{compound:'A',target:'T1',doses:[{x:.001,mean:20,n:2},{x:1,mean:80,n:2}]},{compound:'A',target:'T2',doses:[{x:.1,mean:30,n:1},{x:10,mean:90,n:2}]}],domain=AtlasGraphFormat.concentrationDomain(curves);
  return ['T1','T2'].map(target=>JSON.parse(new DOMParser().parseFromString(AtlasCompoundGraphs.graph({data:{curves},benchling:'test',selected:['A'],target,xDomain:domain,fits:false}), 'image/svg+xml').querySelector('metadata').textContent).concentration_axis_log10);
 });assert.deepEqual(synthetic[0],synthetic[1]);
 await page.goto(base+'?view=overview');await page.locator('main .standalone-graph-exports').first().waitFor();download=page.waitForEvent('download');await page.locator('main .standalone-graph-exports button').first().click();assert(fs.statSync(await (await download).path()).size>1000);
 assert.deepEqual(errors,[]);console.log('PASS: in-vitro fonts, black control at exact 100, n basis, shared concentration axes, custom axes/validation/reset, clipping, unchanged values/fits, current SVG/PNG exports, legacy graph exports and mobile layout');
}finally{await browser?.close();server.kill();}})().catch(e=>{console.error(e);process.exitCode=1;});
