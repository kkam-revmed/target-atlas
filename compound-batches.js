(function(root){
  'use strict';
  // Keep the complete source ID as the identity. Grouping is for navigation only.
  function parse(value){
    const id=String(value??'').trim(),match=/^(RMC-\d+)(?:-(\d{3,}))?$/i.exec(id);
    return {id,base:match?match[1].toUpperCase():id,batch:match?.[2]||null};
  }
  function index(compounds){
    const groups=new Map(),seen=new Set();
    for(const value of compounds||[]){
      const item=parse(value),key=item.base.toLowerCase(),identity=item.id.toLowerCase();
      if(!item.id||seen.has(identity))continue;
      seen.add(identity);
      if(!groups.has(key))groups.set(key,{base:item.base,members:[]});
      groups.get(key).members.push(item);
    }
    return [...groups.values()].sort((a,b)=>a.base.localeCompare(b.base)).map(group=>({...group,members:group.members.sort((a,b)=>a.id.localeCompare(b.id,undefined,{numeric:true}))}));
  }
  function search(groups,value){
    const query=String(value??'').trim().toLowerCase();
    if(!query)return [];
    const base=groups.find(group=>group.base.toLowerCase()===query);
    return base?[base]:groups.filter(group=>group.members.some(item=>item.id.toLowerCase().includes(query)));
  }
  function resolve(groups,value,selectedId=''){
    const query=String(value??'').trim().toLowerCase(),matches=search(groups,value);
    if(!query)return {kind:'empty',groups:matches};
    if(!matches.length)return {kind:'missing',groups:matches};
    if(matches.length>1)return {kind:'ambiguous',groups:matches};
    const group=matches[0],exact=group.members.find(item=>item.id.toLowerCase()===query&&item.id.toLowerCase()!==group.base.toLowerCase());
    const selected=group.members.find(item=>item.id===selectedId);
    const compound=exact||selected||(group.members.length===1?group.members[0]:null);
    return {kind:compound?'ready':'choose-batch',groups:matches,group,compound};
  }
  const api={parse,index,search,resolve};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.AtlasCompoundBatches=api;
})(typeof globalThis!=='undefined'?globalThis:this);
