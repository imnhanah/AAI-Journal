import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createNavigationState} from './navigationState.js';

test('navigation memory preserves false, zero, null, filters and expanded views independently', () => {
  const store=createNavigationState('user');
  for(const [field,value] of Object.entries({tab:'risk',range:0,showAll:false,month:null,expanded:{one:true},filters:['London']})) {
    store.write('user','demo','analytics',field,value);
    assert.deepEqual(store.read('user','demo','analytics',field),value);
    assert.equal(store.read('user','demo','finance',field),undefined);
  }
});
test('workspace and user isolation survive navigation and session disposal', () => {
  const store=createNavigationState('user');
  store.write('user','demo','challenge','balance:progress',{activeLevel:29});
  assert.equal(store.read('user','live','challenge','balance:progress'),undefined);
  assert.equal(store.read('other','demo','challenge','balance:progress'),undefined);
  store.write('other','demo','challenge','balance:progress',{activeLevel:1});
  assert.equal(store.read('user','demo','challenge','balance:progress').activeLevel,29);
  store.clear();
  assert.equal(store.read('user','demo','challenge','balance:progress'),undefined);
  assert.equal(createNavigationState('user').read('user','demo','challenge','balance:progress'),undefined);
});
test('page memory covers navigation choices without retaining financial input drafts or dialogs', () => {
  const code=readFileSync(new URL('./TradingJournal.jsx',import.meta.url),'utf8');
  for(const [page,field] of [['finance','balanceId'],['finance','movementFilter'],['analytics','analyticsTab'],['analytics','selectedAnalyticsMonths'],['markups','open'],['tradelog','search'],['tradelog','listPage'],['reviews','reviewYear'],['management','selected'],['calendar','insightView'],['news','weekOffset']]) assert.ok(code.includes(`usePageState('${page}', 'tj-nav-${field}',`),`${page}/${field}`);
  assert.doesNotMatch(code,/usePageState\('finance', 'tj-nav-(?:amount|note|type|date)'/);
  assert.doesNotMatch(code,/usePageState\([^\n]*(?:'tj-nav-tradeEditor'|'tj-nav-selectedImage'|'tj-nav-selectedEvent')/);
  assert.match(code,/<NavigationSession owner=\{user.id\} workspace=\{account.id\}>/);
});
test('pagination changes reset on changed filters, not on restored initial values', () => {
  const code=readFileSync(new URL('./TradingJournal.jsx',import.meta.url),'utf8');
  assert.match(code,/useWhenChanged\(\(\) => \{ setListPage\(1\); \}, \[yearFilter/);
  assert.match(code,/useWhenChanged\(\(\) => \{ setListPage\(1\); setExpanded\(\{\}\); \}, \[search/);
  assert.match(code,/useWhenChanged\(\(\) => \{\s*setSelectedAnalyticsMonths\(\[\]\)/);
  assert.match(code,/preserveOnNavigation &&[\s\S]*?\.tj-sidebar, \.tj-mobile-bottom/);
});
test('news restores its archived feed synchronously and still checks for fresh data', () => {
  const code=readFileSync(new URL('./TradingJournal.jsx',import.meta.url),'utf8');
  assert.match(code,/usePageState\('news', 'tj-nav-calendarWindow', \(\) => \(\{archive:readNewsArchive/);
  assert.match(code,/getCalendarWindow\(\(progress\) => \{ if \(!cancelled\)/);
});
test('Challenge retains only loaded or saved progress, rejects stale reads and surfaces failures', () => {
  const code=readFileSync(new URL('./useBalanceChallenge.js',import.meta.url),'utf8');
  assert.match(code,/useNavigationCache\('challenge-progress'\)/);
  assert.match(code,/record.key === cacheKey \? record.state : cache.read\(cacheKey\)/);
  assert.match(code,/ticket!==request.current \|\| currentKey.current!==cacheKey/);
  assert.match(code,/if \(failure\) throw failure;\s*if\(!mounted.current/);
  assert.match(code,/cache.write\(cacheKey,next\);\s*setState\(next\)/);
  assert.match(code,/Could not load/);
  assert.match(code,/Could not save/);
  const page=readFileSync(new URL('./ChallengeLifecyclePage.jsx',import.meta.url),'utf8');
  for(const field of ['details','expanded','planRange'])assert.ok(page.includes('`tj-challenge-${account.id}:'+field+'`'));
});
test('collapsed sidebar has no hover or focus tooltip artifact handlers', () => {
  const code=readFileSync(new URL('./SidebarShell.jsx',import.meta.url),'utf8');
  const styles=readFileSync(new URL('./sidebarV2.css',import.meta.url),'utf8');
  assert.doesNotMatch(code,/onMouse(?:Enter|Leave)|onFocus|title=/);
  assert.doesNotMatch(code,/setTooltip|tooltip/i);
  assert.match(styles,/tj-sidebar-collapsed[\s\S]*?\.tj-nav-label\s*\{\s*display:none/);
});
test('all Backtest custom chart dot branches have stable keys', () => {
  const code=readFileSync(new URL('./BacktestAccounts.jsx',import.meta.url),'utf8');
  const dot=code.split('const equityDot=')[1].split(';const baselineLabel')[0];
  const roots=[...dot.matchAll(/<(g|circle)\b([^>]*?)(?:\/?>)/g)].filter(([,tag,attributes],index)=>index===0 || tag==='g' || attributes.includes('stroke='));
  assert.equal(roots.length,3);
  for(const [, ,attributes] of roots)assert.match(attributes,/key=\{`bt-equity-dot-\$\{index\}`\}/);
});
