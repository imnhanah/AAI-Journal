// Lossless JSON envelope for drafts; never silently discard optional undefined fields.
export function encodeDraftValue(value, seen=new Set()) {
  if(value===undefined)return ['undefined'];
  if(value===null||typeof value==='string'||typeof value==='boolean')return ['value',value];
  if(typeof value==='number'&&Number.isFinite(value))return ['number',Object.is(value,-0)?'-0':String(value)];
  if(value instanceof Date)return ['date',value.toISOString()];
  if(!value||typeof value!=='object'||seen.has(value))throw new Error('This draft contains an unsupported value. Keep the editor open.');
  if(typeof Blob!=='undefined'&&value instanceof Blob)throw new Error('Keep the original image in the editor until its existing image-storage step finishes.');
  if(!Array.isArray(value)&&![Object.prototype,null].includes(Object.getPrototypeOf(value)))throw new Error('This draft format is not supported yet. Original data is unchanged.');
  if(Object.getOwnPropertySymbols(value).length)throw new Error('Unsupported draft metadata.');
  seen.add(value);
  let result;
  if(Array.isArray(value)){
    const entries=[];
    for(let i=0;i<value.length;i++)entries.push(Object.hasOwn(value,i)?encodeDraftValue(value[i],seen):['hole']);
    if(Object.getOwnPropertyNames(value).some(k=>k!=='length'&&!/^(0|[1-9]\d*)$/.test(k)))throw new Error('Unsupported array metadata.');
    result=['array',entries];
  }else{
    result=['object',Object.entries(Object.getOwnPropertyDescriptors(value)).map(([key,d])=>{
      if(!d.enumerable||!('value'in d))throw new Error('Unsupported draft property.');
      return [key,encodeDraftValue(d.value,seen)];
    })];
  }
  seen.delete(value);return result;
}
export function decodeDraftValue(value){
  if(!Array.isArray(value))throw new Error('Unknown draft codec.');
  const [kind,data]=value;
  if(kind==='undefined')return undefined;
  if(kind==='value')return data;
  if(kind==='number')return data==='-0'?-0:Number(data);
  if(kind==='date')return new Date(data);
  if(kind==='array'){const result=[];for(const item of data){if(item[0]==='hole')result.length++;else result.push(decodeDraftValue(item));}return result;}
  if(kind==='object'){const result={};for(const [key,item]of data)Object.defineProperty(result,key,{value:decodeDraftValue(item),writable:true,enumerable:true,configurable:true});return result;}
  throw new Error('Unknown draft codec.');
}
