import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const page = readFileSync(new URL('./BacktestAccounts.jsx', import.meta.url), 'utf8');
const view = readFileSync(new URL('./DesktopStrategyTesting.jsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('./desktopStrategyTesting.css', import.meta.url), 'utf8');
const fields = readFileSync(new URL('./writingFields.css', import.meta.url), 'utf8');

test('desktop Strategy Testing shows v2 after the phone branch; the old library stays behind the flag', () => {
  assert.match(page, /const STRATEGY_V2=true;/);
  const phone = page.indexOf('if(phone)return <><MobileStrategyTestingV6 ');
  const v2 = page.indexOf('if(STRATEGY_V2){');
  assert.ok(phone > 0 && v2 > phone);
  assert.match(page, /return <div className=\{`bt-library bt-reference-library /);
});

test('Strategy Testing v2 edits and deletes trades in the trade\'s own run, and uses the setup drawer', () => {
  assert.match(page, /const runOf=trade=>data\.runs\.find\(item=>item\.id===trade\?\.runId\);/);
  assert.match(page, /onEditTrade=\{trade=>openTrade\(runOf\(trade\),trade\)\}/);
  assert.match(page, /mutate\(\(\)=>saveTestTrade\(runOf\(trade\),trade,true\)\)/);
  assert.match(page, /\{setup&&<StrategySetupDrawer key=\{setup\.id\} /);
  assert.match(view, /export function StrategySetupDrawer\(/);
});

test('Strategy Testing v2 styles are desktop-only and reflow by page width', () => {
  assert.match(css, /^@media \(min-width:768px\) \{/m);
  assert.match(css, /@container journal-workspace \(max-width:1280px\)/);
  assert.match(css, /@container journal-workspace \(max-width:860px\)/);
  assert.match(css, /@media \(min-width:768px\) and \(prefers-reduced-motion:reduce\)/);
  assert.match(css, /\.st2-ov \{position:fixed;inset:0;z-index:300;/);
  assert.doesNotMatch(css, /font-size:(?:[0-9]|1[01])(?:\.\d+)?px/);
});

test('Strategy Testing drawer fields opt out of the underline field style', () => {
  assert.equal((fields.match(/:not\(\.st2-in input\):not\(\.st2-ov textarea\)/g) || []).length, 3);
});
