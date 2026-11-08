import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mobileChallengeJourney, mobileChartLine, mobileCoreScoreAxes, mobileDashboardCumulative, mobileDashboardEquity, mobileDashboardMomentum, mobileDashboardRecent, mobileDashboardWeek, mobileSmoothPath} from './mobileDashboardV6.js';

const read = name => readFileSync(new URL(name, import.meta.url), 'utf8');

test('V6 cumulative P&L is a presentation of the existing closed trade order', () => {
  const points = mobileDashboardCumulative([
    {date:'2026-11-03', time:'15:00', pnl:-15},
    {closeDate:'2026-11-01', closeTime:'09:30', pnl:12.5},
    {date:'2026-11-02', time:'10:00', pnl:7.5},
  ]);
  assert.deepEqual(points, [
    {date:'2026-11-01', cumulative:12.5},
    {date:'2026-11-02', cumulative:20},
    {date:'2026-11-03', cumulative:5},
  ]);
});

test('V6 weekly activity respects the journal trading-week setting and trade dates', () => {
  const week = mobileDashboardWeek([
    {date:'2026-11-02', pnl:25},
    {closeDate:'2026-11-04', pnl:-10},
  ], new Date('2026-11-05T12:00:00'), 'monday');
  assert.equal(week.firstDay.toISOString().slice(0, 10), '2026-11-02');
  assert.equal(week.days[0].pnl, 25);
  assert.equal(week.days[2].pnl, -10);
  assert.equal(week.activeDays, 2);
});

test('V6 challenge journey reflects persisted levels without changing challenge state', () => {
  const plan = [{profit:10}, {profit:15}, {profit:20}];
  assert.deepEqual(mobileChallengeJourney({activeLevel:2,levelPnl:7.5,statuses:{1:'Pass'}}, plan), {
    enabled:true, activeLevel:2, nextLevel:3, progress:50, passed:1, complete:false,
  });
  assert.equal(mobileChallengeJourney({activeLevel:4,statuses:{1:'Pass',2:'Pass',3:'Pass'}}, plan).complete, true);
});

test('V6 dashboard is isolated to phones and uses shared theme tokens rather than a mobile palette', () => {
  const journal = read('./TradingJournal.jsx');
  const view = read('./MobileDashboardV6.jsx');
  const css = read('./mobileDashboardV6.css');
  assert.match(journal, /function DashboardSurface\(props\)/);
  assert.match(journal, /phone \? <MobileDashboardV6 \{\.\.\.props\}/);
  assert.match(journal, /workspace=\{account\}/);
  assert.match(view, /<AccountPicker balances=\{balances\}/);
  assert.doesNotMatch(view, /<select\b/);
  assert.match(css, /@media \(max-width:767px\)/);
  assert.match(css, /var\(--accent\)/);
  assert.match(css, /var\(--card\)/);
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b/i);
});

test('phone Dashboard helpers use real stats and tolerate an empty journal', () => {
  const axes = mobileCoreScoreAxes({winRate:50, profitFactor:Infinity, avgWinLoss:1.5, consistency:null, recovery:67});
  assert.deepEqual(axes.map(axis => axis.value), [50, 0, 50, 0, 67]);
  assert.deepEqual(mobileDashboardEquity([{date:'2026-11-01',pnl:10},{date:'2026-11-02',pnl:-4}]), [{label:'11-01',value:10},{label:'11-02',value:6}]);
  const empty = mobileDashboardMomentum([], '2026-11', 100);
  assert.equal(empty.closes, 0);
  assert.equal(empty.bestSession, null);
  assert.equal(mobileSmoothPath([]), '');
  assert.equal(mobileChartLine([5]).points.length, 1);
});

test('momentum measures the last six closes against the balance before them', () => {
  const trades = Array.from({length:7}, (_, index) => ({date:`2026-11-0${index + 1}`, pnl:10, session:'London', asset:'EUR/USD'}));
  const result = mobileDashboardMomentum(trades, '2026-11', 90);
  assert.equal(result.net, 60);
  assert.equal(result.percent, 60);
  assert.equal(result.green, 6);
  assert.deepEqual(result.bestSession, {name:'London', pnl:70});
  assert.equal(mobileDashboardRecent(trades)[0].date, '2026-11-07');
});

test('V6 challenge journey finds a challenge saved on the account as well as on a balance', () => {
  const dashboard = readFileSync(new URL('./MobileDashboardV6.jsx', import.meta.url), 'utf8');
  assert.match(dashboard, /const onAccount = !onBalances\.length && isChallengeEnabled\(workspace\)/);
  assert.match(dashboard, /const state = target && !onAccount \? targetChallenge\.state : fallbackChallenge\?\.state/);
  assert.match(dashboard, /challengeStartingBalance\(state,workspace\)/);
});
