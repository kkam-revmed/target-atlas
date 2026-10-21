// Browser journeys use supplied repository records, including the documented reference-plate exception.
const {chromium}=require('playwright-core'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..'),base='http://127.0.0.1:4186/';
(async()=>{const server=spawn('python3',['-m','http.server','4186','--bind','127.0.0.1'],{cwd:root,stdio:'ignore'});let browser;
try{
 for(let i=0;i<50;i++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage']});
 for(const width of [1440,390,320]){
  const page=await browser.newPage({viewport:{width,height:1000},acceptDownloads:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'?view=curves&experiment=EXP26003438&replicate=1&condition=B');await page.locator('#curveGrid svg').first().waitFor();
  await page.locator('#compareCompoundGraphs').click();await page.locator('#graphCards svg').waitFor();
  await page.locator('#graphClear').click();assert.equal(await page.locator('#graphCards svg').count(),0);
  const supplied=JSON.parse(fs.readFileSync(path.join(root,'cyclind1.json'),'utf8')),ids=supplied.compounds.slice(0,7);
  const partialMatches=[...new Set(supplied.compounds.filter(id=>id.includes('051')).map(id=>id.replace(/-\d{3,}$/,'')))].sort();
  await page.locator('#graphSearch').pressSequentially('051');
  assert(await page.locator('#graphSuggestions').isVisible());
  assert.deepEqual(await page.locator('[data-graph-suggestion]').evaluateAll(es=>es.map(e=>e.dataset.graphSuggestion)),partialMatches);
  assert.equal(await page.evaluate(()=>document.activeElement.id),'graphSearch');
  const popup=await page.locator('#graphSuggestions').boundingBox();assert(popup.x>=0&&popup.x+popup.width<=width+1);
  await page.screenshot({path:'/tmp/compound-suggestions-'+width+'.png'});
  await page.locator('[data-graph-suggestion="RMC-0741051"]').click();
  assert.equal(await page.locator('#graphCompound').inputValue(),'RMC-0741051');
  assert.equal(await page.locator('#graphBatch').inputValue(),'RMC-0741051-001');
  assert(!(await page.locator('#graphSuggestions').isVisible()));
  await page.locator('#graphAdd').click();assert.equal(await page.locator('[data-graph-compound]').first().getAttribute('data-graph-compound'),'RMC-0741051-001');
  await page.locator('#graphClear').click();
  await page.locator('#graphSearch').fill('051');await page.locator('#graphSearch').press('ArrowDown');
  assert.equal(await page.locator('#graphSearch').getAttribute('aria-activedescendant'),'graphSuggestion0');
  await page.locator('#graphSearch').press('Enter');assert.equal(await page.locator('#graphCompound').inputValue(),partialMatches[0]);
  assert(!(await page.locator('#graphSuggestions').isVisible()));
  await page.locator('#graphSearch').fill('051');await page.locator('#graphSearch').press('Escape');
  assert.equal(await page.locator('#graphSearch').inputValue(),'051');assert(!(await page.locator('#graphSuggestions').isVisible()));
  await page.locator('#graphSearch').fill('unknown-id');assert.equal(await page.locator('[data-graph-suggestion]').count(),0);assert(await page.locator('#graphAdd').isDisabled());
  await page.locator('#graphSearch').fill('');assert(!(await page.locator('#graphSuggestions').isVisible()));
  async function add(id){await page.locator('#graphSearch').fill(id.toLowerCase());await page.locator('#graphAdd').click();}
  await add(ids[0]);await add(ids[1]);await add(ids[2]);
  assert(await page.locator('#graphAdd').isDisabled(),'duplicate selection must be disabled');
  await page.locator('#graphSearch').fill('not-an-rmc');assert(await page.locator('#graphAdd').isDisabled());assert.equal(await page.locator('.graph-chip').count(),3);
  await page.locator('#graphSearch').fill('RMC-');assert(await page.locator('#graphAdd').isDisabled(),'ambiguous search requires a choice');
  async function checkPoints(file,selected){
   const data=JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
   const got=await page.locator('[data-graph-compound]').evaluateAll(es=>es.map(e=>({id:e.dataset.graphCompound,points:[...e.querySelectorAll('[data-dose]')].map(p=>({x:+p.dataset.dose,mean:+p.dataset.mean,sd:p.dataset.sd===''?null:+p.dataset.sd}))})));
   assert.deepEqual(got,selected.map(id=>({id,points:data.curves.find(q=>q.compound===id).doses.filter(d=>d.x>0&&Number.isFinite(d.mean)).map(d=>({x:d.x,mean:d.mean,sd:d.sd??null})).sort((a,b)=>a.x-b.x)})));
  }
  await checkPoints('cyclind1.json',ids.slice(0,3));
  assert.equal(await page.locator('#graphStyle').inputValue(),'4pl');
  assert.equal(await page.locator('[data-series="independent-fit"]').count(),3);
  assert.equal(await page.locator('[data-series="dose-means"]').count(),0);
  await page.locator('#graphStyle').selectOption('measured');
  assert.equal(await page.locator('[data-series="independent-fit"]').count(),0);
  assert.equal(await page.locator('[data-series="dose-means"]').count(),3);
  await page.locator('#graphStyle').selectOption('both');
  assert.equal(await page.locator('[data-series="dose-means"]').count(),3);
  assert.equal(await page.locator('[data-series="independent-fit"][stroke-dasharray]').count(),3);
  const bothPending=page.waitForEvent('download');await page.locator('[data-format="svg"]').click();const bothSVG=fs.readFileSync(await (await bothPending).path(),'utf8');assert(bothSVG.includes('Solid lines connect measured means; dashed lines show existing independent 4PL fits.'));
  await page.locator('#graphStyle').selectOption('4pl');assert.equal(await page.locator('[data-series="independent-fit"]').count(),3);
  await page.locator('#graphWells').check();assert(await page.locator('[data-series="well"]').count()>0);
  const pending=page.waitForEvent('download');await page.locator('[data-format="svg"]').click();const svg=fs.readFileSync(await (await pending).path(),'utf8');
  const meta=await page.evaluate(svg=>JSON.parse(new DOMParser().parseFromString(svg,'image/svg+xml').querySelector('metadata').textContent),svg);
  assert.deepEqual(meta.selected_batches,ids.slice(0,3));assert.equal(meta.benchling_id,'EXP26003438');assert.match(meta.context,/Replicate 1/);assert.match(meta.context,/\+25 µM/);
  for(const id of ids.slice(0,3)){assert(svg.includes(id));assert(meta.curves.find(q=>q.compound===id).source.includes('EXP26003438_CyclinD1_well_export.xlsx'));}
  assert.equal(meta.line_basis,'Existing independent 4PL fit');
  for(const q of supplied.curves.filter(q=>ids.slice(0,3).includes(q.compound)))assert.deepEqual(meta.curves.find(c=>c.compound===q.compound).independent_4pl,{ec50_um:q.fit.ec50,baseline:q.fit.s0,plateau:q.fit.sinf,hill_slope:q.fit.hill,r2:q.fit.r2});
  assert(svg.includes('Solid lines: existing independent 4PL fits'));
  assert(svg.includes('Independent-fit warnings'));assert(!svg.includes(ids[3]));
  const pngWait=page.waitForEvent('download');await page.locator('[data-format="png"]').click();const png=fs.readFileSync(await (await pngWait).path());assert.equal(png.subarray(1,4).toString(),'PNG');assert.equal(png.readUInt32BE(16),1600);
  const before=await page.locator('#graphCards svg').evaluate(e=>e.outerHTML);await page.locator('#graphSearch').fill('070');await page.locator('#graphSearch').focus();await page.setViewportSize({width,height:700});await page.waitForTimeout(350);assert.equal(await page.locator('#graphCards svg').evaluate(e=>e.outerHTML),before);assert.equal(await page.locator('#graphSearch').inputValue(),'070');assert.equal(await page.evaluate(()=>document.activeElement.id),'graphSearch');
  await page.locator(`[data-graph-remove="${ids[1]}"]`).click();await checkPoints('cyclind1.json',[ids[0],ids[2]]);
  await page.locator('#d1Replicate').selectOption('2');await page.waitForFunction(()=>document.querySelector('#graphCards metadata')?.textContent.includes('Replicate 2'));
  await checkPoints('cyclind1-bio2-B.json',[ids[0],ids[2]]);
  await page.locator('#d1Condition').selectOption('A');await page.waitForFunction(()=>document.querySelector('#graphCards metadata')?.textContent.includes('No CypA inhibitor'));
  await checkPoints('cyclind1-bio2-A.json',[ids[0],ids[2]]);
  for(const id of [ids[1],ids[3],ids[4],ids[5]])await add(id);assert.equal(await page.locator('.graph-chip').count(),6);await page.locator('#graphSearch').fill(ids[6]);assert(await page.locator('#graphAdd').isDisabled());
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.screenshot({path:'/tmp/compound-graphs-'+width+'.png',fullPage:true});
  await page.goto(base+'?view=compoundGraphs&experiment=EXP26007301&replicate=2&referencePlate=2');await page.locator('#graphSearch').waitFor();await page.locator('#graphClear').click();await add('RMC-0741051-001');
  assert.equal(await page.locator('#graphCards svg').count(),4);
  const sourceMetadata=await page.locator('#graphCards metadata').first().textContent();assert(sourceMetadata.includes('RMC-0741051-002'),'original plate-2 label preserved');assert(sourceMetadata.includes('RMC-0741051-001'),'same batch identity preserved');
  await page.locator('#graphSearch').fill('RMC-0741051-002');assert(await page.locator('#graphAdd').isDisabled(),'reference source label must not appear as a second batch');
  const target=await page.locator('#graphTarget option').nth(1).textContent();await page.locator('#graphTarget').selectOption(target);assert.equal(await page.locator('#graphCards svg').count(),1);
  await page.goto(base+'?view=compoundGraphs&experiment=EXP26007104&replicate=2&response=ratio');await page.locator('#graphCards svg').first().waitFor();assert((await page.locator('#graphCards metadata').first().textContent()).includes('EXP26007104'));assert.equal(await page.locator('#graphCards svg').count(),4);
  assert.deepEqual(errors,[]);console.log(`PASS ${width}px: exact selected dose means/SD, optional wells/fits, SVG and PNG, remove/clear/limit, empty and ambiguous searches, run/condition separation, resize/focus, reference identity and all target configurations`);
  await page.close();
 }
}finally{await browser?.close();server.kill();}})().catch(e=>{console.error(e);process.exitCode=1;});
