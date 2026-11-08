import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('Case Study cards bind favorite visuals and accessibility state to the persisted favorite field',()=>{
  const component=readFileSync(new URL('./CaseStudyLibrary.jsx',import.meta.url),'utf8');
  assert.match(component,/const favorite=!!study\.favorite/);
  assert.match(component,/aria-pressed=\{favorite\}/);
  assert.match(component,/fill=\{favorite\?'currentColor':'none'\}/);
  assert.match(component,/onPatch\(\{favorite:!favorite\}\)/);
});

test('favorite stars use theme-aware warning tokens for a filled selected state',()=>{
  const libraryCss=readFileSync(new URL('./caseStudyLibraryRedesign.css',import.meta.url),'utf8');
  const editorCss=readFileSync(new URL('./caseStudyEditor.css',import.meta.url),'utf8');
  assert.match(libraryCss,/case-study-card__favorite\.is-favorite[\s\S]*var\(--warn-soft\)[\s\S]*var\(--warn\)/);
  assert.match(editorCss,/cse-favorite\.is-favorite[\s\S]*var\(--warn-soft\)[\s\S]*var\(--warn\)/);
});
