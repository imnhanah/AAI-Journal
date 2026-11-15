import {SyncSafetyError, requiredString} from './syncSession.js';

export const SYNC_DATABASE_NAME='tj-sync-foundation-v1';
export const SYNC_DATABASE_VERSION=1;
export const SYNC_STORES=Object.freeze(['drafts','history','operations','receipts']);

// No database opens at import time. No fallback may report memory-only bytes as durable.
export function createIndexedDbSyncStorage({indexedDB=globalThis.indexedDB, databaseName=SYNC_DATABASE_NAME}={}) {
  requiredString(databaseName,'databaseName');
  if (!databaseName.startsWith('tj-sync-foundation-')) throw new SyncSafetyError('UNSAFE_DATABASE_NAME');
  async function open() {
    if (!indexedDB) throw new SyncSafetyError('STORAGE_UNAVAILABLE');
    return new Promise((resolve,reject)=>{
      let request, settled=false;
      const fail=error=>{if(!settled){settled=true;reject(error || new SyncSafetyError('STORAGE_UNAVAILABLE'));}};
      try {request=indexedDB.open(databaseName,SYNC_DATABASE_VERSION);} catch(error){fail(error);return;}
      request.onblocked=()=>fail(new SyncSafetyError('STORAGE_BLOCKED'));
      request.onerror=()=>fail(request.error);
      request.onupgradeneeded=()=>{
        if(settled){request.transaction.abort();return;}
        for(const name of SYNC_STORES){
          const store=request.result.createObjectStore(name,{keyPath:'key'});
          store.createIndex('scope','scope',{unique:false});
        }
      };
      request.onsuccess=()=>{
        const db=request.result;
        if(settled){db.close();return;}
        try{
          if(db.objectStoreNames.length!==SYNC_STORES.length || SYNC_STORES.some(name=>!db.objectStoreNames.contains(name)))throw new SyncSafetyError('UNKNOWN_STORAGE_SCHEMA');
          const inspection=db.transaction(SYNC_STORES,'readonly');
          for(const name of SYNC_STORES){
            const store=inspection.objectStore(name);
            if(store.keyPath!=='key'||store.autoIncrement||!store.indexNames.contains('scope')||store.index('scope').keyPath!=='scope'||store.index('scope').unique)throw new SyncSafetyError('UNKNOWN_STORAGE_SCHEMA');
          }
        }catch(error){db.close();fail(error);return;}
        db.onversionchange=()=>db.close();settled=true;resolve(db);
      };
    });
  }
  return Object.freeze({
    async transaction(mode, work, fence) {
      fence.assert();
      const db=await open();
      try{fence.assert();}catch(error){db.close();throw error;}
      return new Promise((resolve,reject)=>{
        let tx,result,failure,finished=false,workComplete=false;
        const fail=error=>{failure ||= error;try{tx?.abort();}catch{};};
        try{tx=db.transaction(SYNC_STORES,mode);}catch(error){db.close();reject(error);return;}
        const unsubscribe=fence.subscribe(()=>fail(new SyncSafetyError('SESSION_CHANGED')));
        const cleanup=()=>{finished=true;unsubscribe();db.close();};
        tx.onabort=()=>{cleanup();reject(failure || tx.error || new SyncSafetyError('TRANSACTION_ABORTED'));};
        tx.onerror=()=>{failure ||= tx.error;};
        tx.oncomplete=()=>{
          cleanup();
          try{fence.assert();if(!workComplete)throw new SyncSafetyError('ASYNC_TRANSACTION_WORK');resolve(result);}catch(error){reject(error);}
        };
        const request = (name, method, ...args) => new Promise((yes,no)=>{
          try{
            fence.assert();const objectStore=tx.objectStore(name);
            const req=method==='list' ? objectStore.index('scope').getAll(args[0]) : objectStore[method](...args);
            req.onsuccess=()=>{try{fence.assert();yes(req.result);}catch(error){no(error);fail(error);}};
            req.onerror=()=>{failure ||= req.error;no(req.error);};
          }catch(error){no(error);fail(error);}
        });
        const api={get:(s,k)=>request(s,'get',k),list:(s,scope)=>request(s,'list',scope),put:(s,v)=>request(s,'put',v)};
        // Work may await only IndexedDB requests; never network, timers or user callbacks.
        void (async()=>{try{fence.assert();result=await work(api);fence.assert();workComplete=true;}catch(error){if(!finished)fail(error);}})();
      });
    },
  });
}
