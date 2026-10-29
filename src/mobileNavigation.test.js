import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MOBILE_MORE_PAGES } from './mobileNavigation.js';

test('the phone More menu exposes Case Studies with the existing page route', () => {
  assert.ok(MOBILE_MORE_PAGES.includes('case-studies'));

  const shell = readFileSync(new URL('./MobileShell.jsx', import.meta.url), 'utf8');
  const journal = readFileSync(new URL('./TradingJournal.jsx', import.meta.url), 'utf8');
  assert.match(shell, /'case-studies':BookOpen/);
  assert.match(shell, /const go=id=>\{onSheet\(null\);onNavigate\(id\);\}/);
  assert.match(journal, /\{ id: "case-studies", label: "Case Studies"/);
  assert.match(journal, /JOURNAL_PATHS\[nextPage\]/);
});
