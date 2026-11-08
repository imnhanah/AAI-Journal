import test from 'node:test';
import assert from 'node:assert/strict';
import {initialChallengeExpansion,initializeChallengeExpansion,normalizeChallengeExpansion,setChallengeExpanded} from './challengeExpansionState.js';

const cards=['pepperstone','exness','funded-next'];

test('a fresh Challenge session expands only the first active card in display order',()=>{
  assert.deepEqual(initialChallengeExpansion([{id:'pepperstone',active:true}]),{initialized:true,ids:['pepperstone']});
  assert.deepEqual(initialChallengeExpansion([{id:'funded-next',active:false},{id:'exness',active:true},{id:'pepperstone',active:true}]),{initialized:true,ids:['exness']});
  assert.deepEqual(initialChallengeExpansion([{id:'funded-next',active:false}]),{initialized:true,ids:[]});
});

test('async hydration leaves a fresh session uninitialized until every card is ready, then opens the first active card once',()=>{
  const fresh={initialized:false,ids:[]};
  const loading=[{id:'failed',ready:false,active:false},{id:'pepperstone',ready:false,active:false}];
  assert.deepEqual(initializeChallengeExpansion(fresh,loading),fresh);
  const hydrated=[{id:'failed',ready:true,active:false},{id:'pepperstone',ready:true,active:true},{id:'exness',ready:true,active:true}];
  const initialized=initializeChallengeExpansion(fresh,hydrated);
  assert.deepEqual(initialized,{initialized:true,ids:['pepperstone']});
  assert.deepEqual(initializeChallengeExpansion(initialized,hydrated),initialized,'later metric renders do not reopen manually collapsed cards');
});

test('challenge cards expand and collapse independently by stable ID',()=>{
  let state=initialChallengeExpansion([{id:'pepperstone',active:true}]);
  state=setChallengeExpanded(state,cards,'exness',true);
  assert.deepEqual(state.ids,['pepperstone','exness']);
  state=setChallengeExpanded(state,cards,'pepperstone',false);
  assert.deepEqual(state.ids,['exness']);
  state=setChallengeExpanded(state,cards,'exness',value=>!value);
  assert.deepEqual(state.ids,[]);
});

test('navigation retains manual state while a new browser session recalculates the default',()=>{
  const manual={initialized:true,ids:['exness']};
  assert.deepEqual(normalizeChallengeExpansion(manual,cards),manual);
  assert.deepEqual(initialChallengeExpansion([{id:'pepperstone',active:true},{id:'exness',active:true}]),{initialized:true,ids:['pepperstone']});
});

test('reorder keeps matching IDs, deleted cards are removed, and a new card does not reset manual choices',()=>{
  const manual={initialized:true,ids:['exness','pepperstone']};
  assert.deepEqual(normalizeChallengeExpansion(manual,['new','pepperstone','exness']),manual);
  assert.deepEqual(normalizeChallengeExpansion(manual,['new','pepperstone']),{initialized:true,ids:['pepperstone']});
});
