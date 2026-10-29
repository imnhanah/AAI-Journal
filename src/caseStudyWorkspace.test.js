import test from 'node:test';
import assert from 'node:assert/strict';
import { caseStudyBackup, linkEvidence, linkRelatedStudy, mergeCaseStudyWorkspace, normaliseCaseStudyWorkspace, unlinkEvidence, validateEvidenceImage } from './caseStudyWorkspace.js';

const workspace = () => normaliseCaseStudyWorkspace({ notebooks:[{id:'notes',name:'Notes'}], evidence:[{id:'e1',title:'Shared chart'}], studies:[{id:'s1',title:'One',evidenceIds:['e1'],evidencePlacements:{e1:{caption:'First placement'}},relatedStudyIds:[]},{id:'s2',title:'Two',evidenceIds:['e1'],evidencePlacements:{e1:{caption:'Second placement'}},relatedStudyIds:[]}] });

test('normalisation preserves workspace data and supplies new collections', () => {
  const value = normaliseCaseStudyWorkspace({ studies:[{id:'s1'}] });
  assert.deepEqual(value.personalTemplates, []);
  assert.deepEqual(value.studies[0].evidencePlacements, {});
  assert.deepEqual(value.studies[0].relatedStudyIds, []);
});

test('shared evidence carries independent annotations and safely unlinks everywhere', () => {
  const value = workspace();
  assert.equal(value.studies[0].evidencePlacements.e1.caption, 'First placement');
  assert.equal(value.studies[1].evidencePlacements.e1.caption, 'Second placement');
  const removed = unlinkEvidence(value, 'e1');
  assert.equal(removed.evidence.length, 0);
  assert.deepEqual(removed.studies.map(study => study.evidenceIds), [[], []]);
  assert.deepEqual(removed.studies.map(study => study.evidencePlacements), [{}, {}]);
});

test('link helpers do not duplicate evidence or related studies', () => {
  const study = linkEvidence({ id:'s1', evidenceIds:[], evidencePlacements:{} }, 'e1');
  assert.equal(study.evidencePlacements.e1.caption, '');
  assert.equal(linkEvidence(study, 'e1').evidenceIds.length, 1);
  assert.equal(linkRelatedStudy({relatedStudyIds:[]}, 's2').relatedStudyIds[0], 's2');
});

test('backup retains templates, validation and conflict-safe imports', () => {
  const source = workspace();
  source.personalTemplates=[{id:'t1',name:'My research',sections:['Question']}];
  source.studies[0].validation={summary:'Enough examples',validatedAt:'2026-10-28'};
  const backup = caseStudyBackup(source);
  assert.equal(backup.kind, 'aaicorefx-case-study-library');
  assert.equal(backup.workspace.personalTemplates[0].name, 'My research');
  const merged = mergeCaseStudyWorkspace(source, backup.workspace);
  assert.equal(merged.studies.length, 4);
  assert.match(merged.studies[2].title, /imported/);
  const replaced = mergeCaseStudyWorkspace(source, backup.workspace, {conflict:'replace'});
  assert.equal(replaced.studies.length, 2);
});

test('chart uploads accept persistent supported image payloads only', () => {
  assert.equal(validateEvidenceImage({type:'image/png',size:1024}), null);
  assert.match(validateEvidenceImage({type:'application/pdf',size:1}), /PNG, JPEG, or WebP/);
  assert.match(validateEvidenceImage({type:'image/jpeg',size:3 * 1024 * 1024 + 1}), /3 MB/);
});
