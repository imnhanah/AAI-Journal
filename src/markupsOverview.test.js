import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const journal=readFileSync(new URL('./TradingJournal.jsx',import.meta.url),'utf8');
const desktop=readFileSync(new URL('./MarkupsRedesign.jsx',import.meta.url),'utf8');

test('active desktop Markups keeps linked outcome, plan coverage, and filtering data together',()=>{
  assert.match(desktop,/const linkedFor=markup=>trades\.filter/);
  assert.match(desktop,/const totalFor=markup=>linkedFor\(markup\)\.reduce/);
  assert.match(desktop,/Linked P&amp;L/);
  assert.match(desktop,/Plan filled/);
  assert.match(desktop,/alignmentFilter/);
  assert.match(desktop,/resultFilter/);
  assert.doesNotMatch(journal,/function (?:MarkupsPage|ReferenceMarkupsPage)\(/);
});
