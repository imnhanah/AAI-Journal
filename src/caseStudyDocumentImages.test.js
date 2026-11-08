import test from 'node:test';
import assert from 'node:assert/strict';
import {CASE_STUDY_DOCUMENT_IMAGE_MAX_BYTES, isDocumentImageReference, validateCaseStudyDocumentImage} from './caseStudyDocumentImages.js';

test('research document images accept only bounded PNG, JPEG, and WebP files', () => {
  assert.equal(validateCaseStudyDocumentImage(null), 'Choose an image first.');
  assert.equal(validateCaseStudyDocumentImage({type:'image/gif',size:1}), 'Use a PNG, JPEG, or WebP image.');
  assert.equal(validateCaseStudyDocumentImage({type:'image/png',size:CASE_STUDY_DOCUMENT_IMAGE_MAX_BYTES + 1}), 'Images must be 3 MB or smaller.');
  assert.equal(validateCaseStudyDocumentImage({type:'image/webp',size:CASE_STUDY_DOCUMENT_IMAGE_MAX_BYTES}), null);
  assert.equal(isDocumentImageReference('tj-case-study-image:abc'), true);
  assert.equal(isDocumentImageReference('data:image/png;base64,abc'), false);
});
