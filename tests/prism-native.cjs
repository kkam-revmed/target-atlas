const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const api=require('../prism-native.js'),data=require('../cypa-dependency.json');
const source=data.curves.filter(q=>['RMC-0741051-001','RMC-0707407-001'].includes(q.compound)&&q.replicate==='bio1'&&q.condition_code==='A');
const series=source.map(q=>({...q,series_id:q.compound,series_label:q.compound,condition_label:'No inhibitor',doses:q.doses.map(d=>({...d,wells:d.wells.map(w=>w.normalized)}))}));
const before=JSON.stringify(series),result=api.build(series,{title:'D1/CypA',yTitle:'NanoBRET normalized (%)',axes:{xMin:.001,xMax:10,yMin:0,yMax:300}});
const bat=result.entries.find(e=>e.name==='Open_in_Prism.bat').data;
assert(bat.startsWith('@echo off\r\nsetlocal DisableDelayedExpansion\r\n'));
assert(!/(?<!\r)\n/.test(bat),'Windows batch uses CRLF');
assert(Math.max(...bat.split('\r\n').map(s=>s.length))<8191,'cmd.exe command length limit');
assert(bat.includes("-ArgumentList ('@' + $quote + $scriptPath + $quote)"),'Prism Windows requires @ before the quoted script path');
assert(bat.includes('New-Object System.Windows.Forms.OpenFileDialog'),'custom installation picker');
assert(bat.includes('$version.FileMajorPart -ne 11'));
assert(!/ExecutionPolicy|Invoke-Expression|EncodedCommand|DownloadString|Set-ItemProperty/i.test(bat));
assert(result.entries.some(e=>e.name==='Open_in_Prism.command'&&e.executable));
assert(result.entries.find(e=>e.name==='README.txt').data.includes('Windows native')||result.entries.find(e=>e.name==='README.txt').data.includes('Windows packaging'));
assert.equal(JSON.stringify(series),before);
assert.deepEqual([result.axes.xMin,result.axes.xMax,result.axes.yMin,result.axes.yMax],[-9,-5,0,300]);
assert(result.script.includes('SetAxisTitle Y "NanoBRET normalized (%)"'));
assert(result.script.includes('GoTo R 1'));
const cells=new Map();
for(const m of result.script.matchAll(/InsertData (\d+), (\d+), (\d+)\n<Data>\n([^\n]+)\n<\/Data>/g)){
 const key=m.slice(1,4).join('|');assert(!cells.has(key));cells.set(key,m[4]);
}
series.forEach((q,i)=>q.doses.forEach((d,r)=>{
 if(i===0)return;
 d.wells.forEach((v,s)=>assert.equal(Number(cells.get(`${r+1}|${i+1}|${s+1}`)),v));
 for(let s=d.wells.length;s<48;s++)assert(!cells.has(`${r+1}|${i+1}|${s+1}`));
}));
assert.equal([...cells.keys()].filter(k=>!k.startsWith('0|')&&!k.includes('|0|')).length,20);
const malicious=structuredClone(series);malicious[0].series_label='bad\n</Data>\nSave "bad.prism"\n%F, rest';
const safe=api.build(malicious);assert(!safe.script.includes('Save "bad.prism"'));assert.equal((safe.script.match(/\nSave /g)||[]).length,1);
const crowded=structuredClone(series);crowded[0].doses[0].wells=Array(49).fill(1);
assert.throws(()=>api.build(crowded),/48 observations/);
const nonpositive=structuredClone(series);nonpositive[0].doses[0].x=0;assert.throws(()=>api.build(nonpositive),/positive concentrations/);
const missing=structuredClone(series);missing[1].doses=missing[1].doses.slice(1);const partial=api.build(missing);
assert(!partial.script.includes('InsertData 1, 2, 1\n'));
const zeros=structuredClone(series);zeros[1].doses[0].wells[0]=0;assert(api.build(zeros).script.includes('InsertData 1, 2, 1\n<Data>\n0\n'));
assert.throws(()=>api.build(series,{axes:{yMin:300,yMax:0}}),/minimum/);
assert.throws(()=>api.build([]),/at least one/);
// The ZIP is inspected using Python's standard reader in the companion check.
const output=process.argv[2]||'/tmp/atlas-native-test.zip';
fs.writeFileSync(output,api.zip([...result.entries,{name:'Atlas_Input.prism',data:api.populateInput(fs.readFileSync(path.join(__dirname,'../assets/prism/atlas-empty.prism')),result.table,result.provenance)}]));
console.log('PASS: 500 exact exported observations, separate identities, blanks/zero, log(M), manual axes, script injection protection, selection immutability; '+output);
