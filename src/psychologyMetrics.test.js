import test from 'node:test';
import assert from 'node:assert/strict';
import {psychologyMetrics} from './psychologyMetrics.js';

test('missing rule checks and moods are not verified clean execution', () => {
  const stats = psychologyMetrics([{pnl: 5, moodBefore: 'Neutral'}, {pnl: 5, ruleEvaluations: [{checked: true}]}]);
  assert.equal(stats.clean, 0);
  assert.equal(stats.overallAdherence, 100);
  assert.equal(stats.leading, null);
  assert.equal(stats.stableRate, null);
});
test('adherence, shifts, deduplicated mistakes, and chronological recovery use actual records', () => {
  const stats = psychologyMetrics([
    {date: '2026-10-03', pnl: 12, moodBefore: 'Neutral', moodAfter: 'Neutral', ruleEvaluations: [{checked: true}]},
    {date: '2026-10-01', pnl: -4, moodBefore: 'Neutral', moodAfter: 'Anxious', mistakes: ['Chased Entry', 'Chased Entry'], ruleEvaluations: [{checked: false}, {checked: true}]},
    {date: '2026-10-02', pnl: 8, moodBefore: 'Neutral', moodAfter: 'Neutral', ruleEvaluations: [{checked: true}]},
  ]);
  assert.equal(stats.clean, 2);
  assert.equal(stats.overallAdherence, 75);
  assert.equal(stats.leading.mood, 'Neutral');
  assert.equal(stats.mistakes[0].count, 1);
  assert.equal(stats.changed, 1);
  assert.equal(stats.recoveryCount, 1);
  assert.equal(stats.recoveryPnl, 8);
  assert.equal(stats.recoveryWinRate, 100);
});
test('empty samples and final losses do not manufacture a recovery', () => {
  assert.equal(psychologyMetrics([]).cleanRate, null);
  assert.equal(psychologyMetrics([{pnl: -1}]).recoveryCount, 0);
  assert.equal(psychologyMetrics([{pnl: -1}], 2).recoveryCount, 0);
});
