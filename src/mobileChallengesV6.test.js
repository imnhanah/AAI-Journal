import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mobileChallengeCounts, mobileChallengeLevelState, mobileChallengeRanges, mobileChallengeRowStatus} from './mobileChallengesV6Model.js';
import {scopeChallengeAccount} from './challengeLifecycle.js';
import {emptyChallenge} from './challengeModel.js';
import {replayChallenge, resetAutomation} from './challengeAutomation.js';

test('mobile challenge states distinguish earned progress, funding jumps, current, pending and failed levels', () => {
  const state = {statuses:{1:'Pass',2:'Jumped',3:'In progress'}};
  assert.equal(mobileChallengeLevelState(state, 1, 3, false), 'passed');
  assert.equal(mobileChallengeLevelState(state, 2, 3, false), 'jumped');
  assert.equal(mobileChallengeLevelState(state, 3, 3, false), 'current');
  assert.equal(mobileChallengeLevelState(state, 4, 3, false), 'pending');
  assert.equal(mobileChallengeLevelState(state, 3, 3, true), 'failed');
});

test('mobile challenge counts never treat deposit-funded levels as completed trading levels', () => {
  assert.deepEqual(mobileChallengeCounts({statuses:{1:'Pass',2:'Jumped',3:'Pass',4:'In progress'}}), {passed:2,jumped:1});
});

test('adaptive rows present unavailable static sizing rather than inventing broker-derived values', () => {
  const source = readFileSync(new URL('./MobileChallengesV6.jsx', import.meta.url), 'utf8');
  assert.match(source, /adaptive \? 'Unavailable for adaptive sizing'/);
  assert.match(source, /adaptive \? 'Unavailable' : `\$\{row\.lots\.toFixed\(2\)\} lots`/);
});

test('Challenge lifecycle mounts V6 only through the phone branch and retains the desktop split visual', () => {
  const source = readFileSync(new URL('./ChallengeLifecyclePage.jsx', import.meta.url), 'utf8');
  assert.match(source, /return phone \? <>\s*<MobileChallengesV6/);
  assert.match(source, /: <ChallengeSplitVisual \{\.\.\.viewProps\}\/>/);
  assert.match(source, /<MobileChallengesV6[\s\S]*?onOpenSettings=\{openSetup\}/);
});

test('mobile V6 keeps shared-trade challenge progress isolated to its assigned sub-balance', () => {
  const workspace = {
    balances:[
      {id:'alpha',name:'Alpha',startingBalance:20,challengeEnabled:true,challengeMode:'risk'},
      {id:'beta',name:'Beta',startingBalance:20,challengeEnabled:true,challengeMode:'risk'},
    ],
    trades:[{id:'shared',status:'closed',date:'2026-11-05',createdAt:'2026-11-05T12:00:00Z',balanceResults:[
      {balanceId:'alpha',grossPnl:8,netPnl:8,status:'closed'},
      {balanceId:'beta',grossPnl:0,netPnl:0,status:'closed'},
    ]}],
    financeMovements:[],
  };
  const alpha = scopeChallengeAccount(workspace, workspace.balances[0]);
  const beta = scopeChallengeAccount(workspace, workspace.balances[1]);
  const checkpoint = new Date('2026-11-05T09:00:00Z');
  const active = resetAutomation(emptyChallenge(), [], 'risk', 1, checkpoint, 10, 20);
  assert.equal(replayChallenge(active, alpha).counted, 1);
  assert.equal(replayChallenge(active, beta).counted, 1, 'the balance result is retained but has its own zero outcome');
  assert.equal(replayChallenge(active, alpha).activeLevel, 2);
  assert.equal(replayChallenge(active, beta).activeLevel, 1);
});

test('level sheet preserves existing status, note, and settings callbacks instead of introducing new persistence', () => {
  const source = readFileSync(new URL('./MobileChallengesV6.jsx', import.meta.url), 'utf8');
  assert.match(source, /challenge\.setStatus\(row\.level, nextStatus\)/);
  assert.match(source, /challenge\.setNote\(row\.level, noteDraft\)/);
  assert.match(source, /onOpenSettings/);
  assert.match(source, /disabled=\{locked \|\| status === 'Jumped'\}/);
});

test('phone challenge rows keep manual statuses visible and never count funding as a pass', () => {
  const state = {statuses:{1:'Pass',2:'Jumped',4:'Step back',5:'In progress'}};
  const label = (level, failed = false) => mobileChallengeRowStatus(state, level, 3, failed).label;
  assert.equal(label(1), 'Passed');
  assert.equal(label(2), 'Funded');
  assert.equal(label(3), 'In progress');
  assert.equal(label(3, true), 'Paused');
  assert.equal(label(4), 'Step back');
  assert.equal(label(5), 'In progress');
  assert.equal(label(6), 'Not started');
});

test('phone challenge level ranges cover every level', () => {
  assert.deepEqual(mobileChallengeRanges(30).map(range => range.label), ['Levels 1–10','Levels 11–20','Levels 21–30']);
  assert.deepEqual(mobileChallengeRanges(15).map(range => range.label), ['Levels 1–10','Levels 11–15']);
  assert.deepEqual(mobileChallengeRanges(10).map(range => range.label), ['Levels 1–10']);
});
