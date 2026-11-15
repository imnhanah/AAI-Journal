import {DURABLE_RECOVERY_DATABASE,DURABLE_RECOVERY_STORES,RECOVERY_COPIES_DATABASE,RECOVERY_COPIES_STORE,readDurableRecoveryRows,verifyDurableRecoveryRow} from './durableDeviceRecovery.js';
// Read-only owner-operated recovery. Deliberately imports no cloud or journal runtime.
export const DEVICE_RECOVERY_FORMAT = 'aaicorefx-device-recovery';
const databases = {
  [DURABLE_RECOVERY_DATABASE]:DURABLE_RECOVERY_STORES, [RECOVERY_COPIES_DATABASE]:[RECOVERY_COPIES_STORE],
  'aaicorefx-local-journal':['journals'], 'aaicorefx-local-journal-snapshots':['snapshots'],
  'tj-journal-images':['snapshots'], 'tj-cloud-cache':['records'],
  'tj-image-assets':['assets','binaries','queue','leases'],
  'tj-case-study-document-images':['images'], 'tj-case-study-evidence-images':['images'],
};
const imageFields = new Set(['src','url','dataUrl','source','data','image','preview','documentImageRef','profileImage','displaySrc']);
const referencePattern = /tj-(?:case-study-(?:image|evidence|media|storage)|trade-media|shared-media|image):[^\s"'<>]+/g;
export const canonicalRecovery = value => Array.isArray(value) ? '['+value.map(canonicalRecovery).join(',')+']'
  : value && typeof value==='object' ? '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonicalRecovery(value[k])).join(',')+'}' : JSON.stringify(value);
export async function recoveryHash(value) {
  const bytes=typeof value==='string'?new TextEncoder().encode(value):value;
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
}
const base64 = bytes => {let text='';for(let i=0;i<bytes.length;i+=8192)text+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(text);};
export async function encodeRecoveryValue(value) {
  if(value instanceof Blob || value instanceof ArrayBuffer || ArrayBuffer.isView(value)){
    const bytes=new Uint8Array(value instanceof Blob?await value.arrayBuffer():value instanceof ArrayBuffer?value:value.buffer.slice(value.byteOffset,value.byteOffset+value.byteLength));
    return {__aaiRecoveryBinary:{kind:typeof File!=='undefined'&&value instanceof File?'File':value instanceof Blob?'Blob':ArrayBuffer.isView(value)?value.constructor.name:'ArrayBuffer',...(typeof File!=='undefined'&&value instanceof File?{name:value.name,lastModified:value.lastModified}:{}),type:value.type||'',base64:base64(bytes),byteLength:bytes.length,sha256:await recoveryHash(bytes)}};
  }
  if(value instanceof Date)return {__aaiRecoveryDate:value.toISOString()};
  if(value===undefined)return {__aaiRecoveryUndefined:true};
  if(Array.isArray(value))return Promise.all(value.map(encodeRecoveryValue));
  if(value&&typeof value==='object'){const pairs=[];for(const[k,v]of Object.entries(value))pairs.push([k,await encodeRecoveryValue(v)]);return Object.fromEntries(pairs);}
  return value;
}
async function verifyBinaries(value){
 if(!value||typeof value!=='object')return;
 if(value.__aaiRecoveryBinary){const b=value.__aaiRecoveryBinary,bytes=Uint8Array.from(atob(b.base64),c=>c.charCodeAt(0));if(bytes.length!==b.byteLength||await recoveryHash(bytes)!==b.sha256)throw new Error('An archived image failed its checksum.');return;}
 for(const child of Object.values(value))await verifyBinaries(child);
}
function ownedKey(key,userId){
 if(typeof key!=='string')return false;
 if(key===`journal:${userId}`||key.startsWith(`journal:${userId}:`))return true;
 if(key.startsWith('tj-image:')){try{return JSON.parse(key.slice(9)).user===userId;}catch{return false;}}
 return false;
}
function localKeys(storage,userId,email){
 const rows=[];for(let i=0;i<storage.length;i++){const key=storage.key(i);if((/^(tj:|tj-|aaicorefx[-:])/.test(key)&&key.split(':').includes(userId))||(email&&key===`tj:trading-journal:state:v2:${email}`))rows.push({key,value:storage.getItem(key)});}
 return rows.sort((a,b)=>a.key.localeCompare(b.key));
}
function openExisting(indexedDb,name){return new Promise((resolve,reject)=>{
 let absent=false;const request=indexedDb.open(name);
 request.onupgradeneeded=()=>{absent=true;request.transaction.abort();}; // Never create a missing database.
 request.onsuccess=()=>resolve(request.result);
 request.onerror=()=>absent?resolve(null):reject(request.error||new Error('Device storage could not be opened.'));
 request.onblocked=()=>reject(new Error('Close another tab using device storage, then retry.'));
});}
const references = value => {const found=new Set();const walk=v=>{if(typeof v==='string'){for(const ref of v.match(referencePattern)||[])found.add(ref);try{if(v[0]==='{'||v[0]==='[')walk(JSON.parse(v));}catch{}}else if(v&&typeof v==='object')Object.values(v).forEach(walk);};walk(value);return found;};
async function collect(userId,indexedDb,storage,assertOwner,email,projectId){
 await assertOwner();const localStorage=localKeys(storage,userId,email),records=[],stores=[],legacy=[];
 for(const[name,names]of Object.entries(databases)){
  let db;try{db=await openExisting(indexedDb,name);if(!db){stores.push({database:name,status:'absent'});continue;}
   if(name===DURABLE_RECOVERY_DATABASE){
    const durable=await readDurableRecoveryRows(db,userId,projectId);records.push(...durable);
    for(const store of DURABLE_RECOVERY_STORES)stores.push({database:name,store,status:'read',ownedRecords:durable.filter(r=>r.store===store).length});
    continue;
   }
   if(name===RECOVERY_COPIES_DATABASE&&(!projectId||db.version!==1||db.objectStoreNames.length!==1||!db.objectStoreNames.contains(RECOVERY_COPIES_STORE)))throw new Error('Confirm this recovery project and storage version.');
   for(const unexpected of Array.from(db.objectStoreNames).filter(s=>!names.includes(s)))stores.push({database:name,store:unexpected,status:'unreviewed'});
   for(const storeName of names){if(!db.objectStoreNames.contains(storeName)){stores.push({database:name,store:storeName,status:'absent'});continue;}
    const rows=await new Promise((resolve,reject)=>{const rows=[],tx=db.transaction(storeName,'readonly'),request=tx.objectStore(storeName).openCursor();request.onsuccess=()=>{const c=request.result;if(c){let include=false;
     if(name==='aaicorefx-local-journal'||name==='tj-journal-images')include=c.key===userId;
     else if(name==='aaicorefx-local-journal-snapshots')include=c.value.userId===userId;
     else if(name==='tj-cloud-cache')include=ownedKey(c.key,userId);
     else if(name==='tj-image-assets')include=c.value.ownerUserId===userId;
     else if(name===RECOVERY_COPIES_DATABASE)include=c.value.ownerUserId===userId&&c.value.projectId===projectId;
     else include=true; // Unscoped legacy rows are selected by owned references below.
     if(include)rows.push({key:c.key,value:c.value});c.continue();}};tx.oncomplete=()=>resolve(rows);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('Read cancelled.'));});
    if(name==='tj-case-study-document-images'||name==='tj-case-study-evidence-images')legacy.push({name,storeName,rows});
    else for(const row of rows)records.push({database:name,store:storeName,...row});
    stores.push({database:name,store:storeName,status:'read',ownedRecords:rows.length});
   }
  }catch(error){if(name===DURABLE_RECOVERY_DATABASE||name===RECOVERY_COPIES_DATABASE)throw error;stores.push({database:name,status:'unreadable'});}finally{db?.close();}
 }
 const refs=references([records,localStorage]);
 for(const{name,storeName,rows}of legacy){const selected=rows.filter(row=>refs.has(String(row.key)));for(const row of selected)records.push({database:name,store:storeName,...row});const info=stores.find(s=>s.database===name&&s.store===storeName);info.ownedRecords=selected.length;info.unassignedRecords=rows.length-selected.length;}
 await assertOwner();return {records:await encodeRecoveryValue(records),localStorage,stores};
}
export async function exportDeviceRecovery(userId,{indexedDb=globalThis.indexedDB,storage=globalThis.localStorage,assertOwner,origin=globalThis.location?.origin||'',deviceLabel='',email='',projectId=''}={}){
 if(!userId||typeof assertOwner!=='function')throw new Error('Confirm the signed-in account before exporting.');
 if(!indexedDb||!storage)throw new Error('Device storage is unavailable. Keep this browser profile.');
 const first=await collect(userId,indexedDb,storage,assertOwner,email,projectId),second=await collect(userId,indexedDb,storage,assertOwner,email,projectId);
 if(canonicalRecovery(first)!==canonicalRecovery(second))throw new Error('Device data changed during export. Pause edits and retry; source copies remain saved.');
 const issues=[];for(const store of first.stores){if(store.status==='unreadable'||store.status==='unreviewed')issues.push('A device store could not be read.');if(store.unassignedRecords)issues.push('Older unassigned images need owner review.');}
 const binaries=new Set(first.records.filter(r=>r.database==='tj-image-assets'&&r.store==='binaries').map(r=>r.value.id));
 for(const asset of first.records.filter(r=>r.database==='tj-image-assets'&&r.store==='assets'))if(!binaries.has(asset.value.id)&&!['purged'].includes(asset.value.storageState))issues.push('Some retained image metadata has no device bytes. Compare with the separate cloud recovery copy.');
 for(const asset of first.records.filter(r=>r.database==='tj-image-assets'&&r.store==='assets')){const expected=asset.value.checksum,binary=first.records.find(r=>r.database==='tj-image-assets'&&r.store==='binaries'&&r.value.id===asset.value.id)?.value.bytes?.__aaiRecoveryBinary;if(/^[a-f0-9]{64}$/i.test(expected||'')&&binary&&binary.sha256!==expected)issues.push('A device image differs from its saved checksum. Keep the original and compare the recovery copies.');}
 const payload={format:DEVICE_RECOVERY_FORMAT,version:1,recoveryOwnerId:userId,exportedAt:new Date().toISOString(),origin,deviceLabel,recoveryOwnerEmail:email,projectId,deviceOnly:true,...first,issues:[...new Set(issues)]};
 await assertOwner();return {...payload,payloadSha256:await recoveryHash(canonicalRecovery(payload))};
}
export async function verifyDeviceRecovery(bundle,expectedOwner,{expectedProjectId,depth=0}={}){
 if(depth>2)throw new Error('Nested recovery copies are not supported.');
 if(expectedProjectId&&bundle?.projectId&&bundle.projectId!==expectedProjectId)throw new Error('Recovery project does not match.');
 if(bundle?.format!==DEVICE_RECOVERY_FORMAT||bundle.version!==1||!bundle.recoveryOwnerId||!Array.isArray(bundle.records)||!Array.isArray(bundle.localStorage))throw new Error('Choose an AAICOREFX device recovery archive.');
 if(expectedOwner&&bundle.recoveryOwnerId!==expectedOwner)throw new Error('This archive belongs to another account.');
 const{payloadSha256,...payload}=bundle;if(await recoveryHash(canonicalRecovery(payload))!==payloadSha256)throw new Error('Archive checksum does not match. Keep the original file.');
 const recordKeys=new Set();
 for(const row of bundle.records){
  const recordKey=JSON.stringify([row.database,row.store,row.key]);if(recordKeys.has(recordKey))throw new Error('Archive contains duplicate recovery keys.');recordKeys.add(recordKey);
  if(!Object.hasOwn(databases,row.database)||!databases[row.database].includes(row.store))throw new Error('Archive contains an unsupported device store.');
  if(['aaicorefx-local-journal','tj-journal-images'].includes(row.database)&&row.key!==bundle.recoveryOwnerId)throw new Error('Archive contains another account’s device data.');
  if(row.database==='aaicorefx-local-journal-snapshots'&&row.value?.userId!==bundle.recoveryOwnerId)throw new Error('Snapshot owner does not match.');
  if(row.database==='tj-image-assets'&&row.value?.ownerUserId!==bundle.recoveryOwnerId)throw new Error('Image owner does not match.');
  if(row.database==='tj-cloud-cache'&&!ownedKey(row.key,bundle.recoveryOwnerId))throw new Error('Cached record owner does not match.');
  if(row.database===DURABLE_RECOVERY_DATABASE)verifyDurableRecoveryRow(row,bundle.recoveryOwnerId,expectedProjectId||bundle.projectId);
  if(row.database===RECOVERY_COPIES_DATABASE){
   if(row.value?.ownerUserId!==bundle.recoveryOwnerId||row.value?.projectId!==(expectedProjectId||bundle.projectId)||row.key!==row.value?.id)throw new Error('Recovery copy owner or project does not match.');
   if(row.value.archive?.records?.some(r=>r.database===RECOVERY_COPIES_DATABASE))throw new Error('Nested recovery evidence must remain separate.');
   await verifyDeviceRecovery(row.value.archive,bundle.recoveryOwnerId,{expectedProjectId:expectedProjectId||bundle.projectId,depth:depth+1});
  }

 }
 for(const row of bundle.localStorage){const key=row.key;if(!((/^(tj:|tj-|aaicorefx[-:])/.test(key)&&key.split(':').includes(bundle.recoveryOwnerId))||(bundle.recoveryOwnerEmail&&key===`tj:trading-journal:state:v2:${bundle.recoveryOwnerEmail}`)))throw new Error('Archive contains an unrelated setting.');}
 const refs=references([bundle.records.filter(row=>!['tj-case-study-document-images','tj-case-study-evidence-images'].includes(row.database)),bundle.localStorage]);
 for(const row of bundle.records)if(['tj-case-study-document-images','tj-case-study-evidence-images'].includes(row.database)&&!refs.has(String(row.key)))throw new Error('An unassigned image cannot be attributed to this account.');
 await verifyBinaries(bundle.records);return {ownerId:bundle.recoveryOwnerId,records:bundle.records.length,issues:bundle.issues||[],checksum:payloadSha256};
}
function parse(value){try{return JSON.parse(value);}catch{return null;}}
export function deviceRecoveryCopies(bundle){
 const copies=[];if(bundle.records.some(r=>r.database===DURABLE_RECOVERY_DATABASE||r.database===RECOVERY_COPIES_DATABASE))copies.push({id:'durable-pending',label:'Durable drafts and pending-write recovery (kept separate)',backup:{version:1,data:{accounts:[],markups:[],reviews:[],periodReviews:[]}}});for(const row of bundle.records){
  if(row.database==='aaicorefx-local-journal'&&row.value?.accounts)copies.push({id:'device-journal',label:'Saved device journal',backup:{version:1,data:row.value}});
  if(row.database==='aaicorefx-local-journal-snapshots'&&row.value?.backup?.data)copies.push({id:'snapshot:'+row.key,label:'Snapshot '+row.value.createdAt,backup:row.value.backup});
 }
 for(const row of bundle.localStorage){const value=parse(row.value);
  if(row.key.startsWith('tj:trading-journal:state:v2:')&&value?.accounts)copies.push({id:'legacy-journal',label:'Legacy device journal',backup:{version:1,data:{...value,markups:value.markups||[],reviews:value.reviews||[],periodReviews:value.periodReviews||[]}}});
  if(row.key.startsWith('tj:journal-cache:')&&value?.data?.accounts)copies.push({id:'cached-journal',label:'Cached journal (may be incomplete)',backup:{version:1,data:value.data}});
  if(row.key.startsWith('aaicorefx-local-journal-recovery:'))for(const side of['base','next'])if(value?.[side]?.accounts)copies.push({id:row.key+':'+side,label:'Pending journal '+side,backup:{version:1,data:value[side]}});
  if(row.key.startsWith('aaicorefx-case-study-sync-outbox:')&&value){
   const libraries=[['pending',value.pending?.workspace],['conflict-local',value.conflict?.local],['conflict-cloud',value.conflict?.cloud],...(value.history||[]).flatMap((h,i)=>[[`history-${i}-local`,h.local],[`history-${i}-cloud`,h.cloud]])];
   for(const[label,library]of libraries)if(library)copies.push({id:'case-outbox:'+label,label:'Case Study '+label,backup:{version:1,data:{accounts:[],markups:[],reviews:[],periodReviews:[],profileCaseStudyLibrary:library}}});
  }
 }
 return copies;
}
const binaryDataUrl = (value,type='') => value?.__aaiRecoveryBinary ? `data:${value.__aaiRecoveryBinary.type||type||'image/png'};base64,${value.__aaiRecoveryBinary.base64}` : null;
export async function portableDeviceRecovery(bundle,copyId,{expectedOwner}={}){
 await verifyDeviceRecovery(bundle,expectedOwner);const copy=deviceRecoveryCopies(bundle).find(c=>c.id===copyId);if(!copy)throw new Error('Choose one source copy; copies are never merged automatically.');
 const images=new Map();for(const row of bundle.records){
  const binary=binaryDataUrl(row.value?.blob)||binaryDataUrl(row.value?.bytes,row.value?.type)||binaryDataUrl(row.value)||(typeof row.value==='string'&&row.value.startsWith('data:image/')?row.value:null);
  if(binary){images.set(String(row.key),binary);if(row.database==='tj-image-assets')for(const prefix of['tj-image:','tj-case-study-media:','tj-trade-media:','tj-shared-media:'])images.set(prefix+row.key,binary);}
 }
 for(const row of bundle.records.filter(r=>r.database==='tj-image-assets'&&r.store==='assets')){
  const image=images.get('tj-case-study-media:'+row.value.id);if(image&&row.value.cloudPath?.startsWith(bundle.recoveryOwnerId+'/'))images.set('tj-case-study-storage:'+row.value.cloudPath,image);
 }
 const unresolved=new Set();
 async function rewrite(value,key=''){
  if(Array.isArray(value))return Promise.all(value.map(v=>rewrite(v,key)));
  if(value&&typeof value==='object')return Object.fromEntries(await Promise.all(Object.entries(value).map(async([k,v])=>[k,k==='cloudRef'?v:await rewrite(v,k)])));
  if(typeof value!=='string')return value;
  if(images.has(value))return images.get(value);
  if(value.startsWith('data:image/'))return value;
  let next=value;for(const ref of value.match(referencePattern)||[]){if(images.has(ref))next=next.split(ref).join(images.get(ref));else unresolved.add(ref);}
  if((imageFields.has(key)&&/^(https?:|blob:|tj-)/.test(value))&&!images.has(value))unresolved.add(value);
  return next;
 }
 let originalData=structuredClone(copy.backup.data);
 if(copy.id==='cached-journal'){
  const cached=bundle.records.find(row=>row.database==='tj-journal-images'&&row.key===bundle.recoveryOwnerId)?.value;
  const shots=(item,items)=>item._cachedImagePayload?items?.[item.id]??item.screenshots:item.screenshots;
  if(cached){originalData.accounts=(originalData.accounts||[]).map(a=>({...a,trades:(a.trades||[]).map(t=>({...t,screenshots:shots(t,cached.trades)}))}));for(const group of ['markups','reviews'])originalData[group]=(originalData[group]||[]).map(t=>({...t,screenshots:shots(t,cached[group])}));}
 }
 const data=await rewrite(originalData),deviceRoutine=bundle.localStorage.find(r=>r.key===`tj:daily-routine:${bundle.recoveryOwnerId}:device`),routine=copy.backup.routine??parse(deviceRoutine?.value||bundle.localStorage.find(r=>r.key===`tj:daily-routine:${bundle.recoveryOwnerId}`)?.value||'null');
 return {version:1,exportedAt:new Date().toISOString(),recoveryOwnerId:bundle.recoveryOwnerId,routine,data,unavailableImages:unresolved.size,deviceRecoverySource:{copyId,archiveSha256:bundle.payloadSha256,origin:bundle.origin},recoveryWarnings:bundle.issues||[],...(bundle.records.some(r=>r.database===DURABLE_RECOVERY_DATABASE||r.database===RECOVERY_COPIES_DATABASE)?{durableRecoveryArchive:structuredClone(bundle)}:{})};
}

async function decodeRecoveryValue(value){
 if(!value||typeof value!=='object')return value;
 if(value.__aaiRecoveryBinary){const b=value.__aaiRecoveryBinary,bytes=Uint8Array.from(atob(b.base64),c=>c.charCodeAt(0));if(b.kind==='File')return new File([bytes],b.name,{type:b.type,lastModified:b.lastModified});if(b.kind==='Blob')return new Blob([bytes],{type:b.type});const views={Uint8Array,Uint8ClampedArray,Int8Array,Int16Array,Uint16Array,Int32Array,Uint32Array,Float32Array,Float64Array,DataView};return b.kind==='ArrayBuffer'?bytes.buffer:Object.hasOwn(views,b.kind)?new views[b.kind](bytes.buffer):bytes.buffer;}
 if(value.__aaiRecoveryDate)return new Date(value.__aaiRecoveryDate);
 if(value.__aaiRecoveryUndefined)return undefined;
 if(Array.isArray(value))return Promise.all(value.map(decodeRecoveryValue));
 return Object.fromEntries(await Promise.all(Object.entries(value).map(async([k,v])=>[k,await decodeRecoveryValue(v)])));
}
// Restores raw originals only into new, isolated names that no journal/sync code
// reads. Pending uploads/leases/outboxes are evidence and never reactivated.
export async function verifyDeviceRecoveryRestore(bundle,{expectedOwner,indexedDb=globalThis.indexedDB}={}){
 await verifyDeviceRecovery(bundle,expectedOwner);const namespace='aai-device-restore-'+crypto.randomUUID(),groups=new Map();
 for(const row of bundle.records){if(!Object.hasOwn(databases,row.database)||!databases[row.database].includes(row.store))throw new Error('Archive contains an unsupported device store.');const list=groups.get(row.database)||[];list.push(row);groups.set(row.database,list);}
 const restored=[];
 for(const[name,rows]of groups){const target=namespace+':'+name;const db=await new Promise((resolve,reject)=>{const request=indexedDb.open(target,1);request.onupgradeneeded=()=>{for(const store of new Set(rows.map(r=>r.store)))request.result.createObjectStore(store);};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
  try{const decoded=[];for(const row of rows)decoded.push({...row,value:await decodeRecoveryValue(row.value)});
   await new Promise((resolve,reject)=>{const tx=db.transaction([...new Set(rows.map(r=>r.store))],'readwrite');for(const row of decoded)tx.objectStore(row.store).add(row.value,row.key);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('Isolated verification copy failed.'));});
   for(const row of rows){const value=await new Promise((resolve,reject)=>{const request=db.transaction(row.store,'readonly').objectStore(row.store).get(row.key);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});if(canonicalRecovery(await encodeRecoveryValue(value))!==canonicalRecovery(row.value))throw new Error('Isolated restore differs from the archive.');restored.push({database:name,store:row.store,key:row.key});}
  }finally{db.close();}
 }
 // Include exact localStorage originals as inert records, not active settings.
 const settingsName=namespace+':settings';const db=await new Promise((resolve,reject)=>{const request=indexedDb.open(settingsName,1);request.onupgradeneeded=()=>request.result.createObjectStore('originals');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
 try{await new Promise((resolve,reject)=>{const tx=db.transaction('originals','readwrite');for(const row of bundle.localStorage)tx.objectStore('originals').add(row.value,row.key);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});for(const row of bundle.localStorage){const value=await new Promise((resolve,reject)=>{const request=db.transaction('originals','readonly').objectStore('originals').get(row.key);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});if(value!==row.value)throw new Error('Isolated settings restore differs.');}}
 finally{db.close();}
 return {archiveSha256:bundle.payloadSha256,namespace,recordsVerified:restored.length,settingsVerified:bundle.localStorage.length,sourceStoresModified:false,queuesReactivated:false,issues:bundle.issues||[]};
}

export async function decodeDeviceRecoveryImages(bundle,{expectedOwner}={}){
 await verifyDeviceRecovery(bundle,expectedOwner);const candidates=new Map();
 const visit=async(value,type='')=>{
  if(typeof value==='string'){
   for(const src of value.match(/data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+/g)||[]){try{const bytes=Uint8Array.from(atob(src.slice(src.indexOf(',')+1)),c=>c.charCodeAt(0));const checksum=await recoveryHash(bytes);candidates.set(checksum,{src,checksum});}catch{const checksum=await recoveryHash(src);candidates.set(checksum,{src,checksum});}}
   return;
  }
  if(!value||typeof value!=='object')return;
  if(value.__aaiRecoveryBinary){const b=value.__aaiRecoveryBinary;candidates.set(b.sha256,{src:binaryDataUrl(value,type),checksum:b.sha256});return;}
  const mime=value.type||value.mimeType||type;for(const child of Object.values(value))await visit(child,mime);
 };
 await visit(bundle.records);for(const row of bundle.localStorage){try{await visit(JSON.parse(row.value));}catch{await visit(row.value);}}
 let decoded=0;const failed=[];
 for(const{src,checksum}of candidates.values()){try{const image=new Image();image.src=src;await image.decode();if(!image.naturalWidth||!image.naturalHeight)throw new Error('Empty image.');decoded++;}catch{failed.push(checksum);}}
 return {uniqueImages:candidates.size,decoded,failed};
}

// Attach raw, checksum-verified recovery evidence. No cloud reads or queue activation.
export async function withDurableDeviceRecovery(backup,userId,options={}) {
 const archive=await exportDeviceRecovery(userId,options);
 if(!archive.records.some(r=>r.database===DURABLE_RECOVERY_DATABASE||r.database===RECOVERY_COPIES_DATABASE))return backup;
 await verifyDeviceRecovery(archive,userId,{expectedProjectId:options.projectId});
 return {...backup,durableRecoveryArchive:archive};
}
// Ordinary journal import retains pending work separately, never overwriting live safety rows.
export async function preservePortableDurableRecovery(backup,userId,{indexedDb=globalThis.indexedDB,projectId,assertOwner}={}) {
 const archive=backup?.durableRecoveryArchive;if(!archive)return {copies:0,queuesReactivated:false};
 if(typeof assertOwner!=='function'||!projectId)throw new Error('Confirm this recovery account and project first.');
 await assertOwner();await verifyDeviceRecovery(archive,userId,{expectedProjectId:projectId});
 const archives=archive.records.filter(r=>r.database===RECOVERY_COPIES_DATABASE).map(r=>r.value.archive);
 if(archive.records.some(r=>r.database===DURABLE_RECOVERY_DATABASE)){
  const {payloadSha256,...payload}=structuredClone(archive);payload.records=payload.records.filter(r=>r.database!==RECOVERY_COPIES_DATABASE);payload.stores=(payload.stores||[]).filter(r=>r.database!==RECOVERY_COPIES_DATABASE);
  archives.push({...payload,payloadSha256:await recoveryHash(canonicalRecovery(payload))});
 }
 const inputs=[];
 for(const value of archives){await verifyDeviceRecovery(value,userId,{expectedProjectId:projectId});const id=await recoveryHash(canonicalRecovery({owner:userId,projectId,records:value.records,settings:value.localStorage}));inputs.push({id,ownerUserId:userId,projectId,archive:value,restoredAt:new Date().toISOString(),queuesReactivated:false});}
 await assertOwner();
 const db=await new Promise((resolve,reject)=>{const q=indexedDb.open(RECOVERY_COPIES_DATABASE,1);q.onupgradeneeded=()=>q.result.createObjectStore(RECOVERY_COPIES_STORE,{keyPath:'id'});q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);q.onblocked=()=>reject(new Error('Close another recovery tab and retry.'));});
 try{
  await new Promise((resolve,reject)=>{const tx=db.transaction(RECOVERY_COPIES_STORE,'readwrite'),store=tx.objectStore(RECOVERY_COPIES_STORE);tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error||new Error('Recovery preservation interrupted.'));tx.onerror=()=>reject(tx.error);
   for(const row of inputs){const q=store.get(row.id);q.onsuccess=()=>{if(!q.result)store.add(row);else if(q.result.ownerUserId!==userId||q.result.projectId!==projectId)tx.abort();};}
  });
  for(const row of inputs){const saved=await new Promise((resolve,reject)=>{const q=db.transaction(RECOVERY_COPIES_STORE,'readonly').objectStore(RECOVERY_COPIES_STORE).get(row.id);q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});await verifyDeviceRecovery(saved.archive,userId,{expectedProjectId:projectId});if(saved.id!==row.id||await recoveryHash(canonicalRecovery({owner:userId,projectId,records:saved.archive.records,settings:saved.archive.localStorage}))!==row.id)throw new Error('Saved recovery evidence differs. Keep the original archive.');}
 }finally{db.close();}
 await assertOwner();return {copies:inputs.length,queuesReactivated:false};
}

// Draft-only portable copies are recovery evidence, never a replacement journal.
// Keep pending operations isolated in the recovery-copies store; do not replay them.
export async function restorePortableDraftRecovery(backup,userId,options={}) {
 if(backup?.deviceRecoverySource?.copyId!=='durable-pending')return null;
 const archive=backup.durableRecoveryArchive;
 if(backup.version!==1||backup.recoveryOwnerId!==userId||!archive||backup.deviceRecoverySource.archiveSha256!==archive.payloadSha256)throw new Error('Choose the original draft recovery copy for this account.');
 // Validate before any storage opens, including a missing durable-evidence payload.
 await verifyDeviceRecovery(archive,userId,{expectedProjectId:options.projectId});
 if(!archive.records.some(r=>r.database===DURABLE_RECOVERY_DATABASE||r.database===RECOVERY_COPIES_DATABASE))throw new Error('This copy contains no durable draft recovery evidence.');
 const receipt=await preservePortableDurableRecovery(backup,userId,options);
 if(!receipt.copies)throw new Error('No draft recovery evidence was saved. Keep the original file.');
 return receipt;
}
