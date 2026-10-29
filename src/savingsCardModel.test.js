import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {savingsCardModel} from './savingsCardModel.js';
test('Orbit Split uses real goal and allocation values',()=>{
  const model=savingsCardModel({target:50000,allocationPct:20},0,{profit:60,target:12,transferred:0,remaining:12});
  assert.deepEqual(model,{saved:0,target:50000,rate:20,profit:60,allocated:12,retained:48,paid:0,ready:12,goalRemaining:50000,progress:0});
});
test('Orbit Split presents goal progress alongside the profit allocation bar',()=>{
  const source=readFileSync(new URL('./SavingsPlanCard.jsx',import.meta.url),'utf8');
  assert.doesNotMatch(source,/tj-savings-profit-split/);
  assert.match(source,/tj-savings-orbit-ring/);
  assert.match(source,/aria-valuenow=\{model.progress\}/);
  assert.match(source,/model.progress.toFixed\(0\)/);
  for(const field of ['saved','target','retained','allocated','paid','ready'])assert.match(source,new RegExp(`model\\.${field}`));
  assert.match(source,/role="img" aria-label=\{`\$\{100-model.rate\}% retained/);
});
test('partial transfers distinguish total allocation from what is still ready',()=>{
  const model=savingsCardModel({target:50000,allocationPct:20},5,{profit:60,target:12,transferred:5,remaining:7});
  assert.equal(model.allocated,12);assert.equal(model.ready,7);assert.equal(model.paid,5);assert.equal(model.goalRemaining,49995);
});
test('empty, negative profit and completed goals remain finite and bounded',()=>{
  assert.equal(savingsCardModel({target:0},NaN).progress,0);
  assert.equal(savingsCardModel({target:100},150).progress,100);
  assert.equal(savingsCardModel({target:100},150).goalRemaining,0);
  assert.equal(savingsCardModel({target:100},0,{profit:-50}).retained,0);
});
test('shared card uses theme colours and protects actions and readable phone values',()=>{
  const css=readFileSync(new URL('./savingsPlanCard.css',import.meta.url),'utf8');
  for(const size of css.matchAll(/font-size:([\d.]+)px/g))assert.ok(Number(size[1])>=12);
  assert.doesNotMatch(css,/(?:^|[;{])\s*(?:transform|filter|backdrop-filter)\s*:/m);
  assert.doesNotMatch(css,/#[a-f\d]{3,8}\b/i);
  assert.match(css,/min-height:44px/);assert.match(css,/overflow-wrap:anywhere/);
  const source=readFileSync(new URL('./SavingsPlanCard.jsx',import.meta.url),'utf8');
  assert.match(source,/disabled=\{busy \|\| !\(model.ready>0\)\}/);
  assert.match(source,/await onTransfer\(\)/);
});
test('long amounts use a presentation-only variant with single-line figures and full-width allocation rows',()=>{
  const source=readFileSync(new URL('./SavingsPlanCard.jsx',import.meta.url),'utf8');
  const css=readFileSync(new URL('./savingsPlanCard.css',import.meta.url),'utf8');
  assert.match(source,/money\(value\)\.length>13/);
  assert.match(source,/longAmounts\?' tj-savings-orbit-long':''/);
  assert.doesNotMatch(source,/\.slice\(|\.substring\(|toExponential|maximumFractionDigits/);
  assert.match(css,/tj-savings-orbit-long \.tj-savings-orbit-money \{font-size:clamp\(12px,6cqi,26px\);white-space:nowrap/);
  assert.match(css,/tj-savings-orbit-long \.tj-savings-orbit-destinations \{grid-template-columns:minmax\(0,1fr\)/);
  assert.doesNotMatch(css,/text-overflow:ellipsis|overflow:hidden/);
});
