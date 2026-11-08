import test from 'node:test';
import assert from 'node:assert/strict';
import { serializedRr } from './tradePayload.js';

test('running-trade payload omits an absent rr so the database default can apply', () => {
  assert.deepEqual(serializedRr(null), {});
  assert.deepEqual(serializedRr(''), {});
});

test('closed-trade payload serializes finite positive, zero, and negative rr values', () => {
  assert.deepEqual(serializedRr(1.25), { rr:1.25 });
  assert.deepEqual(serializedRr(0), { rr:0 });
  assert.deepEqual(serializedRr(-1), { rr:-1 });
});
