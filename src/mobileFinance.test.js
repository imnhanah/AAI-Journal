import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {addToAmount,financeMonthGroups,financeMovementIssue,financeMovementSign} from './mobileFinanceModel.js';
test('phone finance uses readable stacked stats and wrapped ledger descriptions',()=>{
  const css=readFileSync(new URL('./mobileFinance.css',import.meta.url),'utf8');
  for(const size of css.matchAll(/font-size:([\d.]+)px/g))assert.ok(Number(size[1])>=12);
  assert.match(css,/tj-phone-finance-movement>p[^}]*white-space:normal/);
  assert.match(css,/tj-phone-finance-plans \.tj-savings-orbit-footer \.tj-savings-orbit-transfer[^}]*min-height:44px/);
  // The tab pill slides with transform (motion rule); nothing else may.
  assert.doesNotMatch(css.replace(/\.tj-phone-finance-tabs(?:\[data-tab=savings\])?>i \{[^}]*\}/g,""),/(?:^|[;{])\s*(?:transform|filter|will-change)\s*:/m);
});
test('phone finance sheet separates its blur and planned transfers require explicit submission',()=>{
  const source=readFileSync(new URL('./MobileFinance.jsx',import.meta.url),'utf8');
  assert.match(source,/tj-phone-finance-backdrop" onClick=\{close\}\/>/);
  assert.match(source,/role="dialog" aria-modal="true"/);
  assert.match(source,/p\.onPlanned\(s\);setError\(''\);setOpen\(true\)/);
  assert.match(source,/if\(await p\.onRecord\(\)\)setOpen\(false\)/);
  assert.match(source,/event\.key==='Escape'/);
});
test('phone finance keeps filters full width and never strips a real saving path',()=>{
  const source=readFileSync(new URL('./MobileFinance.jsx',import.meta.url),'utf8');
  assert.match(source,/className="tj-phone-finance-filters">/);
  assert.doesNotMatch(source,/data-scroll-row/);
  for(const handler of ['p.onSource(','p.onSavings(','p.onBalance(','p.onDate(','p.onNote(','p.onAmount(','p.onDelete(','p.onOlder'])assert.ok(source.includes(handler),handler);
  assert.match(source,/<ConfirmDeleteButton/);
});
test('phone finance groups movements by month with real counts',()=>{
  const all=[{id:1,isoDate:'2026-11-03'},{id:2,isoDate:'2026-11-01'},{id:3,isoDate:'2026-10-05'}];
  const groups=financeMonthGroups(all.slice(0,1),all);
  assert.equal(groups.length,1);
  assert.equal(groups[0].count,2);
  assert.equal(groups[0].label,'November 2026');
  assert.deepEqual(financeMonthGroups(all).map(group=>group.key),['2026-11','2026-10']);
});
test('phone finance explains a form it cannot record',()=>{
  const ok={amount:'5',date:'2026-11-06',requiresSavings:false,savingsId:'',balanceId:'a'};
  assert.equal(financeMovementIssue(ok),'');
  assert.match(financeMovementIssue({...ok,amount:''}),/amount/);
  assert.match(financeMovementIssue({...ok,date:''}),/date/);
  assert.match(financeMovementIssue({...ok,requiresSavings:true}),/savings/);
  assert.equal(addToAmount('0.1',0.2),'0.3');
  assert.equal(financeMovementSign('transfer'),'');
});
test('phone simulated outcomes fit their grid and expanded P&L can wrap',()=>{
  const css=readFileSync(new URL('./mobileBacktest.css',import.meta.url),'utf8');
  assert.match(css,/bt-outcome-summary>\.bt-donut \{width:100px;height:100px;justify-self:start/);
  assert.match(css,/tj-backtest-detail[^}]*overflow-wrap:anywhere;white-space:normal/);
});
