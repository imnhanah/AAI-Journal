import test from 'node:test';
import assert from 'node:assert/strict';
import { normaliseCaseStudyNavigation } from './caseStudyNavigation.js';
import { readFileSync } from 'node:fs';

test('Case Study navigation restores only a valid study, mode, and Review step',()=>{
  assert.deepEqual(normaliseCaseStudyNavigation({studyId:'study-a',mode:'Review',reviewStep:3}),{studyId:'study-a',mode:'Review',reviewStep:3});
  assert.deepEqual(normaliseCaseStudyNavigation({studyId:'study-a',mode:'Unknown',reviewStep:99}),{studyId:'study-a',mode:'Write',reviewStep:0});
  assert.equal(normaliseCaseStudyNavigation({mode:'Review',reviewStep:3}),null);
});

test('Case Study workspace persists editor state, clears it for Library navigation, and waits for a loaded matching study',()=>{
  const source=readFileSync(new URL('./CaseStudyLibrary.jsx',import.meta.url),'utf8');
  const journal=readFileSync(new URL('./TradingJournal.jsx',import.meta.url),'utf8');
  assert.match(source,/readCaseStudyNavigation\(sessionOwner\)/);
  assert.match(source,/writeCaseStudyNavigation\(sessionOwner,\{studyId:selectedId,\.\.\.editorNavigation\}\)/);
  assert.match(source,/clearCaseStudyNavigation\(sessionOwner\)/);
  assert.match(source,/workspaceRef\.current\.studies\.some\(study=>study\.id===current\)/);
  assert.match(source,/initialMode=\{editorNavigation\.mode\}/);
  assert.match(source,/initialReviewStep=\{editorNavigation\.reviewStep\}/);
  assert.match(source,/onBack=\{returnToLibrary\}/);
  assert.match(journal,/<CaseStudyLibrary sessionOwner=\{user\.id\}/);
});
