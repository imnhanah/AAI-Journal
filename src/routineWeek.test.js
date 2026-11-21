import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = name => readFileSync(new URL(name, import.meta.url), 'utf8');
const desktop = read('./DailyRoutine.jsx'), phone = read('./MobileStartDay.jsx'), app = read('./TradingJournal.jsx'), panel = read('./WeeklyChallengePanel.jsx');

test('the routine greets by the time of day on desktop and phone', () => {
  for (const source of [desktop, phone]) {
    assert.match(source, /Good morning/);
    assert.match(source, /Good afternoon/);
    assert.match(source, /Good evening/);
  }
});

test('the weekly challenge panel sits inside the routine on both screens, without a new popup or tab', () => {
  assert.match(desktop, /<WeeklyChallengePanel weekly=\{weekly\}\/>/);
  assert.match(phone, /<WeeklyChallengePanel weekly=\{weekly\}\/>/);
  assert.match(panel, /rows\.slice\(0, 2\)/);
  assert.match(panel, /Show \$\{rows\.length - 2\} more/);
});

test('the accounts row shows balance and this week, and no Guardrails link or level', () => {
  assert.match(desktop, /This week/);
  assert.doesNotMatch(desktop, /Guardrails/);
  assert.doesNotMatch(desktop, /Daily cap/);
  assert.match(phone, /This week/);
});

test('weekly progress is read from existing challenge data, never written', () => {
  const start = app.indexOf('const routineWeekly = useMemo');
  const block = app.slice(start, app.indexOf('}, [routinePrompt, routineOff', start));
  assert.match(block, /weeklyChallengeRows\(/);
  assert.doesNotMatch(block, /set[A-Z]\w*\(|updateJournalRoutine|save\w*\(/);
});

test('the popup keeps one size and the week scrolls inside', () => {
  const css = read('./dailyRoutine.css');
  assert.match(css, /\.tj-routine-popup \{[^}]*height:min\(860px,97vh\)/);
  assert.match(read('./weeklyChallenge.css'), /\.tj-wk-list\{[^}]*overflow-y:auto/);
});

test('a member with the routine off gets one quiet bell note on the first day of the week', () => {
  const start = app.indexOf('Routine off but a challenge running');
  const block = app.slice(start, start + 1400);
  assert.match(block, /postNotice\(\{ key: `week:/);
  assert.match(block, /quiet: true/);
  assert.match(block, /getDay\(\) !== \(weekStart === 'sunday' \? 0 : 1\)/);
  assert.match(app, /const routineOff = normalizeRoutine\(routineStore\.routine\)\.enabled === false/);
});
