import test from "node:test";
import assert from "node:assert/strict";
import { localDateKey } from "./dateUtils.js";
import { readFileSync } from "node:fs";

test("localDateKey preserves the calendar date supplied by the local clock", () => {
  const localMidnight = { getFullYear: () => 2026, getMonth: () => 8, getDate: () => 28 };
  const localMonthStart = { getFullYear: () => 2027, getMonth: () => 0, getDate: () => 1 };
  assert.equal(localDateKey(localMidnight), "2026-09-28");
  assert.equal(localDateKey(localMonthStart), "2027-01-01");
});

test("news headings format local calendar keys without applying the profile timezone", () => {
  const date = new Date(2026, 9, 9);
  assert.equal(localDateKey(date), "2026-10-09");
  assert.equal(new Intl.DateTimeFormat('en-CA', {timeZone:'America/New_York', year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date('2026-10-09T00:00:00Z')), "2026-10-08");
  const source=readFileSync(new URL('./TradingJournal.jsx',import.meta.url),'utf8');
  assert.match(source,/const fmtLongDate = \(d\) => formatDate\(localDateKey\(d\)\)/);
  assert.match(source,/const fmtShortDate = \(d\) => formatDate\(localDateKey\(d\)\)/);
});
