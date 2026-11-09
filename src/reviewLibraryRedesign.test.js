import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const journal = readFileSync(new URL('./TradingJournal.jsx', import.meta.url), 'utf8');
const view = readFileSync(new URL('./ReviewPage.jsx', import.meta.url), 'utf8');
const phone = readFileSync(new URL('./MobilePeriodReviews.jsx', import.meta.url), 'utf8');
const desktop = readFileSync(new URL('./desktopReview.css', import.meta.url), 'utf8');

test('active Review Library derives live annual, quarterly and monthly models', () => {
  assert.match(journal, /function ReviewLibraryPage\(/);
  assert.match(journal, /const reviewModels = useMemo\(\(\) => \{/);
  assert.match(journal, /reviewPeriodStats\(trades, reviews, account, "monthly", key\)/);
  assert.match(journal, /reviewPeriodStats\(trades, reviews, account, "quarterly", key\)/);
  assert.match(journal, /reviewPeriodStats\(trades, reviews, account, "annual", String\(reviewYear\)\)/);
  assert.match(journal, /<ReviewPage reviews=\{reviewModels\} answers=\{answers\}/);
});

test('active Review Library preserves account-scoped saves and review-trade linking', () => {
  assert.match(journal, /accountScopes: \{ \.\.\.\(rawPrevious\?\.content\?\.accountScopes \|\| \{\}\), \[reviewBalanceId\]: \{ content, completed \} \}/);
  assert.match(journal, /const reviewMonthTrades = \(period\) => \{/);
  assert.match(journal, /!isRunningTrade\(trade\) && !reviews\.some\(\(item\) => item\.tradeId === trade\.id\)/);
  assert.match(journal, /\{monthTrades && <TradeReviewEditorModal/);
  assert.match(view, /onReviewTrades=\{onReviewTrades\}/);
});

test('active desktop Review keeps its navigator and responsive page-width layout', () => {
  assert.match(view, /<nav className="rv-list rv2-nav" aria-label="Reviews">/);
  assert.match(view, /<QuarterTile key=\{quarter\.id\}/);
  assert.match(view, /<MonthTile key=\{month\.id\}/);
  assert.match(desktop, /\.rv2-qg \{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\);/);
  assert.match(desktop, /@container journal-workspace \(max-width:980px\)/);
});

test('active phone Review protects unsaved writing and keeps period save errors visible', () => {
  assert.match(phone, /useLeaveGuard\(dirty, 'review-detail'\)/);
  assert.match(view, /setError\("Could not save\. Your edits are still here\."\)/);
  assert.match(phone, /role="alert"/);
  assert.match(phone, /\{saving \? 'Saving…' : 'Save review'\}/);
});

test('the removed legacy Review library is not retained alongside the active library', () => {
  assert.doesNotMatch(journal, /LegacyReviewLibraryPage/);
  assert.doesNotMatch(journal, /PeriodReviewModal/);
  assert.doesNotMatch(journal, /loadPeriodReviewContent/);
  assert.doesNotMatch(journal, /reviewLibrarySignals/);
});
