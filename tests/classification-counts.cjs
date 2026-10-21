// Verify count drilldowns against supplied classifications, preserving batch/plate identities.
const {chromium}=require('playwright-core'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process');
const identity=require('../selectivity-identity.js'),root=path.resolve(__dirname,'..'),base='http://127.0.0.1:4187/';
const read=f=>JSON.parse(fs.readFileSync(path.join(root,f),'utf8'));
(async()=>{const server=spawn('python3',['-m','http.server','4187','--bind','127.0.0.1'],{cwd:root,stdio:'ignore'});let browser;
try{
 for(let i=0;i<50;i++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const rep of [1,2])for(const plate of [1,2]){
  const raw=read(rep===1?'sample.json':'selectivity-rep2.json'),data=identity.prepare(raw,{referencePlate:String(plate)}),qs=data.curves;
  assert.equal(raw.compounds.length,28);assert.equal(data.compounds.length,27);
  await page.goto(base+`?view=overview&experiment=EXP26007301&replicate=${rep}&referencePlate=${plate}`);await page.locator('.source-classification-panel').waitFor();
  assert.match(await page.locator('.classification-identity').innerText(),/RMC-0769903-001 and RMC-0769904-001/);
  const modes=[...new Set(qs.map(q=>q.report?.source_mode||'Not reported'))].sort(),inc=qs.filter(q=>q.report?.source_mode==='increasing');
  const selections=[qs,inc,inc,qs,...data.targets.flatMap(t=>[...modes.map(m=>qs.filter(q=>q.target===t&&q.report?.source_mode===m)),qs.filter(q=>q.target===t)]),...modes.map(m=>qs.filter(q=>q.report?.source_mode===m)),qs];
  const buttons=page.locator('[data-classification-count]');assert.equal(await buttons.count(),selections.length);
  for(let i=0;i<selections.length;i++){
   const expected=selections[i],ids=[...new Set(expected.map(q=>q.compound))].sort();
   const number=Number(await buttons.nth(i).innerText());assert.equal(number,[0,2,3].includes(i)?ids.length:expected.length);
   await buttons.nth(i).click();assert(await page.locator('#classificationList').isVisible());
   assert.deepEqual(await page.locator('[data-classification-compound]').evaluateAll(es=>es.map(e=>e.dataset.classificationCompound)),ids);
   const got=await page.locator('.classification-result').evaluateAll(es=>es.map(e=>[e.closest('[data-classification-compound]').dataset.classificationCompound,e.dataset.classificationTarget,e.dataset.classificationMode]));
   assert.deepEqual(got,expected.slice().sort((a,b)=>a.compound.localeCompare(b.compound)).map(q=>[q.compound,q.target,q.report?.source_mode||'Not reported']));
  }
  await page.locator('#classificationSearch').fill('990');assert.equal(await page.locator('[data-classification-compound]').count(),2);
  await page.locator('#classificationSearch').fill('0741051');assert.equal(await page.locator('[data-classification-compound]').count(),1);
  assert.match(await page.locator('#classificationListTable td:last-child').innerText(),new RegExp('RMC-0741051-00'+plate));
  await page.locator('#classificationSearch').fill('unknown');assert.equal(await page.locator('[data-classification-compound]').count(),0);
  await page.locator('#classificationSearch').fill('9903');await page.locator('#classificationListTable [data-compound]').click();assert.equal(await page.locator('#compoundBatch').inputValue(),'RMC-0769903-001');
  await page.locator('nav [data-view="overview"]').click();assert.equal(await page.locator('#classificationSearch').inputValue(),'9903');
  await page.locator('#closeClassificationList').click();assert(!(await page.locator('#classificationList').isVisible()));assert.equal(await page.locator('[data-classification-count][aria-expanded=true]').count(),0);
  console.log(`PASS replicate ${rep}, reference plate ${plate}: every count, exact compound and target lists, both analogs, preserved reference label, search and curve navigation`);
 }
 // Rebuilding for a new run must clear the old classification list.
 await page.locator('[data-classification-count]').first().click();await page.locator('#selectivityReplicate').selectOption('1');await page.waitForFunction(()=>document.querySelector('.source-classification-panel').textContent.includes('Replicate 1'));
 assert(!(await page.locator('#classificationList').isVisible()));
 for(const width of [1440,390,320]){
  await page.setViewportSize({width,height:900});await page.waitForTimeout(250);await page.locator('[data-classification-count]').nth(2).click();
  await page.locator('#classificationSearch').fill('990');await page.locator('#classificationSearch').focus();await page.setViewportSize({width,height:850});await page.waitForTimeout(250);
  assert.equal(await page.locator('#classificationSearch').inputValue(),'990');assert.equal(await page.evaluate(()=>document.activeElement.id),'classificationSearch');
  assert.equal(await page.locator('[data-classification-compound]').count(),2);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.screenshot({path:`/tmp/classification-list-${width}.png`});
 }
 await page.goto(base+'?view=overview&experiment=EXP26007104&replicate=2');await page.locator('.source-classification-panel').waitFor();
 assert.match(await page.locator('.source-classification-panel h2').innerText(),/configuration/);await page.locator('[data-classification-count]').first().click();assert.equal(await page.locator('[data-classification-compound]').count(),14);
 assert.deepEqual(errors,[]);console.log('PASS mobile layouts, resize/search persistence, run changes and orientation configurations');
}finally{await browser?.close();server.kill();}})().catch(e=>{console.error(e);process.exitCode=1;});
