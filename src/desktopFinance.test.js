import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const journal = readFileSync(new URL('./TradingJournal.jsx', import.meta.url), 'utf8');
const view = readFileSync(new URL('./DesktopFinance.jsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('./desktopFinance.css', import.meta.url), 'utf8');

test('desktop Finance shows v2 after the phone branch; phones keep MobileFinance', () => {
  assert.match(journal, /const FINANCE_V2 = true;/);
  assert.match(journal, /import DesktopFinanceV2 from '\.\/DesktopFinance\.jsx';/);
  const phone = journal.indexOf('if (phone) return <MobileFinance');
  const desktop = journal.indexOf('if (FINANCE_V2) {');
  assert.ok(phone > 0 && desktop > phone, 'v2 is returned only after the phone branch');
});

test('Finance v2 records through the same handlers, keeps all-type counts and shows balance after', () => {
  assert.match(journal, /const cashMovements = ledgerMovements\.filter\(\(movement\) => movementFilter === "all" \|\| movement\.type === movementFilter\);/);
  assert.match(journal, /allMovements=\{ledgerMovements\.map\(movement => \(\{\.\.\.movement,title:movementLabel\(movement\)\}\)\)\} balanceAfter=\{balanceAfter\}/);
  assert.match(journal, /date=\{date\} onDate=\{setDate\} note=\{note\} onNote=\{setNote\} onRecord=\{record\}/);
  assert.match(journal, /if \(!multiBalance\) \{\n\s*balanceAfter = \{\}; let running = tradingOpeningBalance\(account\);/);
  assert.match(view, /const issue = financeMovementIssue\(/);
  assert.match(view, /confirmLabel: 'Delete movement', tone: 'danger'/);
});

test('Finance v2 has the hero actions, ledger, savings plans and movement drawer', () => {
  for (const label of ['Keep cash flow intentional.', 'Available capital', 'Move to savings', 'Search notes', 'Cash movements never change your trading statistics.', 'Ready to transfer', 'Transfers to savings', 'New movement', 'Withdraw from']) assert.ok(view.includes(label), label);
  assert.match(view, /\[10, 25, 50, 100\]\.map/);
});

test('Finance v2 styles are desktop-only, hide the duplicate banner and reflow by page width', () => {
  assert.match(css, /\.tj-page-transition:has\(\.fn2\)>\.tj-signal-page-finance \{display:none;\}/);
  assert.match(css, /^@media \(min-width:768px\) \{/m);
  assert.match(css, /@container journal-workspace \(max-width:1000px\)/);
  assert.match(css, /@media \(min-width:768px\) and \(prefers-reduced-motion:reduce\)/);
});
