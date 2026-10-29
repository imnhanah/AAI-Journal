import test from 'node:test';
import assert from 'node:assert/strict';
import { activeRoutineItems, normalizeRoutine, routineDayKey, routineRequired, completeRoutine, routineHistory, resetCountdown, REQUIRE_ALL, reorderRoutine, loadRoutineProfile, saveRoutineProfile } from './dailyRoutine.js';
import { readFileSync } from 'node:fs';
const noon=new Date('2026-10-09T12:00:00Z');
test('profile routine card keeps only controls and labels',()=>{
  const source=readFileSync(new URL('./DailyRoutine.jsx',import.meta.url),'utf8');
  const card=source.slice(source.indexOf('export function DailyRoutineProfileCard'),source.indexOf('export function DailyRoutineManagement'));
  assert.match(card,/tj-profile-routine-status/);
  assert.match(card,/Start Day routine/);
  assert.match(card,/Routine items/);
  assert.doesNotMatch(card,/Your routine items/);
  assert.match(card,/Open Management ↗/);
  assert.doesNotMatch(card,/when the Tokyo session opens/);
  assert.doesNotMatch(card,/Markups and trades open straight to their entry forms/);
  assert.doesNotMatch(card,/Edit them in Management\. The same list applies in every workspace\./);
  assert.doesNotMatch(card,/aria-describedby="profile-routine-description"/);
});
test('management reference includes one editable routine list and accessible reordering',()=>{
  const source=readFileSync(new URL('./DailyRoutine.jsx',import.meta.url),'utf8');
  const css=readFileSync(new URL('./dailyRoutine.css',import.meta.url),'utf8');
  assert.match(source,/tj-routine-management-banner/);
  assert.match(source,/Restore recommended items/);
  assert.doesNotMatch(source,/tj-routine-reorder-note|tj-routine-management-footer/);
  assert.match(source,/tj-routine-management-status[\s\S]*Routine is off[\s\S]*Restore recommended items/);
  assert.doesNotMatch(source,/Change in Profile settings ↗/);
  assert.match(source,/deleteItem/);
  assert.match(source,/routineItems\(routine\)/);
  assert.doesNotMatch(source,/<h3>Your items<\/h3>/);
  assert.match(source,/role="switch" aria-label=\{item.label\} aria-checked=\{item.enabled!==false\}/);
  assert.match(source,/className=\{`tj-routine-status-chip \$\{routine\.enabled\?'is-on':''\}`\} role="switch" aria-checked=\{routine\.enabled\}/);
  assert.match(source,/save\(r=>\(\{\.\.\.r,enabled:!r\.enabled\}\)\)/);
  assert.match(source,/const listDisabled=busy\|\|!routine\.enabled;/);
  assert.match(source,/className="tj-routine-list" aria-disabled=\{listDisabled\}/);
  assert.match(source,/disabled=\{listDisabled\}/);
  assert.match(css,/\.tj-routine-management\.is-routine-off \.tj-routine-list \{opacity:\.48;\}/);
  assert.match(source,/updateItem\(r,item,\{enabled:item.enabled===false\}\)/);
  assert.match(source,/className="tj-routine-item-actions"/);
  assert.match(source,/e.key==='ArrowUp'/);assert.match(source,/e.key==='ArrowDown'/);
  assert.match(css,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.doesNotMatch(css,/--tj-on-accent/);
  assert.match(css,/--tj-panel:var\(--color-surface-252\)/);
  assert.match(css,/min-height:666px/);
  assert.match(css,/height:48px/);
  assert.match(css,/\.tj-routine-group-tag \{[^}]*padding:0;background:transparent;color:var\(--tj-accent\)/);
  assert.match(css,/\.tj-routine-group-tag\.is-pretrade \{background:transparent;color:var\(--tj-purple\)/);
  assert.match(css,/\.tj-routine-item-actions \{display:flex;align-items:center;align-self:stretch;gap:6px/);
  assert.match(css,/flex:0 0 28px;width:28px;height:28px/);
  assert.match(css,/@container\(max-width:580px\)/);
  assert.doesNotMatch(css,/@media\(max-width:1200px\)/);
});
test('Tokyo routine day uses UTC, including offsets and midnight rollover',()=>{
  assert.equal(routineDayKey(new Date('2026-10-11T08:59:59+09:00')),'2026-10-10');
  assert.equal(routineDayKey(new Date('2026-10-10T20:00:00-04:00')),'2026-10-11');
  assert.equal(resetCountdown(new Date('2026-10-10T23:59:00Z')),'0h 1m');
});
test('weekends do not prompt the routine and Monday Tokyo open resumes it',()=>{
  assert.equal(routineRequired({},new Date('2026-10-10T12:00:00Z')),false);
  assert.equal(routineRequired({},new Date('2026-10-11T12:00:00Z')),false);
  assert.equal(routineRequired({},new Date('2026-10-12T00:00:00Z')),true);
});
test('eight app defaults are enabled and two optional checks are off',()=>{
  assert.equal(activeRoutineItems({}).length,8);assert.equal(normalizeRoutine().appItems.accepted_risk.enabled,false);
  assert.equal(routineRequired({},noon),true);
});
test('custom items default to on; pausing persists and preserves past completions',()=>{
  const r=normalizeRoutine({customItems:[{id:'c1',label:'Read affirmations',group:'before'},{id:'c2',label:'Review yesterday',group:'pretrade',enabled:false}]});
  assert.equal(r.customItems[0].enabled,true);assert.equal(r.customItems[1].enabled,false);
  assert.equal(activeRoutineItems(r).length,9);
  const completed=completeRoutine(r,['c1'],noon);
  const paused=normalizeRoutine({...completed,customItems:completed.customItems.map(item=>({...item,enabled:false}))});
  assert.equal(activeRoutineItems(paused).length,8);
  assert.deepEqual(paused.completions['2026-10-09'].tickedIds,['c1']);
  assert.equal(routineRequired(paused,noon),false);
  const onlyCustom={...paused,appItems:Object.fromEntries(Object.keys(paused.appItems).map(id=>[id,{enabled:false}]))};
  assert.equal(routineRequired(onlyCustom,new Date('2026-10-11T00:00Z')),false);
  assert.equal(activeRoutineItems({...onlyCustom,customItems:[{...r.customItems[1],enabled:true}]}).length,1);
});
test('zero and partial saves complete the day; next Tokyo open prompts again',()=>{
  assert.equal(REQUIRE_ALL,false);
  for(const ticks of [[],['moved'],activeRoutineItems({}).map(i=>i.id)]){
    const r=completeRoutine({},ticks,noon);
    assert.equal(routineRequired(r,new Date('2026-10-09T23:59:59Z')),false);
    assert.equal(routineRequired(r,new Date('2026-10-12T00:00:00Z')),true);
    assert.deepEqual(r.completions['2026-10-09'].tickedIds,ticks);
    assert.equal(r.completions['2026-10-09'].total,8);
  }
});
test('disabled or empty routines skip; switching back on without a completion prompts',()=>{
  const r=normalizeRoutine();assert.equal(routineRequired({...r,enabled:false},noon),false);
  const empty={...r,appItems:Object.fromEntries(Object.keys(r.appItems).map(id=>[id,{enabled:false}]))};
  assert.equal(routineRequired(empty,noon),false);
  assert.equal(routineRequired({...empty,customItems:[{id:'custom-a',label:'Affirmation',group:'before'}]},noon),true);
});
test('editing, disabling and deleting items retain historical completion and do not re-prompt',()=>{
  const r=completeRoutine({customItems:[{id:'custom-a',label:'Read',group:'before'}]},['custom-a','moved'],noon);
  const edited=normalizeRoutine({...r,customItems:[],appItems:{moved:{enabled:false}}});
  assert.equal(routineRequired(edited,noon),false);assert.deepEqual(edited.completions['2026-10-09'].tickedIds,['custom-a','moved']);
});
test('streak counts consecutive UTC days, not tick count; seven dots end in today',()=>{
  let r=completeRoutine({},[],new Date('2026-10-07T21:00Z'));
  r=completeRoutine(r,[],new Date('2026-10-08T21:00Z'));
  assert.equal(routineHistory(r,noon).streak,2);
  assert.equal(routineHistory(completeRoutine(r,[],noon),noon).streak,3);
  assert.equal(routineHistory(r,new Date('2026-10-12T00:00Z')).streak,0);
  assert.equal(routineHistory(r,noon).days.length,7);assert.equal(routineHistory(r,noon).days.at(-1).today,true);
});
test('stable custom ids survive order changes and duplicates cannot shadow app items',()=>{
  const r=normalizeRoutine({customItems:[{id:'moved',label:'Fake'},{id:'c1',label:'One'},{id:'c2',label:'Two',group:'pretrade'}]});
  assert.equal(r.customItems.length,2);
  assert.equal(reorderRoutine(r,'c2','c1').order.indexOf('c2')<reorderRoutine(r,'c2','c1').order.indexOf('c1'),true);
});
test('default routine items can be renamed, moved, deleted, and restored through saved metadata',()=>{
  const edited=normalizeRoutine({appItems:{moved:{label:'Morning walk',group:'pretrade',enabled:true}}});
  assert.equal(edited.appItems.moved.label,'Morning walk');
  assert.equal(activeRoutineItems(edited).find(item=>item.id==='moved').group,'pretrade');
  const deleted=normalizeRoutine({appItems:{moved:{deleted:true}}});
  assert.equal(activeRoutineItems(deleted).some(item=>item.id==='moved'),false);
});
test('both new-markup triggers are gated; editing and markup form stay unchanged',()=>{
  const source=readFileSync(new URL('./TradingJournal.jsx',import.meta.url),'utf8');
  assert.match(source,/onClick=\{openNewMarkup\}/);assert.match(source,/onNew=\{openNewMarkup\}/);
  assert.match(source,/loadRoutine: \(\) => routineStore.refresh\(\)/);
  assert.match(source,/const openNewMarkup = \(\) => routineGate.current.request\('markup'\)/);
  assert.match(source,/completeRoutine\(latest, tickedIds, new Date\(\)\)/);
  assert.match(source,/onClose=\{closeDailyRoutine\}/);
  assert.match(source,/const closeDailyRoutine = \(\) => routineGate.current.cancel\(\)/);
  assert.match(source,/useDailyRoutine\(user\)/);
});
test('profile persistence re-reads other-tab completions, preserves preferences and isolates users',async()=>{
  let user={id:'a',user_metadata:{accent_color:'purple'}};let writes=0;
  const auth={getUser:async()=>({data:{user:structuredClone(user)}}),updateUser:async({data})=>{writes++;user.user_metadata={...user.user_metadata,...data};return {data:{user:structuredClone(user)}};}};
  const firstTab=await loadRoutineProfile(auth,'a');assert.equal(routineRequired(firstTab,noon),true);
  await saveRoutineProfile(auth,'a',r=>completeRoutine(r,[],noon));
  assert.equal(routineRequired(await loadRoutineProfile(auth,'a'),noon),false);
  await saveRoutineProfile(auth,'a',r=>({...r,customItems:[{id:'test',label:'New',group:'before'}]}));
  assert.equal(routineRequired(await loadRoutineProfile(auth,'a'),noon),false);
  assert.equal(user.user_metadata.accent_color,'purple');assert.equal(writes,2);
  await assert.rejects(()=>saveRoutineProfile(auth,'b',r=>r));assert.equal(writes,2);
  user={id:'b',user_metadata:{}};assert.equal(routineRequired(await loadRoutineProfile(auth,'b'),noon),true);
});
test('failed profile writes do not produce a saved completion',async()=>{
  const auth={getUser:async()=>({data:{user:{id:'a',user_metadata:{}}}}),updateUser:async()=>({error:{message:'Offline'},data:{user:null}})};
  await assert.rejects(()=>saveRoutineProfile(auth,'a',r=>completeRoutine(r,[],noon)),/Offline/);
  assert.equal(routineRequired(await loadRoutineProfile(auth,'a'),noon),true);
});
