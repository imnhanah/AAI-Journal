import test from 'node:test';
import assert from 'node:assert/strict';
import { claimNoticeKey, addNotice, adminToNotice, groupNotices, markAllRead, markRead, normalizeNotice, noticesSwitchedOn, noticeTime, readNotices, removeIds, restoreItems, saveNoticesSwitch, writeNotices } from './appNotices.js';

const memory = () => { const data = new Map(); return { getItem: k => data.has(k) ? data.get(k) : null, setItem: (k, v) => data.set(k, String(v)) }; };
const make = (key, extra = {}) => normalizeNotice({ key, kind: 'guard', title: `T ${key}`, text: 'x', urgent: true, ...extra }, 1000);

test('a notice needs a key, a known kind and a title', () => {
  assert.equal(normalizeNotice({ kind: 'guard', title: 'a' }), null);
  assert.equal(normalizeNotice({ key: 'a', kind: 'bogus', title: 'a' }), null);
  assert.equal(normalizeNotice({ key: 'a', kind: 'guard', title: '  ' }), null);
  assert.equal(make('a').id, 'app:a');
});

test('the same event never lands twice', () => {
  const first = addNotice([], make('a'));
  assert.equal(first.added, true);
  assert.equal(addNotice(first.items, make('a')).added, false);
});

test('urgent unread notices sit under Needs you now, the rest under Earlier', () => {
  let items = addNotice([], make('a', { at: 1 })).items;
  items = addNotice(items, make('b', { kind: 'goal', urgent: false, at: 2 })).items;
  assert.deepEqual(groupNotices(items).now.map(i => i.id), ['app:a']);
  assert.deepEqual(groupNotices(markRead(items, 'app:a')).now, []);
  assert.equal(groupNotices(markAllRead(items)).earlier.length, 2);
});

test('clearing can be undone and never duplicates', () => {
  const items = addNotice(addNotice([], make('a')).items, make('b')).items;
  const gone = removeIds(items, ['app:a']);
  assert.equal(gone.length, 1);
  assert.equal(restoreItems(gone, [items.find(i => i.id === 'app:a')]).length, 2);
  assert.equal(restoreItems(items, [items[0]]).length, 2);
});

test('the list and the switch survive a reload, per member', () => {
  const store = memory();
  writeNotices('u1', [make('a')], store);
  assert.equal(readNotices('u1', store).length, 1);
  assert.equal(readNotices('u2', store).length, 0);
  assert.equal(noticesSwitchedOn('u1', store), true);
  saveNoticesSwitch('u1', false, store);
  assert.equal(noticesSwitchedOn('u1', store), false);
  assert.equal(noticesSwitchedOn('u2', store), true);
});

test('admin messages become inbox rows that are never urgent', () => {
  const row = adminToNotice({ id: 'n1', title: 'Hi', body: 'Body', createdAt: '2026-11-20T10:00:00Z', read: false });
  assert.equal(row.urgent, false);
  assert.equal(row.source, 'admin');
});

test('time labels are short and human', () => {
  assert.equal(noticeTime(1000, 1000 + 30000), 'Just now');
  assert.equal(noticeTime(0, 5 * 60000), '5 min');
  assert.equal(noticeTime(0, 3 * 3600000), '3 h');
  assert.equal(noticeTime(0, 30 * 3600000), 'Yesterday');
  assert.equal(noticeTime(0, 4 * 86400000), '4 d');
});

test('an event is announced once per member, even after it was cleared', () => {
  const store = memory();
  assert.equal(claimNoticeKey('u1', 'app:a', store), true);
  assert.equal(claimNoticeKey('u1', 'app:a', store), false);
  assert.equal(claimNoticeKey('u2', 'app:a', store), true);
});

test('quiet notices keep their flag', () => {
  assert.equal(make('q', { quiet: true }).quiet, true);
  assert.equal(make('q').quiet, false);
});
