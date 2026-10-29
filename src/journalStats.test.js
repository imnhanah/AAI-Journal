import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeClosedTrades} from './journalStats.js';

test('numeric strings are summed numerically and invalid results fail closed with record detail', () => {
  const stats = summarizeClosedTrades([{pnl:'100',date:'2026-01-01'}, {pnl:'-25',date:'2026-01-01'}, null, {pnl:null}, {pnl:''}, {pnl:'invalid'}]);
  assert.equal(stats.valid,false);
  assert.equal(stats.netPnl,null);
  assert.deepEqual(stats.issues,[{recordType:'trade',recordId:'unsaved',field:'pnl',value:'invalid',reason:'not-finite'}]);
});
test('no losses means unlimited profit factor, not a fabricated three', () => {
  assert.equal(summarizeClosedTrades([{pnl:100}]).profitFactor,Infinity);
  assert.equal(summarizeClosedTrades([]).profitFactor,0);
  assert.equal(summarizeClosedTrades([]).thunderScore,0);
  assert.equal(summarizeClosedTrades([{pnl:100}]).recovery,0);
});
test('same-day streaks and recovery follow time, independent of input order', () => {
  const rows=[{id:'3',date:'2026-01-01',time:'12:00',pnl:10},{id:'1',date:'2026-01-01',time:'09:00',pnl:-10},{id:'2',date:'2026-01-01',time:'10:00',pnl:20}];
  const stats=summarizeClosedTrades(rows);
  assert.equal(stats.streak,2);
  assert.equal(stats.streakType,'win');
  assert.equal(stats.recovery,100);
  assert.deepEqual(stats.sorted.map(t=>t.id),['1','2','3']);
  assert.equal(rows[0].id,'3');
});
test('breakeven classification remains consistent with the account cap', () => {
  const stats=summarizeClosedTrades([{pnl:5},{pnl:-5},{pnl:20},{pnl:-10}],5);
  assert.equal(stats.be,2);assert.equal(stats.wins,1);assert.equal(stats.losses,1);
  assert.equal(stats.netPnl,10);
});
test('average R uses recorded R values, including losses and zero, not the cash payoff ratio', () => {
  const stats=summarizeClosedTrades([{pnl:300,rr:3},{pnl:-50,rr:-1},{pnl:100,rr:0},{pnl:20,rr:null},{pnl:10,rr:''}]);
  assert.equal(stats.averageR,2/3);
  assert.notEqual(stats.averageR,stats.avgWinLoss);
  assert.equal(summarizeClosedTrades([{pnl:10}]).averageR,null);
});
