const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const {reusableLauncher}=require('../prism-native.js');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'atlas-mac-launcher-')),bin=path.join(root,'bin'),folder=path.join(root,"Atlas β & $(not-a-command) package");
fs.mkdirSync(bin);fs.mkdirSync(folder);
const launcher=path.join(root,'Atlas_Prism_Launcher.command'),opened=path.join(root,'opened');
fs.writeFileSync(launcher,reusableLauncher);fs.writeFileSync(path.join(folder,'Atlas_Input.prism'),'fixture');fs.writeFileSync(path.join(folder,'Open_in_Prism.pzc'),'CreateLog\nOpen "Atlas_Input.prism"\n');
const stub=(name,body)=>fs.writeFileSync(path.join(bin,name),'#!/bin/bash\n'+body,{mode:0o755});
stub('uname','echo "${ATLAS_TEST_PLATFORM:-Darwin}"\n');
stub('osascript',`if [[ "$*" == *"choose folder"* ]]; then
 if [ "\${ATLAS_TEST_CANCEL:-0}" = 1 ]; then exit 1; fi
 printf '%s' "$ATLAS_TEST_FOLDER"
else
 printf '%s' "$ATLAS_TEST_HFS"
fi
`);
stub('open','printf \'%s\\n\' "$@" > "$ATLAS_TEST_OPEN"\n');
const env={...process.env,PATH:bin+':'+process.env.PATH,ATLAS_TEST_FOLDER:folder,ATLAS_TEST_HFS:'Macintosh HD:Atlas β & $(not-a-command) package:',ATLAS_TEST_OPEN:opened};
const run=extra=>spawnSync('/bin/bash',[launcher],{env:{...env,...extra},encoding:'utf8'});
assert.equal(spawnSync('/bin/bash',['-n',launcher]).status,0);
let r=run();assert.equal(r.status,0,r.stderr);assert.deepEqual(fs.readFileSync(opened,'utf8').trimEnd().split('\n'),['-b','com.GraphPad.Prism',path.join(folder,'Run_Atlas_Prism.pzc')]);
assert.equal(fs.readFileSync(path.join(folder,'Run_Atlas_Prism.pzc'),'utf8'),'SetPath "'+env.ATLAS_TEST_HFS+'"\n'+fs.readFileSync(path.join(folder,'Open_in_Prism.pzc'),'utf8'));
fs.unlinkSync(opened);r=run({ATLAS_TEST_CANCEL:'1'});assert.equal(r.status,0);assert(!fs.existsSync(opened));assert.match(r.stdout,/No folder selected/);
r=run({ATLAS_TEST_FOLDER:root});assert.equal(r.status,1);assert.match(r.stdout,/Choose the extracted Atlas_Prism folder/);assert(!fs.existsSync(opened));
r=run({ATLAS_TEST_HFS:'Macintosh HD:bad%folder:'});assert.equal(r.status,1);assert(!fs.existsSync(opened));
r=run({ATLAS_TEST_PLATFORM:'Linux'});assert.equal(r.status,1);assert.match(r.stdout,/requires macOS/);assert(!fs.existsSync(opened));
assert(!/\b(?:xattr|spctl|sudo|curl|wget)\b/.test(reusableLauncher));
fs.rmSync(root,{recursive:true,force:true});
console.log('PASS: reusable launcher shell syntax, selected-folder quoting, input validation, cancellation, platform/path guards and unchanged Prism invocation (Mac APIs mocked; native Mac validation pending)');
