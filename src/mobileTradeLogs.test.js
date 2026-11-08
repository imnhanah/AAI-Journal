import test from 'node:test';
import {journalActiveFilters,journalClearFilter,journalHeldLabel,journalMonths,journalTradeMoney} from './mobileJournalTimeline.js';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {emptyPhoneTradeFilters,matchesPhoneTrade} from './mobileTradeFilters.js';
test('phone trade filters combine direction, results, sessions, review and inclusive dates',()=>{
  const trade={direction:'BUY',entrySession:'NYC AM',date:'2026-10-08'};
  const all=emptyPhoneTradeFilters();assert.equal(matchesPhoneTrade(trade,all,false,'win'),true);
  const filters={...all,result:'win',direction:'BUY',sessions:['London','NY AM'],review:'needs',from:'2026-10-08',to:'2026-10-08'};
  assert.equal(matchesPhoneTrade(trade,filters,false,'win'),true);
  assert.equal(matchesPhoneTrade(trade,filters,true,'win'),false);
  assert.equal(matchesPhoneTrade({...trade,date:'2026-10-09'},filters,false,'win'),false);
  assert.equal(matchesPhoneTrade(trade,{...filters,direction:'SELL'},false,'win'),false);
  assert.equal(matchesPhoneTrade({...trade,entrySession:'Tokyo'},{...all,sessions:['Asia']},false,'be'),true);
});
test('phone trade log has a separate solid backdrop, readable type and large controls',()=>{
  const css=readFileSync(new URL('./mobileTradeLogs.css',import.meta.url),'utf8');
  for(const size of css.matchAll(/font-size:([\d.]+)px/g))assert.ok(Number(size[1])>=12);
  assert.doesNotMatch(css,/(?:^|[;{])\s*(?:transform|filter|will-change)\s*:/m);
  assert.match(css,/\.tj-phone-log-backdrop[^}]*background:color-mix/);
  assert.doesNotMatch(css,/\.tj-phone-log-backdrop[^}]*backdrop-filter/);
  assert.match(css,/min-height:44px/);
  const source=readFileSync(new URL('./MobileTradeLogs.jsx',import.meta.url),'utf8');
  assert.match(source,/aria-modal="true"/);assert.match(source,/event.key==='Escape'/);
  assert.match(source,/event.key==='Tab'/);assert.match(source,/screenshots.slice\(0,2\)/);
});
test('V10 mobile library keeps the summary to trades, net P&L and plan alignment, with a shared search control',()=>{
  const source=readFileSync(new URL('./MobileTradeLogs.jsx',import.meta.url),'utf8');
  assert.match(source,/TRADES/);assert.match(source,/NET P&amp;L/);assert.match(source,/PLAN ALIGNMENT/);
  assert.match(source,/placeholder="Search trades, notes, instruments"/);
  assert.match(source,/onSearch\?\.\(event\.target\.value\)/);
  assert.match(source,/ArrowUpRight/);assert.match(source,/ArrowDownRight/);
  assert.doesNotMatch(source,/tj-phone-log-direction \$\{/);
  const css=readFileSync(new URL('./mobileTradeLogs.css',import.meta.url),'utf8');
  assert.match(css,/\.tj-phone-log-summary \{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(css,/\.tj-phone-log-search \{display:flex/);
});

test('phone Journal filters by instrument, date parts and entry model', () => {
  const trade={asset:'EUR/USD',date:'2026-11-04',entryType:'Pro Trend',direction:'BUY',session:'London'},all=emptyPhoneTradeFilters();
  assert.equal(matchesPhoneTrade(trade,{...all,instrument:'XAU/USD'},false,'win'),false);
  assert.equal(matchesPhoneTrade(trade,{...all,year:'2026',month:'11',week:'1',model:'Pro Trend'},false,'win'),true);
  assert.equal(matchesPhoneTrade(trade,{...all,week:'2'},false,'win'),false);
  assert.equal(matchesPhoneTrade(trade,{...all,result:'running'},false,'running'),true);
});

test('phone Journal helpers group newest first, measure hold time and split money', () => {
  const months=journalMonths([{id:1,date:'2026-10-07',time:'09:00'},{id:2,date:'2026-11-04',time:'11:50'},{id:3,date:'2026-11-04',time:'12:00'}]);
  assert.deepEqual(months.map(month=>[month.key,month.trades.map(trade=>trade.id)]),[['2026-11',[3,2]],['2026-10',[1]]]);
  assert.equal(journalHeldLabel({date:'2026-11-04',time:'11:50',closeDate:'2026-11-04',closeTime:'12:22'}),'32m');
  assert.equal(journalHeldLabel({date:'2026-11-04',time:'11:50'}),null);
  const money=journalTradeMoney({balanceResults:[{balanceId:'a',grossPnl:-6,commission:.2,swap:0},{balanceId:'b',grossPnl:-4,commission:.1,swap:.1,netPnl:-4.2}]},[{id:'a',name:'Exness'}]);
  assert.equal(money.gross,-10);
  assert.ok(Math.abs(money.costs-.4)<1e-9);
  assert.deepEqual(money.accounts.map(account=>account.name),['Exness','Account']);
});

test('phone Journal chips clear one filter and month also clears week', () => {
  const filters={...emptyPhoneTradeFilters(),result:'win',month:'11',week:'2',sessions:['London']};
  const chips=journalActiveFilters(filters);
  assert.deepEqual(chips.map(chip=>chip.label),['Wins','Nov','Week 2','London']);
  assert.equal(journalClearFilter(filters,chips[0]).result,'All');
  assert.equal(journalClearFilter(filters,chips[1]).week,'');
  assert.deepEqual(journalClearFilter(filters,chips[3]).sessions,[]);
});

test('deleting from the trade detail page takes a second tap', () => {
  const view=readFileSync(new URL('./MobileJournalTimeline.jsx',import.meta.url),'utf8');
  assert.match(view,/if\(confirming\) onDelete\(trade\.id\); else setConfirming\(true\)/);
  assert.match(view,/Tap again to permanently delete/);
});

test('phone Trade Logs places the gated Log Trade action below the Net P&L card', () => {
  const view=readFileSync(new URL('./MobileJournalTimeline.jsx',import.meta.url),'utf8');
  const css=readFileSync(new URL('./mobileJournalTimeline.css',import.meta.url),'utf8');
  assert.ok(view.indexOf('tj-jr-log-trade-wrap') > view.indexOf('tj-jr-hero'));
  assert.match(view,/className="tj-jr-log-trade" disabled=\{locked\} onClick=\{onNewTrade\} aria-label=/);
  assert.match(view,/onNewTrade=\{onNewTrade\} locked=\{locked\}/);
  assert.match(css,/\.tj-jr-log-trade-wrap\{display:flex;justify-content:center/);
  assert.match(css,/\.tj-jr button\.tj-jr-log-trade\{[^}]*min-height:46px/);
});
