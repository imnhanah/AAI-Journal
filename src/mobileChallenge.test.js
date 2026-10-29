import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL(name,import.meta.url),'utf8');
test('Challenge headline shows live and planned balances side by side',()=>{
 const source=read('./ChallengeLifecyclePage.jsx');
 const summary=source.match(/<section className="tj-challenge-balance-summary">([\s\S]*?)<\/section>/)?.[1];
 assert.ok(summary);
 assert.match(summary,/tj-challenge-balance-pair/);
 assert.match(summary,/AVAILABLE TRADING CAPITAL[\s\S]*?\{fmt\(life.liveBalance\)\}/);
 assert.match(summary,/FULL CHALLENGE TARGET[\s\S]*?\{fmt\(plan.at\(-1\).end\)\}/);
});
test('phone Challenge preserves account-scoped progress and funding-jump protections',()=>{
 const source=read('./ChallengeLifecyclePage.jsx'),mobile=read('./MobileChallengePlan.jsx');
 assert.match(source,/phone\?<MobileChallengePlan rows=\{visiblePlan\}/);
 assert.match(source,/scopeChallengeAccount\(workspace,balance\)/);
 assert.match(mobile,/challenge.setNote\(row.level,e.target.value\)/);
 assert.match(mobile,/locked\|\|value==='Jumped'\|\|status==='Jumped'/);
 assert.match(mobile,/onSave\(draft\)/);
});
test('phone Challenge uses two-column stats, decorative segments and full-width guardrails',()=>{
 const css=read('./mobileChallenge.css');
 assert.match(css,/@media\(max-width:767px\)/);
 assert.match(css,/\.tj-challenge-summary-metrics \{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 assert.match(css,/\.tj-challenge-level-rail button \{display:none/);
 assert.match(css,/\.tj-challenge-account-guardrails>div \{display:grid;grid-template-columns:minmax\(0,1fr\)/);
 assert.match(css,/\.tj-phone-challenge-levels>article\[data-milestone\]/);
 assert.ok([...css.matchAll(/font-size:\s*([\d.]+)px/g)].every(match=>Number(match[1])>=12));
});
test('status sheets stage a change until save, trap focus and restore background state',()=>{
 const source=read('./MobileChallengePlan.jsx');
 assert.match(source,/const \[draft,setDraft\]=useState\(status\)/);
 assert.match(source,/aria-modal="true"/);assert.match(source,/e.key==='Escape'/);assert.match(source,/e.key==='Tab'/);
 assert.match(source,/background.forEach\(\(\[e,inert\]\)=>\{e.inert=inert;/);
 assert.match(source,/prior\?\.isConnected&&prior.focus\(\)/);
});
