import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { depositBlockText } from './useDepositCheck.js';

const journal = readFileSync(new URL('./TradingJournal.jsx', import.meta.url), 'utf8');
const money = (value) => `$${value}`;

test('deposit lock message names the limit and the most you can add', () => {
  const text = depositBlockText({ allowed: false, reason: 'funding-cap', fundedLevel: 9, maxLevel: 5, totalLevels: 10, maximum: 120.5 }, money);
  assert.match(text, /Level 9/); assert.match(text, /up to Level 5/); assert.match(text, /\$120\.5/);
});

test('when the halfway level is reached, deposits are closed', () => {
  assert.match(depositBlockText({ allowed: false, reason: 'active-cap', maxLevel: 5, totalLevels: 10 }, money), /Deposits are closed/);
  assert.equal(depositBlockText(null, money), '');
});

test('the same funding check guards the warning and the save', () => {
  assert.match(journal, /const checkDepositFunding = async \(movement\)/);
  assert.match(journal, /const funding = await checkDepositFunding\(movement\);/);
  assert.match(journal, /onCheckDeposit=\{checkDepositFunding\}/);
});
