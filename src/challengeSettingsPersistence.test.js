import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('custom challenge adaptive settings are saved for both the balance and its account',()=>{
  const source=readFileSync(new URL('./TradingJournal.jsx',import.meta.url),'utf8');
  const persisted=/challengeAdaptiveRiskPct:adaptiveRiskPct,challengeAdaptiveDrawdownPct:adaptiveDrawdownPct/g;
  assert.equal(source.match(persisted)?.length,2,
    'saving challenge settings must update both balance and account records');

  const database=readFileSync(new URL('./db.js',import.meta.url),'utf8');
  assert.match(database,/challengeAdaptiveRiskPct:Number\(balance\.challengeAdaptiveRiskPct\) \|\| 1/);
  assert.match(database,/challengeAdaptiveDrawdownPct:Number\(balance\.challengeAdaptiveDrawdownPct\) \|\| 10/);
  assert.match(database,/challengeAdaptiveRiskPct:x\.risk_settings\?\.challengeAdaptiveRiskPct/);
  assert.match(database,/challengeAdaptiveDrawdownPct:x\.risk_settings\?\.challengeAdaptiveDrawdownPct/);
  assert.match(database,/challengeMode:x\.challengeMode \|\| "risk"/);
  assert.match(database,/challengeAdaptiveRiskPct:Number\(x\.challengeAdaptiveRiskPct\) \|\| 1/);
});
