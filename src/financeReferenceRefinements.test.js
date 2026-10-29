import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=file=>readFileSync(new URL(file,import.meta.url),'utf8');
const page=read('./TradingJournal.jsx').split('function FinancePage(')[1].split('export function FinanceReminderModal')[0];
test('Finance has one ledger account scope shared with the top selector',()=>{
  assert.doesNotMatch(page,/movementBalanceId|setMovementBalanceId|Cash movement account/);
  assert.match(page,/financeMovementBelongsToBalance\(account, movement, activeBalanceId\)/);
  assert.ok(page.includes('label="Finance account"'));
});
test('cash filters live inside the ledger title, and desktop savings use a bounded donut and readable text',()=>{
  assert.match(page,/Cash movements<\/strong><\/div><div className="tj-finance-ledger-filters"/);
  const css=read('./financeReferenceRefinements.css');
  assert.match(css,/@media \(min-width:768px\)/);
  assert.match(css,/margin-left:auto;justify-content:flex-end/);
  assert.match(css,/ring strong \{width:40px;height:40px/);
  assert.match(css,/ring \{width:48px;height:48px/);
  for(const size of css.matchAll(/font-size:([\d.]+)px/g)) assert.ok(Number(size[1])>=12);
  assert.doesNotMatch(css,/(?:transform|filter|backdrop-filter)\s*:|#[a-f\d]{3,8}\b/i);
});
