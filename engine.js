/* Deterministic browser analysis. Runs in a worker; no network or uploads. */
globalThis.AtlasCore = (()=>{
const mean=a=>a.reduce((s,x)=>s+x,0)/a.length;
const variance=(a,ddof=0)=>{const m=mean(a);return a.reduce((s,x)=>s+(x-m)**2,0)/(a.length-ddof);};
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const key=(c,t)=>JSON.stringify([c,t]);
function fit4pl(records){
 const pos=records.filter(r=>r.x>0),x=pos.map(r=>r.x),y=pos.map(r=>r.y),z=x.map(Math.log10);
 if(x.length<6||new Set(x).size<4)return [null,['At least four positive doses and six wells are required for a 4PL fit.']];
 if(Math.max(...y)-Math.min(...y)<1e-8)return [null,['Flat response: EC50 is not identifiable.']];
 const lo=Math.min(...z)-2,hi=Math.max(...z)+2,my=mean(y),sst=y.reduce((s,v)=>s+(v-my)**2,0);
 function evaluate(e,h){const v=z.map(zz=>1/(1+10**clamp((e-zz)*h,-100,100))),mv=mean(v),vv=v.reduce((s,v)=>s+(v-mv)**2,0);if(vv<1e-12)return [Infinity,0,0];let d=0;for(let i=0;i<v.length;i++)d+=(v[i]-mv)*(y[i]-my);d/=vv;const b=my-d*mv;let ss=0;for(let i=0;i<v.length;i++)ss+=(y[i]-b-d*v[i])**2;return [ss,b,d];}
 let best=[Infinity,0,0,0,0];
 for(let i=0;i<65;i++){const e=lo+(hi-lo)*i/64;for(let j=0;j<35;j++){const h=.1*50**(j/34),[s,b,d]=evaluate(e,h);if(s<best[0])best=[s,e,h,b,d];}}
 let de=(hi-lo)/64,dh=.15;
 for(let iter=0;iter<24;iter++){let improved=false;for(const [ae,ah] of [[-de,0],[de,0],[0,-dh],[0,dh],[-de,-dh],[de,dh]]){const e=clamp(best[1]+ae,lo,hi),h=clamp(best[2]*Math.exp(ah),.1,5),[s,b,d]=evaluate(e,h);if(s<best[0]){best=[s,e,h,b,d];improved=true;}}if(!improved){de*=.5;dh*=.5;}}
 const [s,e,h,b,d]=best,r2=1-s/sst,ec=10**e,flags=[];
 if(!(Math.min(...x)<ec&&ec<Math.max(...x)))flags.push('EC50 outside tested range');
 if(r2<.7)flags.push('R² below 0.70');if(h<.11||h>4.99)flags.push('Hill slope at bound');if(Math.abs(d)<20)flags.push('Amplitude below 20');if(Math.abs(b)>1000||Math.abs(b+d)>1000)flags.push('Plateau extrapolation');
 const xs=[...new Set(x)].sort((a,b)=>a-b),means=xs.map(xx=>mean(pos.filter(r=>r.x===xx).map(r=>r.y))),imax=means.indexOf(Math.max(...means)),imin=means.indexOf(Math.min(...means)),ran=Math.max(...means)-Math.min(...means);
 if((imax>0&&imax<means.length-2&&means[imax]-means.at(-1)>Math.max(20,.25*ran))||(imin>1&&imin<means.length-1&&means.at(-1)-means[imin]>Math.max(20,.25*ran)))flags.push('Non-monotonic dose response');
 const zmin=Math.min(...z),zmax=Math.max(...z),line=Array.from({length:101},(_,i)=>{const zz=zmin+(zmax-zmin)*i/100;return [10**zz,b+d/(1+10**clamp((e-zz)*h,-100,100))];});
 return [{ec50:ec,log_ec50_um:e,hill:h,s0:b,sinf:b+d,amplitude:d,r2,rmse:Math.sqrt(s/y.length),direction:d>=0?'Increasing':'Decreasing',line},flags];
}
function standardize(matrix){const p=matrix[0].length,m=Array.from({length:p},(_,j)=>mean(matrix.map(r=>r[j]))),sd=Array.from({length:p},(_,j)=>Math.sqrt(variance(matrix.map(r=>r[j])))||1);return matrix.map(r=>r.map((v,j)=>(v-m[j])/sd[j]));}
function eigenSymmetric(matrix){const n=matrix.length,a=matrix.map(r=>[...r]),v=Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>i===j?1:0));
 for(let iter=0;iter<100*n*n;iter++){let p=0,q=1,largest=0;for(let i=0;i<n;i++)for(let j=i+1;j<n;j++)if(Math.abs(a[i][j])>largest){largest=Math.abs(a[i][j]);p=i;q=j;}if(largest<1e-12)break;
 const theta=.5*Math.atan2(2*a[p][q],a[q][q]-a[p][p]),c=Math.cos(theta),s=Math.sin(theta),app=a[p][p],aqq=a[q][q],apq=a[p][q];
 for(let k=0;k<n;k++)if(k!==p&&k!==q){const kp=a[k][p],kq=a[k][q];a[k][p]=a[p][k]=c*kp-s*kq;a[k][q]=a[q][k]=s*kp+c*kq;}
 a[p][p]=c*c*app-2*s*c*apq+s*s*aqq;a[q][q]=s*s*app+2*s*c*apq+c*c*aqq;a[p][q]=a[q][p]=0;
 for(let k=0;k<n;k++){const kp=v[k][p],kq=v[k][q];v[k][p]=c*kp-s*kq;v[k][q]=s*kp+c*kq;}}
 return Array.from({length:n},(_,j)=>{const vector=v.map(r=>r[j]);const largest=vector.reduce((i,val,k)=>Math.abs(val)>Math.abs(vector[i])?k:i,0);if(vector[largest]<0)for(let k=0;k<n;k++)vector[k]*=-1;return {value:Math.max(0,a[j][j]),vector};}).sort((a,b)=>b.value-a.value);
}
function cluster(X,names){if(X.length<2)return [...names];const n=X.length,dist=Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>Math.sqrt(X[i].reduce((s,v,k)=>s+(v-X[j][k])**2,0))));const groups=names.map((_,i)=>[i]);
 while(groups.length>1){let best=[Infinity,0,1];for(let i=0;i<groups.length;i++)for(let j=i+1;j<groups.length;j++){let s=0;for(const a of groups[i])for(const b of groups[j])s+=dist[a][b];const d=s/(groups[i].length*groups[j].length);if(d<best[0])best=[d,i,j];}const [,i,j]=best,left=groups[i],right=groups[j];if(dist[left.at(-1)][right.at(-1)]<dist[left.at(-1)][right[0]])right.reverse();groups[i]=left.concat(right);groups.splice(j,1);}return groups[0].map(i=>names[i]);}
function maps(curves,targets,compounds){const lookup=new Map(curves.map(q=>[key(q.compound,q.target),q.cmax])),names=[],matrix=[];for(const c of compounds){const row=targets.map(t=>lookup.get(key(c,t)));if(row.every(v=>v!==undefined&&v!==null)){names.push(c);matrix.push(row);}}
 const pca={points:[],variance:[],loadings:[],excluded:compounds.length-names.length,reason:''};if(compounds.length>250)return [{...pca,reason:'Similarity maps are limited to 250 compounds in this version.'},compounds];
 const X=matrix.length?standardize(matrix):[],order=cluster(X,names).concat(compounds.filter(c=>!names.includes(c)));
 if(names.length<3||targets.length<2){pca.reason='PCA needs at least three complete compound profiles across at least two targets.';return [pca,order];}
 const cov=targets.map((_,j)=>targets.map((_,k)=>X.reduce((s,r)=>s+r[j]*r[k],0))),eigen=eigenSymmetric(cov),total=eigen.reduce((s,e)=>s+e.value,0);if(total<1e-12){pca.reason='Identical profiles have no variance to map.';return [pca,order];}
 pca.variance=eigen.slice(0,2).map(e=>e.value/total);pca.points=X.map((r,i)=>({compound:names[i],x:r.reduce((s,v,j)=>s+v*eigen[0].vector[j],0),y:r.reduce((s,v,j)=>s+v*eigen[1].vector[j],0)}));pca.loadings=targets.map((t,j)=>({target:t,x:eigen[0].vector[j],y:eigen[1].vector[j]}));return [pca,order];}
function analyze(inputs,onProgress=()=>{}){const wells=inputs.flatMap(f=>f.wells),parameters=inputs.flatMap(f=>f.parameters),notes=inputs.flatMap(f=>f.notes||[]),files=inputs.map(f=>f.name);
 if(!wells.length)throw new Error('No corrected wells found. Add the well-level export or a tidy CSV.');if(wells.length>100000)throw new Error('Limit: 100,000 sample wells per analysis.');
 const groups=new Map();for(const r of wells){const k=key(r.compound,r.target);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(r);}if(groups.size>1000)throw new Error('Limit: 1,000 compound–target curves.');const reports=new Map();for(const p of parameters){const k=key(p.compound,p.target);if(reports.has(k))throw new Error(`Duplicate parameter reports for ${p.compound} / ${p.target}.`);reports.set(k,p);}
 const curves=[];let done=0;for(const [k,records] of groups){const [compound,target]=JSON.parse(k),retained=records.filter(r=>!r.excluded);if(!retained.length){notes.push(`${compound} / ${target}: all wells excluded.`);continue;}const trans=[...new Set(retained.map(r=>r.transfection))];if(trans.length>1)throw new Error(`${compound} / ${target} has multiple transfection groups. Analyze experiments separately.`);const report=reports.get(k)||null;if(report&&report.transfection!==trans[0])throw new Error(`Transfection mismatch for ${compound} / ${target}. Use matched exports.`);
 const dg=new Map();for(const r of retained){if(!dg.has(r.x))dg.set(r.x,[]);dg.get(r.x).push(r.y);}const doses=[...dg].sort((a,b)=>a[0]-b[0]).map(([x,ys])=>({x,mean:mean(ys),sd:ys.length>1?Math.sqrt(variance(ys,1)):null,n:ys.length,wells:ys})),positive=doses.filter(s=>s.x>0),[fit,fit_flags]=fit4pl(retained),peak_mean=Math.max(...doses.map(s=>s.mean)),peak_dose=doses.find(s=>s.mean===peak_mean).x;
 curves.push({compound,target,transfection:trans[0],doses,fit,fit_flags,peak_mean,peak_dose,cmax:report?.cmax??peak_mean,cmax_basis:report?.cmax!=null?'Reported Activity (cmax)':'Observed peak dose mean',n_wells:retained.length,excluded_wells:records.length-retained.length,n_doses:doses.length,min_dose:positive.length?positive[0].x:null,max_dose:doses.at(-1).x,sources:[...new Set(records.map(r=>r.source))],report});done++;if(done%10===0)onProgress(done,groups.size);}
 if(!curves.length)throw new Error('No usable unmasked wells.');const unmatched=[...reports.keys()].filter(k=>!groups.has(k));if(unmatched.length)notes.push(`${unmatched.length} parameter rows had no matching corrected wells.`);curves.sort((a,b)=>a.compound.localeCompare(b.compound)||a.target.localeCompare(b.target));const targets=[...new Set(curves.map(q=>q.target))].sort(),compounds=[...new Set(curves.map(q=>q.compound))].sort(),[pca,cluster_order]=maps(curves,targets,compounds);
 const rawRecords=inputs.flatMap(f=>f.raw_plate_records||[]),plate_qc=globalThis.AtlasPlateQC?AtlasPlateQC.analyze(rawRecords):{available:false,reason:'Raw plate QC module was not loaded.',channels:[],plates:[],notes:[]};
 return {curves,targets,compounds,pca,cluster_order,files,notes,plate_qc,cmax_bases:[...new Set(curves.map(q=>q.cmax_basis))].sort(),wells_total:wells.length,wells_excluded:wells.filter(r=>r.excluded).length,model:'Unweighted 4PL; free S0 and Sinf; Hill 0.1–5; search +/-2 log units beyond doses.'};
}
return {analyze,fit4pl,maps,eigenSymmetric};
})();
