import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pulseBreakdown, pulseDrawdown, pulseInsights, pulseMonthly, pulseTicks} from './mobileAnalyticsPulse.js';

const read = name => readFileSync(new URL(name, import.meta.url), 'utf8');

test('Mobile Analytics is a phone-only presentation of AnalyticsPage data', () => {
  const journal = read('./TradingJournal.jsx');
  const view = read('./MobileAnalyticsPulse.jsx');
  const css = read('./mobileAnalyticsPulse.css');
  assert.match(journal, /import MobileAnalyticsPulse from '.\/MobileAnalyticsPulse\.jsx'/);
  assert.match(journal, /if \(phone\) \{\s*return <MobileAnalyticsPulse/s);
  assert.match(journal, /equityData=\{equityData\}/);
  assert.match(journal, /sessionStats=\{sessionStats\}/);
  assert.match(journal, /liveGuardrails=\{liveGuardrails\}/);
  assert.match(journal, /change:event\.value, kind:event\.kind/);
  assert.match(view, /ThemeSelect/);
  assert.doesNotMatch(view, /<select\b/);
  assert.match(view, /Drag to read each balance/);
  assert.match(view, /onOpenAccountSettings/);
  assert.match(css, /@media \(max-width:767px\)/);
  assert.match(css, /touch-action:pan-y/);
});

test('breakdowns use real stats, keep sessions, and link markups to their trades', () => {
  const source = {
    tagStats:[{tag:'Pro Trend',count:5,wins:3,netPnl:13.95,winRate:60,avgRR:.93,best:22.24,worst:-18.48}],
    sessionStats:[{session:'London',count:2,wins:1,netPnl:-5,winRate:50},{session:'Tokyo',count:0,wins:0,netPnl:0,winRate:0}],
    trades:[{id:'a',session:'London',pnl:5,rr:1,direction:'BUY',premarketMarkupId:'m1'},{id:'b',session:'London',pnl:-10,rr:-1,direction:'SELL'}],
    markups:[{id:'m1',instrument:'EUR/USD',date:'2026-11-03',bias:'Bullish',status:'Planned'},{id:'m2',instrument:'XAU/USD',date:'2026-11-02',bias:'Bearish',status:'Passed'}],
    gradeFor:() => 'A', statusFor:status => status, currency:'USD',
  };
  const [model] = pulseBreakdown('model', source);
  assert.equal(model.grade, 'A');
  assert.equal(model.sub, '5 trades · 60% win rate');
  const sessions = pulseBreakdown('session', source);
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].details.find(item => item.label === 'Worst trade').tone, 'neg');
  const plans = pulseBreakdown('plan', source);
  assert.equal(plans[0].sub, 'Executed · 1 trade · 100% WR');
  assert.equal(plans[0].details.find(item => item.label === 'Match').value, '100%');
  assert.equal(plans[1].sub, 'Passed · Waiting for trade');
});

test('monthly totals, chart ticks and drawdown come from the data given', () => {
  assert.deepEqual(pulseMonthly([{date:'2026-10-02',pnl:10},{closeDate:'2026-10-09',pnl:5.5},{date:'2026-11-01',pnl:-2}]).map(row => [row.key,row.value]), [['2026-10',15.5],['2026-11',-2]]);
  const ticks = pulseTicks([-18.48,39.2]);
  assert.ok(ticks.ticks.includes(0));
  assert.ok(ticks.high >= 39.2 && ticks.low <= -18.48);
  assert.equal(pulseDrawdown([{equity:100},{equity:150},{equity:120}]).amount, 30);
  assert.equal(pulseDrawdown([{equity:100},{equity:150}]), null);
  assert.equal(pulseDrawdown([]), null);
});

test('Worth a look only reports what the journal supports and always keeps risk limits', () => {
  const empty = pulseInsights({});
  assert.deepEqual(empty.map(note => note.id), ['risk']);
  assert.equal(empty[0].strong, 'No loss limits set.');
  const notes = pulseInsights({
    tagStats:[{tag:'Pro',count:5,winRate:60,netPnl:14},{tag:'Counter',count:3,winRate:33,netPnl:2.62}],
    confluenceStats:[{name:'PDH Break',netPnl:-30.02},{name:'BOS',netPnl:63}],
    equityData:[{equity:100},{equity:150.23},{equity:122.56}],
    guardrails:{tradeEntryLocked:true},
  });
  assert.deepEqual(notes.map(note => note.id), ['trim','tag','drawdown','risk']);
  assert.equal(notes[0].strong, 'Counter');
  assert.equal(notes[2].strong, '18.42% below');
  assert.equal(notes[3].tone, 'red');
});
