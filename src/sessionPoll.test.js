import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const auth = readFileSync(new URL('./auth.js', import.meta.url), 'utf8');
const journal = readFileSync(new URL('./TradingJournal.jsx', import.meta.url), 'utf8');

test('checkSession is exported from auth.js', () => {
  assert.match(auth, /export async function checkSession\(\)/);
});

test('checkSession uses supabase.auth.getUser for server-validated check', () => {
  const fn = auth.slice(auth.indexOf('export async function checkSession'));
  assert.match(fn, /supabase\.auth\.getUser\(\)/);
});

test('checkSession returns authError for 401 status', () => {
  const fn = auth.slice(auth.indexOf('export async function checkSession'));
  assert.match(fn, /status === 401/);
  assert.match(fn, /authError: true/);
});

test('checkSession returns authError for 403 status', () => {
  const fn = auth.slice(auth.indexOf('export async function checkSession'));
  assert.match(fn, /status === 403/);
});

test('checkSession returns authError for auth-related error messages (invalid, expired, jwt, etc.)', () => {
  const fn = auth.slice(auth.indexOf('export async function checkSession'));
  assert.match(fn, /includes\('invalid'\)/);
  assert.match(fn, /includes\('expired'\)/);
  assert.match(fn, /includes\('jwt'\)/);
  assert.match(fn, /includes\('session'\)/);
});

test('checkSession returns networkError, not authError, when getUser throws', () => {
  const start = auth.indexOf('export async function checkSession');
  const end = auth.indexOf('\nexport async function ', start + 1);
  const fn = auth.slice(start, end > start ? end : undefined);
  const catchBlock = fn.slice(fn.indexOf('} catch'));
  assert.match(catchBlock, /networkError: true/);
  assert.doesNotMatch(catchBlock, /authError: true/);
});

test('checkSession returns authError when getUser returns no user data', () => {
  const fn = auth.slice(auth.indexOf('export async function checkSession'));
  assert.match(fn, /data\?\.user/);
  // The no-user path must return authError, not networkError
  const noUserLine = fn.slice(fn.indexOf('if (!data?.user)'));
  assert.match(noUserLine, /authError: true/);
});

test('TradingJournal.jsx imports checkSession from auth', () => {
  assert.match(journal, /import \{[^}]*checkSession[^}]*\} from "\.\/auth"/);
});

test('session poll listens for visibilitychange to detect when tab becomes visible', () => {
  assert.match(journal, /visibilitychange/);
});

test('session poll listens for window focus event', () => {
  const pollSection = journal.slice(journal.indexOf('visibilitychange'));
  assert.match(pollSection, /window\.addEventListener\('focus'/);
});

test('session poll runs every 60 seconds via setInterval', () => {
  assert.match(journal, /setInterval\([^,]+,\s*60000\)/);
});

test('session poll calls onLogout when checkSession returns authError', () => {
  const checkUsage = journal.slice(journal.indexOf('const result = await checkSession()'));
  assert.match(checkUsage, /result\.authError/);
  assert.match(checkUsage, /onLogoutRef\.current/);
});

test('session poll does not sign out on network errors (only authError triggers logout)', () => {
  const checkUsage = journal.slice(journal.indexOf('const result = await checkSession()'));
  // Must check authError specifically, not networkError
  assert.match(checkUsage, /result\.authError/);
  assert.doesNotMatch(checkUsage, /result\.networkError/);
});

test('session poll only runs check when tab is visible', () => {
  const runCheck = journal.slice(journal.indexOf('const runCheck = async'));
  assert.match(runCheck, /visibilityState\s*!==\s*['"]visible/);
});

test('session poll cleans up listeners and interval on unmount', () => {
  const pollEffect = journal.slice(journal.indexOf('document.addEventListener(\'visibilitychange\''));
  assert.match(pollEffect, /removeEventListener\('visibilitychange'/);
  assert.match(pollEffect, /removeEventListener\('focus'/);
  assert.match(pollEffect, /clearInterval\(id\)/);
});
