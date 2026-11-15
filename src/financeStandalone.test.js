import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { savingsIssue, newSavingsDraft } from './savingsSetup.js';

const journal = readFileSync(new URL('./TradingJournal.jsx', import.meta.url), 'utf8');

test('Finance no longer depends on an account-level switch', () => {
  assert.doesNotMatch(journal, /finance\?\.enabled/);
  assert.match(journal, /page === "finance" && \(/);
  assert.match(journal, /aaicorefx:open-finance/);
});

test('savings accounts are saved from the Finance page', () => {
  assert.match(journal, /onSaveSavings=\{handleSaveSavings\}/);
  assert.match(journal, /const handleSaveSavings = async \(list\)/);
});

test('savings window validation', () => {
  assert.equal(savingsIssue({ name: 'Savings', target: 0, allocationPct: 20, reminderMinutes: 30 }), '');
  assert.match(savingsIssue({ name: ' ', target: 0, allocationPct: 20, reminderMinutes: 30 }), /name/);
  assert.match(savingsIssue({ name: 'A', target: 0, allocationPct: 120, reminderMinutes: 30 }), /0 to 100/);
  assert.match(savingsIssue({ name: 'A', target: 0, allocationPct: 5, reminderMinutes: 0 }), /Reminder/);
  assert.ok(newSavingsDraft('b1').id.startsWith('draft-'));
});
