import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('phone profile is full-height with stacked regional fields and pinned footer',()=>{
  const css=readFileSync(new URL('./mobileProfile.css',import.meta.url),'utf8');
  for(const size of css.matchAll(/font-size:([\d.]+)px/g))assert.ok(Number(size[1])>=12);
  assert.match(css,/height:100dvh!important/);
  assert.match(css,/tj-regional-fields[^}]*grid-template-columns:1fr/);
  assert.match(css,/tj-accent-row[^}]*repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(css,/tj-profile-studio-footer[^}]*flex-shrink:0/);
  assert.doesNotMatch(css,/(?:^|[;{])\s*(?:transform|filter|will-change)\s*:/m);
});
test('phone profile scroll includes identity and final delete action; confirmation blur is separate',()=>{
  const source=readFileSync(new URL('./TradingJournal.jsx',import.meta.url),'utf8');
  assert.match(source,/tj-profile-studio-scroll">\{phone&&has\("tj-personal-profile-card"\)\}/);
  assert.match(source,/tj-phone-profile-delete" onClick=\{onDelete\}/);
  const dialog=readFileSync(new URL('./ProfileDeleteDialog.jsx',import.meta.url),'utf8');
  assert.match(dialog,/tj-profile-delete-backdrop" aria-hidden="true"/);
  assert.match(dialog,/value !== name/);
});
test('phone accent tiles use solid previews without overflowing decorative bars',()=>{
  const css=readFileSync(new URL('./mobileProfile.css',import.meta.url),'utf8');
  assert.match(css,/tj-profile-modal \.tj-accent-preview-bars \{display:none/);
});
