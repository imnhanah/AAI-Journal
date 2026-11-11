import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const page = readFileSync(new URL('./ChallengeLifecyclePage.jsx', import.meta.url), 'utf8');
const view = readFileSync(new URL('./DesktopChallenge.jsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('./desktopChallenge.css', import.meta.url), 'utf8');
const hook = readFileSync(new URL('./useChallenge.js', import.meta.url), 'utf8');
const journal = readFileSync(new URL('./TradingJournal.jsx', import.meta.url), 'utf8');

test('desktop Challenge shows v2; phones keep MobileChallengesV6', () => {
  assert.match(page, /const CHALLENGE_V2 = true;/);
  assert.match(page, /return phone \? <><MobileChallengesV6 /);
  assert.match(page, / : CHALLENGE_V2 \? <><DesktopChallengeCard \{\.\.\.viewProps\} rules=\{challengeRules\[mode\] \|\| challengeRules\.risk\} saving=\{saving\} error=\{error\}\/>\{celebrating&&<ChallengeCompletePopup [^}]*\}[\s\S]*?<\/> : <ChallengeSplitVisual/);
  assert.match(page, /const deskV2=CHALLENGE_V2&&!phonePage;/);
  assert.match(page, /<ChallengeHero cards=\{deskCards\} selectedId=\{deskId\} onSelect=\{setDeskSel\}\/>/);
});

test('Challenge v2 keeps every challenge mounted and reports its level for the switcher', () => {
  assert.match(page, /<div key=\{balance\.id\} hidden=\{balance\.id!==deskId\}><BalanceCard /);
  assert.match(page, /level:loading\|\|!plan\.length\?0:Math\.min\(Math\.max\(state\.activeLevel \|\| 1,1\),plan\.length\),total:plan\.length,name:account\.name/);
});

test('every challenge mode explains why live balance can exceed the planned final balance', () => {
  const explanation = /\['Planned and live balance','The final planned balance is the clean-path target\. Re-passing levels after a step-back adds to realised equity again, so live balance can finish above the plan\.'/g;
  assert.equal([...page.matchAll(explanation)].length, 3);
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
  assert.match(hook, /setRecord\(current=>current\?\.key===key \? \{\.\.\.current,state:event\.detail\.state\} : current\)/);
});

test('Challenge v2 styles are desktop-only, hide the duplicate banner and reflow by page width', () => {
  assert.match(css, /\.tj-challenge-split-page:has\(\.ch2-hero\)>\.tj-signal-page-challenge \{display:none;\}/);
  assert.match(css, /^@media \(min-width:768px\) \{/m);
  assert.match(css, /@container journal-workspace \(max-width:1100px\)/);
  assert.match(css, /@media \(min-width:768px\) and \(prefers-reduced-motion:reduce\)/);
});
