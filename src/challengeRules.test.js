import test from 'node:test';
import assert from 'node:assert/strict';
import {challengeRulesFor,normaliseAdaptiveStepBack} from './challengeRules.js';
const text=rules=>rules.items.map(item=>item.join(' ')).join('\n');
test('Mode 1 rules state the 1.5R-2R range, default and completion rule',()=>{
  const rules=challengeRulesFor('risk');
  assert.match(text(rules),/1\.5R to 2R/);assert.match(text(rules),/default is 1\.5R/);
  assert.match(text(rules),/last level is passed by a trade profit and the balance has reached the planned final target/);
});
test('Mode 2 rules say two losses on the same level, not consecutive',()=>{
  const body=text(challengeRulesFor('streak'));
  assert.match(body,/2\.8R to 5R/);assert.match(body,/default is 2\.8R/);
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
