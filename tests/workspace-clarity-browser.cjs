const {chromium}=require('playwright-core'),{spawn}=require('node:child_process'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'..'),base='http://127.0.0.1:4662/';
(async()=>{const server=spawn('python3',['-m','http.server','4662','--bind','127.0.0.1'],{cwd:root,stdio:'ignore'});let browser;
try{
 for(let i=0;i<50;i++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({acceptDownloads:true,viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'#compound-response');await page.locator('#runSearch').waitFor();
 assert(await page.locator('#runFitReview').isHidden(),'Neutral workspace must not imply any fitted result');
 await require('./select-workspace.cjs')(page);
 const before=await page.locator('#runGraph metadata').textContent();
 const expected=await page.locator('#runGraph metadata').evaluate(el=>{const q=JSON.parse(el.textContent).curves;return {count:q.length,flagged:q.filter(v=>v.fit_flags?.length).length};});
 assert.match(await page.locator('#runFitReview').innerText(),new RegExp('of '+expected.count+' series'));
 await page.locator('[data-review-fits]').click();assert.equal(await page.locator('#runTab-activity').getAttribute('aria-selected'),'true');assert(await page.locator('#runParameters').isVisible());
 await page.locator('#runTab-graph').click();assert.equal(await page.locator('#runGraph metadata').textContent(),before,'Review navigation does not alter scientific outputs');
 await page.locator('#runStyle').selectOption('measured');assert.match(await page.locator('#runFitReview').innerText(),/No 4PL curves are displayed/);assert.equal(await page.locator('[data-review-fits]').count(),0);
 const guide=page.locator('#runPane-graph .prism-export-guide');await guide.locator('summary').click();
 for(const phrase of ['tables only','always creates 4PL','fits can differ','SD versus SEM'])assert((await guide.innerText()).includes(phrase));
 const downloadWait=page.waitForEvent('download');await page.locator('#runPrismGraph').click();await downloadWait;
 const receipt=page.locator('#runPrismStatus');await receipt.locator('ol').waitFor();const instructions=await receipt.innerText();
 for(const phrase of ['Atlas_Prism 9','does not belong inside','Atlas_Result.prism','intermediate file'])assert(instructions.includes(phrase));
 await receipt.locator('summary').click();const launcherWait=page.waitForEvent('download');await receipt.locator('[data-prism-mac-launcher]').click();assert.equal((await launcherWait).suggestedFilename(),'Atlas_Mac_Launcher.zip');
 for(const width of [1440,390,320]){await page.setViewportSize({width,height:900});await receipt.scrollIntoViewIfNeeded();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No page overflow at '+width);}
 await page.setViewportSize({width:1440,height:1000});await page.locator('#runMode').selectOption('summary');await page.locator('#runStyle').selectOption('both');
 assert.match(await page.locator('#runFitReview').innerText(),/one displayed mean per concentration/);
 await page.locator('#runSelectionDetails').evaluate(el=>el.open=true);
 for(const key of ['sel-2-1','sel-2-2'])await page.locator('[data-run-choice="'+key+'"]').uncheck();
 assert.match(await page.locator('#runFitReview').innerText(),/fewer than two biological runs/);
 const synthetic=await page.evaluate(()=>AtlasGraphOptions.fitSummary([{series_label:'<script>unsafe</script>',fit:null,fit_flags:['<bad>'],doses:[{n:1}]}],'summary','both'));
 assert(synthetic.includes('0 of 1'));assert(synthetic.includes('1 have warnings'));assert(synthetic.includes('no fitted EC50'));assert(synthetic.includes('&lt;script&gt;'));assert(!synthetic.includes('<script>'));
 await page.locator('#runGraph').scrollIntoViewIfNeeded();await page.screenshot({path:'/tmp/atlas-clarity-workspace.png'});
 assert.deepEqual(errors,[]);console.log('PASS: neutral state, fit-status navigation and missing/flagged fits, measured-only explanation, export-choice caveats, actual package and reusable launcher download, folder guidance, single-run summary warning, escaped labels, 1440/390/320px layout; graph metadata unchanged by review navigation');
}finally{await browser?.close();server.kill();}})().catch(e=>{console.error(e);process.exitCode=1;});
