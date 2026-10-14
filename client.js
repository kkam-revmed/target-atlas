globalThis.AtlasClient = (()=>{
  let worker=null,next=0;const pending=new Map();
  function boot(){if(worker)return;worker=new Worker(new URL('./worker.js?v=experiment-qc-1',document.baseURI));worker.onmessage=e=>{const p=pending.get(e.data.id);if(!p)return;if(e.data.progress){p.progress(e.data.progress);return;}pending.delete(e.data.id);e.data.error?p.reject(new Error(e.data.error)):p.resolve(e.data.data);};worker.onerror=e=>{for(const p of pending.values())p.reject(new Error(e.message||'Analysis worker failed.'));pending.clear();worker?.terminate();worker=null;};}
  async function analyze(files,progress=()=>{}){const names=files.map(f=>f.name);if(new Set(names).size!==names.length)throw new Error('The same file was selected more than once.');progress('Reading corrected values from your files…');const inputs=[];for(const f of files){const bytes=Uint8Array.from(atob(f.content),c=>c.charCodeAt(0));inputs.push({name:f.name,...await AtlasInput.parse({name:f.name,bytes})});}boot();const id=++next;return new Promise((resolve,reject)=>{pending.set(id,{resolve,reject,progress});worker.postMessage({id,inputs});});}
  return {analyze};
})();
