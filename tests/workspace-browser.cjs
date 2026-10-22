const {chromium}=require('playwright-core'),{spawn}=require('node:child_process'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),base='http://127.0.0.1:4195/';
(async()=>{const server=spawn('python3',['-m','http.server','4195','--bind','127.0.0.1'],{cwd:root,stdio:'ignore'});let browser;
try{
 for(let i=0;i<50;i++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);await page.locator('#runSearch').waitFor();
 assert.equal(await page.locator('#runAssay').inputValue(),'');assert.equal(await page.locator('#runTarget').inputValue(),'');assert.equal(await page.locator('#runCompound').inputValue(),'');assert.equal(await page.locator('#runSelected [data-run-remove]').count(),0);assert.equal(await page.locator('#runGraph svg').count(),0);
 for(const id of ['runPNG','runSVG','runCSV','runPrism','runPrismGraph'])assert(await page.locator('#'+id).isDisabled());
 for(const width of [1440,390,320]){await page.setViewportSize({width,height:1000});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
 await page.setViewportSize({width:1440,height:1000});
 await page.locator('#runSearch').fill('RMC-0741051');await page.locator('#runCompound').selectOption('RMC-0741051-001');await page.locator('#runAdd').click();assert.equal(await page.locator('#runGraph svg').count(),0);
 await page.locator('#runAssay').selectOption('selectivity');assert.equal(await page.locator('#runTarget').inputValue(),'');assert.equal(await page.locator('#runGraph svg').count(),0);
 await page.locator('#runTarget').selectOption('Cyclin D3');await page.locator('#runGraph svg').waitFor();
 await page.locator('#runAssay').selectOption('');assert.equal(await page.locator('#runGraph svg').count(),0);assert(await page.locator('#runPrismGraph').isDisabled());await page.locator('#runAssay').selectOption('selectivity');
 assert.equal(new URL(page.url()).hash,'#compound-response');
 assert.equal(await page.locator('nav [data-view]:visible').count(),3);assert(!(await page.locator('#scientistStart').isVisible()));assert(!(await page.locator('.study-select').isVisible()));
 assert.equal(await page.locator('#runGraph [data-run-series]').count(),4);assert.equal(await page.locator('#runAssay').inputValue(),'selectivity');
 await page.locator('#runSearch').fill('9903');assert.equal(await page.locator('#runCompound option').count(),1);await page.locator('#runAdd').click();
 assert.equal(await page.locator('#runSelected [data-run-remove]').count(),2);assert.equal(await page.locator('#runGraph [data-run-series]').count(),6);
 const selected=await page.locator('#runSelected').innerText(),metadata=await page.locator('#runGraph metadata').textContent();
 for(const tab of ['activity','measurements','sources','graph']){await page.locator('[data-workspace-tab="'+tab+'"]').click();assert(await page.locator('#runPane-'+tab).isVisible());assert.equal(await page.locator('#runSelected').innerText(),selected);assert.equal(new URL(page.url()).hash,'#compound-response');}
 assert.equal(await page.locator('#runGraph metadata').textContent(),metadata,'tabs must not change the plot');
 for(const [mode,series] of [['technical',6],['individual',6],['summary',3],['pooled',3]]){await page.locator('#runMode').selectOption(mode);assert.equal(await page.locator('#runGraph [data-run-series]').count(),series);}
 await page.locator('[data-workspace-tab="evidence"]').click();await page.locator('[data-evidence-assays]').first().waitFor();assert.equal(await page.locator('[data-evidence-assays]').count(),2);assert.match(await page.locator('#runEvidence').innerText(),/0741051/);
 await page.locator('.workspace-evidence-batch>details>summary').first().click();assert((await page.locator('[data-evidence-crosslink="0"] .xlink-adduct-table').count())>0);assert.match(await page.locator('[data-evidence-crosslink="0"]').innerText(),/Original compound label: RMC-0741051-001/);
 await page.locator('[data-workspace-tab="graph"]').click();await page.locator('#runAssay').selectOption('d1');assert(await page.locator('#runCondition').isVisible());assert(!(await page.locator('#runTarget').isVisible()));assert.equal(await page.locator('#runGraph [data-run-series]').count(),1);assert.match(await page.locator('#runStatus').innerText(),/No exact D1 batch match/);
 await page.locator('#runAssay').selectOption('both');await page.locator('#runMode').selectOption('individual');assert.equal(await page.locator('#runGraph [data-run-series]').count(),8);
 let wait=page.waitForEvent('download');await page.locator('#runCSV').click();const csv=fs.readFileSync(await (await wait).path(),'utf8');assert(csv.includes('RMC-0769903-001'));assert(csv.includes('RMC-0741051-002'),'original plate 2 label retained');
 for(const width of [1440,390,320]){await page.setViewportSize({width,height:1000});await page.waitForTimeout(200);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.equal(await page.locator('#runSelected').innerText(),selected);await page.locator('#pageTitle').scrollIntoViewIfNeeded();await page.screenshot({path:'/tmp/atlas-workspace-'+width+'.png'});}
 await page.setViewportSize({width:1440,height:1000});await page.locator('[data-workspace-tab="graph"]').focus();await page.keyboard.press('ArrowRight');assert(await page.locator('#runPane-activity').isVisible());
 await page.locator('nav [data-view="overview"]').click();await page.locator('nav [data-view="runComparison"]').click();assert.equal(await page.locator('#runSelected').innerText(),selected);assert(await page.locator('#runPane-activity').isVisible());
 await page.goto(base+'?view=curves&experiment=EXP26007301');await page.locator('#curveGrid svg').first().waitFor();assert(await page.locator('nav [data-view="curves"]').isVisible(),'legacy links expand their tool group');
 const compound=await page.locator('#compound').inputValue(),batch=await page.locator('#compoundBatch').inputValue();await page.locator('#compareCompoundGraphs').click();await page.locator('#runTarget').waitFor();assert.equal(await page.locator('#runTarget').inputValue(),'');await page.locator('#runTarget').selectOption('Cyclin D3');await page.locator('#runGraph svg').waitFor();assert.equal(await page.locator('#runSelected [data-run-remove]').count(),1);assert((await page.locator('#runSelected').textContent()).includes(compound));assert((await page.locator('#runSelected').textContent()).includes(batch.slice(-3)));
 await page.locator('#runSelected [data-run-remove]').click();await page.locator('[data-workspace-tab="evidence"]').click();assert.match(await page.locator('#runEvidence').innerText(),/Choose a compound batch above/);
 assert.deepEqual(errors,[]);console.log('PASS: default single workspace, three primary destinations, exact batch selection, persistent tabs/navigation, all four replicate modes, inline assay/source evidence, exports, keyboard tabs, legacy entry, desktop and mobile');
}finally{await browser?.close();server.kill();}})().catch(e=>{console.error(e);process.exitCode=1;});
