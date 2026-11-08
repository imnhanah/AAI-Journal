import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const journal = readFileSync(new URL('./TradingJournal.jsx', import.meta.url), 'utf8');
const lists = readFileSync(new URL('./MobileSetupLists.jsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('./mobileSetupLists.css', import.meta.url), 'utf8');

test('the lists update in place inside the existing Setup page', () => {
  for (const key of ['mistakes', 'confluences', 'entries']) assert.ok(journal.includes(`<ManagementCollection key="${key}" phone={phone} `));
  assert.ok(journal.includes('<RulesPage managementView phone={phone} '));
  assert.ok(journal.includes('<RiskPresetsManager presets={riskPresets} onSave={onRiskPresets} phone={phone}/>'));
  assert.doesNotMatch(lists, /<Modal|tj-ma-modal/);
  assert.ok(!journal.includes('className="tj-setup-back"'), 'the shared Back button replaces the old link');
});

test('preset rows stay locked and deleting still takes two taps', () => {
  assert.match(journal, /locked:isDefault\(item\)/);
  assert.match(lists, /row\.locked\s*\? <div className="tj-ml-item"/);
  assert.equal((lists.match(/<ConfirmDeleteButton /g) || []).length, 2);
});

test('the list copy does not promise that renames rewrite past trades', () => {
  assert.doesNotMatch(lists, /show on past trades/);
  assert.match(lists, /Past trades keep the name they were logged with/);
});

test('phone list text and targets respect the phone rules', () => {
  for (const size of css.matchAll(/font-size:([\d.]+)px/g)) assert.ok(Number(size[1]) >= 12);
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgba?\(/i);
});
