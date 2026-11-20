import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = name => readFileSync(new URL(`./${name}`, import.meta.url), 'utf8');

test('PLACEHOLDER_ACCOUNT has id:null, isPlaceholder:true, and all required empty arrays', () => {
  const source = read('TradingJournal.jsx');
  assert.match(source, /const PLACEHOLDER_ACCOUNT = \{/);
  assert.match(source, /id: null, isPlaceholder: true/);
  assert.match(source, /trades: \[\]/);
  assert.match(source, /balances: \[\]/);
  assert.match(source, /financeMovements: \[\]/);
  assert.match(source, /savingsAccounts: \[\]/);
});

test('placeholder is returned when accounts array is empty; real accounts still resolve normally', () => {
  const source = read('TradingJournal.jsx');
  assert.match(source, /if \(!accounts\.length\) return PLACEHOLDER_ACCOUNT/);
  assert.match(source, /accounts\.find\(\(a\) => a\.id === activeId\) \|\| accounts\[0\] \|\| null/);
});

test('placeholder is never written to storage: all save functions guard on account.id', () => {
  const source = read('TradingJournal.jsx');
  const guardPattern = /if \(!account\?\.id\) return/;
  const guardCount = [...source.matchAll(new RegExp(guardPattern, 'g'))].length;
  assert.ok(guardCount >= 7, `Expected at least 7 account.id guards, found ${guardCount}`);
});

test('requireWorkspace opens the create modal when placeholder, then resumes the action', () => {
  const source = read('TradingJournal.jsx');
  assert.match(source, /const requireWorkspace = \(next\) => \{/);
  assert.match(source, /if \(!account\?\.isPlaceholder\) \{ next\(\); return; \}/);
  assert.match(source, /pendingWorkspaceAction\.current = next/);
  assert.match(source, /setModal\('addaccount'\)/);
  assert.match(source, /const pending = pendingWorkspaceAction\.current/);
  assert.match(source, /if \(pending\) pending\(\)/);
});

test('workspace-dependent pages show NoWorkspaceState when placeholder', () => {
  const source = read('TradingJournal.jsx');
  assert.match(source, /account\.isPlaceholder \? <div/);
  assert.match(source, /<NoWorkspaceState/);
  assert.match(source, /function NoWorkspaceState\(/);
});

test('account settings and import modals are suppressed for placeholder', () => {
  const source = read('TradingJournal.jsx');
  assert.match(source, /modal === "account" && !account\.isPlaceholder/);
  assert.match(source, /modal === "import" && !tradeLogsReadOnly && !account\.isPlaceholder/);
});
