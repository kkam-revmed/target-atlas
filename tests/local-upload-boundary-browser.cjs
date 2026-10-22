// A matching compound ID must never make uploaded values look like bundled runs.
const {chromium}=require('playwright-core'),{spawn}=require('node:child_process'),assert=require('node:assert/strict');
const root=require('node:path').resolve(__dirname,'..'),base='http://127.0.0.1:4661/';
(async()=>{const server=spawn('python3',['-m','http.server','4661','--bind','127.0.0.1'],{cwd:root,stdio:'ignore'});let browser;
try{
 for(let i=0;i<50;i++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);await page.locator('#runSearch').waitFor();
 const csv='compound,target,concentration_um,response,replicate\n'+[.01,.1,1,10].flatMap(x=>[1,2].map(r=>`RMC-0741051-001,Cyclin D3,${x},${900+x},${r}`)).join('\n');
 await page.locator('.upload-tools').evaluate(e=>e.open=true);await page.locator('#paste').evaluate(e=>e.closest('details').open=true);await page.locator('#paste').fill(csv);await page.locator('#analyzePaste').click();
 await page.waitForFunction(()=>!state.busy&&state.localAnalysis===true);
 assert.equal(await page.evaluate(()=>state.view),'overview');
 assert.equal(await page.evaluate(()=>state.data.curves[0].doses[0].mean),900.01);
 assert.equal(await page.evaluate(()=>state.data.normalization_reference),false);
 assert(await page.locator('#selectivityIdentityNotice').isHidden());assert(await page.locator('#orientationNotice').isHidden());assert.match(await page.locator('#basisNote').innerText(),/Normalization and control levels are not established/);
 assert.match(await page.locator('#localAnalysisNotice').innerText(),/normalization and Benchling ID were not specified/);
 await page.evaluate(()=>setView('curves'));await page.locator('#curveGrid svg').first().waitFor();
 assert.equal(await page.locator('#curveGrid [data-reference="normalization-100"]').count(),0);
 assert((await page.locator('#curveGrid svg').first().textContent()).includes('Response (supplied units)'));
 await page.evaluate(()=>setView('compoundGraphs'));await page.locator('#graphCards svg').first().waitFor();
 assert.equal(await page.locator('#graphCards [data-reference="normalization-100"]').count(),0);
 assert.equal(await page.locator('#graphCards .response-axis-title').first().textContent(),'Response (supplied units)');
 const metadata=JSON.parse(await page.locator('#graphCards metadata').first().textContent());assert.equal(metadata.normalization_reference,null);assert.equal(metadata.benchling_id,'Local upload (Benchling ID not assigned)');assert.equal(await page.locator('#experimentId').textContent(),'Not assigned to this upload');
 await page.evaluate(()=>setView('biologicalReplicates'));assert.equal(await page.locator('#biologicalReplicates svg').count(),0);assert.match(await page.locator('#biologicalReplicates').innerText(),/no linked biological replicate/);
 await page.evaluate(()=>setView('runComparison'));await require('./select-workspace.cjs')(page);
 assert.notEqual(Number(await page.locator('#runGraph [data-mean]').first().getAttribute('data-mean')),900.01);
 assert.match(await page.locator('#localAnalysisNotice').innerText(),/Published Atlas runs only/);
 assert.match(await page.locator('#localAnalysisNotice').innerText(),/does not include your uploaded file/);
 for(const width of [390,320]){await page.setViewportSize({width,height:900});assert(await page.locator('#localAnalysisNotice').isVisible());assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
 await page.locator('#localAnalysisNotice button').click();assert.equal(await page.evaluate(()=>state.view),'overview');assert.equal(await page.evaluate(()=>state.data.curves[0].doses[0].mean),900.01);
 assert.deepEqual(errors,[]);console.log('PASS: local upload stays distinct from bundled workspace and replicate views; raw units retain no assumed100%control; compound comparison metadata truthful; mobile notice and return path');
}finally{await browser?.close();server.kill();}})().catch(e=>{console.error(e);process.exitCode=1;});
