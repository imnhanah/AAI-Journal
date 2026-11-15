const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function mergeHydratedMedia(current,captured=[],hydrated=[],accounts=false){
  if(!Array.isArray(current))return current;
  const before=new Map((captured||[]).map(row=>[row.id,row])),after=new Map((hydrated||[]).map(row=>[row.id,row]));
  return current.map(row=>{
    const old=before.get(row.id),next=after.get(row.id);if(!old||!next||old.updatedAt!==row.updatedAt)return row;
    if(accounts)return {...row,trades:mergeHydratedMedia(row.trades,old.trades,next.trades)};
    return equal(row.screenshots,old.screenshots)?{...row,screenshots:next.screenshots}:row;
  });
}
export function cloudMediaComplete(value){
  if(Array.isArray(value))return value.every(cloudMediaComplete);
  if(!value||typeof value!=='object')return typeof value!=='string'||!value.startsWith('tj-trade-media:');
  const candidate=value.src||value.url||'',src=typeof candidate==='string'?candidate:'';
  if(src.startsWith('tj-trade-media:'))return typeof value.cloudRef==='string'&&value.cloudRef.startsWith('tj-case-study-storage:');
  return Object.values(value).every(cloudMediaComplete);
}
