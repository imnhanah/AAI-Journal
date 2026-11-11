import test from 'node:test';
import assert from 'node:assert/strict';
import { CHALLENGE_PLAN as plan, STREAK_CHALLENGE_PLAN, emptyChallenge, changeChallengeStatus as change, challengeModeActivationRule, challengeDepositFundingRule, challengeFundingLimit, challengeFundingRecommendations, maxFundedChallengeLevel } from './challengeModel.js';
import { buildChallengePlan, isChallengeEnabled, challengeFailureFloor } from './challengeModel.js';

test('Custom deposit preserves the original ladder; absent balance keeps challenge off', () => {
  for (const value of [1, 100, 1000, 12.5]) {
    const scaled = buildChallengePlan(value);
    assert.deepEqual(scaled, plan);
    assert.equal(scaled.at(-1).end, 52404);
  }
  for (const value of ['', 0, -1, Infinity, undefined]) {
    assert.deepEqual(buildChallengePlan(value), []);
    assert.equal(isChallengeEnabled({ challengeEnabled: true, challengeStartingBalance: value }), false);
  }
  assert.equal(isChallengeEnabled({ challengeEnabled: false, challengeStartingBalance: 100 }), false);
  assert.equal(isChallengeEnabled({ challengeEnabled: true, challengeStartingBalance: 100 }), true);
});
test('Adaptive Balance compounds from the chosen Level 1 balance and has its own drawdown floor', () => {
  const plan=buildChallengePlan(100,'adaptive',10,3,{adaptiveRiskPct:2,adaptiveDrawdownPct:10});
  assert.equal(plan.length,10);
  assert.deepEqual(plan[0],{level:1,start:100,risk:2,profit:6,end:106,lots:0,tp:3,sl:0,riskPct:2,profitPct:6});
  assert.equal(plan[1].start,106);
  assert.equal(plan[1].risk,2.12);
  assert.equal(plan[1].end,112.36);
  assert.equal(challengeFailureFloor(100,'adaptive',{adaptiveDrawdownPct:10}),90);
  assert.equal(challengeFailureFloor(100,'risk',{}),20);
});
test('Passing level five completes all preceding levels without discarding notes', () => {
  const original = { ...emptyChallenge(), notes: { 2: 'Keep my note' } };
  const next = change(original, 5, 'Pass');
  for (let i = 1; i <= 5; i++) assert.equal(next.statuses[i], 'Pass');
  assert.equal(next.activeLevel, 6);
  assert.equal(next.statuses[6], 'In progress');
  assert.equal(next.notes[2], 'Keep my note');
  assert.deepEqual(original.statuses, {});
});

test('30 worksheet levels retain exact dollar calculations', () => {
  assert.equal(plan.length, 30);
  assert.equal(plan[0].start, 20);
  assert.equal(plan[0].risk, 4.5);
  assert.equal(plan[0].profit, 6);
  assert.equal(plan[0].end, 26);
  assert.equal(plan.at(-1).end, 52404);
  plan.forEach((row, i) => {
    assert.equal(row.end, row.start + row.profit);
    assert.equal(row.tp, 20);
    if (i) {
      assert.equal(row.start, plan[i - 1].end);
      assert.equal(row.risk, plan[i - 1].profit);
    }
  });
});
test('Mode 2 retains the old risk, stop-loss and lot ladder but uses 3.1R profits', () => {
  const streak = buildChallengePlan(20, 'streak');
  assert.equal(streak.length, 30);
  assert.equal(streak[0].risk, 4.5);
  assert.equal(streak[0].sl, 15);
  assert.equal(streak[0].lots, .03);
  assert.equal(streak[0].tp, 46.5);
  assert.equal(streak[0].profit, 13.95);
  assert.equal(streak[1].risk, 6);
  assert.equal(streak[1].start, 33.95);
  assert.equal(streak.at(-1).end, 124939.15);
  assert.deepEqual(streak, STREAK_CHALLENGE_PLAN);
});
test('fixed modes cap initial and deposit funding at the selected plan halfway point', () => {
  assert.deepEqual([10,15,20,30].map(maxFundedChallengeLevel),[5,7,10,15]);
  for (const [levels, mode, reward] of [[10,'risk',1.5],[15,'streak',2.8],[20,'risk',2],[30,'streak',3.1]]) {
    const limit=challengeFundingLimit({mode,reward,levelCount:levels,balance:20});
    const accepted=challengeModeActivationRule({mode,reward,levelCount:levels,balance:limit.plan[limit.maxLevel-1].start});
    const rejected=challengeModeActivationRule({mode,reward,levelCount:levels,balance:limit.firstProhibitedStart});
    assert.equal(accepted,null);
    assert.equal(rejected.kind,'balance');
    assert.equal(rejected.maxFundedLevel,limit.maxLevel);
  }
  const plan10=buildChallengePlan(20,'risk',10,1.5);
  assert.equal(challengeDepositFundingRule({mode:'risk',reward:1.5,levelCount:10,balance:plan10[4].start,activeLevel:2}).allowed,true);
  assert.equal(challengeDepositFundingRule({mode:'risk',reward:1.5,levelCount:10,balance:plan10[5].start,activeLevel:2}).allowed,false);
  assert.equal(challengeDepositFundingRule({mode:'risk',reward:1.5,levelCount:10,balance:plan10[4].start,activeLevel:5}).reason,'active-cap');
  assert.equal(challengeDepositFundingRule({mode:'adaptive',levelCount:10,balance:1000,activeLevel:1,linked:false}).allowed,true);
  const adaptivePlan=buildChallengePlan(100,'adaptive',10,3);
  assert.equal(challengeDepositFundingRule({mode:'adaptive',reward:3,levelCount:10,balance:adaptivePlan[5].start,activeLevel:1,linked:true,startingBalance:100}).allowed,false);
});
test('funding recommendations are ladder-validated and retain their priority order',()=>{
  const balance=60;
  const recommendations=challengeFundingRecommendations({mode:'risk',reward:1.5,balance,levelCount:10});
  assert.ok(recommendations.length);
  assert.equal(recommendations[0].kind,'length');
  for (const recommendation of recommendations) {
    if (recommendation.kind==='adaptive') continue;
    assert.equal(challengeFundingLimit({...recommendation,balance}).allowed,true);
  }
});
test('Pass advances, step back reactivates previous level without changing plan', () => {
  let state = change(emptyChallenge(), 1, 'Pass');
  assert.equal(state.activeLevel, 2);
  assert.equal(state.statuses[2], 'In progress');
  state = change(state, 2, 'Step back');
  assert.equal(state.activeLevel, 1);
  assert.equal(state.statuses[1], 'In progress');
  assert.equal(state.statuses[2], 'Step back');
  assert.equal(plan.at(-1).end, 52404);
});
test('Only one level in progress and first-level step back remains in range', () => {
  let state = change(emptyChallenge(), 4, 'In progress');
  state = change(state, 7, 'In progress');
  assert.equal(Object.values(state.statuses).filter(s => s === 'In progress').length, 1);
  assert.equal(change(state, 1, 'Step back').activeLevel, 1);
});
test('Completion requires every level passed; clearing a pass reopens challenge', () => {
  assert.equal(change(emptyChallenge(), 30, 'Pass').activeLevel, 31);
  let state = emptyChallenge();
  for (let i = 1; i <= 30; i++) state = change(state, i, 'Pass');
  assert.equal(state.activeLevel, 31);
  assert.equal(Object.values(state.statuses).filter(s => s === 'Pass').length, 30);
  assert.equal(change(state, 30, '').activeLevel, 29);
});
test('Notes survive transitions and progress serializes for persistence', () => {
  const state = change({ ...emptyChallenge(), notes: { 1: 'First attempt' } }, 1, 'Pass');
  assert.equal(state.notes[1], 'First attempt');
  assert.deepEqual(JSON.parse(JSON.stringify(state)), state);
  assert.throws(() => change(state, 0, 'Pass'));
  assert.throws(() => change(state, 1, 'invalid'));
});
test('Not started activates the previous level, with only one in progress', () => {
  const state = change(change(emptyChallenge(), 5, 'Pass'), 5, '');
  assert.equal(state.statuses[5], '');
  assert.equal(state.statuses[4], 'In progress');
  assert.equal(state.activeLevel, 4);
  assert.equal(Object.values(state.statuses).filter(s => s === 'In progress').length, 1);
  const first = change(state, 1, '');
  assert.equal(first.activeLevel, 1);
  assert.equal(first.statuses[1], 'In progress');
});
test('stepping back at an earlier level clears later passed levels and keeps notes',()=>{
  const passed=change({...emptyChallenge(),notes:{15:'Keep this'}},15,'Pass');
  const next=change(passed,5,'Step back');
  assert.equal(next.activeLevel,4);
  assert.equal(next.statuses[4],'In progress');
  for(let level=6;level<=16;level++)assert.equal(next.statuses[level],'');
  assert.equal(next.notes[15],'Keep this');
});
