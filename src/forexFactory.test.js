import test from "node:test";
import assert from "node:assert/strict";
import { normalizeEvents } from "./forexFactory.js";
test("release normalization retains actual values without inventing missing data", () => {
  const base = {title:"Release",country:"USD",date:"2026-10-09T14:00:00Z",impact:"Medium",forecast:"47.5",previous:"47.8"};
  const [missing,zero,published] = normalizeEvents([base,{...base,actual:0},{...base,actual:"48.1",description:"Source description"}]);
  assert.equal(missing.actual,"—");
  assert.equal(missing.description,"");
  assert.equal(zero.actual,0);
  assert.equal(published.actual,"48.1");
  assert.equal(published.description,"Source description");
  assert.equal(published.impact,"medium");
});
