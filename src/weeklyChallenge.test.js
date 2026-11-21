import test from 'node:test';
import assert from 'node:assert/strict';
import { resetAutomation } from './challengeAutomation.js';
import { emptyChallenge } from './challengeModel.js';
import { challengeLevelAt, firstRoutineOfWeek, lastWeekTotal, weekPnlPercent, weekStartMs, weeklyChallengeRow } from './weeklyChallenge.js';

const started = new Date(2026, 8, 1, 9, 0);
const progress = resetAutomation(emptyChallenge(), [], 'risk', 1, started, 30, 100);
const trade = (id, day, hour, pnl) => ({ id, pnl, grossPnl: pnl, date: `2026-09-${String(day).padStart(2, '0')}`, closeDate: `2026-09-${String(day).padStart(2, '0')}`, createdAt: new Date(2026, 8, day, hour).toISOString(), status: 'closed' });
const scoped = (trades = [], extra = {}) => ({ id: 'a', challengeEnabled: true, balance: 100, challengeStartingBalance: 100, trades, financeMovements: [], ...extra });

test('the week starts on the member\'s chosen day', () => {
  const wed = new Date(2026, 8, 16, 15, 30);
  assert.equal(new Date(weekStartMs(wed, 'monday')).getDate(), 14);
  assert.equal(new Date(weekStartMs(wed, 'sunday')).getDate(), 13);
  assert.equal(new Date(weekStartMs(new Date(2026, 8, 14, 0, 5), 'monday')).getDate(), 14);
});

test('a level at a past moment ignores later trades, and now sees them all', () => {
  const trades = [trade(1, 3, 10, 40), trade(2, 10, 10, 40), trade(3, 17, 10, -5)];
  const early = challengeLevelAt(progress, scoped(trades), new Date(2026, 8, 2).getTime());
  const mid = challengeLevelAt(progress, scoped(trades), new Date(2026, 8, 14).getTime());
  const now = challengeLevelAt(progress, scoped(trades));
  const opening = challengeLevelAt(progress, scoped([])).level;
  assert.equal(early.level, opening);
  assert.ok(mid.level >= early.level);
  assert.ok(now.level >= mid.level);
  assert.equal(mid.level, challengeLevelAt(progress, scoped(trades.slice(0, 2))).level, 'cutting at a moment equals having only the earlier trades');
});

test('before the challenge began it reports the opening level', () => {
  const result = challengeLevelAt(progress, scoped([trade(1, 3, 10, 40)]), new Date(2026, 7, 1).getTime());
  assert.equal(result.existed, false);
  assert.equal(result.level, challengeLevelAt(progress, scoped([])).level);
});

test('a row carries last week, this week and now, and a week of no trades holds', () => {
  const week = new Date(2026, 8, 16, 9);
  const row = weeklyChallengeRow({ id: 'a', name: 'Test', progress, scoped: scoped([trade(1, 3, 10, 40)]) }, week, 'monday');
  assert.equal(row.start, row.now);
  assert.equal(row.delta, 0);
  assert.equal(row.mode, 'Mode 1 · Risk limit');
  assert.ok(row.last !== null);
});

test('a challenge that started this week has no last week', () => {
  const fresh = resetAutomation(emptyChallenge(), [], 'risk', 1, new Date(2026, 8, 15, 8), 30, 100);
  const row = weeklyChallengeRow({ id: 'a', name: 'New', progress: fresh, scoped: scoped() }, new Date(2026, 8, 16, 9), 'monday');
  assert.equal(row.last, null);
  assert.equal(row.startedThisWeek, true);
  assert.equal(row.lastDelta, null);
});

test('failed or completed challenges get no row', () => {
  const ruined = scoped([trade(1, 3, 10, -90)]);
  assert.equal(weeklyChallengeRow({ id: 'a', name: 'X', progress, scoped: ruined }, new Date(2026, 8, 16), 'monday'), null);
});

test('last week total adds the known weeks only', () => {
  assert.equal(lastWeekTotal([{ lastDelta: 3 }, { lastDelta: null }, { lastDelta: -1 }]), 2);
});

test('the first routine of the week is the one with nothing saved yet this week', () => {
  const wed = new Date(2026, 8, 16, 9);
  assert.equal(firstRoutineOfWeek({ completions: {} }, wed), true);
  assert.equal(firstRoutineOfWeek({ completions: { '2026-09-14': { tickedIds: [] } } }, wed), false);
  assert.equal(firstRoutineOfWeek({ completions: { '2026-09-11': { tickedIds: [] } } }, wed), true);
});

test('week P&L is a percentage of the balance the week opened with, ignoring deposits', () => {
  const wed = new Date(2026, 8, 16, 9);
  const trades = [trade(1, 15, 10, 10), trade(2, 16, 8, 10), trade(3, 10, 10, 500)];
  assert.equal(weekPnlPercent({ trades, balance: 120, now: wed }), 20);
  const deposit = [{ type: 'deposit', amount: 50, createdAt: new Date(2026, 8, 15, 12).toISOString() }];
  assert.equal(weekPnlPercent({ trades, financeMovements: deposit, balance: 170, now: wed }), 20);
  assert.equal(weekPnlPercent({ trades: [], balance: 0, now: wed }), null);
});
