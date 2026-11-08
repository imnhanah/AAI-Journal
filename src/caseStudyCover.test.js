import test from 'node:test';
import assert from 'node:assert/strict';
import { evidenceImageReference, resolveCaseStudyCover } from './caseStudyCover.js';

const evidence = [
  {id:'first',url:'tj-case-study-evidence:first'},
  {id:'second',url:'https://example.test/second.png'},
  {id:'missing'},
  {id:'note-only',source:'A written observation'},
];

test('case study covers use a valid explicit cover before linked evidence', () => {
  const cover=resolveCaseStudyCover({coverEvidenceId:'second',evidenceIds:['first']},evidence);
  assert.equal(cover.id,'second');
});

test('case study covers use the first valid linked evidence in stored link order', () => {
  const cover=resolveCaseStudyCover({evidenceIds:['missing','first','second']},evidence);
  assert.equal(cover.id,'first');
  assert.equal(evidenceImageReference(cover),'tj-case-study-evidence:first');
});

test('case study covers ignore unavailable links and never use unlinked note images', () => {
  assert.equal(resolveCaseStudyCover({evidenceIds:['missing','note-only']},evidence),null);
  assert.equal(resolveCaseStudyCover({evidenceIds:[]},evidence),null);
});

test('research-notes-backed evidence remains a valid cover reference through navigation cycles', () => {
  const documentReference='tj-case-study-image:liquidity-chart';
  const linked=[{id:'chart',url:documentReference,documentImageRef:documentReference}];
  assert.equal(resolveCaseStudyCover({evidenceIds:['chart']},linked)?.id,'chart');
  assert.equal(evidenceImageReference(linked[0]),documentReference);
});
