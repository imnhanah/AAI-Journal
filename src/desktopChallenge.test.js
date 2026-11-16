import test from 'node:test';
import {challengeRulesFor} from './challengeRules.js';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parse} from '@babel/parser';
import {runInNewContext} from 'node:vm';

const page = readFileSync(new URL('./ChallengeLifecyclePage.jsx', import.meta.url), 'utf8');
const view = readFileSync(new URL('./DesktopChallenge.jsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('./desktopChallenge.css', import.meta.url), 'utf8');
const hook = readFileSync(new URL('./useChallenge.js', import.meta.url), 'utf8');
const journal = readFileSync(new URL('./TradingJournal.jsx', import.meta.url), 'utf8');

test('desktop Challenge shows v2; phones keep MobileChallengesV6', () => {
  assert.match(page, /const CHALLENGE_V2 = true;/);
  assert.match(page, /return phone \? <><MobileChallengesV6 /);
  assert.match(page, / : CHALLENGE_V2 \? <><DesktopChallengeCard \{\.\.\.viewProps\} rules=\{challengeRulesFor\(mode,state\.automation\?\.adaptiveStepBack\)\} saving=\{saving\} error=\{error\}\/>\{\(celebrating\|\|certOpen\)&&<ChallengeCompletePopup [^}]*\}[\s\S]*?<\/> : <ChallengeSplitVisual/);
  assert.match(page, /const deskV2=CHALLENGE_V2&&!phonePage;/);
  assert.match(page, /<ChallengeHero cards=\{deskCards\} selectedId=\{deskId\} onSelect=\{setDeskSel\}[^>]*\/>/);
});

test('Challenge v2 keeps every challenge mounted and reports its level for the switcher', () => {
  assert.match(page, /<div key=\{balance\.id\} hidden=\{balance\.id!==deskId\}><BalanceCard /);
  assert.match(page, /level:loading\|\|!plan\.length\?0:Math\.min\(Math\.max\(state\.activeLevel \|\| 1,1\),plan\.length\),total:plan\.length,name:account\.name/);
});

test('every challenge mode explains why live balance can exceed the planned final balance', () => {
  for (const mode of ['risk', 'streak', 'adaptive']) {
    const planned = challengeRulesFor(mode).items.find(([label]) => label === 'Completing the challenge');
    assert.ok(planned, mode);
    assert.match(planned[1], /live balance can finish above them/);
  }
});

test('Challenge v2 uses the lifecycle handlers for status, notes, settings and delete', () => {
  assert.match(view, /onClick=\{\(\) => challenge\.setStatus\(row\.level, value\)\}/);
  assert.match(view, /onSave=\{challenge\.setNote\}/);
  assert.match(view, /changeSetupTarget\(current, field, event\.target\.value, 'percentage'\)/);
  assert.match(view, /if \(await onDelete\(\)\) setSetup\(null\);/);
  assert.match(view, /Delete this challenge and its progress\?/);
  assert.match(view, /useEffect\(\(\) => \{\s*setSelected\(current\.level\);\s*setRange\(rangeOf\(current\.level\)\);\s*\}, \[current\.level\]\);/);
});

test('saving an unlocked single-account setup updates the visible Challenge plan immediately', () => {
  assert.match(journal, /aaicorefx:account-challenge-updated/);
  assert.match(journal, /accountId:account\.id,state:nextState/);
  assert.match(hook, /window\.addEventListener\('aaicorefx:account-challenge-updated',sync\)/);
  const ast=parse(hook,{sourceType:'module',plugins:['jsx']});let node;
  const visit=n=>{if(!n||typeof n!=='object')return;if(n.type==='VariableDeclarator'&&n.id?.name==='sync')node=n.init;for(const[k,v]of Object.entries(n)){if(['loc','start','end'].includes(k))continue;if(Array.isArray(v))v.forEach(visit);else if(v&&typeof v==='object')visit(v);}};visit(ast);assert.ok(node);
  const key='cloud:owner:account',remote={notes:{1:'server'}};
  for(const [dirty,eventAccount]of [[false,'account'],[true,'account'],[false,'other-account']]){
    const original={notes:{1:'visible'}},local={notes:{1:'newer local draft'}};let record={key,state:original},verified=false;
    const sync=runInNewContext(`(${hook.slice(node.start,node.end)})`,{account:{id:'account'},key,latest:{current:dirty?{key,next:local}:null},setRecord:update=>{record=update(record);},setReadVerified:value=>{verified=value;},setError:()=>{},setLoading:()=>{}});
    sync({detail:{accountId:eventAccount,state:remote}});
    assert.equal(record.state,eventAccount==='other-account'?original:dirty?local:remote);
    assert.equal(verified,eventAccount==='account');
  }
});

test('Challenge v2 styles are desktop-only, hide the duplicate banner and reflow by page width', () => {
  assert.match(css, /\.tj-challenge-split-page:has\(\.ch2-hero\)>\.tj-signal-page-challenge \{display:none;\}/);
  assert.match(css, /^@media \(min-width:768px\) \{/m);
  assert.match(css, /@container journal-workspace \(max-width:1100px\)/);
  assert.match(css, /@media \(min-width:768px\) and \(prefers-reduced-motion:reduce\)/);
});
