import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('./TradingJournal.jsx',import.meta.url),'utf8');
const page=source.slice(source.indexOf('function FinancePage('),source.indexOf('function FinanceReminderModal('));
const css=readFileSync(new URL('./financeRedesign.css',import.meta.url),'utf8');
test('Finance reference keeps overview, ledger and the working entry and savings actions',()=>{
  for(const label of ['AVAILABLE CAPITAL','TOTAL SAVINGS','CASH FLOW · FUNDS IN VS OUT','READY TO SAVE','Cash movements','New movement','Savings plans']) assert.ok(page.includes(label));
  assert.match(page,/showOlder \? cashMovements : cashMovements.slice\(0, 6\)/);
  assert.match(page,/onClick=\{record\}/);
  assert.match(page,/onTransfer=\{\(\) => recordPlannedTransfer\(saving\)\}/);
  assert.match(page,/onDelete\(movement.id\)/);
});
test('Finance styling is scoped, responsive and uses the current accent without text transforms',()=>{
  assert.match(css,/tj-finance-v2/);
  assert.match(css,/@container \(max-width:700px\)/);
  assert.match(css,/var\(--tj-accent\)/);
  assert.doesNotMatch(css,/(?:transform|filter|backdrop-filter)\s*:|#[\da-f]{3,8}\b/);
  for(const match of css.matchAll(/font-size:\s*([\d.]+)px/g)) assert.ok(Number(match[1])>=12);
});
