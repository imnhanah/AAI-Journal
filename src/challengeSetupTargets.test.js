import test from 'node:test';
import assert from 'node:assert/strict';
import {targetAmount,targetPercentage,changeSetupTarget,changeSetupBalance} from './challengeSetupTargets.js';

test('amounts and percentages convert both ways using the selected starting balance',()=>{
  assert.equal(targetAmount(10,200),20);
  assert.equal(targetPercentage(20,200),10);
  assert.equal(targetAmount(12.3456,250),30.86);
  assert.equal(targetPercentage(20,0),0);
});
test('editing an amount converts its paired percentage without changing another target',()=>{
  const next=changeSetupTarget({startingBalance:100,monthlyGoalPct:5,yearlyGoalPct:40},'monthlyGoalPct','20','amount');
  assert.equal(next.monthlyGoalPct,20);
  assert.equal(next.monthlyGoalPctAmount,'20');
  assert.equal(next.yearlyGoalPct,40);
  const percentage=changeSetupTarget(next,'monthlyGoalPct','8','percentage');
  assert.equal(percentage.monthlyGoalPctAmount,undefined);
  assert.equal(targetAmount(percentage.monthlyGoalPct,percentage.startingBalance),8);
});
test('starting balance edits keep money-entered targets fixed and percentage-entered targets proportional',()=>{
  const next=changeSetupBalance({startingBalance:100,monthlyGoalPct:20,monthlyGoalPctAmount:'20',dailyLossLimitPct:5},200);
  assert.equal(next.monthlyGoalPct,10);
  assert.equal(next.monthlyGoalPctAmount,'20');
  assert.equal(next.dailyLossLimitPct,5);
  assert.equal(targetAmount(next.dailyLossLimitPct,next.startingBalance),10);
});
