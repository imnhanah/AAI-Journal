import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createPrivateCache } from './privateCache.js';
import { planMediaMutation, THIN_COLUMNS, validateImageFile, shouldHandleImagePaste } from './mediaMutation.js';
import { readAllPages } from '../supabase/functions/_shared/readAllPages.js';
import { JOURNAL_TABLES, journalManifest, mergeJournalDelta } from './journalDelta.js';
import { savingsOwner, savingsForBalance } from './financeScope.js';

const tick = () => new Promise(resolve => setImmediate(resolve));
function fixture() {
  const saved = new Map(); const writes = [];
  const cache = createPrivateCache({
    read: async key => saved.get(key),
    write: async (key,value,valid) => { if (valid()) {saved.set(key,value);writes.push(key);} },
    clear: async user => { for (const key of saved.keys()) if (key.startsWith(user+':')) saved.delete(key); },
    evict: async (user,predicate) => {for (const key of saved.keys()) if(key.startsWith(user+':') && predicate(key)) saved.delete(key);},
  });
  return {cache,saved,writes};
}
const ref = (extra = {}) => 'tj-image:' + JSON.stringify({user:'u',table:'trades',id:'t',version:'v1',path:['entry','0'],...extra});
test('cold/warm media cache reuses only the same owner, record and version', async () => {
  const {cache} = fixture(); await cache.activate('u'); let downloads=0;
  const fetch = async () => {downloads++;return 'image';};
  await cache.get('u:trades:t:v1',fetch); await cache.get('u:trades:t:v1',fetch);
  assert.equal(downloads,1);
  await cache.get('u:trades:t:v2',fetch); await cache.get('u:trades:other:v1',fetch);
  assert.equal(downloads,3);
  await cache.activate('v'); await cache.get('v:trades:t:v1',fetch); assert.equal(downloads,4);
});
test('logout clears cached private data and blocks further reads', async () => {
  const {cache,saved} = fixture(); await cache.activate('u'); await cache.get('u:media',async()=> 'private');
  await cache.activate(null); assert.equal(saved.size,0);
  await assert.rejects(cache.get('u:media',async()=> 'leak'),/Sign in/);
});
test('failed media fetch is never cached as empty or successful', async () => {
  const {cache,saved} = fixture(); await cache.activate('u');
  await assert.rejects(cache.get('u:media',async()=>{throw new Error('offline');}),/offline/);
  assert.equal(saved.size,0);
  assert.equal(await cache.get('u:media',async()=> 'recovered'),'recovered');
});
test('stale in-flight request cannot repopulate data after mutation or logout', async () => {
  for (const action of ['mutation','logout']) {
    const {cache,saved,writes} = fixture(); await cache.activate('u'); let finish;
    const pending = cache.get('u:media',()=>new Promise(resolve=>{finish=resolve;}));
    await tick();
    if (action==='logout') await cache.activate(null); else await cache.invalidate(()=>true);
    finish('stale'); await assert.rejects(pending,/superseded/);
    assert.equal(saved.size,0); assert.equal(writes.length,0);
  }
});
test('parallel loads deduplicate and text-only invalidation preserves versioned images', async () => {
  const {cache} = fixture(); await cache.activate('u'); let calls=0;
  const fetch=async()=>{calls++;await tick();return 'image';};
  await Promise.all([cache.get('u:media:v1',fetch),cache.get('u:media:v1',fetch)]);
  await cache.invalidate(()=>false); await cache.get('u:media:v1',fetch);
  assert.equal(calls,1);
  await cache.invalidate(()=>true); await cache.get('u:media:v1',fetch); assert.equal(calls,2);
});
test('text-only writes omit unchanged or never-loaded screenshot columns', () => {
  const shots = {entry:[ref()],exit:[]};
  assert.equal(planMediaMutation({table:'trades',id:'t',incoming:shots,previous:shots}).write,false);
  assert.equal(planMediaMutation({table:'trades',id:'t',incoming:undefined,previous:shots}).write,false);
  assert.equal(planMediaMutation({table:'trades',id:'t',incoming:[],previous:undefined}).write,false);
  assert.throws(()=>planMediaMutation({table:'trades',id:'t',incoming:[],previous:shots}),/explicitly removed/);
  assert.equal(planMediaMutation({table:'trades',id:'t',incoming:[],previous:shots,edited:true}).write,true);
  assert.throws(()=>planMediaMutation({table:'trades',id:'t',incoming:[ref({id:'other'})],previous:shots,edited:true}),/different record/);
  for(const columns of Object.values(THIN_COLUMNS)) assert.doesNotMatch(columns,/screenshots|profile_image|avatar|snapshot/);
});
test('thin save query implementations do not return screenshot-bearing rows', () => {
  const code=readFileSync(new URL('./db.js',import.meta.url),'utf8');
  for(const fn of ['createTrade','updateTrade','createMarkup','updateMarkup','saveTradeReview']) {
    const line=code.split('\n').find(line=>line.startsWith('export async function '+fn+'('));
    assert.match(line,/select\(THIN_COLUMNS\./); assert.doesNotMatch(line,/\.select\(\)/);
  }
  const accountUpdate=code.split('\n').find(line=>line.startsWith('export async function updateAccount('));
  assert.doesNotMatch(accountUpdate,/profile_image:null/);
});
test('metadata bootstrap allowlist excludes avatars, arbitrary snapshots and period bodies', () => {
  const sql=readFileSync(new URL('../supabase/journal_egress_hardening.sql',import.meta.url),'utf8');
  for(const line of sql.split('\n').filter(line=>line.includes('when ') && line.includes(' then '))) assert.doesNotMatch(line,/profile_image|avatar_url|share_snapshot|screenshots|,content[,']/);
  assert.match(sql,/security invoker/); assert.match(sql,/t\.user_id = \$1/); assert.match(sql,/order by key/);
  assert.doesNotMatch(sql,/delete from|drop table|disable row level/i);
});
test('bootstrap retains all 1,203 historical rows, counts and all-time P&L', () => {
  const rows=Array.from({length:1203},(_,i)=>({id:String(i).padStart(6,'0'),updated_at:'v1',trade_date:'2020-01-01',pnl:i%2?20:-10}));
  const response={tables:Object.fromEntries(JOURNAL_TABLES.map(table=>[table,{rows:table==='trades'?rows:[],deleted:[],available:true}]))};
  const cold=mergeJournalDelta({},response);
  assert.equal(cold.trades.length,1203);
  assert.equal(cold.trades.reduce((sum,row)=>sum+row.pnl,0),rows.reduce((sum,row)=>sum+row.pnl,0));
  const known=journalManifest(cold); assert.equal(Object.keys(known.trades).length,1203);
  const warm=mergeJournalDelta(cold,{tables:Object.fromEntries(JOURNAL_TABLES.map(table=>[table,{rows:[],deleted:[],available:true}]))});
  assert.deepEqual(warm.trades,cold.trades);
});
test('savings bootstrap preserves the selected owner and reminder across cold and warm reloads', () => {
  const sql=readFileSync(new URL('../supabase/journal_egress_hardening.sql',import.meta.url),'utf8');
  const fields=sql.match(/when 'savings_accounts' then '([^']+)'/)[1].split(',');
  const saved={id:'saving',user_id:'u',account_id:'workspace',balance_id:'second',name:'Savings',target:100000,allocation_pct:20,transfer_interval:'Weekly',reminder_minutes:90,updated_at:'v2'};
  const projected=Object.fromEntries(Object.entries(saved).filter(([key])=>fields.includes(key)));
  assert.deepEqual(projected,saved);
  const response=rows=>({protocol:3,tables:Object.fromEntries(JOURNAL_TABLES.map(table=>[table,{rows:table==='savings_accounts'?rows:[],deleted:[],available:true}]))});
  const cold=mergeJournalDelta({},response([projected]));
  const warm=mergeJournalDelta(cold,response([]));
  for(const snapshot of [cold,warm]) {
    const row=snapshot.savings_accounts[0];
    const plan={id:row.id,balanceId:row.balance_id,reminderMinutes:row.reminder_minutes};
    const account={balances:[{id:'first'},{id:'second'}],savingsAccounts:[plan]};
    assert.equal(savingsOwner(account,plan),'second');
    assert.equal(plan.reminderMinutes,90);
    assert.deepEqual(savingsForBalance(account,'first'),[]);
    assert.deepEqual(savingsForBalance(account,'second'),[plan]);
    assert.equal(savingsOwner(account,{id:'legacy'}),'first');
  }
});
test('bootstrap refreshes pre-fix caches without changing stored rows or weakening owner isolation', () => {
  const sql=readFileSync(new URL('../supabase/journal_egress_hardening.sql',import.meta.url),'utf8');
  const accepted=sql.match(/known ->> '_protocol' = '(\d+)'/)[1];
  const returned=Number(sql.match(/'tables',result,'protocol',(\d+)/)[1]);
  assert.equal(accepted,'3');
  assert.equal(returned,3);
  assert.notEqual(accepted,'2','pre-fix caches must trigger an authoritative refresh');
  assert.equal(journalManifest(mergeJournalDelta({}, {protocol:returned,tables:Object.fromEntries(JOURNAL_TABLES.map(table=>[table,{rows:[],deleted:[],available:true}]))}))._protocol,returned);
  assert.match(sql,/else '\{\}'::jsonb end/);
  assert.match(sql,/t\.user_id = \$1/);
  assert.match(sql,/security invoker/);
  assert.doesNotMatch(sql,/update public\.|delete from|drop table|disable row level/i);
});
test('keyset pagination includes records beyond 1,000 with stable ID ordering', async () => {
  const rows=Array.from({length:1501},(_,i)=>({id:String(i).padStart(6,'0'),date:'2020-01-01'}));
  const cursors=[];
  const result=await readAllPages(async(after,size)=>{cursors.push(after);return {data:rows.filter(row=>after===null||row.id>after).slice(0,size),error:null};});
  assert.deepEqual(result,rows); assert.deepEqual(cursors,[null,'000499','000999','001499','001500']);
  const capped = await readAllPages(async(after)=>({data:rows.filter(row=>after===null||row.id>after).slice(0,100),error:null}));
  assert.deepEqual(capped,rows);
  await assert.rejects(readAllPages(async()=>({data:null,error:{message:'offline'}})),/offline/);
});
test('one paste targets only the intentionally active uploader; duplicate images remain allowed', () => {
  const rootA={contains:()=>true}, rootB={contains:()=>false};
  const target={closest:selector=>selector==='[data-image-uploader]'?rootA:null};
  const event={target,defaultPrevented:false};
  assert.equal(shouldHandleImagePaste(event,rootA),true);
  event.defaultPrevented=true; assert.equal(shouldHandleImagePaste(event,rootA),false);
  event.defaultPrevented=false; assert.equal(shouldHandleImagePaste(event,rootB),false);
  const file={size:1024,type:'image/png'}; assert.equal(validateImageFile(file),''); assert.equal(validateImageFile(file),'');
  assert.match(validateImageFile({size:11*1024*1024,type:'image/png'}),/10 MB/);
});
