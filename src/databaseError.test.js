import test from 'node:test';
import assert from 'node:assert/strict';
import { databaseErrorMessage } from './databaseError.js';

test('database errors distinguish session, permission, validation and network failures without exposing detail', () => {
  assert.match(databaseErrorMessage({ code:'401', message:'JWT expired' }, 'save the trade'), /sign-in session has expired/i);
  assert.match(databaseErrorMessage({ code:'42501', message:'new row violates row-level security policy' }, 'save the trade'), /permission/i);
  assert.match(databaseErrorMessage({ code:'23514', message:'new row violates check constraint' }, 'save the trade'), /invalid or incomplete/i);
  assert.match(databaseErrorMessage({ message:'Failed to fetch' }, 'save the trade'), /could not reach the server/i);
  const message = databaseErrorMessage({ message:'private implementation detail' }, 'save the trade');
  assert.equal(message, "We couldn't save the trade. Please try again.");
  assert.doesNotMatch(message, /private implementation detail/i);
});

test('cloud trade creation verifies that the active Supabase session owns the trade', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(new URL('./db.js', import.meta.url), 'utf8');
  assert.match(source, /supabase\.auth\.getSession\(\)/);
  assert.match(source, /session\.user\?\.id!==userId/);
});
