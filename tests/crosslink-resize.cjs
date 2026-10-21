// Uses only supplied data. Resizing must not change which assay result is displayed or exported.
const {chromium}=require('playwright-core');
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},acceptDownloads:true});
  await page.goto((process.env.ATLAS_URL||'http://127.0.0.1:4173/')+'?view=crosslinking');
  await page.locator('#xlinkContext').waitFor();
  await page.locator('#xlinkPickerSearch').fill('0737135');
  await page.locator('#xlinkContext').selectOption('CDK4 (CyclinD1)');
  await page.locator('#xlinkListFilter').selectOption('hits');
  await page.locator('#xlinkSearch').fill('RMC-');
  await page.locator('#xlinkAdvanced').evaluate(el=>el.open=true);
  await page.locator('#xcompareMembership').selectOption('any');
  const snapshot=()=>page.evaluate(()=>({
   controls:Object.fromEntries(['xlinkPickerSearch','xlinkCompoundSelect','xlinkBatchSelect','xlinkContext','xlinkSearch','xlinkListFilter','xcompareMembership'].map(id=>[id,document.getElementById(id).value])),
   heading:document.getElementById('xlinkSelectedHeading').textContent,
   values:document.querySelector('.xlink-adduct-table').textContent,
   rows:[...document.querySelectorAll('#xlinkTable [data-xlink-compound]')].map(e=>e.dataset.xlinkCompound),
   advanced:document.getElementById('xlinkAdvanced').open
  }));
  const download=async()=>{const waiting=page.waitForEvent('download');await page.locator('#xlinkCSV').click();const d=await waiting;return fs.readFileSync(await d.path(),'utf8');};
  const before=await snapshot(),beforeCSV=await download();
  for(const viewport of [{width:390,height:650},{width:844,height:390},{width:1440,height:1000},{width:320,height:800}]){
   await page.locator('#xlinkSearch').focus();
   await page.setViewportSize(viewport);await page.waitForTimeout(400);
   assert.deepEqual(await snapshot(),before,JSON.stringify(viewport));
   assert.equal(await page.evaluate(()=>document.activeElement.id),'xlinkSearch');
   assert.equal(await download(),beforeCSV,'resizing must not change exported records');
   const layout=await page.evaluate(()=>({viewport:innerWidth,width:document.documentElement.scrollWidth}));
   assert(layout.width<=layout.viewport+1,JSON.stringify(layout));
  }
  console.log('PASS: height change, rotation, desktop and narrow phone preserve context, batch, filters, focus, values and exact CSV');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
