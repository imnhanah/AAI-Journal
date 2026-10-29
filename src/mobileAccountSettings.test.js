import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL(name,import.meta.url),'utf8');
test('phone Account Settings pins the summary, tabs and save bar around one scroll area',()=>{
 const css=read('./mobileAccountSettings.css'),source=read('./TradingJournal.jsx');
 assert.match(css,/height:100dvh!important/);
 assert.match(css,/\.tj-settings-hub-content \{flex:1;min-height:0;overflow-y:auto/);
 assert.match(css,/\.tj-settings-hub-footer \{flex:none/);
 assert.match(source,/ref=\{summary\} className="tj-settings-account-hero/);
 assert.match(css,/\.tj-settings-linked-inputs \{grid-template-columns:minmax\(0,1fr\) 24px/);
 assert.match(css,/\.tj-settings-reset-grid \{display:grid;grid-template-columns:minmax\(0,1fr\)/);
 assert.ok([...css.matchAll(/font-size:\s*([\d.]+)px/g)].every(m=>Number(m[1])>=12));
});
test('phone danger sheet only requests existing protected confirmations',()=>{
 const sheet=read('./PhoneWorkspaceDangerSheet.jsx'),danger=read('./SettingsDangerZone.jsx');
 assert.match(sheet,/onRequest\('reset'\)/);assert.match(sheet,/onRequest\('delete'\)/);
 assert.doesNotMatch(sheet,/onReset\(|onDelete\(/);
 assert.match(sheet,/modal.inert=true/);assert.match(sheet,/modal.inert=wasInert/);
 assert.match(danger,/typedName === workspaceName/);
 assert.match(danger,/if \(!allowed \|\| inFlight.current\) return/);
 assert.match(danger,/if \(event.target === event.currentTarget\) close\(\)/);
});
test('phone popup actions stack primary first, preserve gates and keep long balances readable',()=>{
 const css=read('./mobilePopups.css'),single=read('./SingleAccountSwitchDialog.jsx');
 assert.match(css,/min-height:52px/);assert.match(css,/order:-1/);
 assert.match(css,/\.tj-single-switch-kept\) \{[^}]*box-sizing:border-box/);
 assert.match(css,/\.tj-challenge-completion-stats \{grid-template-columns:minmax\(0,1fr\)/);
 assert.match(css,/\.tj-finance-reminder-allocation strong \{[^}]*white-space:nowrap/);
 assert.match(single,/disabled=\{!acknowledged\}/);
 assert.ok([...css.matchAll(/font-size:\s*([\d.]+)px/g)].every(m=>Number(m[1])>=12));
});
