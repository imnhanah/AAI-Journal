import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=name=>readFileSync(new URL(name,import.meta.url),'utf8');

test('phone analytics keeps chart geometry and touch tooltips inside the viewport',()=>{
  const css=read('./mobileAnalytics.css');
  assert.match(css,/recharts-responsive-container,.recharts-wrapper,.recharts-surface[^}]*max-width:100%!important/);
  assert.match(css,/\.recharts-wrapper \{touch-action:pan-y/);
  assert.match(css,/recharts-tooltip-wrapper \{max-width:calc\(100vw - 48px\)!important;pointer-events:none/);
});

test('phone finance protects long transaction values and preserves form clearance',()=>{
  const css=read('./mobileFinance.css');
  assert.match(css,/tj-phone-finance-movement>b[^}]*max-width:42vw/);
  assert.match(css,/tj-phone-finance-sheet-body[^}]*scroll-padding-bottom:calc\(14px \+ env\(safe-area-inset-bottom,0px\)\)/);
  assert.match(css,/tj-phone-finance-sheet \[role="alert"\][^}]*overflow-wrap:anywhere/);
});

test('phone management keeps long labels and dense actions within their cards',()=>{
  const css=read('./mobileManagement.css');
  assert.match(css,/tj-management-nav>button>\* \{min-width:0;overflow-wrap:anywhere/);
  assert.match(css,/tj-management-row-actions,.tj-root.tj-root.tj-root.tj-root \.tj-rule-actions[^}]*flex-wrap:wrap/);
  assert.match(css,/tj-management-collection h2,.tj-management-phone-back strong\) \{min-width:0;overflow-wrap:anywhere/);
});

test('phone profile and account settings expose touch selection and retain footer clearance',()=>{
  const profile=read('./mobileProfile.css'),account=read('./mobileAccountSettings.css');
  assert.match(profile,/tj-theme-choice-row button\[aria-pressed="true"\][^}]*var\(--tj-accent-muted\)/);
  assert.match(profile,/tj-accent-option\[aria-pressed="true"\][^}]*box-shadow/);
  assert.match(profile,/tj-profile-studio-scroll[^}]*scroll-padding-bottom:calc\(72px \+ env\(safe-area-inset-bottom,0px\)\)/);
  assert.match(account,/tj-settings-hub-content[^}]*scroll-padding-bottom:calc\(76px \+ env\(safe-area-inset-bottom,0px\)\)/);
  assert.match(account,/tj-settings-section-head \{flex-wrap:wrap/);
});
