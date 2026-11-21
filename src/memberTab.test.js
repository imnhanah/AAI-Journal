import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = name => readFileSync(new URL(name, import.meta.url), 'utf8');

test('a failed Owner check never hides the Memberships tab', () => {
  assert.match(read('./membershipAdmin.js'), /if \(error\) throw error;\s*return data === true;/);
  const app = read('./TradingJournal.jsx');
  assert.match(app, /readMembershipAdmin\(\)\.catch\(\(\) => null\)/);
  assert.match(app, /authorized !== null\) setMembershipAdmin\(authorized\)/);
});
