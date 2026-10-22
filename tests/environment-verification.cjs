// Retained cloud verification helper, adapted only for portable checkout/browser paths.
const { chromium } = require('playwright-core');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {execFileSync} = require('node:child_process');
const root=process.env.ATLAS_ROOT||require('node:path').resolve(__dirname,'..');
(async()=>{
  const files=execFileSync('git',['ls-files','-z'],{cwd:root}).toString().split('\0').filter(Boolean);
  let json=0,js=0;
  for(const f of files){
    if(f.endsWith('.json')){JSON.parse(fs.readFileSync(`${root}/${f}`,'utf8'));json++;}
    if(f.endsWith('.js')){execFileSync(process.execPath,['--check',`${root}/${f}`]);js++;}
  }
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  try {
    const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true});
    const errors=[],bad=[],external=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('response',r=>{if(r.status()>=400)bad.push(`${r.status()} ${r.url()}`);});
    await page.route('**/*',route=>{
      if(new URL(route.request().url()).hostname!=='127.0.0.1'){external.push(route.request().url());return route.abort();}
      return route.continue();
    });
    const ready=async()=>{
      await page.waitForFunction(()=>!document.querySelector('#demo').disabled && document.querySelector('#status').hidden && document.querySelector('#metrics').textContent.trim(),{timeout:60000});
    };
    await page.goto('http://127.0.0.1:4173/?view=overview',{waitUntil:'networkidle'});
    await ready();
    await page.locator('#studySelect').selectOption('EXP26007301');await ready();
    assert(await page.locator('#metrics').innerText());
    const checks=['default overview'];
    async function view(id,selector){
      await page.locator('nav details').evaluateAll(es=>es.forEach(e=>e.open=true));
      await page.locator(`nav [data-view="${id}"]`).click();
      await page.waitForFunction(({id,selector})=>{
        const el=document.querySelector('#'+id);
        return el&&!el.hidden&&el.textContent.trim().length>50&&(!selector||el.querySelector(selector));
      },{id,selector},{timeout:60000});
      await page.waitForLoadState('networkidle');
      checks.push(id);console.log('PASS view '+id);
    }
    await view('curves','svg');
    await view('biologicalReplicates','svg');
    await view('dataSources','.source-card');
    await view('dataExport','table');
    assert.equal(await page.locator('.atlas-export-badge').innerText(),'270,659 available measurements');
    await page.locator('[data-action="none-datasets"]').click();
    await page.locator('[data-category]').first().check();
    await page.locator('#dataExport details').evaluateAll(els=>els.forEach(el=>el.open=true));
    const metricBoxes=page.locator('[data-metric]');
    if(await metricBoxes.count()>1)await metricBoxes.first().uncheck();
    const selections=()=>page.locator('#dataExport').evaluate(el=>Object.fromEntries(['category','metric','column'].map(k=>[k,[...el.querySelectorAll(`[data-${k}]:checked`)].map(e=>e.dataset[k])])));
    const before=await selections();
    await page.locator('[data-filter="compound"]').fill('RMC-0741051');
    await page.locator('[data-action="reset"]').click();
    assert.deepEqual(await selections(),before);
    assert.equal(await page.locator('[data-filter="compound"]').inputValue(),'');
    checks.push('catalog 270659; reset preserves datasets/measurements/columns');
    await view('batchComparison','select');
    await view('overview','svg');
    await page.locator('#selectivityReplicate').selectOption('1');await ready();checks.push('selectivity replicate 1');
    await page.locator('#selectivityReferencePlate').selectOption('2');await ready();checks.push('reference plate 2');
    for(const study of ['EXP26007104','EXP26003438']){
      await page.locator('#studySelect').selectOption(study);await ready();
      await view('curves','svg');checks.push(study);
      await view('overview','svg');
    }
    await page.locator('#d1Replicate').selectOption('2');await ready();
    await page.locator('#d1Condition').selectOption('A');await ready();checks.push('D1 replicate 2 condition A');
    await view('assayEvidence','table');
    await view('crosslinking','table');
    for(const params of [
      'view=curves&experiment=EXP26007301&replicate=1&referencePlate=2&cmax=130&ec50=one3&includeReference=true',
      'view=curves&experiment=EXP26007104&replicate=2&response=gds&cmax=110&ec50=le1&includeReference=false',
      'view=curves&experiment=EXP26003438&replicate=2&condition=A&cmax=100&ec50=gt10&includeReference=true'
    ]){
      await page.goto('http://127.0.0.1:4173/?'+params,{waitUntil:'networkidle'});await ready();
      await page.waitForFunction(()=>!document.querySelector('#curves').hidden);
      await page.locator('#scientistStart > summary').click();
      await page.locator('#copyAtlasLink').click();
      await page.waitForFunction(()=>document.querySelector('#atlasShareStatus').textContent.length>0);
      const expected=new URLSearchParams(params);
      await page.reload({waitUntil:'networkidle'});await ready();
      for(const [key,value] of expected)assert.equal(new URL(page.url()).searchParams.get(key),value,'reload '+key);
      assert.equal(await page.locator('#studySelect').inputValue(),expected.get('experiment'));
      assert.equal(await page.locator('#threshold').inputValue(),expected.get('cmax'));
      assert.equal(await page.locator('#ec50Range').inputValue(),expected.get('ec50'));
      assert.equal(await page.locator('#includeReference').isChecked(),expected.get('includeReference')==='true');
      const exp=expected.get('experiment');
      const repSelector=exp==='EXP26007301'?'#selectivityReplicate':exp==='EXP26007104'?'#orientationReplicate':'#d1Replicate';
      assert.equal(await page.locator(repSelector).inputValue(),expected.get('replicate'));
      for(const [param,selector] of [['condition','#d1Condition'],['response','#orientationMode'],['referencePlate','#selectivityReferencePlate']])if(expected.has(param))assert.equal(await page.locator(selector).inputValue(),expected.get(param));
      checks.push('section reload '+expected.get('experiment'));
    }
    const routes=['curves','overview','assayEvidence','crosslinking','dataSources','dataExport'];
    for(const id of routes){
      await page.locator('#scientistStart').evaluate(el=>el.open=true);
      await page.locator(`[data-start-view="${id}"]`).click();
      await page.waitForFunction(id=>!document.querySelector('#'+id).hidden,id);
      assert.equal(await page.locator('#scientistStart').evaluate(el=>el.open),false);
      checks.push('scientist start '+id);
    }
    assert(await page.locator('link[href*="scientist-start.css"]').evaluate(el=>!!el.sheet));
    await page.goto('http://127.0.0.1:4173/presentation.html',{waitUntil:'networkidle'});
    assert((await page.locator('body').innerText()).length>1000);checks.push('presentation');
    assert.deepEqual(errors,[],'Browser exceptions');
    assert.deepEqual(bad,[],'HTTP failures');
    assert.deepEqual(external,[],'Unexpected external requests');
    console.log(JSON.stringify({jsonFiles:json,jsSyntaxChecks:js,browserChecks:checks,errors,bad,external},null,2));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
