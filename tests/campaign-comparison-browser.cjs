const {chromium}=require('playwright-core'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..'),identity=require('../selectivity-identity.js'),base='http://127.0.0.1:4188/';
const read=f=>JSON.parse(fs.readFileSync(path.join(root,f),'utf8')),d1=read('cyclind1-source-parameters.json');
function csv(text){const out=[];let row=[],v='',quoted=false;for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){v+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){row.push(v);v='';}else if(c==='\n'&&!quoted){row.push(v.replace(/\r$/,''));out.push(row);row=[];v='';}else v+=c;}row.push(v);out.push(row);return out;}
(async()=>{let browser;const server=spawn('python3',['-m','http.server','4188','--bind','127.0.0.1'],{cwd:root,stdio:'ignore'});
try{
 for(let i=0;i<50;i++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 async function ready(){await page.locator('[data-comparison-compound]').first().waitFor();await page.waitForFunction(()=>!document.querySelector('#exportCampaignComparison').disabled);}
 for(const rep of [1,2]){
  await page.goto(base+`?view=overview&experiment=EXP26007301&replicate=${rep}&referencePlate=2`);await page.locator('#potencySummary table').waitFor();
  const buttons=page.locator('#potencySummary [data-overview-basis="gds"]'),n=await buttons.count(),data=identity.prepare(read(rep===1?'sample.json':'selectivity-rep2.json'),{referencePlate:'2'});
  for(let i=0;i<n;i++){
   await buttons.nth(i).click();const expectedIDs=await page.locator('#overviewListTable [data-compound]').evaluateAll(es=>es.map(e=>e.dataset.compound));
   if(await page.locator('#compareD1Campaign').getAttribute('aria-expanded')==='false')await page.locator('#compareD1Campaign').click();await ready();
   assert.deepEqual(await page.locator('[data-comparison-compound]').evaluateAll(es=>es.map(e=>e.dataset.comparisonCompound)),expectedIDs);
   const pending=page.waitForEvent('download');await page.locator('#exportCampaignComparison').click();const [headers,...records]=csv(fs.readFileSync(await (await pending).path(),'utf8').replace(/^\uFEFF/,''));assert.equal(records.length,expectedIDs.length);
   for(let j=0;j<records.length;j++){
    const r=Object.fromEntries(headers.map((h,k)=>[h,records[j][k]])),id=expectedIDs[j],q=data.curves.find(q=>q.compound===id&&q.target===r.selectivity_target),right=d1.find(q=>q.compound===id);
    assert.equal(r.selectivity_compound,id);assert.equal(Number(r.selectivity_cmax),q.cmax);assert.equal(Number(r.selectivity_ec50_um),q.report.ec50);assert.equal(r.selectivity_qualifier.replace(/^'/,''),q.report.qualifier);assert.equal(r.selectivity_biological_replicate,String(rep));assert.equal(r.selectivity_source_compound,q.source_compound);assert.equal(r.selectivity_physical_plate,q.physical_plate);
    assert.equal(r.cyclind1_biological_replicate,'');assert.equal(r.cyclind1_run_date,'');assert.equal(r.cyclind1_condition,'No CypA inhibitor');
    if(right){assert.equal(Number(r.cyclind1_cmax),right.cmax);assert.equal(Number(r.cyclind1_ec50_um),right.ec50);assert.equal(r.cyclind1_qualifier.replace(/^'/,''),right.qualifier);assert.equal(r.cyclind1_source_qc,right.source_qc);assert.equal(r.cyclind1_source,right.source);assert.equal(Number(r.cyclind1_source_row),right.source_row);}else{assert.equal(r.cyclind1_cmax,'');assert.equal(r.cyclind1_ec50_um,'');}
   }
  }
  console.log(`PASS replicate ${rep}: every GDS band compares and exports exactly the visible list, preserving values, qualifiers, QC, dates, batch and reference plate labels`);
 }
 await page.locator('[data-overview-basis="gds"][data-overview-target="Cyclin D3"][data-overview-band="le1"]').click();await ready();
 assert.equal(await page.locator('[data-comparison-compound]').count(),17);
 await page.locator('#overviewListSearch').fill('0732120');await ready();assert.equal(await page.locator('[data-comparison-compound]').count(),1);assert.match(await page.locator('#campaignComparisonTable').innerText(),/Different batch only/);assert.match(await page.locator('#campaignComparisonTable').innerText(),/RMC-0732120-001/);assert.match(await page.locator('#campaignComparisonTable').innerText(),/Unavailable/);
 const single=page.waitForEvent('download');await page.locator('#exportCampaignComparison').click();assert.equal(csv(fs.readFileSync(await (await single).path(),'utf8')).length,2);
 await page.locator('#overviewListSearch').fill('unknown');await page.waitForFunction(()=>document.querySelector('#campaignComparisonCount').textContent.includes('0 of 0'));assert(await page.locator('#exportCampaignComparison').isDisabled());assert.equal(await page.locator('[data-comparison-compound]').count(),0);
 await page.locator('#overviewListSearch').fill('');await ready();
 for(const width of [1440,390,320]){
  await page.setViewportSize({width,height:900});await page.waitForTimeout(250);await ready();await page.locator('#campaignComparisonHeading').scrollIntoViewIfNeeded();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.screenshot({path:`/tmp/campaign-comparison-${width}.png`});
 }
 await page.locator('#campaignComparisonTable [data-compound]').first().click();assert(await page.locator('#curves').isVisible());await page.locator('nav [data-view="overview"]').click();await ready();
 await page.locator('#compareD1Campaign').click();assert(!(await page.locator('#campaignComparison').isVisible()));assert(await page.locator('#overviewListTable').isVisible());assert(await page.locator('#exportOverviewList').isVisible());
 await page.locator('#potencyRefitSummary .potency-count').first().click();assert(await page.locator('#compareD1Campaign').isHidden());assert(await page.locator('#campaignComparison').isHidden());
 await page.locator('#studySelect').selectOption('EXP26003438');await page.locator('#potencySummary .potency-count').first().click();assert(await page.locator('#compareD1Campaign').isHidden());
 assert.deepEqual(errors,[]);console.log('PASS: 17-compound screenshot journey, explicit batch mismatch, missing data, filtered export, desktop/mobile layouts, curve navigation and source separation');
}finally{await browser?.close();server.kill();}})().catch(e=>{console.error(e);process.exitCode=1;});
