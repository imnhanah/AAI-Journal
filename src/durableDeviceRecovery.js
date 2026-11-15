// Pure validation/read helpers. No SDK, worker, active restore, or import-time storage opens.
export const DURABLE_RECOVERY_DATABASE = 'tj-sync-foundation-v1';
export const DURABLE_RECOVERY_STORES = Object.freeze(['drafts','history','operations','receipts']);
export const RECOVERY_COPIES_DATABASE = 'tj-phase-a-recovery-copies';
export const RECOVERY_COPIES_STORE = 'copies';
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function verifyDurableRecoveryRow(row,ownerId,projectId) {
  const value=row?.value;
  if(!projectId||!DURABLE_RECOVERY_STORES.includes(row?.store)||value?.schemaVersion!==1||!Array.isArray(value.scope)||value.scope.length!==2||value.scope[0]!==projectId||value.scope[1]!==ownerId||!Array.isArray(row.key)||!same(row.key,value.key)||!same(row.key.slice(0,2),value.scope))throw new Error('Durable recovery scope or schema does not match. Keep the source device.');
  const size=row.store==='drafts'?4:row.store==='history'?5:3;
  if(row.key.length!==size||row.key.slice(0,row.store==='history'?4:size).some(x=>typeof x!=='string'||!x))throw new Error('Invalid durable recovery key.');
  if((row.store==='drafts'||row.store==='history')&&(!Number.isSafeInteger(value.revision)||value.revision<1||value.feature!==row.key[2]||value.recordId!==row.key[3]))throw new Error('Invalid durable draft revision.');
  if(row.store==='history'&&row.key[4]!==value.revision)throw new Error('Invalid durable history key.');
  if((row.store==='operations'||row.store==='receipts')&&value.operationId!==row.key[2])throw new Error('Invalid durable operation key.');
  return true;
}
export async function readDurableRecoveryRows(db,ownerId,projectId) {
  if(!projectId||db.version!==1||db.objectStoreNames.length!==DURABLE_RECOVERY_STORES.length||DURABLE_RECOVERY_STORES.some(s=>!db.objectStoreNames.contains(s)))throw new Error('Confirm this project and the durable storage version before exporting.');
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(DURABLE_RECOVERY_STORES,'readonly'),rows=[];let failure;
    tx.onabort=()=>reject(failure||tx.error||new Error('Durable recovery read interrupted.'));
    tx.onerror=()=>{failure ||= tx.error;};
    tx.oncomplete=()=>resolve(rows.sort((a,b)=>JSON.stringify([a.store,a.key]).localeCompare(JSON.stringify([b.store,b.key]))));
    for(const store of DURABLE_RECOVERY_STORES){
      const object=tx.objectStore(store);
      try{
        if(object.keyPath!=='key'||object.autoIncrement||!object.indexNames.contains('scope')||object.index('scope').keyPath!=='scope'||object.index('scope').unique)throw new Error('Unknown durable storage shape.');
        const request=object.index('scope').getAll([projectId,ownerId]);
        request.onsuccess=()=>{try{for(const value of request.result){const row={database:DURABLE_RECOVERY_DATABASE,store,key:value.key,value};verifyDurableRecoveryRow(row,ownerId,projectId);rows.push(row);}}catch(error){failure=error;tx.abort();}};
      }catch(error){failure=error;tx.abort();break;}
    }
  });
}
