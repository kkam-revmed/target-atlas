const {chromium}=require('playwright-core'),{spawn}=require('node:child_process'),fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'..'),base='http://127.0.0.1:4199/';
function unzip(bytes){const files={};let p=0;while(bytes.readUInt32LE(p)===0x04034b50){assert.equal(bytes.readUInt16LE(p+8),0);const len=bytes.readUInt32LE(p+18),n=bytes.readUInt16LE(p+26),extra=bytes.readUInt16LE(p+28),start=p+30+n+extra;files[bytes.subarray(p+30,p+30+n).toString()]=bytes.subarray(start,start+len);p=start+len;}return files;}
(async()=>{const server=spawn('python3',['-m','http.server','4199','--bind','127.0.0.1'],{cwd:root,stdio:'ignore'});let browser;
try{
 for(let i=0;i<50;i++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({acceptDownloads:true,viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 async function download(selector){const wait=page.waitForEvent('download');await page.locator(selector).click();const d=await wait;assert(d.suggestedFilename().endsWith('.zip'));const files=unzip(fs.readFileSync(await d.path()));const provenance=JSON.parse(files['Atlas_Prism/provenance.json']);const native=unzip(files['Atlas_Prism/Atlas_Input.prism']);const rows=native['data/tables/A8CB8A16-CF2B-4606-A7F4-3BCC05585DF7/data.csv'].toString().trim().split('\n').map(r=>r.split(','));assert(rows.length>0);assert(!Object.keys(native).some(n=>n.endsWith('/results.json')));return {files,native,rows,script:files['Atlas_Prism/Open_in_Prism.pzc'].toString(),provenance:JSON.parse(files['Atlas_Prism/provenance.json'])};}
 await page.goto(base+'?view=runComparison');await page.locator('#runGraph svg').waitFor();await page.locator('#runSearch').fill('9903');await page.locator('#runAdd').click();
 let result=await download('#runPrismGraph');assert.equal(result.provenance.series.length,6);assert.equal(result.provenance.series.filter(q=>q.source_compound==='RMC-0741051-002').length,2);assert(result.script.includes('SetAxisTitle Y "Corrected response"'));
 const priorCount=result.provenance.series.length;
 await page.locator('#runMode').selectOption('summary');result=await download('#runPrismGraph');assert.equal(result.provenance.series.length,priorCount/2);assert(result.provenance.series.every(q=>q.summary_components.length===2));
 await page.goto(base+'?view=biologicalReplicates&experiment=EXP26003438');await page.locator('#cypaPlot svg').waitFor();await page.locator('#cypaCompound').selectOption('RMC-0741051-001');
 const editor=page.locator('#cypaPlot .graph-axis-editor');await editor.evaluate(el=>el.open=true);
 await editor.locator('[data-axis-field="yMax"]').fill('300');await editor.locator('[data-axis-field="xMin"]').fill('0.001');await editor.locator('[data-axis-action="apply"]').click();
 result=await download('#cypaPrismGraph');assert.equal(result.provenance.series.length,4);assert.equal(result.provenance.native_fit.axes.xMin,-9);assert.equal(result.provenance.native_fit.axes.yMax,300);assert(result.script.includes('SetAxisTitle Y "NanoBRET normalized (%)"'));
 // Values are serialized exactly; any subsequent Prism import precision is a
 // consumer behavior recorded in the package, not rounding by the exporter.
 const q=result.provenance.series[0];q.doses.forEach((d,r)=>{assert.equal(Number(result.rows[r][0]),Math.log10(d.x)-6);assert.deepEqual(result.rows[r].slice(1).map(Number),d.wells);});for(const q of result.provenance.series.slice(1))for(const d of q.doses)for(const w of d.wells)assert(result.script.includes('\n'+w+'\n'));
 await page.locator('#cypaGraphMode').selectOption('pooled');await page.locator('#cypaPrismGraph').click();await page.waitForFunction(()=>document.querySelector('#cypaPrismStatus').textContent.includes('48 observations'));assert(!await page.locator('#cypaPrismGraph').isDisabled());
 await page.locator('#cypaGraphMode').selectOption('individual');await page.setViewportSize({width:390,height:844});
 await page.locator('#cypaPrismGraph').scrollIntoViewIfNeeded();const box=await page.locator('#cypaPrismGraph').boundingBox();assert(box.x>=0&&box.x+box.width<=391);
 await download('#cypaPrismGraph');await page.screenshot({path:'/tmp/atlas-prism-mobile.png'});
 // Failed asset fetch produces a useful message and restores the button.
 await page.route('**/assets/prism/atlas-empty.prism',route=>route.fulfill({status:503,body:'unavailable'}));await page.locator('#cypaPrismGraph').click();await page.waitForFunction(()=>document.querySelector('#cypaPrismStatus').textContent.includes('could not be loaded'));assert(!await page.locator('#cypaPrismGraph').isDisabled());
 assert.deepEqual(errors,[]);console.log('PASS: desktop/mobile native ZIP downloads; selected compounds and original plate labels; biological means; exact input serialization; applied manual axes; normalized/corrected labels; pooled limit and fetch error recovery.');
}finally{await browser?.close();server.kill();}})().catch(e=>{console.error(e);process.exitCode=1;});
