import test from "node:test";
import assert from "node:assert/strict";
import {newsWeekKey,mergeNewsWeek,archivedNewsEvents,readNewsArchive,NEWS_ARCHIVE_KEY} from "./newsArchive.js";
import {getCalendarWindow} from "./forexFactory.js";
const event = {isoDate:"2026-10-09T14:00:00Z",title:"Release",currency:"USD",forecast:"1"};
test("weekly keys are dated and roll over without overwriting past weeks", () => {
  const friday = new Date(2026,9,9,12);
  assert.equal(newsWeekKey(-1,friday),"2026-09-27");
  assert.equal(newsWeekKey(0,friday),"2026-10-04");
  assert.equal(newsWeekKey(1,friday),"2026-10-11");
  assert.equal(newsWeekKey(-1,new Date(2026,9,12)),newsWeekKey(0,friday));
  let archive = mergeNewsWeek({},"2026-10-04",{events:[event],fetchedAt:1000,source:"live"});
  archive = mergeNewsWeek(archive,"2026-10-11",{events:[],fetchedAt:2000,source:"live"});
  assert.equal(Object.keys(archive).length,2);
  assert.equal(archive["2026-10-04"].events.length,1);
});
test("newer snapshots replace a week, failures and stale snapshots preserve it", () => {
  const archive = mergeNewsWeek({},"2026-10-04",{events:[event],fetchedAt:2000});
  assert.deepEqual(mergeNewsWeek(archive,"2026-10-04",{events:null}),archive);
  assert.deepEqual(mergeNewsWeek(archive,"2026-10-04",{events:[],fetchedAt:1000}),archive);
  assert.equal(mergeNewsWeek(archive,"2026-10-04",{events:[],fetchedAt:3000})["2026-10-04"].events.length,0);
});
test("overlapping events deduplicate with newest values and invalid storage is safe", () => {
  const archive = {a:{events:[event],fetchedAt:1000},b:{events:[{...event,forecast:"2"}],fetchedAt:2000}};
  const events = archivedNewsEvents(archive);
  assert.equal(events.length,1);
  assert.equal(events[0].forecast,"2");
  assert.deepEqual(readNewsArchive({getItem:()=>"{bad"}),{});
  assert.deepEqual(readNewsArchive({getItem:key=>{assert.equal(key,NEWS_ARCHIVE_KEY);return JSON.stringify({"2026-10-04":archive.a});}})["2026-10-04"],archive.a);
});
test("all three weeks load together and survive a reload alongside older snapshots", async () => {
  const previousWindow = globalThis.window;
  const previousFetch = globalThis.fetch;
  const data = new Map();
  const storage = {getItem:key=>data.get(key) ?? null,setItem:(key,value)=>data.set(key,value)};
  const olderKey = newsWeekKey(-2);
  storage.setItem(NEWS_ARCHIVE_KEY,JSON.stringify({[olderKey]:{events:[event],fetchedAt:1000,source:"cache"}}));
  const requests = [];
  globalThis.window = {localStorage:storage};
  globalThis.fetch = async (url) => {
    requests.push(url);
    const offset = url.includes("lastweek") ? -1 : url.includes("nextweek") ? 1 : 0;
    return {ok:true,json:async()=>[{title:`Week ${offset}`,country:"USD",date:`${newsWeekKey(offset)}T12:00:00Z`,impact:"High"}]};
  };
  try {
    const progress = [];
    const first = await getCalendarWindow((value)=>progress.push(value.results.length));
    assert.equal(requests.length,3);
    assert.equal(first.results.length,3);
    assert.equal(Object.keys(first.archive).length,4);
    assert.deepEqual(progress,[1,2,3]);
    const restored = await getCalendarWindow();
    assert.equal(requests.length,3,"fresh dated caches avoid duplicate requests");
    assert.equal(Object.keys(restored.archive).length,4);
    assert.deepEqual(restored.archive[olderKey].events,[event]);
  } finally {
    globalThis.window = previousWindow;
    globalThis.fetch = previousFetch;
  }
});
