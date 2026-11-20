import test from 'node:test';
import assert from 'node:assert/strict';
import { writesAreExplicitlyPaused, accountsFull, applyMemberAccess, featureOff, fetchMyAccess, normalizeAccess, exportMyRecords, fetchMyNotifications, markNotificationRead, clearNotification } from './memberAccess.js';
import { MEMBERSHIP, resolveEffectiveMembership } from './membership.js';

const good = { available: true, status: 'active', deletion_at: null, features: { trade_logs: true, finance: false, challenge: true, case_studies: true, strategy_testing: true }, multiple_accounts_allowed: false, account_limit: null, accounts_used: 2, journal_cloud_write_allowed: true, image_upload_allowed: false, support_email: 'aaicorefx@gmail.com' };

test('a valid reply is read exactly, and null means no account limit', () => {
  const access = normalizeAccess(good);
  assert.equal(access.available, true);
  assert.equal(access.accountLimit, null);
  assert.equal(access.multipleAccountsAllowed, false);
  assert.equal(access.journalCloudWriteAllowed, true);
  assert.equal(access.imageUploadAllowed, false);
});

test('missing, malformed or unknown replies are unavailable, never permission', () => {
  for (const bad of [null, undefined, {}, { available: false }, { available: true }, { available: true, status: 'weird' }, 'active']) {
    const access = normalizeAccess(bad);
    assert.equal(access.available, false);
    assert.equal(access.journalCloudWriteAllowed, false);
    assert.equal(access.imageUploadAllowed, false);
  }
});

test('a lookup error is unavailable, not an empty journal', async () => {
  const failing = { rpc: async () => ({ data: null, error: { message: 'boom' } }) };
  assert.equal((await fetchMyAccess({ client: failing })).available, false);
  const throwing = { rpc: async () => { throw new Error('offline'); } };
  assert.equal((await fetchMyAccess({ client: throwing })).available, false);
});

test('deleting keeps the deadline, and only a valid date is used', () => {
  assert.equal(normalizeAccess({ ...good, status: 'deleting', deletion_at: '2026-12-01T00:00:00Z' }).deletionAt, '2026-12-01T00:00:00Z');
  assert.equal(normalizeAccess({ ...good, status: 'deleting', deletion_at: 'not a date' }).deletionAt, null);
});

test('export accepts only the CSV text the server sends', async () => {
  assert.deepEqual(await exportMyRecords({ client: { rpc: async () => ({ data: 'table,record_json\r\n', error: null }) } }), { csv: 'table,record_json\r\n' });
  assert.ok((await exportMyRecords({ client: { rpc: async () => ({ data: '<html>', error: null }) } })).error);
  assert.ok((await exportMyRecords({ client: { rpc: async () => ({ data: null, error: { message: 'x' } }) } })).error);
});

test('Premium is recognized as a plan label only', async () => {
  const lookup = value => resolveEffectiveMembership({ authenticated: true, client: { rpc: async () => ({ data: value, error: null }) } });
  assert.equal((await lookup('premium')).membership, MEMBERSHIP.PREMIUM);
  assert.equal((await lookup('owner')).membership, MEMBERSHIP.OWNER);
  assert.equal((await lookup('free')).membership, MEMBERSHIP.FREE);
  assert.equal((await lookup('something-else')).membership, MEMBERSHIP.FREE);
  assert.notEqual(MEMBERSHIP.PREMIUM, MEMBERSHIP.OWNER);
});

test('notifications keep only well-formed plain-text messages, oldest last', async () => {
  const rows = [{ id: 'a', title: 'One', body: 'x', created_at: '2026-01-01T00:00:00Z', read_at: null }, { id: 'b', title: 'Two', body: '<b>y</b>', created_at: '2026-01-02T00:00:00Z', read_at: '2026-01-03T00:00:00Z' }, { id: 5, title: 'bad' }, null];
  const result = await fetchMyNotifications({ client: { rpc: async () => ({ data: rows, error: null }) } });
  assert.deepEqual(result.notes.map(note => note.id), ['b', 'a']);
  assert.equal(result.notes[0].body, '<b>y</b>');
  assert.equal(result.notes[0].read, true);
  assert.equal(result.notes[1].read, false);
});

test('a notification lookup failure is an error, not an empty list', async () => {
  assert.ok((await fetchMyNotifications({ client: { rpc: async () => ({ data: null, error: { message: 'x' } }) } })).error);
  assert.ok((await fetchMyNotifications({ client: { rpc: async () => ({ data: { not: 'a list' }, error: null }) } })).error);
});

test('mark read and clear report success only when the server says so', async () => {
  const yes = { rpc: async () => ({ data: true, error: null }) };
  const no = { rpc: async () => ({ data: false, error: null }) };
  const bad = { rpc: async () => { throw new Error('offline'); } };
  assert.equal(await markNotificationRead('a', { client: yes }), true);
  assert.equal(await markNotificationRead('a', { client: no }), false);
  assert.equal(await clearNotification('a', { client: bad }), false);
});

import { canQueueCloudUpload } from './sharedImageStorage.js';
const allowed = { ...good, image_upload_allowed: true };
const ownerReady = { status: 'ready', membership: MEMBERSHIP.OWNER, cloudWritesAllowed: true, imageAccessStatus: 'ready', imageUploadsAllowed: true };
test('the access answer never grants a free member cloud writes', () => {
  const free = { status: 'ready', membership: MEMBERSHIP.FREE, cloudWritesAllowed: false };
  const r = applyMemberAccess(free, normalizeAccess({ ...good, journal_cloud_write_allowed: true, image_upload_allowed: true }), true);
  assert.equal(r.cloudWritesAllowed, false);
  assert.equal(canQueueCloudUpload(r), false);
});

import { readFileSync } from 'node:fs';
test('member-access hooks run before the journal screen returns early', () => {
  const source = readFileSync(new URL('./TradingJournal.jsx', import.meta.url), 'utf8');
  const hook = source.indexOf("document.documentElement.classList.toggle('tj-accounts-full'");
  const earlyReturn = source.indexOf('if (loaded && loadError && !account) {');
  assert.ok(hook > 0 && earlyReturn > 0 && hook < earlyReturn, 'hooks must stay above the first early return');
});

test('an incomplete or inconsistent reply is unavailable, never permission', () => {
  const bad = [
    { ...good, features: { finance: false } },
    { ...good, features: { ...good.features, extra: true } },
    { ...good, features: { ...good.features, finance: 'no' } },
    { ...good, multiple_accounts_allowed: undefined },
    { ...good, account_limit: -1 },
    { ...good, account_limit: 'x' },
    { ...good, accounts_used: null },
    { ...good, status: 'deleting', deletion_at: null },
    { ...good, status: 'active', deletion_at: '2026-12-01T00:00:00Z' },
    { ...good, journal_cloud_write_allowed: undefined },
  ];
  for (const raw of bad) assert.equal(normalizeAccess(raw).available, false);
  assert.equal(normalizeAccess(good).available, true);
});
test('only an explicit false switches a feature off, and only for an active account', () => {
  const off = normalizeAccess(good);
  assert.equal(featureOff(off, 'finance', true), true);
  assert.equal(featureOff(off, 'challenge', true), false);
  assert.equal(featureOff(off, 'finance', false), false);
  assert.equal(featureOff(null, 'finance', true), false);
  assert.equal(featureOff(normalizeAccess(null), 'finance', true), false);
});
test('a normal Owner keeps working while access is active, and pauses when it is not', () => {
  assert.deepEqual(applyMemberAccess(ownerReady, normalizeAccess(allowed), true), ownerReady);
  const plain = { status: 'ready', membership: MEMBERSHIP.OWNER, error: '', imageAccessStatus: 'ready', imageUploadsAllowed: true };
  assert.equal(canQueueCloudUpload(applyMemberAccess(plain, normalizeAccess(allowed), true)), true);
  assert.equal(canQueueCloudUpload(applyMemberAccess(plain, null, true)), false);
  assert.equal(applyMemberAccess(plain, null, false), plain);
  for (const state of [normalizeAccess({ ...good, status: 'suspended' }), normalizeAccess({ ...good, status: 'banned' }), normalizeAccess(null)]) {
    const paused = applyMemberAccess(plain, state, true);
    assert.equal(paused.cloudWritesAllowed, false);
    assert.equal(canQueueCloudUpload(paused), false);
  }
});
test('the tighter account limit applies, including zero, and unverified access blocks creation', () => {
  const make = extra => normalizeAccess({ ...good, ...extra });
  assert.equal(accountsFull(make({ multiple_accounts_allowed: false, account_limit: 0, accounts_used: 0 }), 0, true), true);
  assert.equal(accountsFull(make({ multiple_accounts_allowed: false, account_limit: null, accounts_used: 0 }), 0, true), false);
  assert.equal(accountsFull(make({ multiple_accounts_allowed: false, account_limit: null, accounts_used: 1 }), 0, true), true);
  assert.equal(accountsFull(make({ multiple_accounts_allowed: true, account_limit: 3, accounts_used: 2 }), 2, true), false);
  assert.equal(accountsFull(make({ multiple_accounts_allowed: true, account_limit: 3, accounts_used: 2 }), 3, true), true);
  assert.equal(accountsFull(make({ multiple_accounts_allowed: true, account_limit: null, accounts_used: 50 }), 50, true), false);
  assert.equal(accountsFull(make({ multiple_accounts_allowed: false, account_limit: 3, accounts_used: 0 }), 1, true), true);
  assert.equal(accountsFull(normalizeAccess(null), 0, true), true);
  assert.equal(accountsFull(make({ status: 'suspended' }), 0, true), true);
  assert.equal(accountsFull(null, 0, true), true);
  assert.equal(accountsFull(null, 0, false), false);
  assert.equal(accountsFull(make({ account_limit: 0 }), 0, false), false);
});

test('an explicit no from the server narrows an active reply, and nothing else does', () => {
  const plain = { status: 'ready', membership: MEMBERSHIP.OWNER, error: '', imageAccessStatus: 'ready', imageUploadsAllowed: true };
  const noJournal = applyMemberAccess(plain, normalizeAccess({ ...good, journal_cloud_write_allowed: false }), true);
  assert.equal(noJournal.cloudWritesAllowed, false);
  const noImages = applyMemberAccess(plain, normalizeAccess({ ...good, image_upload_allowed: false }), true);
  assert.equal(canQueueCloudUpload(noImages), false);
  assert.equal(canQueueCloudUpload(applyMemberAccess(plain, normalizeAccess(allowed), true)), true);
});

test('writes pause for pending, unverified, inactive or explicitly denied access only', () => {
  assert.equal(writesAreExplicitlyPaused(null, true), true);
  assert.equal(writesAreExplicitlyPaused(normalizeAccess(null), true), true);
  assert.equal(writesAreExplicitlyPaused(normalizeAccess({ ...good, status: 'suspended' }), true), true);
  assert.equal(writesAreExplicitlyPaused(normalizeAccess({ ...good, journal_cloud_write_allowed: false }), true), true);
  assert.equal(writesAreExplicitlyPaused(normalizeAccess(good), true), false);
  assert.equal(writesAreExplicitlyPaused(null, false), false);
});
test('every cloud write in the data layer checks the pause first', () => {
  const source = readFileSync(new URL('./db.js', import.meta.url), 'utf8');
  assert.match(source, /export const setCloudWritesPaused/);
  const writes = [...source.matchAll(/export async function ((?:create|update|delete|save|set|add|reset|markLocal)\w*)\([^)]*\)\s*\{([^]{0,60})/g)];
  assert.ok(writes.length >= 31);
  for (const [, name, start] of writes) {
    if (name !== 'saveTypeTags') assert.match(start, /^\s*if\s*\(globalThis\.__tjCloudWritesPaused\s*===\s*true\)\s*return/, `${name} must check the pause first`);
  }
});

test('case study and strategy testing cloud saves also check the pause first', () => {
  for (const [file, name] of [['caseStudyCloud.js', 'saveProfileCaseStudyLibrary'], ['backtestCloud.js', 'saveTestRun'], ['backtestCloud.js', 'saveTestTrade']]) {
    const source = readFileSync(new URL(`./${file}`, import.meta.url), 'utf8');
    const at = source.indexOf(`export async function ${name}(`);
    assert.ok(at >= 0, name);
    assert.match(source.slice(at, at + 260), /__tjCloudWritesPaused===true/, `${name} must check the pause`);
  }
});

test('bell callbacks discard answers from a previous account', () => {
  const source = readFileSync(new URL('./MemberBell.jsx', import.meta.url), 'utf8');
  assert.match(source, /epoch\.current \+= 1/);
  for (const name of ['const load = useCallback', 'const read = async', 'const clear = async']) {
    const at = source.indexOf(name);
    assert.ok(at >= 0, name);
    assert.match(source.slice(at, at + 700), /epoch\.current/, `${name} must check the epoch`);
  }
});
