import test from 'node:test';
import assert from 'node:assert/strict';
import {persistedBalanceResultNetPnl} from './balanceResultPnl.js';

test('missing persisted net P&L remains distinguishable from a real zero',()=>{
  assert.equal(persistedBalanceResultNetPnl(null),null);
  assert.equal(persistedBalanceResultNetPnl(''),null);
  assert.equal(persistedBalanceResultNetPnl(0),0);
  assert.equal(persistedBalanceResultNetPnl('18.5'),18.5);
});
