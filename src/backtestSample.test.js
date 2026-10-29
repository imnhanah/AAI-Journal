import test from 'node:test';import assert from 'node:assert/strict';
import {eurusdSample,sampleRandom} from './backtestSample.js';import {backtestStats} from './backtestModel.js';
test('requested EURUSD sample has exactly ten closed trades, four +3R wins and six -1R losses',()=>{
 const trades=eurusdSample('sample',()=>.4),stats=backtestStats({startingBalance:10000,tradeTarget:10},trades);
 assert.equal(trades.length,10);assert.equal(new Set(trades.map(t=>t.id)).size,10);
 assert.ok(trades.every(t=>t.asset==='EUR/USD'&&t.runId==='sample'&&t.premarketMarkupId===null));
 assert.equal(trades.filter(t=>t.rr===3).length,4);assert.equal(trades.filter(t=>t.rr===-1).length,6);
 assert.equal(stats.winRate,40);assert.equal(stats.balance,10600);assert.equal(stats.net,600);assert.equal(stats.profitFactor,2);
 assert.ok(trades.every(t=>t.pnl===t.rr*100&&t.context.includes('Generated sample')));
});
test('randomized sample outcomes can be reproduced safely after a partial-save retry',()=>{
 assert.deepEqual(eurusdSample('x',sampleRandom('run-id')).map(t=>[t.rr,t.direction]),eurusdSample('x',sampleRandom('run-id')).map(t=>[t.rr,t.direction]));
});
