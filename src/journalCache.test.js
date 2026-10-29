import test from 'node:test';
import assert from 'node:assert/strict';
import { writeJournalCache, readJournalCache } from './journalCache.js';

test('cache keeps image references/captions and identifies only omitted inline bytes', () => {
  const records = new Map();
  const original = globalThis.localStorage;
  globalThis.localStorage = { getItem: key => records.get(key), setItem: (key, value) => records.set(key, value) };
  try {
    const reference = 'tj-image:{"version":"one"}';
    writeJournalCache('owner', { imageReferences: true, accounts: [{ id: 'account', trades: [
      { id: 'refs', screenshots: { entry: [{ src: reference, caption: 'Setup' }], exit: [] } },
      { id: 'removed', screenshots: { entry: [], exit: [] } },
      { id: 'new', screenshots: { entry: ['data:image/png;base64,large'], exit: [] } },
    ] }], markups: [], reviews: [] });
    const data = readJournalCache('owner').data;
    const [refs, removed, added] = data.accounts[0].trades;
    assert.equal(refs.screenshots.entry[0].src, reference);
    assert.equal(refs.screenshots.entry[0].caption, 'Setup');
    assert.equal(refs._cachedImagePayload, false);
    assert.equal(removed._cachedImagePayload, false);
    assert.equal(added._cachedImagePayload, true);
    assert.deepEqual(added.screenshots.entry, []);
    assert.equal(readJournalCache('someone-else'), null);
  } finally { globalThis.localStorage = original; }
});
