import test from 'node:test';
import assert from 'node:assert/strict';
import {caseStudyBackup} from './caseStudyWorkspace.js';
import {auditRecoveredCaseStudyBackup, auditRecoveredCaseStudyWorkspace} from './recoveredCaseStudyIntegrity.js';

const workspace = () => ({
  legacyAccountLibraries:[{accountId:'legacy-a',workspace:{studies:[]}}],
  notebooks:[{id:'notes',name:'Notes'}],
  personalTemplates:[{id:'template-a',name:'Template',sections:['Overview'],metadata:{preserved:true}}],
  evidence:[{id:'chart-a',title:'Chart'}],
  studies:[{id:'study-a',title:'Study',notebookId:'notes',templateId:'template-a',relatedStudyIds:[],evidenceIds:['chart-a'],sectionNotes:{Overview:'private note'},richDocument:{type:'doc',content:[]},evidencePlacements:{'chart-a':{caption:'Caption',observation:'Observation',annotations:[{id:'annotation-a'}],board:{objects:[{id:'draw-a',tool:'draw'},{id:'text-a',tool:'text',text:'private'}]}}}}],
});

test('read-only recovered inventory counts preserved structures and resolves all valid references',()=>{
  const result=auditRecoveredCaseStudyWorkspace(workspace());
  assert.equal(result.valid,true);
  assert.deepEqual(result.counts,{studies:1,notebooks:1,evidence:1,templates:1,placements:1,annotations:1,boardObjects:2,boardDrawings:1,textObjects:1,sectionNotes:1,richDocuments:1,captions:1,observations:1});
});

test('integrity report identifies duplicate IDs and missing or malformed references without changing the source',()=>{
  const source=workspace();
  source.evidence.push({id:'chart-a',title:'Duplicate'});
  source.studies[0].notebookId='missing-notebook';
  source.studies[0].evidenceIds=['missing-evidence'];
  source.studies[0].relatedStudyIds=['missing-study'];
  source.studies[0].evidencePlacements={'unknown-chart':{annotations:{bad:true},board:{objects:[null]}}};
  const before=structuredClone(source);
  const result=auditRecoveredCaseStudyWorkspace(source);
  assert.equal(result.valid,false);
  assert.ok(result.problems.some(problem=>problem.kind==='evidence' && problem.id==='chart-a'));
  assert.ok(result.problems.some(problem=>problem.kind==='missing-notebook'));
  assert.ok(result.problems.some(problem=>problem.kind==='missing-evidence'));
  assert.ok(result.problems.some(problem=>problem.kind==='missing-related-study'));
  assert.ok(result.problems.some(problem=>problem.kind==='placement-missing-evidence'));
  assert.ok(result.problems.some(problem=>problem.kind==='malformed-annotations'));
  assert.ok(result.problems.some(problem=>problem.kind==='malformed-board-object'));
  assert.deepEqual(source,before);
});

test('both library and full-journal backup shapes retain the recovered workspace and legacy descriptors',()=>{
  const source=workspace();
  const libraryBackup=caseStudyBackup(source);
  const journalBackup={data:{profileCaseStudyLibrary:structuredClone(source)}};
  assert.equal(auditRecoveredCaseStudyBackup(source,libraryBackup).valid,true);
  assert.equal(auditRecoveredCaseStudyBackup(source,journalBackup).valid,true);
  assert.equal(auditRecoveredCaseStudyBackup(source,{workspace:{studies:[]}}).valid,false);
});
