import test from "node:test";
import assert from "node:assert/strict";
import {dueNewsAlerts,dueNewsReleases,eventAlertKey,nextNewsRelease,countdownLabel,readAlertSettings} from "./newsAlertModel.js";
import {matchesNewsFilters,normalizeNewsFilters} from './newsPreferences.js';
const release=Date.parse("2026-10-09T14:00:00Z");
const event={isoDate:"2026-10-09T14:00:00Z",title:"Release",currency:"USD",impact:"high"};
test('release notification fires once at release and ignores stale releases and holidays',()=>{
  const alerts=dueNewsReleases([event],release,release-1000,new Set());
  assert.equal(alerts[0].minute,0);
  assert.deepEqual(dueNewsReleases([event],release+1000,release,new Set(alerts[0].keys)),[]);
  assert.deepEqual(dueNewsReleases([event],release+60000,release-1000,new Set()),[]);
  assert.deepEqual(dueNewsReleases([{...event,impact:'holiday'}],release,release-1000,new Set()),[]);
});
test('countdown and real reminders follow selected currencies and impacts',()=>{
  const events=[event,{...event,title:'CAD high',currency:'CAD'},{...event,title:'USD low',impact:'low'},{...event,title:'JPY high',currency:'JPY'}];
  const filters=normalizeNewsFilters({currencies:['USD','CAD'],impact:{high:true,medium:false,low:false}});
  const matching=events.filter(item=>matchesNewsFilters(item,filters));
  const now=release-15*60000;
  assert.deepEqual(dueNewsAlerts(matching,now,now-1000,new Set()).map(item=>item.event.title),['Release','CAD high']);
  const changed=normalizeNewsFilters({currencies:['JPY'],impact:{high:false,medium:true,low:false}});
  const newlyMatching=events.filter(item=>matchesNewsFilters(item,changed));
  assert.deepEqual(dueNewsAlerts(newlyMatching,now,now-1000,new Set()),[]);
  assert.equal(nextNewsRelease(newlyMatching,now),null);
});
test("15 and 5 minute thresholds trigger once, never after release",()=>{
  const seen=new Set();
  const fifteen=dueNewsAlerts([event],release-15*60000,release-15*60000-1000,seen);
  assert.equal(fifteen[0].minute,15);
  fifteen[0].keys.forEach(key=>seen.add(key));
  assert.deepEqual(dueNewsAlerts([event],release-15*60000+1000,release-15*60000,seen),[]);
  assert.equal(dueNewsAlerts([event],release-5*60000,release-5*60000-1000,seen)[0].minute,5);
  assert.deepEqual(dueNewsAlerts([event],release,release-20*60000,new Set()),[]);
});
test("late wakeup consolidates crossed reminders instead of duplicate sounds",()=>{
  const alerts=dueNewsAlerts([event],release-3*60000,release-20*60000,new Set());
  assert.equal(alerts.length,1);assert.equal(alerts[0].minute,5);assert.equal(alerts[0].keys.length,2);
});
test("holidays, invalid dates, disabled thresholds, and already delivered reminders are skipped",()=>{
  const now=release-5*60000,previous=now-1000;
  assert.deepEqual(dueNewsAlerts([{...event,impact:"holiday"},{...event,isoDate:"invalid"}],now,previous,new Set()),[]);
  assert.deepEqual(dueNewsAlerts([event],now,previous,new Set(),[15]),[]);
  assert.deepEqual(dueNewsAlerts([event],now,previous,new Set([eventAlertKey(event,5)])),[]);
});
test("next release and countdown use absolute timestamps",()=>{
  assert.equal(nextNewsRelease([event,{...event,isoDate:"invalid"}],release-1000),event);
  assert.equal(nextNewsRelease([event],release),null);
  assert.equal(countdownLabel(15*60000),"0:15:00");
  assert.equal(countdownLabel(-1),"0:00:00");
});
test("settings restore only supported reminder choices",()=>{
  assert.deepEqual(readAlertSettings({getItem:()=>JSON.stringify({enabled:true,sound:false,minutes:[15,99]})}),{enabled:true,sound:false,minutes:[15]});
  assert.deepEqual(readAlertSettings({getItem:()=>"{bad"}),{enabled:false,sound:true,minutes:[15,5]});
});
