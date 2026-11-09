import test from 'node:test';
import assert from 'node:assert/strict';
import { normaliseCaseStudyReview, patchStudyReview, reviewReadiness } from './caseStudyReview.js';
import { readFileSync } from 'node:fs';

test('review readiness requires an assessment, meaningful reasoning, and a substantive conclusion only',()=>{
  let review=normaliseCaseStudyReview();
  assert.equal(reviewReadiness(review).ready,false);
  review={...review,assessment:'Supported',explanation:'The evidence supports the stated market condition.',conclusion:'The hypothesis is supported during the tested session, while the sample still needs further testing.'};
  const readiness=reviewReadiness(review);
  assert.equal(readiness.ready,true); assert.equal(readiness.percentage,100);
  assert.equal(reviewReadiness({...review,conclusion:'  TBD '}).checks[2].complete,false);
});

test('review patches preserve earlier fields and keep evidence notes scoped to the study',()=>{
  const first=patchStudyReview({id:'study',review:{assessment:'Inconclusive',explanation:'Initial explanation is retained.',evidence:{e1:{classification:'Neutral',observation:'First study note.'}}}},{limitations:'Session selection was narrow.'},'2026-11-03T00:00:00.000Z');
  const second=patchStudyReview(first,{evidence:{...first.review.evidence,e2:{classification:'Supporting',observation:'Second study note.'}}},'2026-11-03T00:01:00.000Z');
  assert.equal(second.review.assessment,'Inconclusive');
  assert.equal(second.review.evidence.e1.observation,'First study note.');
  assert.equal(second.review.evidence.e2.classification,'Supporting');
  assert.equal(second.review.updatedAt,'2026-11-03T00:01:00.000Z');
});

test('Review mode renders full-width evidence cards, button classifications, one validation action, and readiness navigation',()=>{
  const source=readFileSync(new URL('./CaseStudyLibrary.jsx',import.meta.url),'utf8');
  const css=readFileSync(new URL('./caseStudyEditor.css',import.meta.url),'utf8');
  assert.match(source,/\['Write','Split','Analyze','Review'\]/);
  assert.match(source,/function ReviewWorkspace/);
  assert.match(source,/Assessment Explanation/);
  assert.match(source,/\['Supporting','Contradicting','Neutral'\]/);
  assert.match(source,/csr-classification/);
  assert.match(source,/onOpenViewer\(item\.id\)/);
  assert.match(source,/Return to researching/);
  assert.match(source,/Mark validated/);
  assert.match(source,/reviewReadiness\(review\)/);
  assert.match(source,/disabled=\{status==='Validated'&&study\.status!=='Validated'&&!reviewCanValidate\}/);
  assert.match(css,/\.csr-layout/); assert.match(css,/grid-template-columns:220px minmax\(0,1fr\) 268px/);
  assert.match(css,/\.csr-evidence \{ display:grid; grid-template-columns:1fr/);
  assert.match(css,/object-fit:contain/);
  assert.match(css,/\.csr-classification/);
  assert.match(source,/Validation readiness<\/span>/);
});
