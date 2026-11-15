import {privateCache} from './privateCacheRuntime';
import {getJournalSafety,listSafetyDrafts} from './journalDataSafety.js';
import {decodeDraftValue} from './journalPayloadCodecs.js';
import {isLocalJournal} from './localJournalDb';
const legacyKey=user=>`journal:${user}:pending-trades`;
export async function pendingTradeSaves(userId){
  const mode=isLocalJournal()?'local':'cloud';
  let legacy=[];try{legacy=(await privateCache.read(legacyKey(userId)))||[];}catch{}
  const rows=await listSafetyDrafts(userId,'pending-trade',{mode});
  const result=new Map((Array.isArray(legacy)?legacy:[]).filter(x=>x?.trade?.id&&x?.accountId).map(x=>[JSON.stringify([x.accountId,x.trade.id]),x]));
  for(const row of rows){
    if(row.payload?.codecVersion!==1)throw new Error('Unknown pending-trade format. Original data is retained.');
    const item=decodeDraftValue(row.payload.value),key=JSON.stringify([item.accountId,item.trade.id]);
    if(row.payload.state==='dirty')result.set(key,item);else result.delete(key);
  }
  if((isLocalJournal()?'local':'cloud')!==mode)throw new Error('Storage mode changed during pending-work recovery.');
  return [...result.values()];
}
export async function queueTradeSave(userId,accountId,trade,kind){
  const mode=isLocalJournal()?'local':'cloud',context=getJournalSafety(userId,{mode}).forWorkspace(accountId);
  const next={accountId,trade,kind:kind==='update'?'update':'create',savedAt:new Date().toISOString(),token:globalThis.crypto.randomUUID()};
  const draft=context.draft('pending-trade',trade.id,next);
  await draft.ready();draft.edit(next);const captured=await draft.capture();
  return {...next,receipt:{captured,mode,accountId,tradeId:trade.id}};
}
export async function clearPendingTradeSave(userId,accountId,tradeId,receipt){
  if(!receipt||receipt.accountId!==accountId||receipt.tradeId!==tradeId)throw new Error('A matching complete-operation receipt is required.');
  const draft=getJournalSafety(userId,{mode:receipt.mode}).forWorkspace(accountId).draft('pending-trade',tradeId,{});
  return draft.acknowledge(receipt.captured);
}
