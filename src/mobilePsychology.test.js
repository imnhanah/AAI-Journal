import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {growthChart,holdComparison,holdWidths,moodBarTone} from './mobilePsychologyModel.js';
const read=name=>readFileSync(new URL(name,import.meta.url),'utf8');
test('phone Psychology keeps live clean-execution and recovery calculations',()=>{
  const source=read('./TradingJournal.jsx');
  assert.match(source,/psychologyMetrics\(trades, account.breakevenCap\)/);
  assert.match(source,/data.clean\} of \{data.total/);
  assert.match(source,/data.recoveryPnl == null \? "—" : fmtMoney\(data.recoveryPnl\)/);
  assert.match(source,/onClick=\{\(\) => setReviewOpen\(true\)\}/);
});
test('phone Psychology uses three tabs, readable text and the shared review popup',()=>{
  const css=read('./mobilePsychologyLab.css'),view=read('./MobilePsychologyLab.jsx'),source=read('./TradingJournal.jsx');
  assert.ok([...css.matchAll(/font-size:\s*([\d.]+)px/g)].every(match=>Number(match[1])>=12));
  // The tab pill slides with transform (motion rule); nothing else may.
  assert.doesNotMatch(css.replace(/\.tj-psy-tabs>i \{[^}]*\}/,""),/(?:^|[\s{;])(?:transform|filter|mask-image)\s*:/);
  assert.match(view,/\['psychology','Psychology'\],\['risk','Risk'\],\['insights','Insights'\]/);
  assert.match(source,/riskInsightsData\(account, trades, riskStats\)/);
  assert.match(source,/\{reviewModal\}/);
});
test('phone Psychology helpers describe hold times and growth honestly',()=>{
  assert.equal(holdComparison(480,282),'Winners are held about 1.7× longer than losers.');
  assert.equal(holdComparison(100,300),'Losers are held about 3.0× longer than winners.');
  assert.match(holdComparison(null,300),/Add entry and exit times/);
  assert.deepEqual(holdWidths(100,50),{win:100,loss:50});
  assert.equal(moodBarTone(50),'is-amber');
  assert.equal(growthChart([]),null);
  assert.match(growthChart([{label:'a',actual:10,target:10},{label:'b',actual:12,target:10}]).actual,/^M56 /);
});
