import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=file=>readFileSync(new URL(file,import.meta.url),'utf8');
test('phone trade form uses full screen, pinned summary/footer and only inner scrolling',()=>{
  const css=read('./mobileLogTrade.css');
  assert.match(css,/@media \(max-width:767px\)/);assert.match(css,/height:100dvh!important/);
  assert.match(css,/\.tj-entry-composer-scroll \{flex:1;min-height:0;overflow-y:auto/);
  assert.match(css,/\.tj-entry-identity \{flex:none/);assert.match(css,/\.tj-entry-composer-footer \{flex:none/);
  assert.doesNotMatch(css,/transform\s*:|will-change\s*:/);
  const sizes=[...css.matchAll(/font-size:\s*([\d.]+)px/g)].map(match=>Number(match[1]));assert.ok(sizes.every(size=>size>=12));
});
test('phone trade fields and touch targets fit the reference and preserve save logic',()=>{
  const css=read('./mobileLogTrade.css'),source=read('./TradingJournal.jsx');
  assert.match(css,/\.tj-trade-entry-grid \{display:grid;grid-template-columns:minmax\(0,1fr\)/);
  assert.match(css,/\.tj-trade-direction-toggle button \{height:50px!important/);
  assert.match(css,/\.tj-tag \{min-height:44px!important/);
  assert.match(source,/onClick=\{save\}>\{saving \|\| externalSaving \? "Saving…" : saveError \? "Retry Save Trade" : editing \? "Save Changes" : "Save Trade"\}/);
  assert.match(source,/disabled=\{saving \|\| externalSaving/);
});
test('V10 Execution and Process tabs reuse one trade form, including risk, rules and compact selections',()=>{
  const css=read('./mobileLogTrade.css'),source=read('./TradingJournal.jsx');
  assert.match(source,/<JournalEntryLayout compactNumbers activePanel=\{panelStep\} onPanelChange=\{onPanelStepChange\}>/);
  assert.match(source,/<section title="Execution">/);assert.match(source,/<section title="Process">/);
  assert.match(source,/className="tj-phone-trade-risk"/);
  assert.match(source,/tj-phone-process-selection/);
  assert.match(source,/value=\{form\.context\}/);
  assert.match(source,/screenshots=\{tradeImageSessions\(form\.screenshots\)\.entry\}/);
  assert.match(source,/screenshots=\{tradeImageSessions\(form\.screenshots\)\.exit\}/);
  assert.match(css,/\.tj-phone-trade-risk \{display:flex/);
  assert.match(css,/\.tj-phone-process-selection \.tj-tagwrap \{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
});
test('phone instrument picker has a separate solid backdrop, search, selection and focus restoration',()=>{
  const source=read('./MobileInstrumentPicker.jsx'),css=read('./mobileLogTrade.css');
  assert.match(source,/role="dialog" aria-modal="true"/);assert.match(source,/aria-label="Search instruments"/);
  assert.match(source,/onChange\(item\);close\(\)/);assert.match(source,/trigger.current\?\.focus\(\)/);
  assert.match(css,/\.tj-phone-instrument-backdrop \{[^}]*background:color-mix/);
  assert.doesNotMatch(css,/\.tj-phone-instrument-sheet \{[^}]*backdrop-filter/);
});
test('instrument sheet can be dismissed by an accessible handle without changing selection',()=>{
  const source=read('./MobileInstrumentPicker.jsx'),css=read('./mobileLogTrade.css');
  assert.match(source,/aria-label="Close menu" onClick={close}/);
  assert.match(source,/setPointerCapture\(event.pointerId\)/);
  assert.match(source,/event.clientY-dragStart.current>60\)close\(\)/);
  assert.match(source,/onPointerCancel/);
  assert.match(css,/\.tj-phone-picker-handle \{[^}]*height:44px/);
});
