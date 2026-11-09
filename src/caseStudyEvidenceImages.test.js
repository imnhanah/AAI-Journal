import test from 'node:test';
import assert from 'node:assert/strict';
import { EVIDENCE_IMAGE_MAX_BYTES, validateEvidenceImage } from './caseStudyWorkspace.js';
import { isEvidenceImageReference, isStoredEvidenceImageReference } from './caseStudyEvidenceImages.js';

test('shared Evidence Library image references are distinct from direct document-image references',()=>{
  assert.equal(isEvidenceImageReference('tj-case-study-evidence:chart-1'),true);
  assert.equal(isEvidenceImageReference('tj-case-study-image:document-1'),false);
  assert.equal(isEvidenceImageReference('data:image/png;base64,legacy'),false);
});

test('all IndexedDB-backed evidence references begin unresolved so an invalid image element cannot win the async load race',()=>{
  assert.equal(isStoredEvidenceImageReference('tj-case-study-evidence:chart-1'),true);
  assert.equal(isStoredEvidenceImageReference('tj-case-study-image:document-1'),true);
  assert.equal(isStoredEvidenceImageReference('https://example.test/chart.png'),false);
});

test('Evidence Library retains the existing safe image size and type policy',()=>{
  assert.equal(validateEvidenceImage({type:'image/png',size:EVIDENCE_IMAGE_MAX_BYTES}),null);
  assert.match(validateEvidenceImage({type:'image/gif',size:1}),/PNG, JPEG, or WebP/);
  assert.match(validateEvidenceImage({type:'image/webp',size:EVIDENCE_IMAGE_MAX_BYTES+1}),/3 MB/);
});
