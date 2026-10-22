const {chromium}=require('playwright-core');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),base=process.env.ATLAS_TEST_URL||'http://127.0.0.1:4173/';
const four=['RMC-0731503-001','RMC-0732395-001','RMC-0740660-001','RMC-0740668-001'];
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const metadata=()=>page.locator('#runGraph svg metadata').evaluate(el=>JSON.parse(el.textContent));
  const selected=()=>page.locator('[data-run-remove]').evaluateAll(es=>es.map(e=>e.dataset.runRemove));
  for(const width of [1440,390]){
   await page.setViewportSize({width,height:1000});
   await page.goto(base+'?view=overview&experiment=EXP26003438&replicate=2&condition=B&cmax=120&includeReference=false');
   await page.locator('#potencySummary [data-overview-band="le1"]').click();
   assert.equal(await page.locator('#graphOverviewList').innerText(),'Graph these compounds (4)');
   await page.locator('#graphOverviewList').click();await page.locator('#runGraph svg').waitFor();
   assert.deepEqual(await selected(),four);assert.equal(await page.locator('#runAssay').inputValue(),'d1');assert.equal(await page.locator('#runCondition').inputValue(),'A');
   assert((await page.locator('#runSelectionNote').innerText()).includes('no biological replicate assignment'));
   const meta=await metadata();assert.equal(meta.curves.length,4);
   const source=JSON.parse(fs.readFileSync(path.join(root,'cyclind1-bio2-A.json'),'utf8'));
   for(const q of meta.curves){
    assert(four.includes(q.compound));assert.equal(q.biological_replicate,2);assert.equal(q.condition,'No CypA inhibitor');
    const expected=source.curves.find(v=>v.compound===q.compound);
    const doses=await page.locator('#runGraph [data-run-series]').evaluateAll((es,id)=>[...es.find(e=>e.dataset.runSeries===id).querySelectorAll('[data-dose]')].map(d=>[Number(d.dataset.dose),Number(d.dataset.mean),d.dataset.sd===''?null:Number(d.dataset.sd)]),q.series_id);
    assert.deepEqual(doses,expected.doses.map(d=>[d.x,d.mean,d.sd]));
   }
   const wait=page.waitForEvent('download');await page.locator('#runSVG').click();const exported=fs.readFileSync(await (await wait).path(),'utf8');for(const id of four)assert(exported.includes(id));
   await page.locator('#runSearch').fill('0741051');await page.locator('#runAdd').click();assert.equal((await selected()).length,5,'Adding a fifth compound is not blocked by the old three-compound limit');
   await page.locator('nav [data-view="overview"]').click();await page.locator('#overviewListSearch').fill('0668');
   assert.equal(await page.locator('#graphOverviewList').innerText(),'Graph these compounds (1)');await page.locator('#graphOverviewList').click();await page.waitForFunction(()=>document.querySelectorAll('[data-run-remove]').length===1);assert.deepEqual(await selected(),['RMC-0740668-001']);
   await page.locator('nav [data-view="overview"]').click();await page.locator('#overviewListSearch').fill('not-a-compound');assert(await page.locator('#graphOverviewList').isDisabled());
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  }
  await page.goto(base+'?view=overview&experiment=EXP26003438&replicate=1&condition=B&cmax=120&includeReference=false');
  await page.locator('#potencyRefitSummary [data-overview-band="le1"]').click();const refitIDs=await page.locator('#overviewListTable [data-compound]').evaluateAll(es=>es.map(e=>e.dataset.compound));
  await page.locator('#graphOverviewList').click();await page.locator('#runGraph svg').waitFor();assert.deepEqual(await selected(),refitIDs);assert.equal(await page.locator('#runCondition').inputValue(),'B');assert((await metadata()).curves.every(q=>q.biological_replicate===1&&q.condition==='+25 µM CypA inhibitor'));
  await page.goto(base+'?view=overview&experiment=EXP26007301&replicate=2&cmax=120&includeReference=false');
  await page.locator('#potencySummary [data-overview-target="Cyclin D3"][data-overview-band="le1"]').click();
  const visible=await page.locator('#overviewListTable [data-compound]').evaluateAll(es=>es.map(e=>e.dataset.compound));assert(visible.includes('RMC-0732120-002'));
  await page.locator('#graphOverviewList').click();await page.locator('#runGraph svg').waitFor();assert.deepEqual(await selected(),visible);assert.equal(await page.locator('#runTarget').inputValue(),'Cyclin D3');
  const meta=await metadata();assert.deepEqual([...new Set(meta.curves.map(q=>q.compound))].sort(),[...visible].sort());assert(meta.curves.every(q=>q.biological_replicate===2));
  assert.deepEqual(errors,[]);console.log('PASS overview → workspace: all four exact D1 batches, GDS/refit distinction, correct condition/run and source doses, SVG export, fifth compound, filtered/empty lists, selectivity target and batch002, desktop/mobile');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
