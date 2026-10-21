const {chromium}=require('playwright-core'),assert=require('node:assert/strict'),path=require('node:path'),{spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..'),base='http://127.0.0.1:4192/';
(async()=>{const server=spawn('python3',['-m','http.server','4192','--bind','127.0.0.1'],{cwd:root,stdio:'ignore'});let browser;
try{for(let i=0;i<50;i++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage']});
for(const width of [1440,390,320]){
 const page=await browser.newPage({viewport:{width,height:1000},hasTouch:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'?view=biologicalReplicates&experiment=EXP26007301&replicate=2');await page.locator('#bioGraphCards svg').first().waitFor();
 const input=page.locator('#globalCompoundSearch'),list=page.locator('#globalCompoundSuggestions');assert.equal(await input.getAttribute('list'),null);
 await input.fill('RMC-0741051');assert(await list.isVisible());assert.equal(await list.locator('[data-global-suggestion]').count(),1);assert.equal(await list.locator('strong').textContent(),'RMC-0741051');assert.equal(await list.locator('small').textContent(),'Batch 001');
 await list.locator('button').tap();assert(!(await list.isVisible()));assert.equal(await page.locator('#globalCompoundBatch').inputValue(),'RMC-0741051-001');
 await input.fill('051');assert(await list.isVisible());assert.equal(await list.locator('[data-global-suggestion="RMC-0741051"]').count(),1);await input.press('ArrowDown');assert(await input.getAttribute('aria-activedescendant'));await input.press('Enter');assert.equal(await input.inputValue(),'RMC-0741051');assert(!(await list.isVisible()));assert.equal(await page.locator('#biologicalReplicates').isVisible(),true);
 await input.fill('074');const ids=await list.locator('[data-global-suggestion]').evaluateAll(els=>els.map(e=>e.dataset.globalSuggestion));assert(ids.length>1);assert(ids.every(id=>id.includes('074')));await input.press('ArrowUp');await input.press('Enter');assert.equal(await input.inputValue(),ids.at(-1));
 await input.fill('0732120-002');await list.locator('button').click();assert.equal(await page.locator('#globalCompoundBatch').inputValue(),'RMC-0732120-002');
 await input.fill('no-such-id');assert(!(await list.isVisible()));assert(await page.locator('#globalCompoundBatch').isDisabled());assert.match(await page.locator('#globalCompoundStatus').textContent(),/No matching compound/);
 await input.fill('0741051-002');assert(!(await list.isVisible())); // Original plate-2 alias is not a separate selectable batch.
 await input.fill('051');await input.press('Escape');assert.equal(await input.getAttribute('aria-expanded'),'false');await input.press('ArrowDown');assert(await list.isVisible());
 await page.setViewportSize({width,height:800});await page.waitForTimeout(350);assert.equal(await input.inputValue(),'051');assert.equal(await page.evaluate(()=>document.activeElement.id),'globalCompoundSearch');assert(await list.isVisible());assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await input.scrollIntoViewIfNeeded();await page.screenshot({path:`/tmp/global-compound-search-${width}.png`});
 await list.locator('[data-global-suggestion="RMC-0741051"]').click();await page.locator('#globalCompoundForm button[type="submit"]').click();await page.waitForFunction(()=>!document.querySelector('#curves').hidden);assert.equal(await page.evaluate(()=>state.compound),'RMC-0741051-001');
 await page.locator('#selectivityReplicate').selectOption('compare');await page.waitForFunction(()=>!document.querySelector('#biologicalReplicates').hidden&&document.querySelector('#bioGraphCards svg'));assert.equal(await page.locator('#selectivityReplicate').inputValue(),'compare');assert.equal(await page.evaluate(()=>state.selectivityReplicate),2);
 await page.locator('#selectivityReplicate').selectOption('1');await page.waitForFunction(()=>!document.querySelector('#curves').hidden&&state.data.biological_replicate===1);assert.equal(await page.locator('#selectivityReplicate').inputValue(),'1');assert.equal(await page.evaluate(()=>state.compound),'RMC-0741051-001');
 await page.locator('#selectivityReplicate').selectOption('compare');await page.waitForFunction(()=>!document.querySelector('#biologicalReplicates').hidden);await page.reload();await page.locator('#bioGraphCards svg').first().waitFor();assert.equal(await page.locator('#selectivityReplicate').inputValue(),'compare');assert.equal(await page.evaluate(()=>state.selectivityReplicate),1);
 if(width===1440)for(const [study,selector] of [['EXP26007104','orientationReplicate'],['EXP26003438','d1Replicate']]){
  await page.locator('#studySelect').selectOption(study);await page.waitForFunction(study=>!state.busy&&state.study===study,study);assert.equal(await page.locator('#'+selector).inputValue(),'compare');
  await page.locator('#'+selector).selectOption('2');await page.waitForFunction(()=>!document.querySelector('#curves').hidden&&state.data.biological_replicate===2);assert.equal(await page.locator('#'+selector).inputValue(),'2');
  await page.locator('#'+selector).selectOption('compare');await page.waitForFunction(()=>!document.querySelector('#biologicalReplicates').hidden&&document.querySelector('#biologicalReplicates svg'));assert.equal(await page.locator('#'+selector).inputValue(),'compare');
 }
 assert.deepEqual(errors,[]);await page.close();console.log('PASS '+width+'px: filtered exact/partial IDs, pointer and keyboard selection, batch002 identity, source alias excluded, empty state, resize/focus, navigation, direct replicate comparison dropdown/return/reload and no horizontal overflow');
}
}finally{await browser?.close();server.kill();}})().catch(e=>{console.error(e);process.exitCode=1;});
