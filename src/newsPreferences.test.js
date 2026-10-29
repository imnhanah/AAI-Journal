import test from "node:test";
import assert from "node:assert/strict";
import { NEWS_FILTER_KEY, readNewsFilters, toggleNewsCurrency, matchesNewsFilters, normalizeNewsFilters } from "./newsPreferences.js";

test("currency selections stack, toggle off, and ALL clears them", () => {
  const selected = toggleNewsCurrency(toggleNewsCurrency([], "USD"), "CAD");
  assert.deepEqual(selected, ["USD", "CAD"]);
  assert.deepEqual(toggleNewsCurrency(selected, "USD"), ["CAD"]);
  assert.deepEqual(toggleNewsCurrency(selected, "ALL"), []);
});
test("multiple currency filters combine with impact and global events", () => {
  const filters = normalizeNewsFilters({ currencies: ["USD","CAD"] });
  assert.equal(matchesNewsFilters({currency:"CAD",impact:"high"},filters), true);
  assert.equal(matchesNewsFilters({currency:"JPY",impact:"high"},filters), false);
  assert.equal(matchesNewsFilters({currency:"USD",impact:"low"},filters), false);
  assert.equal(matchesNewsFilters({currency:"All",impact:"medium"},filters), true);
});
test("saved preferences restore and malformed storage falls back safely", () => {
  const preferences = { impact: {high:false,medium:true,low:true}, currencies:["USD","CAD","USD","BAD"] };
  assert.deepEqual(readNewsFilters({getItem:key => {assert.equal(key,NEWS_FILTER_KEY); return JSON.stringify(preferences);}}), {...preferences,currencies:["USD","CAD"]});
  assert.deepEqual(readNewsFilters({getItem:()=>"{broken"}), normalizeNewsFilters(null));
  assert.deepEqual(readNewsFilters({getItem:()=>{throw Error("storage blocked");}}), normalizeNewsFilters(null));
});
