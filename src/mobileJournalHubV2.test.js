import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = name => readFileSync(new URL(name, import.meta.url), 'utf8');

test('Journal Hub V2 is phone-only, uses whole-card navigation, and keeps Reviews on hold', () => {
  const view = read('./MobileJournalHubV2.jsx');
  const css = read('./mobileJournalHubV2.css');
  const shell = read('./MobileShell.jsx');
  const journal = read('./TradingJournal.jsx');
  assert.match(view, /onOpenRoutine/);
  assert.match(view, /id:'markups'/);
  assert.match(view, /id:'tradelog'/);
  assert.match(view, /onNavigate\(id\)/);
  assert.match(view, /onNavigate\('challenge'\)/);
  assert.match(view, /onNavigate\('backtest'\)/);
  assert.doesNotMatch(view, /Reviews/);
  assert.match(css, /@media \(max-width:767px\)/);
  assert.match(css, /var\(--accent\)/);
  assert.match(css, /tj-jh2-routine:active/);
  assert.match(shell, /quickTile\('journal',NotebookText,'Trade Logs'/);
  assert.match(journal, /journal:'\/journal-hub'/);
  assert.match(journal, /\(page === "tradelog" \|\| page === "journal"\) && <TradeLogPage/);
  assert.match(journal, /openDailyRoutineFromHub/);
});
