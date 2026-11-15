import test from 'node:test';
import assert from 'node:assert/strict';
import {compareCaseStudyLibraries, createCaseStudyReconciliationProposal, describeStudyConflict} from './caseStudyReconciliation.js';

const study = (id, evidenceId, annotationId='annotation-a') => ({ id, title:id, evidenceIds:[evidenceId], evidencePlacements:{[evidenceId]:{caption:id,annotations:[{id:annotationId,x:10,y:20}]}}, relatedStudyIds:[] });
const workspace = ({studies=[],evidence=[],notebooks=[],personalTemplates=[],connections=[]}={}) => ({studies,evidence,notebooks,personalTemplates,connections});

test('reconciliation automatically retains local-only and cloud-only Case Study records', () => {
  const local=workspace({studies:[study('local-study','local-evidence')],evidence:[{id:'local-evidence',cloudRef:'private/local'}]});
  const cloud=workspace({studies:[study('cloud-study','cloud-evidence')],evidence:[{id:'cloud-evidence',cloudRef:'private/cloud'}]});
  const proposal=createCaseStudyReconciliationProposal({local,cloud});
  assert.equal(proposal.unresolved.length,0);
  assert.deepEqual(proposal.workspace.studies.map(item=>item.id).sort(),['cloud-study','local-study']);
  assert.equal(proposal.workspace.evidence.find(item=>item.id==='local-evidence').cloudRef,'private/local');
  assert.equal(proposal.mergedCounts.annotations,2);
});

test('same-ID content differences require an explicit choice and preserve the chosen cloud reference', () => {
  const local=workspace({evidence:[{id:'evidence-a',title:'Safari',cloudRef:'owners/a/local'}]});
  const cloud=workspace({evidence:[{id:'evidence-a',title:'Chrome',cloudRef:'owners/a/cloud'}]});
  const comparison=compareCaseStudyLibraries({local,cloud});
  assert.equal(comparison.conflicts.length,1);
  let proposal=createCaseStudyReconciliationProposal({local,cloud});
  assert.equal(proposal.unresolved.length,1);
  proposal=createCaseStudyReconciliationProposal({local,cloud,selections:{'evidence:evidence-a':'cloud'}});
  assert.equal(proposal.unresolved.length,0);
  assert.equal(proposal.workspace.evidence[0].cloudRef,'owners/a/cloud');
});

test('annotations, placements, templates and connections survive a reviewed merge', () => {
  const local=workspace({
    studies:[study('study-a','evidence-a')], evidence:[{id:'evidence-a',cloudRef:'ref-a'}],
    personalTemplates:[{id:'template-a',name:'Local',sections:[{id:'s'}]}],
  });
  const cloud=workspace({
    studies:[study('study-b','evidence-b','annotation-b')], evidence:[{id:'evidence-b',cloudRef:'ref-b'}],
    connections:[{id:'connection-a',source:{type:'case-study',id:'study-a'},target:{type:'case-study',id:'study-b'},relationship:'supports',explanation:'linked'}],
  });
  const proposal=createCaseStudyReconciliationProposal({local,cloud});
  assert.equal(proposal.workspace.studies.length,2);
  assert.equal(proposal.workspace.connections.length,1);
  assert.equal(proposal.workspace.studies.find(item=>item.id==='study-a').evidencePlacements['evidence-a'].annotations[0].x,10);
  assert.deepEqual(proposal.unresolvedReferences,[]);
});

test('reviewed field choices do not create replacement IDs or silently drop the unselected snapshot', () => {
  const local=workspace({studies:[study('study-a','evidence-a')]});
  const cloud=workspace({studies:[{...study('study-a','evidence-a'),title:'Cloud version'}]});
  const proposal=createCaseStudyReconciliationProposal({local,cloud,selections:{'study:study-a:field:title':'local'}});
  assert.equal(proposal.workspace.studies[0].id,'study-a');
  assert.equal(proposal.workspace.studies[0].title,'study-a');
});

test('a conflicted study keeps safe relationships and labels only differing placement details as pending', () => {
  const localStudy={...study('study-a','evidence-a'), evidenceIds:['evidence-a','evidence-b','evidence-c'], evidencePlacements:{
    'evidence-a':{caption:'Safari A',annotations:[{id:'a',x:1,y:2}]},
    'evidence-b':{caption:'Safari B',annotations:[]},
    'evidence-c':{caption:'Safari C',annotations:[]},
  }};
  const cloudStudy={...study('study-a','evidence-a'), title:'Chrome title', evidenceIds:['evidence-a','evidence-d','evidence-e','evidence-f'], evidencePlacements:{
    'evidence-a':{caption:'Chrome A',annotations:[{id:'a',x:3,y:4}]},
    'evidence-d':{caption:'Chrome D',annotations:[]},
    'evidence-e':{caption:'Chrome E',annotations:[]},
    'evidence-f':{caption:'Chrome F',annotations:[]},
  }};
  const local=workspace({studies:[localStudy],evidence:['a','b','c'].map(id=>({id:`evidence-${id}`}))});
  const cloud=workspace({studies:[cloudStudy],evidence:['a','d','e','f'].map(id=>({id:`evidence-${id}`}))});
  const unresolved=createCaseStudyReconciliationProposal({local,cloud});
  assert.equal(unresolved.canSave,false);
  assert.equal(unresolved.relationshipIntegrity.placements.local,3);
  assert.equal(unresolved.relationshipIntegrity.placements.cloud,4);
  assert.equal(unresolved.relationshipIntegrity.placements.sourceDistinct,6);
  assert.equal(unresolved.relationshipIntegrity.pendingPlacements.length,1);
  assert.equal(unresolved.relationshipIntegrity.placements.omitted.length,0);
  assert.equal(unresolved.relationshipIntegrity.annotations.omitted.length,0);
  assert.equal(unresolved.possibleCounts.studies,1);
  assert.equal(unresolved.possibleCounts.evidence,6);
  assert.equal(unresolved.possibleCounts.placements,6);
  const granularChoice=createCaseStudyReconciliationProposal({local,cloud,selections:{'study:study-a:field:title':'local','study:study-a:placement:evidence-a':'cloud'}});
  assert.equal(granularChoice.mergedCounts.placements,6);
  assert.equal(granularChoice.workspace.studies[0].evidencePlacements['evidence-a'].caption,'Chrome A');
});

test('reconciliation unions unique evidence links and placements from the device and cloud', () => {
  const localStudy={...study('study-a','evidence-local'),evidenceIds:['evidence-local'],evidencePlacements:{'evidence-local':{caption:'Device',annotations:[{id:'annotation-local',x:12,y:24}]}}};
  const cloudStudy={...study('study-a','evidence-cloud'),evidenceIds:['evidence-cloud'],evidencePlacements:{'evidence-cloud':{caption:'Cloud',annotations:[{id:'annotation-cloud',x:48,y:72}]}}};
  const local=workspace({studies:[localStudy],evidence:[{id:'evidence-local',cloudRef:'owner/device'}]});
  const cloud=workspace({studies:[cloudStudy],evidence:[{id:'evidence-cloud',cloudRef:'owner/cloud'}]});
  const proposal=createCaseStudyReconciliationProposal({local,cloud});
  assert.equal(proposal.canSave,true);
  assert.deepEqual(proposal.workspace.studies[0].evidenceIds,['evidence-local','evidence-cloud']);
  assert.deepEqual(Object.keys(proposal.workspace.studies[0].evidencePlacements),['evidence-local','evidence-cloud']);
  assert.equal(proposal.workspace.evidence.find(item=>item.id==='evidence-local').cloudRef,'owner/device');
  assert.equal(proposal.workspace.evidence.find(item=>item.id==='evidence-cloud').cloudRef,'owner/cloud');
});

test('same evidence placement with different caption requires an explicit source choice', () => {
  const localStudy={...study('study-a','evidence-a'),evidencePlacements:{'evidence-a':{caption:'Device caption',annotations:[]}}};
  const cloudStudy={...study('study-a','evidence-a'),evidencePlacements:{'evidence-a':{caption:'Cloud caption',annotations:[]}}};
  const local=workspace({studies:[localStudy],evidence:[{id:'evidence-a',cloudRef:'same/ref'}]});
  const cloud=workspace({studies:[cloudStudy],evidence:[{id:'evidence-a',cloudRef:'same/ref'}]});
  let proposal=createCaseStudyReconciliationProposal({local,cloud});
  assert.equal(proposal.canSave,false);
  assert.equal(proposal.unresolved[0].key,'study:study-a:placement:evidence-a');
  proposal=createCaseStudyReconciliationProposal({local,cloud,selections:{'study:study-a:placement:evidence-a':'cloud'}});
  assert.equal(proposal.canSave,true);
  assert.equal(proposal.workspace.studies[0].evidencePlacements['evidence-a'].caption,'Cloud caption');
});

test('annotation-coordinate conflicts remain protected until their placement choice is made', () => {
  const localStudy={...study('study-a','evidence-a'),evidencePlacements:{'evidence-a':{caption:'Same',annotations:[{id:'annotation-a',x:10,y:20,order:1}]}}};
  const cloudStudy={...study('study-a','evidence-a'),evidencePlacements:{'evidence-a':{caption:'Same',annotations:[{id:'annotation-a',x:88,y:44,order:1}]}}};
  const local=workspace({studies:[localStudy],evidence:[{id:'evidence-a',cloudRef:'same/ref'}]});
  const cloud=workspace({studies:[cloudStudy],evidence:[{id:'evidence-a',cloudRef:'same/ref'}]});
  let proposal=createCaseStudyReconciliationProposal({local,cloud});
  assert.equal(proposal.relationshipIntegrity.annotations.pending.length,1);
  assert.equal(proposal.relationshipIntegrity.annotations.omitted.length,0);
  proposal=createCaseStudyReconciliationProposal({local,cloud,selections:{'study:study-a:placement:evidence-a':'local'}});
  assert.deepEqual(proposal.workspace.studies[0].evidencePlacements['evidence-a'].annotations,[{id:'annotation-a',x:10,y:20,order:1}]);
});

test('merged evidence ordering keeps device order then appends cloud-only relationships', () => {
  const localStudy={...study('study-a','evidence-b'),evidenceIds:['evidence-b','evidence-a'],evidencePlacements:{}};
  const cloudStudy={...study('study-a','evidence-c'),evidenceIds:['evidence-c','evidence-a','evidence-d'],evidencePlacements:{}};
  const allEvidence=['evidence-a','evidence-b','evidence-c','evidence-d'].map(id=>({id}));
  const proposal=createCaseStudyReconciliationProposal({local:workspace({studies:[localStudy],evidence:allEvidence}),cloud:workspace({studies:[cloudStudy],evidence:allEvidence})});
  assert.equal(proposal.canSave,true);
  assert.deepEqual(proposal.workspace.studies[0].evidenceIds,['evidence-b','evidence-a','evidence-c','evidence-d']);
});

test('a retained placement blocks saving when its evidence record needs a separate decision', () => {
  const sharedStudy=study('study-a','evidence-a');
  const local=workspace({studies:[sharedStudy],evidence:[{id:'evidence-a',caption:'Device evidence',cloudRef:'owner/device'}]});
  const cloud=workspace({studies:[sharedStudy],evidence:[{id:'evidence-a',caption:'Cloud evidence',cloudRef:'owner/cloud'}]});
  let proposal=createCaseStudyReconciliationProposal({local,cloud});
  assert.equal(proposal.canSave,false);
  assert.equal(proposal.unresolved[0].key,'evidence:evidence-a');
  proposal=createCaseStudyReconciliationProposal({local,cloud,selections:{'evidence:evidence-a':'cloud'}});
  assert.equal(proposal.canSave,true);
  assert.equal(proposal.workspace.evidence[0].cloudRef,'owner/cloud');
});

test('saving remains disabled until every conflicting study field and placement has a decision', () => {
  const localStudy={...study('study-a','evidence-a'),title:'Device title',evidencePlacements:{'evidence-a':{caption:'Device placement',annotations:[]}}};
  const cloudStudy={...study('study-a','evidence-a'),title:'Cloud title',evidencePlacements:{'evidence-a':{caption:'Cloud placement',annotations:[]}}};
  const local=workspace({studies:[localStudy],evidence:[{id:'evidence-a'}]});
  const cloud=workspace({studies:[cloudStudy],evidence:[{id:'evidence-a'}]});
  let proposal=createCaseStudyReconciliationProposal({local,cloud,selections:{'study:study-a:field:title':'local'}});
  assert.equal(proposal.canSave,false);
  proposal=createCaseStudyReconciliationProposal({local,cloud,selections:{'study:study-a:field:title':'local','study:study-a:placement:evidence-a':'cloud'}});
  assert.equal(proposal.canSave,true);
  assert.equal(proposal.workspace.studies[0].title,'Device title');
  assert.equal(proposal.workspace.studies[0].evidencePlacements['evidence-a'].caption,'Cloud placement');
});

test('pending relationship summary never classifies valid associations as omitted or deleted', () => {
  const localStudy={...study('study-a','evidence-a'),evidencePlacements:{'evidence-a':{caption:'Device',annotations:[{id:'ann',x:1,y:1}]}}};
  const cloudStudy={...study('study-a','evidence-a'),evidencePlacements:{'evidence-a':{caption:'Cloud',annotations:[{id:'ann',x:2,y:2}]}}};
  const local=workspace({studies:[localStudy],evidence:[{id:'evidence-a'}]});
  const cloud=workspace({studies:[cloudStudy],evidence:[{id:'evidence-a'}]});
  const proposal=createCaseStudyReconciliationProposal({local,cloud});
  assert.equal(proposal.relationshipIntegrity.placements.pending.length,1);
  assert.equal(proposal.relationshipIntegrity.placements.omitted.length,0);
  assert.equal(proposal.relationshipIntegrity.annotations.pending.length,1);
  assert.equal(proposal.relationshipIntegrity.annotations.omitted.length,0);
});

test('field choices preserve stable IDs, captions, observations, annotations and cloud references', () => {
  const localStudy={...study('study-a','evidence-a'),notes:'Device notes',evidencePlacements:{'evidence-a':{caption:'Device caption',observation:'Device observation',annotations:[{id:'ann',x:14,y:27,order:2}]}}};
  const cloudStudy={...study('study-a','evidence-a'),notes:'Cloud notes',evidencePlacements:{'evidence-a':{caption:'Cloud caption',observation:'Cloud observation',annotations:[{id:'ann',x:44,y:57,order:2}]}}};
  const local=workspace({studies:[localStudy],evidence:[{id:'evidence-a',cloudRef:'owner/private/object'}]});
  const cloud=workspace({studies:[cloudStudy],evidence:[{id:'evidence-a',cloudRef:'owner/private/object'}]});
  const proposal=createCaseStudyReconciliationProposal({local,cloud,selections:{'study:study-a:field:notes':'cloud','study:study-a:placement:evidence-a':'local'}});
  const merged=proposal.workspace.studies[0];
  assert.equal(proposal.canSave,true);
  assert.equal(merged.id,'study-a');
  assert.equal(merged.notes,'Cloud notes');
  assert.deepEqual(merged.evidencePlacements['evidence-a'],localStudy.evidencePlacements['evidence-a']);
  assert.equal(proposal.workspace.evidence[0].cloudRef,'owner/private/object');
  assert.deepEqual(local.studies[0],localStudy);
  assert.deepEqual(cloud.studies[0],cloudStudy);
});

test('study comparison describes readable safety-critical fields without assuming which side changed first', () => {
  const localStudy={...study('study-a','evidence-a'), status:'draft', objective:'Device objective', notes:'Device notes', tags:['device'], pinned:true, sections:['Plan'], sectionNotes:{Plan:'Local section'}};
  const cloudStudy={...study('study-a','evidence-a'), title:'Cloud study', status:'validated', objective:'Cloud objective', notes:'Cloud notes', tags:['cloud'], archived:true, sections:['Plan'], sectionNotes:{Plan:'Cloud section'}};
  const local=workspace({studies:[localStudy],evidence:[{id:'evidence-a'}],notebooks:[{id:'notebook-a',name:'Device notebook'}]});
  const cloud=workspace({studies:[cloudStudy],evidence:[{id:'evidence-a'}],notebooks:[{id:'notebook-a',name:'Cloud notebook'}]});
  const fields=describeStudyConflict({local:localStudy,cloud:cloudStudy,localWorkspace:local,cloudWorkspace:cloud});
  assert.equal(fields.find(field=>field.key==='objective').state,'different');
  assert.equal(fields.find(field=>field.key==='sections').state,'different');
  assert.equal(fields.find(field=>field.key==='pinned').state,'different');
  assert.equal(fields.find(field=>field.key==='archived').state,'different');
  assert.equal(fields.find(field=>field.key==='annotations').state,'identical');
});

test('an orphaned evidence relationship blocks a reviewed merge instead of dropping it', () => {
  const local=workspace({studies:[{...study('study-a','missing-evidence'), evidenceIds:['missing-evidence']} ]});
  const proposal=createCaseStudyReconciliationProposal({local,cloud:workspace()});
  assert.equal(proposal.unresolved.length,0);
  assert.equal(proposal.unresolvedReferences.length,2);
  assert.equal(proposal.canSave,false);
});
