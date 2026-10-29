import {supabase} from './supabaseClient';
import {privateCache,notifyJournalMutation} from './privateCacheRuntime';
import {mergeBacktestDelta,protectTestTrade} from './backtestModel';
import {backtestProfileKey,scopeBacktests} from './backtestWorkspace';
const key=user=>`journal:${user}:backtest`;
export const readBacktestCache=user=>privateCache.read(backtestProfileKey(user));
async function rpc(name,args) {
  const {data,error}=await supabase.rpc(name,args);
  if(error)throw new Error(error.code==='PGRST202'||error.code==='42P01'?'Apply supabase/backtest_accounts.sql in the Supabase SQL Editor, then retry. Your existing backtest trades are unchanged.':error.message);
  if(data==null)throw new Error('Backtest request returned no data. Please retry.');
  return data;
}
export async function preloadBacktests(user) {
  if(privateCache.token().owner!==user)throw new Error('Session changed.');
  const previous=await privateCache.read(key(user))||{runs:[],trades:[]};
  let next=await privateCache.get(key(user),async()=>mergeBacktestDelta(previous,await rpc('tj_sync_backtests',{known:{runs:previous.runs.map(x=>({id:x.id,updatedAt:x.updatedAt})),trades:previous.trades.map(x=>({id:x.id,updatedAt:x.updatedAt}))}})),{refresh:true});
  const versions=new Map(next.trades.map(t=>[t.id,t.updatedAt]));
  const changed=previous.trades.filter(t=>versions.get(t.id)!==t.updatedAt).map(t=>`${key(user)}:media:${t.id}:`);
  if(changed.length)await privateCache.invalidate(k=>changed.some(prefix=>k.startsWith(prefix)));
  return next;
}
export async function syncBacktests(user) {
  const all=await preloadBacktests(user);
  return privateCache.get(backtestProfileKey(user),async()=>scopeBacktests(all),{refresh:true});
}
export async function saveTestRun(run,remove=false) {
  return rpc('tj_save_backtest_run',{row_id:run.id,expected_version:run.updatedAt||null,settings:run,remove_row:remove});
}
export async function saveTestTrade(run,trade,remove=false) {
  const safe=protectTestTrade(run,trade);
  return rpc('tj_save_backtest_trade',{row_id:trade.id,run_id:run.id,expected_version:trade.updatedAt||null,trade_data:safe.metadata,media:safe.screenshots??null,remove_row:remove});
}
export async function loadTestMedia(user,trade) {
  if(privateCache.token().owner!==user)throw new Error('Session changed before opening backtest screenshots.');
  const scoped=await readBacktestCache(user);
  if(!scoped?.trades.some(row=>row.id===trade.id&&row.runId===trade.runId))throw new Error('Backtest screenshot is not in this workspace.');
  return privateCache.get(`${key(user)}:media:${trade.id}:${trade.updatedAt}`,()=>rpc('tj_backtest_media',{row_id:trade.id,media_version:trade.updatedAt}));
}
export async function refreshTestCache(user) {
  if(privateCache.token().owner!==user)throw new Error('Session changed during backtest save.');
  await privateCache.invalidate(()=>false);
  const next=await syncBacktests(user);
  notifyJournalMutation('backtest',false);
  return next;
}
