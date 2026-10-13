importScripts('./engine.js');
self.onmessage = event => {
  const {id,inputs}=event.data;
  try {
    const data=AtlasCore.analyze(inputs,(done,total)=>self.postMessage({id,progress:`Fitting curve ${done} of ${total}…`}));
    self.postMessage({id,data});
  } catch(e) {self.postMessage({id,error:e.message||String(e)});}
};
