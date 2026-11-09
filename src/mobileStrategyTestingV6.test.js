import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {backtestStats, testType, testTypeLabel} from './backtestModel.js';
import {scopeBacktests} from './backtestWorkspace.js';
import {strategyEquityPath, strategyResult, strategyStreakTitle, strategyTotals, strategyTradeMeta} from './mobileStrategyTestingModel.js';

const read = name => readFileSync(new URL(name, import.meta.url), 'utf8');
const run = {id:'run-a', name:'London study', instrument:'EUR/USD', timeframe:'M15', startingBalance:1000, currency:'USD', tradeTarget:4, riskPct:1};
const trade = (id, pnl, direction = 'BUY') => ({id, runId:'run-a', asset:'EUR/USD', timeframe:'M15', date:`2026-11-0${id}`, closeDate:`2026-11-0${id}`, pnl, rr:pnl > 0 ? 2 : -1, direction});

test('Strategy Testing V6 mounts only through the phone branch and keeps the desktop workspace intact', () => {
  const source = read('./BacktestAccounts.jsx');
  assert.match(source, /const phone=usePhoneBacktest\(\)/);
  assert.match(source, /if\(phone\)return <>\s*<MobileStrategyTestingV6/);
  assert.match(source, /return <div className=\{`bt-library bt-reference-library/);
  assert.match(source, /<MobileStrategyTestingV6[\s\S]*onOpenTrade=\{openTrade\}/);
});

test('V6 preserves profile-scoped Backtest and Forward Test records while filtering by established type', () => {
  const records = scopeBacktests({runs:[run, {...run, id:'run-b', testType:'forward'}], trades:[trade('1', 40), {...trade('2', -10), runId:'run-b'}]});
  assert.equal(records.runs.length, 2);
  assert.equal(testType(records.runs[0]), 'backtest');
  assert.equal(testTypeLabel(records.runs[1]), 'Forward Test');
  const view = read('./MobileStrategyTestingV6.jsx');
  assert.match(view, /testType\(run\) === 'forward'/);
  assert.match(view, /testTypeLabel\(run\)/);
});

test('V6 presents existing simulation metrics and never routes simulated trades to live journal handlers', () => {
  const stats = backtestStats(run, [trade('1', 40), trade('2', -10)]);
  assert.equal(stats.balance, 1030);
  assert.equal(stats.total, 2);
  assert.equal(stats.wins, 1);
  const view = read('./MobileStrategyTestingV6.jsx');
  assert.match(view, /backtestStats\(activeRun,trades\)/);
  assert.match(view, /onOpenTrade\(activeRun\)/);
  assert.match(view, /onLoadMedia=\{onLoadMedia\}/);
  assert.doesNotMatch(view, /saveTrade\(|openNewTrade\(|challengeProgress|live journal analytics/);
});

test('V6 trade history retains established instrument, timeframe, and result filters with selection callbacks', () => {
  const view = read('./MobileStrategyTestingV6.jsx');
  assert.match(view, /historyFilter==='running'&&!isClosedTest\(trade\)/);
  assert.match(view, /instrument==='all'\|\|trade\.asset===instrument/);
  assert.match(view, /timeframe==='all'\|\|trade\.timeframe===timeframe/);
  assert.match(view, /setSelectedTradeId\(id => id === trade\.id \? null : trade\.id\)/);
  assert.match(view, /onEdit=\{onEditTrade\}/);
  assert.match(view, /onDelete=\{onDeleteTrade\}/);
});

test('phone strategy helpers number trades, total them and never count running trades', () => {
  const closed = [trade('1', 40), trade('2', -10)], running = {...trade('3', null), context:'[aaicorefx-running-trade]'};
  const stats = backtestStats(run, [...closed, running]);
  const meta = strategyTradeMeta(stats);
  assert.deepEqual(meta.get('2'), {number:2, balance:1030});
  assert.equal(meta.has('3'), false);
  assert.equal(strategyResult(running), 'running');
  assert.equal(strategyResult(trade('4', 0)), 'flat');
  assert.deepEqual(strategyTotals([...closed, running]), {pnl:30, r:1});
  assert.equal(strategyStreakTitle(stats), 'No streak');
  assert.equal(strategyStreakTitle({streak:3, streakType:'flat'}), '3 break-even streak');
  assert.match(strategyEquityPath([1000, 1040, 1030]).line, /^M6 /);
});

test('phone strategy deletes through the existing handlers and asks first', () => {
  const view = read('./MobileStrategyTestingV6.jsx');
  assert.match(view, /title="Delete this test\?"/);
  assert.match(view, /await onDeleteRun\(deleting\)/);
  assert.match(view, /<ConfirmDeleteButton className="tj-st6-trade-delete"/);
});
