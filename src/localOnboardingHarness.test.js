import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = name => readFileSync(new URL(`./${name}`, import.meta.url), 'utf8');

test('local onboarding harness is development-only and reuses the real onboarding components', () => {
  const main = read('main.jsx');
  const harness = read('LocalOnboardingHarness.jsx');
  assert.match(main, /import\.meta\.env\.DEV[\s\S]*LocalOnboardingHarness/);
  assert.match(main, /pathname === '\/__local-onboarding'/);
  assert.match(harness, /EmptyJournalOnboarding/);
  assert.match(harness, /AddAccountModal/);
  assert.match(harness, /LOCAL ONBOARDING TEST — NO DATA SAVED\./);
  assert.match(harness, /Blocked by LOCAL ONBOARDING TEST/);
  assert.match(harness, /searchParams\.set\('mode', nextMode\)/);
  assert.doesNotMatch(harness, /from ['"]\.\/db|supabase\.auth|createAccount\(/);
});

test('production source exports the actual onboarding and account-creation components', () => {
  const journal = read('TradingJournal.jsx');
  assert.match(journal, /export function EmptyJournalOnboarding/);
  assert.match(journal, /export function AddAccountModal/);
});
