import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const view = readFileSync(new URL('./ReviewPage.jsx', import.meta.url), 'utf8');
const journal = readFileSync(new URL('./TradingJournal.jsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('./desktopReview.css', import.meta.url), 'utf8');

test('desktop Review navigator shows the year, 2x2 quarters and 12 month tiles', () => {
  assert.match(view, /import "\.\/desktopReview\.css";/);
  assert.match(view, /<nav className="rv-list rv2-nav" aria-label="Reviews">/);
  assert.match(view, /<QuarterTile key=\{quarter\.id\}/);
  assert.match(view, /<MonthTile key=\{month\.id\}/);
  assert.match(css, /\.rv2-qg \{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\);/);
  assert.match(css, /\.rv2-mg \{display:grid;grid-template-columns:repeat\(4,minmax\(0,1fr\)\);/);
});

test('Review insight counts trades that still need a review', () => {
  assert.match(journal, /const reviewPendingCount = reviewAnnual \? Math\.max\(0, \(reviewAnnual\.trades \|\| 0\) - \(reviewAnnual\.reviewed \|\| 0\)\) : 0;/);
  assert.match(journal, /className="tj-review-redesign-controls rv2-insight"/);
});

test('Review stacks by the page width when the side panel takes space', () => {
  assert.match(css, /@container journal-workspace \(max-width:980px\) \{\n\s*\.tj-root \.rv \.rv-md \{grid-template-columns:minmax\(0,1fr\);height:auto;overflow:visible;\}/);
  assert.match(css, /\.tj-root \.rv \.rv-heat \{grid-template-columns:repeat\(6,minmax\(0,1fr\)\);\}/);
});

test('month reviews have week tabs and weekly answers save into the month record', () => {
  assert.match(view, /export const weekKey = \(number, field\) => `week\$\{number\}_\$\{field\}`;/);
  assert.match(view, /\["overview", "Overview"\], \.\.\.weeks\.map\(\(week\) => \[`week\$\{week\.number\}`, `Week \$\{week\.number\}`, week\]\), \["reflection", "Reflection"\]/);
  assert.match(view, /const weekday = \(new Date\(Date\.UTC\(year, monthIndex, start\)\)\.getUTCDay\(\) \+ 6\) % 7;/);
  assert.match(view, /ctx\.editorialLong\(weekKey\(week\.number, field\), label, "Start writing…", 4\)/);
  assert.match(journal, /tradeRows: stat\.trades, reviewedIds: stat\.reviewedTrades\.map\(\(trade\) => trade\.id\), returnBase: Number\(account\.balance\) \|\| 0/);
});
