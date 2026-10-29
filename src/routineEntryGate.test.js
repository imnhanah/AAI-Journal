import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRoutineEntryGate, ROUTINE_ENTRY_STALE} from './routineEntryGate.js';
import {normalizeRoutine, completeRoutine, APP_ROUTINE_ITEMS} from './dailyRoutine.js';

function fixture() {
  const events=[];
  let context={userId:'user',workspaceId:'demo',tradeLocked:false};
  let routine=normalizeRoutine();
  let date=new Date('2026-10-15T12:00:00Z');
  const actions={context:()=>context,now:()=>date,loadRoutine:async()=>routine,
    saveRoutine:async ids=>{events.push(['save',ids]);routine=completeRoutine(routine,ids,date);return routine;},
    onPrompt:kind=>events.push(['prompt',kind]),onOpen:entry=>events.push(['open',entry]),
    onDismiss:()=>events.push(['dismiss']),onBusy:value=>events.push(['busy',value]),
    onError:error=>events.push(['error',error.message]),onLocked:()=>events.push(['locked'])};
  return {actions,events,gate:createRoutineEntryGate(()=>actions),setRoutine:value=>{routine=value;},
    setContext:patch=>{context={...context,...patch};},setDate:value=>{date=new Date(value);},
    get routine(){return routine;}};
}
test('first live trade opens the routine, then continues to the original linked-trade draft',async()=>{
  const f=fixture(),draft={premarketMarkupId:'markup',asset:'EUR/USD',session:'London'};
  assert.equal(await f.gate.request('trade',draft),'routine');
  assert.ok(f.events.some(([kind,value])=>kind==='prompt'&&value==='trade'));
  assert.ok(!f.events.some(([kind])=>kind==='open'));
  assert.equal(await f.gate.complete(['slept_enough']),true);
  const entry=f.events.find(([kind])=>kind==='open')[1];
  assert.equal(entry.kind,'trade');assert.deepEqual(entry.draft,draft);
  assert.deepEqual(f.routine.completions['2026-10-15'].tickedIds,['slept_enough']);
});
test('markup and trade entry share the same daily completion',async()=>{
  const f=fixture();
  assert.equal(await f.gate.request('markup'),'routine');
  await f.gate.complete(['moved']);
  assert.equal(f.events.find(([kind])=>kind==='open')[1].kind,'markup');
  assert.equal(await f.gate.request('trade'),'open');
  assert.equal(f.events.filter(([kind])=>kind==='prompt').length,1);
});
test('completed, disabled and empty routines open trade entry directly',async()=>{
  for(const routine of [completeRoutine({},[],new Date('2026-10-15T12:00:00Z')),normalizeRoutine({enabled:false}),normalizeRoutine({appItems:Object.fromEntries(APP_ROUTINE_ITEMS.map(item=>[item.id,{enabled:false}]))})]) {
    const f=fixture();f.setRoutine(routine);
    assert.equal(await f.gate.request('trade'),'open');
    assert.ok(!f.events.some(([kind])=>kind==='prompt'));
  }
});
test('UTC next-day reset prompts again without changing existing checklist completion rules',async()=>{
  const f=fixture();
  await f.gate.request('trade');await f.gate.complete([]);
  assert.equal(await f.gate.request('trade'),'open');
  f.setDate('2026-10-16T00:00:00Z');
  assert.equal(await f.gate.request('trade'),'routine');
});
test('cancelling the routine saves nothing and does not open either form',async()=>{
  const f=fixture();await f.gate.request('trade');f.gate.cancel();
  assert.ok(!f.events.some(([kind])=>kind==='save'||kind==='open'));
  await assert.rejects(f.gate.complete([]),{message:ROUTINE_ENTRY_STALE});
  assert.equal(await f.gate.request('markup'),'routine');
});
test('profile loading failure never bypasses the routine gate',async()=>{
  const f=fixture();f.actions.loadRoutine=async()=>{throw new Error('offline');};
  assert.equal(await f.gate.request('trade'),'error');
  assert.ok(f.events.some(([kind,message])=>kind==='error'&&message==='offline'));
  assert.ok(!f.events.some(([kind])=>kind==='open'||kind==='prompt'));
  assert.deepEqual(f.events.at(-1),['busy',false]);
});
test('failed routine saves preserve the requested trade and allow a real retry',async()=>{
  const f=fixture(),save=f.actions.saveRoutine;
  await f.gate.request('trade',{asset:'GBP/USD'});
  f.actions.saveRoutine=async()=>{throw new Error('save failed');};
  await assert.rejects(f.gate.complete(['moved']),/save failed/);
  assert.ok(!f.events.some(([kind])=>kind==='open'));
  f.actions.saveRoutine=save;await f.gate.complete(['moved']);
  assert.equal(f.events.find(([kind])=>kind==='open')[1].draft.asset,'GBP/USD');
});
test('rapid duplicate requests perform only one profile check and preserve the first intent',async()=>{
  const f=fixture();let finish,calls=0;
  f.actions.loadRoutine=()=>{calls++;return new Promise(resolve=>{finish=resolve;});};
  const first=f.gate.request('trade',{asset:'EUR/USD'});
  assert.equal(await f.gate.request('markup'),'busy');
  finish(f.routine);await first;
  assert.equal(await f.gate.request('markup'),'busy');
  await f.gate.complete([]);
  assert.equal(calls,1);assert.equal(f.events.find(([kind])=>kind==='open')[1].kind,'trade');
});
test('workspace or user changes during profile loading cannot open a stale entry',async()=>{
  for(const patch of [{workspaceId:'live'},{userId:'other'}]) {
    const f=fixture();let finish;
    f.actions.loadRoutine=()=>new Promise(resolve=>{finish=resolve;});
    const pending=f.gate.request('trade');f.setContext(patch);finish(f.routine);
    assert.equal(await pending,'stale');assert.ok(!f.events.some(([kind])=>kind==='open'||kind==='prompt'));
  }
});
test('changing workspace before save rejects the old intent without saving routine data',async()=>{
  const f=fixture();await f.gate.request('trade');f.setContext({workspaceId:'live'});
  await assert.rejects(f.gate.complete([]),{message:ROUTINE_ENTRY_STALE});
  assert.ok(!f.events.some(([kind])=>kind==='save'||kind==='open'));
});
test('workspace changes or cancellation during saving never open a trade on the new account',async()=>{
  for(const cancel of [false,true]) {
    const f=fixture();await f.gate.request('trade');let finish;
    f.actions.saveRoutine=()=>new Promise(resolve=>{finish=resolve;});
    const pending=f.gate.complete([]);
    if(cancel)f.gate.cancel();else f.setContext({workspaceId:'live'});
    finish(completeRoutine({},[],new Date('2026-10-15T12:00:00Z')));
    assert.equal(await pending,false);assert.ok(!f.events.some(([kind])=>kind==='open'));
  }
});
test('trade guardrails are respected before loading, after loading and after routine save',async()=>{
  for(const phase of ['before','loading','saving']) {
    const f=fixture();
    if(phase==='before')f.setContext({tradeLocked:true});
    if(phase==='loading')f.actions.loadRoutine=async()=>{f.setContext({tradeLocked:true});return f.routine;};
    const result=await f.gate.request('trade');
    if(phase==='saving'){f.setContext({tradeLocked:true});assert.equal(await f.gate.complete([]),false);}else assert.equal(result,'locked');
    assert.ok(f.events.some(([kind])=>kind==='locked'));assert.ok(!f.events.some(([kind])=>kind==='open'));
  }
  const f=fixture();f.setContext({tradeLocked:true});assert.equal(await f.gate.request('markup'),'routine');
});
test('all live trade creation entry points use the shared gate; edits and backtests remain separate',()=>{
  const code=readFileSync(new URL('./TradingJournal.jsx',import.meta.url),'utf8');
  assert.match(code,/const openNewTrade = \(draft = null\) => routineGate.current.request\('trade', draft\)/);
  assert.match(code,/onLogTrade=\{openNewTrade\}/);
  assert.match(code,/onNewTrade=\{\(\) => openNewTrade\(\)\}/);
  assert.match(code,/onTrade=\{\(markup\)=>openNewTrade\(\{ premarketMarkupId/);
  assert.match(code,/onClick=\{\(\) => openNewTrade\(\)\}/);
  assert.match(code,/entryKind=\{routineEntryKind\}/);
  assert.match(code,/onClose=\{closeDailyRoutine\}/);
  const popup=readFileSync(new URL('./DailyRoutine.jsx',import.meta.url),'utf8');
  assert.match(popup,/entryKind==='trade'\?'Save & open trade →':'Save & open markup →'/);
  assert.match(popup,/REQUIRE_ALL&&!done/);
});
