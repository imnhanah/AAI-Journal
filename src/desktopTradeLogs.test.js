import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const journal = readFileSync(new URL('./TradingJournal.jsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('./desktopTradeLogs.css', import.meta.url), 'utf8');
const tradeLog = journal.slice(journal.indexOf('function TradeLogPage'), journal.indexOf('\nfunction CalendarPage'));

test('desktop returns Trade Logs v2 after the phone timeline', () => {
  assert.match(journal, /import '\.\/desktopTradeLogs\.css';/);
  assert.match(journal, /if\(phone\)return <>\<MobileJournalTimeline/);
  assert.match(journal, /return desktopV2;/);
  assert.ok(journal.indexOf('if(phone)return <><MobileJournalTimeline') < journal.indexOf('return desktopV2;'));
  assert.doesNotMatch(tradeLog, /TRADE_LOGS_V2|tj-tradelog-reference-summary|tj-tradelog-card-grid/);
  assert.match(journal, /const shownAccountBalance = useDashboardBalanceCountUp\(accountBalance\);/);
  assert.match(journal, /const accountBalanceParts = ddMoneyParts\(shownAccountBalance, account\.baseCurrency\);/);
});

test('Trade Logs v2 keeps clicks inside its Filter and Sort panels', () => {
  assert.match(journal, /<div className="tl2-tools" ref=\{toolbarRef\}>/);
  assert.match(css, /\.tl2-tools \{display:contents;\}/);
});

test('Trade Logs v2 reflows by the page width and respects reduced motion', () => {
  assert.match(css, /@container journal-workspace \(max-width:1180px\) \{\n\s*\.tj-root \.tl2 :is\(\.tl2-layout,\.tl2-head,\.tl2-two,\.tl2-two\.is-wide-left\) \{grid-template-columns:minmax\(0,1fr\);\}/);
  assert.match(css, /@media \(min-width:768px\) and \(prefers-reduced-motion:reduce\)/);
  assert.match(css, /\.tl2-card \{[^}]*border-radius:20px;/);
  assert.match(css, /\.tl2-layout \{display:grid;grid-template-columns:392px minmax\(0,1fr\);/);
});
