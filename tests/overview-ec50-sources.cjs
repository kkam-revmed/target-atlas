// Regression journeys use only the supplied JSON files; no fits or measurements are generated.
const {chromium}=require('playwright-core');
const {spawn}=require('node:child_process');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=name=>JSON.parse(fs.readFileSync(path.join(root,name),'utf8'));
const source=read('cyclind1-source-parameters.json');
const base='http://127.0.0.1:4177/';
function band(v,op='='){
 if(!Number.isFinite(v)||v<=0)return 'unreported';
 for(const b of [1,3,10])if(Math.abs(v-b)<=1e-7*b)v=b;
 if(op===''||op==='=')return v<=1?'le1':v<=3?'one3':v<=10?'three10':'gt10';
 if(['>','>=','≥'].includes(op))return v>10||v===10&&op==='>'?'gt10':'unresolved';
 if(['<','<=','≤'].includes(op))return v<=1?'le1':'unresolved';
 return 'unresolved';
}
function csv(text){return text.replace(/^\uFEFF/,'').split(/\r?\n/).map(line=>{const out=[];let value='',quote=false;for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'){if(quote&&line[i+1]==='"'){value+='"';i++;}else quote=!quote;}else if(c===','&&!quote){out.push(value);value='';}else value+=c;}out.push(value);return out;});}
(async()=>{
 const server=spawn('python3',['-m','http.server','4177','--bind','127.0.0.1'],{cwd:root,stdio:'ignore'});let browser;
 try{
  for(let i=0;i<50;i++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const goto=async(rep,condition)=>{await page.goto(base+`?view=overview&experiment=EXP26003438&replicate=${rep}&condition=${condition}&cmax=120&ec50=all&includeReference=false`);await page.locator('#potencySummary table').waitFor();};
  await goto(2,'B');
  assert.deepEqual(await page.locator('#d1Replicate option').allTextContents(),['Replicate 1 · 2 Sep 2026','Replicate 2 · 3 Sep 2026','Compare replicates 1 & 2']);
  const counts=async id=>page.locator(id+' tbody td').evaluateAll(els=>els.map(e=>Number((e.querySelector('button')||e.querySelector('span')).textContent)));
  assert.deepEqual(await counts('#potencySummary'),[4,35,104,47,0,0]);
  assert.deepEqual(await counts('#potencyRefitSummary'),[16,36,31,47,0]);
  assert.match(await page.locator('#potencyGdsContext').innerText(),/Replicate not identified.*No CypA inhibitor/);
  assert.match(await page.locator('#potencyRefitContext').innerText(),/Replicate 2.*2026-09-03.*130.*116/);
  let exportRows=0;
  for(const basis of ['gds','refit']){
   const supplied=basis==='gds'?source:read('cyclind1-bio2-B.json').curves;
   const active=supplied.filter(q=>!q.is_reference&&(basis==='gds'?q.cmax:q.peak_mean)>120);
   for(const key of ['le1','one3','three10','gt10','unreported','unresolved']){
    const expected=active.filter(q=>band(basis==='gds'?q.ec50:q.fit?.ec50,basis==='gds'?q.qualifier:'=')===key).sort((a,b)=>a.compound.localeCompare(b.compound));
    const button=page.locator(`[data-overview-basis="${basis}"][data-overview-band="${key}"]`);
    if(!expected.length){assert.equal(await button.count(),0);continue;}
    assert.equal(Number(await button.innerText()),expected.length);await button.click();
    assert.deepEqual(await page.locator('#overviewListTable [data-compound]').evaluateAll(els=>els.map(e=>e.dataset.compound)),expected.map(q=>q.compound));
    const pending=page.waitForEvent('download');await page.locator('#exportOverviewList').click();const download=await pending;
    const [headers,...rows]=csv(fs.readFileSync(await download.path(),'utf8'));assert.equal(rows.length,expected.length);exportRows+=rows.length;
    for(let i=0;i<rows.length;i++){
     const got=Object.fromEntries(headers.map((h,j)=>[h,rows[i][j]])),q=expected[i];assert.equal(got.compound,q.compound);
     assert.equal(Number(got.cmax),basis==='gds'?q.cmax:q.peak_mean);
     assert.equal(Number(got[basis==='gds'?'reported_ec50_um':'independent_refit_ec50_um']),basis==='gds'?q.ec50:q.fit.ec50);
     assert.equal(got.biological_replicate,basis==='gds'?'':'2');assert.equal(got.run_date,basis==='gds'?'':'2026-09-03');
     assert.equal(got.condition.replace(/^'/,''),basis==='gds'?'No CypA inhibitor':read('cyclind1-bio2-B.json').condition_label);
     assert.equal(got.source_file,basis==='gds'?q.source:q.sources.join('; '));
     if(basis==='gds'){assert.equal(got.reported_ec50_qualifier.replace(/^'/,''),q.qualifier);assert.equal(Number(got.source_row),q.source_row);assert.equal(got.source_qc,q.source_qc||'');assert(!headers.includes('independent_refit_ec50_um'));}
     else{assert.equal(got.independent_refit_flags,q.fit_flags.join('; '));assert(!headers.includes('reported_ec50_um'));}
    }
   }
  }
  assert.equal(exportRows,320);
  await page.locator('[data-overview-basis="refit"][data-overview-band="one3"]').click();
  const wanted=await page.locator('#overviewListTable [data-compound]').first().getAttribute('data-compound');
  await page.locator('#overviewListSearch').fill(wanted);
  assert.equal(await page.locator('#overviewListTable [data-compound]').count(),1);
  const selected=page.waitForEvent('download');await page.locator('#exportOverviewList').click();const d=await selected;const selectedCSV=csv(fs.readFileSync(await d.path(),'utf8'));assert.equal(selectedCSV.length,2);assert.equal(selectedCSV[1][selectedCSV[0].indexOf('compound')],wanted);
  for(const [rep,condition,expected] of [[1,'A',[10,71,63,52,0]],[1,'B',[12,68,63,42,0]],[2,'A',[21,49,47,82,0]]]){
   await goto(rep,condition);assert.deepEqual(await counts('#potencySummary'),[4,35,104,47,0,0]);assert.deepEqual(await counts('#potencyRefitSummary'),expected);
  }
  await goto(2,'B');
  const data=read('cyclind1-bio2-B.json');
  await page.locator('#threshold').fill('150');await page.locator('#threshold').dispatchEvent('input');
  await page.waitForFunction(()=>document.querySelector('#potencyRefitContext').textContent.includes('> 150'));
  assert.equal((await counts('#potencyRefitSummary')).reduce((a,b)=>a+b,0),data.curves.filter(q=>!q.is_reference&&q.peak_mean>150).length);
  await page.locator('#includeReference').check();assert.equal((await counts('#potencyRefitSummary')).reduce((a,b)=>a+b,0),data.curves.filter(q=>q.peak_mean>150).length);
  // Real source types with qualified and missing values remain distinct from independent fits.
  for(const url of ['?view=overview&experiment=EXP26007301&replicate=1&referencePlate=2','?view=overview&experiment=EXP26007104&replicate=2&response=ratio']){
   await page.goto(base+url);await page.locator('#potencySummary table').waitFor();assert(await page.locator('#potencyRefitSummary table').count());assert.equal(await page.locator('#overviewCompoundList').isVisible(),false);
  }
  await goto(2,'B');
  for(const width of [390,320]){
   await page.setViewportSize({width,height:844});await page.waitForTimeout(300);
   await page.locator('[data-overview-basis="refit"][data-overview-band="one3"]').click();assert.match(await page.locator('#overviewListCount').innerText(),/36 of 36/);
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   if(process.env.ATLAS_SCREENSHOT&&width===320)await page.locator('.potency-panel').screenshot({path:process.env.ATLAS_SCREENSHOT.replace('.png','-mobile.png')});
  }
  if(process.env.ATLAS_SCREENSHOT){await page.setViewportSize({width:1440,height:1200});await page.locator('#closeOverviewList').click();assert.equal(await page.locator('.potency-table .selected-band').count(),0);await page.locator('.potency-panel').screenshot({path:process.env.ATLAS_SCREENSHOT});}
  assert.deepEqual(errors,[]);console.log('PASS: source-separated counts, all four runs, reference/cutoff controls, exact lists and 320 CSV records, selected-only CSV, GDS bounds, other studies, desktop/mobile and replicate labels');
 }finally{if(browser)await browser.close();server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
