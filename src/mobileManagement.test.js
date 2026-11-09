import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL(name,import.meta.url),'utf8');
test('phone Management opens as an index, and routine requests open the routine directly',()=>{
 const source=read('./TradingJournal.jsx'),css=read('./mobileManagement.css');
 assert.match(source,/const \[phoneIndex,setPhoneIndex\]\s*=\s*usePageState\('management', 'tj-nav-phoneIndex', !routineRequest\)/);
 assert.match(source,/setSelected\("daily-routine"\);setPhoneIndex\(false\)/);
 assert.match(source,/useNavStep\(`setup:\$\{activeSection\}`, phoneListOpen, \(\) => setPhoneIndex\(true\)\)/);
 assert.match(css,/\.tj-management-phone-index \.tj-management-content \{display:none/);
 assert.match(css,/\.tj-management-phone-list \.tj-management-nav/);
});

test('Journal Setup keeps the Management route while using the updated user-facing label',()=>{
 const source=read('./TradingJournal.jsx');
 assert.match(source,/\{ id: "management", label: "Journal Setup", icon: SlidersHorizontal \}/);
 assert.match(source,/<h1>Journal Setup<\/h1><p>Customize your trading workflow, rules, and journal preferences\.<\/p>/);
 assert.match(source,/aria-label="Journal Setup lists"/);
 assert.match(source,/usePageState\('management', 'tj-nav-selected'/);
});
test('phone lists and routine rows have full-width wrapping content and large controls',()=>{
 const css=read('./mobileManagement.css');
 assert.match(css,/@media\(max-width:767px\)/);
 assert.match(css,/min-height:52px/);assert.match(css,/min-height:48px/);
 assert.match(css,/\.tj-management-reference \.tj-icon-btn \{width:44px/);
 assert.match(css,/\.tj-routine-custom-label \{[^}]*white-space:normal/);
 assert.ok([...css.matchAll(/font-size:\s*([\d.]+)px/g)].every(match=>Number(match[1])>=12));
});
test('touch and keyboard routine reordering use the same persisted ordering helper',()=>{
 const source=read('./DailyRoutine.jsx');
 assert.match(source,/data-routine-id=\{item.id\}/);
 assert.match(source,/setPointerCapture\(e.pointerId\)/);
 assert.match(source,/reorderRoutine\(r,drag.id,target\)/);
 assert.match(source,/e.key==='ArrowUp'/);assert.match(source,/e.key==='ArrowDown'/);
 assert.match(source,/disabled=\{busy\}/);
});
test('phone Setup home keeps every list reachable and shares routine figures',()=>{
 const home=read('./MobileSetupHome.jsx'),routine=read('./DailyRoutine.jsx');
 for(const id of ['instruments','mistakes','confluences','entries','rules','risk-presets','mappings','backup'])assert.ok(home.includes(`'${id}'`),id);
 assert.match(home,/onUpdateRoutine\(r=>\(\{\.\.\.r,enabled:!r\.enabled\}\)\)/);
 assert.match(routine,/routineWeekStats\(routine\)/);
});
