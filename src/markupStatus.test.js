import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = file => readFileSync(new URL(file,import.meta.url),'utf8');
test('markup statuses use semantic theme colours instead of the app accent', () => {
  const css=read('./markupStatus.css');
  for(const [status,token] of [['planned','blue'],['watching','amber'],['executed','green'],['not-executed','muted']]){
    assert.ok(css.includes(`.tj-markup-status-${status}`));
    assert.ok(css.includes(`--markup-status-color: var(--tj-${token})`));
  }
  assert.doesNotMatch(css,/#[a-f\d]{3,8}\b|var\(--(?:tj-)?accent\)/i);
  assert.match(css,/\.tj-picker-options \.tj-markup-status-option/);
  assert.match(css,/aria-checked="true"/);
});
test('desktop and phone status menus keep coloured options and labelled selections', () => {
  assert.match(read('./JournalControls.jsx'),/className:child\.props\.className/);
  for(const file of ['./TradingJournal.jsx','./MobileMarkups.jsx']){
    const source=read(file);
    assert.ok(source.includes('tj-markup-status-trigger'));
    assert.ok(source.includes('tj-markup-status-option'));
  }
  assert.ok(read('./TradingJournal.jsx').includes("import './markupStatus.css'"));
});

test('the redesigned Markups detail uses the effective linked status and a matching semantic pill', () => {
  const view = read('./MarkupsRedesign.jsx');
  const css = read('./markupsRedesign.css');
  assert.match(view, /const statusFor=markup=>linkedFor\(markup\)\.length \? 'Executed' : markupStatus\(markup\.status\)/);
  assert.match(view, /mk-chip--status-\$\{statusClass\(statusFor\(current\)\)\}/);
  for (const [status, token] of [['planned', 'blue'], ['watching', 'amber'], ['executed', 'green']]) {
    assert.match(css, new RegExp(`\\.mk-chip--status-${status}\\{--mk-status-color:var\\(--tj-${token}\\)\\}`));
  }
  assert.match(css, /\.mk-chip--status-not-executed\{--mk-status-color:var\(--muted\)\}/);
});
