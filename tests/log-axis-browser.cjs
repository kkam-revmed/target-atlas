const {chromium}=require('playwright-core'),{spawn}=require('node:child_process'),fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'..'),base='http://127.0.0.1:4198/';
(async()=>{const server=spawn('python3',['-m','http.server','4198','--bind','127.0.0.1'],{cwd:root,stdio:'ignore'});let browser;
try{
 for(let i=0;i<50;i++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage']});const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const [url,selector,downloadButton] of [['?view=runComparison','#runGraph','#runSVG'],['?view=biologicalReplicates&experiment=EXP26003438','#cypaPlot','#cypaExport']]){
  await page.goto(base+url);if(url.includes('runComparison'))await require('./select-workspace.cjs')(page);const editor=page.locator(selector+' [data-graph-editor]');await editor.locator('svg').waitFor();assert.equal(await editor.locator('.response-axis-title').textContent(),'NanoBRET normalized response (%)');await editor.locator('summary').click();
  await editor.locator('[data-axis-field="xMin"]').fill('0.001');await editor.locator('[data-axis-field="xMax"]').fill('100');await editor.locator('[data-axis-action="apply"]').click();
  const snapshot=()=>editor.locator('svg').evaluate(svg=>({curves:JSON.parse(svg.querySelector('metadata').textContent).curves,geometry:[...svg.querySelectorAll('[data-run-series] path,[data-run-series] circle,[data-run-series] line,[data-run-series] rect')].map(e=>[...e.attributes].filter(a=>['d','x','y','cx','cy','x1','x2','y1','y2','width','height'].includes(a.name)).map(a=>[a.name,a.value])),doses:[...svg.querySelectorAll('[data-dose]')].map(e=>({...e.dataset}))}));
  const before=await snapshot();
  for(const [mode,labels,title] of [['logM',['-9','-8','-7','-6','-5','-4'],'log₁₀ concentration (M)'],['logUM',['-3','-2','-1','0','1','2'],'log₁₀ concentration (µM)'],['um',['0.001','0.01','0.1','1','10','100'],'Concentration (µM, log scale)']]){
   await editor.locator('[data-x-labels]').selectOption(mode);await editor.locator('[data-axis-action="apply"]').click();assert.deepEqual(await editor.locator('.concentration-tick').allTextContents(),labels);assert.equal(await editor.locator('.concentration-axis-title').textContent(),title);assert.deepEqual(await snapshot(),before,'Only labels change, not source doses, fits or plotted geometry');
   const wait=page.waitForEvent('download');await page.locator(downloadButton).click();const svg=fs.readFileSync(await (await wait).path(),'utf8');assert(svg.includes(title));assert(svg.includes('NanoBRET normalized response (%)'));assert(svg.includes('x_tick_labels'));
  }
  await page.setViewportSize({width:390,height:900});await editor.locator('[data-x-labels]').selectOption('logM');await editor.locator('[data-axis-action="apply"]').click();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await editor.locator('[data-axis-action="reset"]').click();assert.equal(await editor.locator('[data-x-labels]').inputValue(),'logM');assert.equal(await editor.locator('.concentration-axis-title').textContent(),'log₁₀ concentration (M)');await page.setViewportSize({width:1440,height:1000});
 }
 assert.deepEqual(errors,[]);console.log('PASS: molar and micromolar log labels, −4 = 100µM, unchanged source doses/fits/geometry, current SVG exports, reset and mobile controls');
}finally{await browser?.close();server.kill();}})().catch(e=>{console.error(e);process.exitCode=1;});
