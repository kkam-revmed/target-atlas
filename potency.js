(function(root){
  'use strict';
  const labels={all:'All EC50 ranges (Cmax only)',le1:'≤1 µM',one3:'>1–3 µM',three10:'>3–10 µM',gt10:'>10 µM',unreported:'Not reported',unresolved:'Unresolved range'};
  const ranges=['le1','one3','three10','gt10'];
  // GDS stores float32 M values. Snap only conversion noise at the three cut points.
  function boundary(value){for(const b of [1,3,10])if(Math.abs(value-b)<=1e-7*b)return b;return value;}
  function category(q){
    const r=q.report;
    if(!r||r.ec50==null||!Number.isFinite(Number(r.ec50))||Number(r.ec50)<=0)return 'unreported';
    const v=boundary(Number(r.ec50)),op=String(r.qualifier??'').trim();
    if(op===''||op==='=')return v<=1?'le1':v<=3?'one3':v<=10?'three10':'gt10';
    // A censored value is binned only if its entire allowed interval fits one band.
    if(op==='>'||op==='>='||op==='≥')return v>10||(v===10&&op==='>')?'gt10':'unresolved';
    if(op==='<'||op==='<='||op==='≤')return v<=1?'le1':'unresolved';
    return 'unresolved';
  }
  function matches(q,range){return range==='all'||category(q)===range;}
  const api={labels,ranges,category,matches};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.AtlasPotency=api;
})(typeof globalThis!=='undefined'?globalThis:this);
