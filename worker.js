importScripts('./orientation-mapping.js?v=orientation-ratio-config-2','./plate-mapping.js?v=selectivity-rep2-1','./plate-qc.js?v=selectivity-rep2-1','./engine.js?v=orientation-ratio-config-2');
self.onmessage = event => {
  const {id,inputs}=event.data;
  try {
    const data=AtlasCore.analyze(inputs,(done,total)=>self.postMessage({id,progress:`Fitting curve ${done} of ${total}…`}));
    self.postMessage({id,data});
  } catch(e) {self.postMessage({id,error:e.message||String(e)});}
};
