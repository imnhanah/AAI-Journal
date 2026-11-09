import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('List View uses the shared StudyCard data and handlers while rendering a dedicated three-column structure',()=>{
  const component=readFileSync(new URL('./CaseStudyLibrary.jsx',import.meta.url),'utf8');
  assert.match(component,/view=\{workspace\.settings\.view\}/);
  assert.match(component,/if\(view==='list'\) return <article className="case-study-card case-study-list-card"/);
  assert.match(component,/case-study-list-card__thumbnail/);
  assert.match(component,/case-study-list-card__information/);
  assert.match(component,/case-study-list-card__action-column/);
  assert.match(component,/const returnToLibrary = \(\) => \{ setCardMenu\(null\); setHeaderMenuOpen\(false\); setScreen\('library'\); setSelectedId\(null\); \}/);
});

test('List View has fixed thumbnail, information, and action columns with a narrow responsive layout',()=>{
  const css=readFileSync(new URL('./caseStudyLibraryRedesign.css',import.meta.url),'utf8');
  assert.match(css,/case-study-list-card \{ align-items:stretch; column-gap:14px; display:grid; grid-template-columns:190px minmax\(0,1fr\) auto/);
  assert.match(css,/case-study-list-card__thumbnail \{ align-self:center; aspect-ratio:16\/9/);
  assert.match(css,/case-study-list-card__action-column \{ align-items:flex-start; display:flex/);
  assert.match(css,/case-study-grid--list \.case-study-list-card \{ column-gap:10px; grid-template-columns:minmax\(96px,34%\) minmax\(0,1fr\) auto/);
});
