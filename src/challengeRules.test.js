import {readFileSync} from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {challengeRulesFor,normaliseAdaptiveStepBack} from './challengeRules.js';
const text=rules=>rules.items.map(item=>item.join(' ')).join('\n');
test('Mode 1 rules state the one-trade pass, strict 40% net-loss step-back and completion rule',()=>{
  const rules=challengeRulesFor('risk');
  assert.equal(rules.items.length,5);
  assert.match(text(rules),/One closed trade must meet or exceed the level’s full profit target/);
  assert.match(text(rules),/net loss greater than 40%/);
  assert.match(text(rules),/Exactly 40% does not trigger/);
  assert.match(text(rules),/smaller losses do not accumulate/);
  assert.match(text(rules),/minimum-balance rule still applies/);
  assert.match(text(rules),/a trade passes the last level and the balance has reached the planned final target/);
});
test('Mode 2 rules say two losses on the same level, not consecutive',()=>{
  const body=text(challengeRulesFor('streak'));
  assert.equal(challengeRulesFor('streak').items.length,5);
  assert.match(body,/Two losses on the same level/);assert.doesNotMatch(body,/consecutive/i);
});
test('Adaptive rules follow the chosen step-back rule',()=>{
  assert.match(text(challengeRulesFor('adaptive','one')),/Step-back · One loss/);
  assert.match(text(challengeRulesFor('adaptive','two')),/Step-back · Two losses/);
  assert.match(text(challengeRulesFor('adaptive','net')),/Step-back · Net loss/);
  assert.match(text(challengeRulesFor('adaptive')),/Step-back · One loss/);
  assert.equal(normaliseAdaptiveStepBack('bogus'),'one');
});
test('every mode explains deposits and completion',()=>{
  for(const mode of ['risk','streak','adaptive']){const body=text(challengeRulesFor(mode));assert.match(body,/never count as growth/);assert.match(body,/Completing the challenge/)}
});

test('all three modes require the profit and post-cost balance on the same trade',()=>{
  for(const mode of ['risk','streak','adaptive']) {
    const body=text(challengeRulesFor(mode));
    assert.match(body,/after that same trade, fees and commissions/);
    assert.match(body,/planned ending balance/);
    assert.match(body,/Both are required on the same trade/);
    assert.match(body,/Small wins do not add up or unlock an earlier attempt/);
    assert.match(body,/planned starting balance/);
  }
});


test('Mode 1 setup help describes the same net-loss rule without cumulative profit wording',()=>{
  const source=readFileSync(new URL('./ChallengeModeSettings.jsx',import.meta.url),'utf8');
  assert.match(source,/single trade’s net loss greater than 40% of planned risk/);
  assert.match(source,/minimum-balance rule still applies/);
  assert.doesNotMatch(source,/Gross P&L accumulates at each level/);
});


test('every mode states net profit and loss after costs and setup never advertises gross progression',()=>{
  for(const mode of ['risk','streak','adaptive'])assert.match(text(challengeRulesFor(mode)),/All profit and loss checks use net P&L after commission, swap/);
  const settings=readFileSync(new URL('./ChallengeModeSettings.jsx',import.meta.url),'utf8');
  assert.doesNotMatch(settings,/Reach the gross profit target|wins reset the streak/);
  assert.match(settings,/Two net-losing trades on the same level/);
  assert.match(settings,/smaller wins and breakevens do not clear the loss count/);
  const page=readFileSync(new URL('./ChallengePage.jsx',import.meta.url),'utf8');
  assert.match(page,/Level net P&L:/);assert.doesNotMatch(page,/Level gross P&L:/);
});
