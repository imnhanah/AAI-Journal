import {SyncSafetyError,requiredString} from './syncSession.js';
import {normalizeSaveOutcome,savedOutcome} from './syncOutcome.js';

const SCHEMA=1;
const clone=value=>structuredClone(value);
const assert=(condition,code)=>{if(!condition)throw new SyncSafetyError(code);};
const safeInteger=(n,min=0)=>Number.isSafeInteger(n)&&n>=min;
const validBase=value=>typeof value==='string'&&value.trim().length>0;
function canonical(value,depth=0){
  assert(depth<=64,'PAYLOAD_TOO_DEEP');
  if(value===null || typeof value==='string' || typeof value==='boolean')return JSON.stringify(value);
  if(typeof value==='number'){assert(Number.isFinite(value),'INVALID_PAYLOAD');return JSON.stringify(value);}
  if(Array.isArray(value)){
    assert(Object.getOwnPropertySymbols(value).length===0 && Object.keys(value).length===value.length && Object.getOwnPropertyNames(value).length===value.length+1,'INVALID_PAYLOAD');
    for(let i=0;i<value.length;i++){const descriptor=Object.getOwnPropertyDescriptor(value,String(i));assert(descriptor?.enumerable && 'value' in descriptor,'INVALID_PAYLOAD');}
    return '['+value.map(v=>canonical(v,depth+1)).join(',')+']';
  }
  assert(value&&typeof value==='object' && [Object.prototype,null].includes(Object.getPrototypeOf(value)),'INVALID_PAYLOAD');
  assert(Object.getOwnPropertySymbols(value).length===0,'INVALID_PAYLOAD');
  for(const descriptor of Object.values(Object.getOwnPropertyDescriptors(value)))assert(descriptor.enumerable && 'value' in descriptor,'INVALID_PAYLOAD');
  return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k],depth+1)).join(',')+'}';
}
function names(values,name){
  assert(Array.isArray(values) && values.length<=32,'INVALID_ARGUMENT');
  const result=values.map(v=>requiredString(v,name));assert(new Set(result).size===result.length,'INVALID_ARGUMENT');return [...result].sort();
}
const checkRow=(row,scope)=>{
  if(!row)return row;
  assert(row.schemaVersion===SCHEMA,'UNKNOWN_RECORD_SCHEMA');
  assert(row.scope?.[0]===scope[0] && row.scope?.[1]===scope[1],'SCOPE_MISMATCH');
  return row;
};

// Pure data repository: no transport, subscription, automatic replay or application imports.
export function createDurableSync({storage,session,clock=()=>Date.now(),crypto=globalThis.crypto}={}){
  assert(storage?.transaction && session?.capture,'INVALID_CONFIGURATION');
  const now=()=>{const n=clock();assert(Number.isSafeInteger(n)&&n>=0,'INVALID_CLOCK');return n;};
  const run=async(mode,work)=>{
    const token=session.capture(),scope=[token.projectId,token.ownerId];
    const fence={assert:()=>session.assert(token),subscribe:listener=>session.subscribe(listener)};
    const result=await storage.transaction(mode,tx=>work(tx,scope),fence);session.assert(token);return clone(result);
  };
  const draftKey=(scope,feature,id)=>[...scope,requiredString(feature,'feature'),requiredString(id,'recordId')];
  const opKey=(scope,id)=>[...scope,requiredString(id,'operationId')];
  const checkedDraft=async(tx,scope,key)=>{
    const row=checkRow(await tx.get('drafts',key),scope);
    if(row)assert(safeInteger(row.revision,1),'INVALID_DRAFT_SCHEMA');
    return row;
  };
  const checkedOperation=async(tx,scope,id)=>{
    const row=checkRow(await tx.get('operations',opKey(scope,id)),scope);
    if(row)assert(safeInteger(row.version,1) && ['paused','pending','in-flight','retry-wait','conflict','needs-review','failed','confirmed'].includes(row.status),'INVALID_OPERATION_SCHEMA');
    return row;
  };
  const prepared=payload=>{canonical(payload);return clone(payload);};
  const writeDraft=async(tx,scope,input,operationId=null)=>{
    const key=draftKey(scope,input.feature,input.recordId),old=await checkedDraft(tx,scope,key);
    assert(safeInteger(input.expectedRevision) && (old?.revision||0)===input.expectedRevision,'DRAFT_CONFLICT');
    assert(input.baseRevision===null||validBase(input.baseRevision),'BASE_REVISION_REQUIRED');
    const draft={schemaVersion:SCHEMA,key,scope,feature:input.feature,recordId:input.recordId,revision:(old?.revision||0)+1,
      payload:input.payload,baseRevision:input.baseRevision,operationId,lastOperationId:operationId||old?.lastOperationId||null,state:operationId?'queued':'draft',updatedAt:now()};
    await tx.put('drafts',draft);
    await tx.put('history',{...draft,key:[...key,draft.revision]});
    return draft;
  };
  const leased=(op,token)=>{
    assert(op&&op.status==='in-flight'&&op.lease?.token===token,'LEASE_LOST');
    assert(op.lease.expiresAt>now(),'LEASE_EXPIRED');
  };
  return Object.freeze({
    readDraft(feature,recordId){return run('readonly',async(tx,scope)=>(await checkedDraft(tx,scope,draftKey(scope,feature,recordId)))||null);},
    readHistory(feature,recordId){return run('readonly',async(tx,scope)=>{
      draftKey(scope,feature,recordId);
      return (await tx.list('history',scope)).map(row=>checkRow(row,scope)).filter(row=>row.feature===feature&&row.recordId===recordId).sort((a,b)=>a.revision-b.revision);
    });},
    saveDraft(input){
      const value={...input,payload:prepared(input.payload)};
      return run('readwrite',async(tx,scope)=>{const draft=await writeDraft(tx,scope,value);return {draft,outcome:savedOutcome({target:'local',revision:draft.revision})};});
    },
    async stageWrite(input){
      input={...input};
      const token=session.capture(),payload=prepared(input.payload),requiredParts=names(input.requiredParts||['record'],'requiredPart'),dependencies=names(input.dependencies||[],'dependency');
      requiredString(input.operationId,'operationId');assert(['create','update','delete'].includes(input.intent),'INVALID_INTENT');
      assert(input.intent==='create'?input.baseRevision===null:validBase(input.baseRevision),'BASE_REVISION_REQUIRED');
      assert(requiredParts.length>0&&!dependencies.includes(input.operationId),'INVALID_DEPENDENCY');
      // SHA is computed before the IDB transaction. Replays retain the same operation ID and payload.
      assert(crypto?.subtle,'HASH_UNAVAILABLE');
      const request={feature:input.feature,recordId:input.recordId,payload,intent:input.intent,baseRevision:input.baseRevision,requiredParts,dependencies};
      const fingerprint=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical(request))))).map(b=>b.toString(16).padStart(2,'0')).join('');
      session.assert(token);
      return run('readwrite',async(tx,scope)=>{
        const existing=await checkedOperation(tx,scope,input.operationId);
        if(existing){assert(existing.fingerprint===fingerprint,'OPERATION_ID_REUSE');return {operation:existing,replayed:true};}
        const key=draftKey(scope,input.feature,input.recordId),old=await checkedDraft(tx,scope,key);
        if(old?.lastOperationId){
          const previous=await checkedOperation(tx,scope,old.lastOperationId);
          assert(previous?.status==='confirmed','PRIOR_OPERATION_UNRESOLVED');
          const receipt=checkRow(await tx.get('receipts',opKey(scope,previous.operationId)),scope);
          assert(receipt&&input.intent!=='create'&&input.baseRevision===receipt.serverRevision,'BASE_REVISION_CHANGED');
        }
        for(const dependency of dependencies)assert(await checkedOperation(tx,scope,dependency),'DEPENDENCY_MISSING');
        const draft=await writeDraft(tx,scope,{...input,payload},input.operationId);
        const operation={schemaVersion:SCHEMA,key:opKey(scope,input.operationId),scope,operationId:input.operationId,...request,payload:clone(payload),fingerprint,
          draftRevision:draft.revision,version:1,status:'paused',reason:'explicit-resume-required',attempts:0,availableAt:now(),lease:null,createdAt:now()};
        await tx.put('operations',operation);
        return {draft,operation,replayed:false};
      });
    },
    getOperation(id){return run('readonly',async(tx,scope)=>(await checkedOperation(tx,scope,id))||null);},
    listOperations(){return run('readonly',async(tx,scope)=>{
      const rows=await tx.list('operations',scope);for(const row of rows)await checkedOperation(tx,scope,row.operationId);return rows;
    });},
    // Resuming is explicit local intent, not a cloud permission grant. No worker runs here.
    resumeOperation(id,expectedVersion){return run('readwrite',async(tx,scope)=>{
      const op=await checkedOperation(tx,scope,id);assert(op&&op.version===expectedVersion,'OPERATION_CONFLICT');assert(op.status==='paused','RECONCILIATION_REQUIRED');
      const next={...op,status:'pending',reason:null,version:op.version+1};await tx.put('operations',next);return next;
    });},
    claimOperation(id,{workerId,leaseMs=30000}={}){
      requiredString(workerId,'workerId');assert(safeInteger(leaseMs,1000)&&leaseMs<=120000,'INVALID_LEASE');
      const leaseToken=crypto?.randomUUID?.();assert(leaseToken,'RANDOM_UNAVAILABLE');
      return run('readwrite',async(tx,scope)=>{
        const op=await checkedOperation(tx,scope,id);if(!op)return null;
        if(op.status==='in-flight'){
          if(op.lease.expiresAt>now())return null;
          // The server may have committed. Expiry alone never authorizes a resend.
          await tx.put('operations',{...op,status:'needs-review',reason:'lease-expired-reconcile-before-retry',lease:null,version:op.version+1});return null;
        }
        if(!['pending','retry-wait'].includes(op.status)||op.availableAt>now())return null;
        for(const dependency of op.dependencies){
          const receipt=checkRow(await tx.get('receipts',opKey(scope,dependency)),scope);if(!receipt)return null;
        }
        const next={...op,status:'in-flight',attempts:op.attempts+1,version:op.version+1,lease:{workerId,token:leaseToken,expiresAt:now()+leaseMs}};
        await tx.put('operations',next);return next;
      });
    },
    renewLease(id,leaseToken,leaseMs=30000){
      assert(safeInteger(leaseMs,1000)&&leaseMs<=120000,'INVALID_LEASE');
      return run('readwrite',async(tx,scope)=>{const op=await checkedOperation(tx,scope,id);leased(op,leaseToken);
        const next={...op,version:op.version+1,lease:{...op.lease,expiresAt:now()+leaseMs}};await tx.put('operations',next);return next;
      });
    },
    finishOperation(id,leaseToken,result){
      const outcome=normalizeSaveOutcome(result);
      return run('readwrite',async(tx,scope)=>{
        const op=await checkedOperation(tx,scope,id);assert(op,'OPERATION_MISSING');
        if(op.status==='confirmed'){
          const receipt=checkRow(await tx.get('receipts',opKey(scope,id)),scope);
          assert(outcome.status==='saved'&&outcome.target==='cloud'&&outcome.operationId===id&&receipt?.serverRevision===outcome.revision,'RECEIPT_MISMATCH');
          return {operation:op,receipt,replayed:true};
        }
        leased(op,leaseToken);
        if(outcome.status==='saved'&&outcome.target==='cloud'&&outcome.operationId===id&&op.requiredParts.every(part=>outcome.parts.includes(part))){
          const receipt={schemaVersion:SCHEMA,key:op.key,scope,operationId:id,fingerprint:op.fingerprint,serverRevision:outcome.revision,parts:[...outcome.parts],confirmedAt:now()};
          const next={...op,status:'confirmed',lease:null,version:op.version+1,reason:null};
          await tx.put('receipts',receipt);await tx.put('operations',next);
          const key=draftKey(scope,op.feature,op.recordId),draft=await checkedDraft(tx,scope,key);
          if(draft?.revision===op.draftRevision&&draft.operationId===id)await tx.put('drafts',{...draft,state:'confirmed',confirmedRevision:outcome.revision});
          return {operation:next,receipt,replayed:false};
        }
        const retry=outcome.status==='failed'&&outcome.retryable&&outcome.definite;
        const status=outcome.status==='conflict'?'conflict':retry?'retry-wait':outcome.status==='failed'?'failed':'needs-review';
        const next={...op,status,reason:outcome.error||'incomplete-or-mismatched-receipt',lease:null,version:op.version+1,
          availableAt:retry?now()+Math.min(60000,1000*2**Math.min(op.attempts-1,6)):op.availableAt};
        await tx.put('operations',next);return {operation:next,receipt:null,replayed:false};
      });
    },
  });
}
