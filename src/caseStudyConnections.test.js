import test from 'node:test';
import assert from 'node:assert/strict';
import { CaseStudyConnectionError, caseStudyConnectionsForStudy, createCaseStudyConnection, isUsableCaseStudyConnection, removeCaseStudyConnection, removeConnectionsForCaseStudy, updateCaseStudyConnection } from './caseStudyConnections.js';
import { caseStudyBackup, normaliseCaseStudyWorkspace } from './caseStudyWorkspace.js';

const workspace = () => normaliseCaseStudyWorkspace({ studies:[{id:'liquidity',title:'Liquidity'},{id:'structure',title:'Structure',archived:true},{id:'entries',title:'Entries'}] });
const input = { source:{type:'case-study',id:'liquidity'}, target:{type:'case-study',id:'structure'}, relationship:'builds-on', explanation:'The liquidity model builds on market structure.' };
const create = (base=workspace()) => createCaseStudyConnection(base,input,{id:'9f4310f1-87f0-4ebd-986d-01d6365be55c',timestamp:'2026-11-03T12:00:00.000Z'});

test('Case Study connections use durable profile-workspace records and preserve archived endpoints', () => {
  const result=create();
  assert.match(result.connection.id,/^[0-9a-f-]{36}$/i);
  assert.equal(result.workspace.connections.length,1);
  assert.equal(result.workspace.connections[0].target.id,'structure');
  assert.equal(isUsableCaseStudyConnection(result.workspace,result.connection),true);
  assert.equal(caseStudyConnectionsForStudy(result.workspace,'structure').length,1);
  const restored=normaliseCaseStudyWorkspace(caseStudyBackup(result.workspace).workspace);
  assert.deepEqual(restored.connections,result.workspace.connections);
});

test('connection CRUD rejects self, missing endpoints, required explanation, and logical duplicates', () => {
  const base=workspace();
  for (const fields of [{...input,target:{type:'case-study',id:'liquidity'}},{...input,target:{type:'case-study',id:'missing'}},{...input,explanation:' '}]) assert.throws(()=>createCaseStudyConnection(base,fields),CaseStudyConnectionError);
  const created=create(base).workspace;
  assert.throws(()=>createCaseStudyConnection(created,input),error=>error.code==='duplicate-connection');
  const related=createCaseStudyConnection(base,{...input,relationship:'related-to'}).workspace;
  assert.throws(()=>createCaseStudyConnection(related,{...input,source:input.target,target:input.source,relationship:'related-to'}),error=>error.code==='duplicate-connection');
});

test('directional relationships preserve direction and editing cannot accidentally change endpoints', () => {
  const first=create();
  const second=createCaseStudyConnection(first.workspace,{...input,source:input.target,target:input.source,relationship:'builds-on',explanation:'Structure uses liquidity observations.'},{id:'44580d0e-e670-41b2-9c48-7f9e9e32aacd',timestamp:'2026-11-03T12:01:00.000Z'});
  assert.equal(second.workspace.connections.length,2);
  const edited=updateCaseStudyConnection(second.workspace,first.connection.id,{relationship:'supports',explanation:'Updated reasoning.',source:{type:'case-study',id:'entries'}},{timestamp:'2026-11-03T12:02:00.000Z'});
  assert.equal(edited.connection.source.id,'liquidity');
  assert.equal(edited.connection.target.id,'structure');
  assert.equal(edited.connection.relationship,'supports');
  assert.equal(edited.connection.updatedAt,'2026-11-03T12:02:00.000Z');
});

test('removing a connection or deleting a study never changes unrelated Case Studies or relationships', () => {
  const first=create();
  const second=createCaseStudyConnection(first.workspace,{...input,target:{type:'case-study',id:'entries'},relationship:'supports',explanation:'Useful entry confirmation.'},{id:'8d1514f9-cda2-4d0f-b97b-a56a0b4114a5',timestamp:'2026-11-03T12:01:00.000Z'});
  const removed=removeCaseStudyConnection(second.workspace,first.connection.id);
  assert.deepEqual(removed.studies,second.workspace.studies);
  assert.equal(removed.connections.length,1);
  const deleted=removeConnectionsForCaseStudy(second.workspace,'structure');
  assert.equal(deleted.connections.length,1);
  assert.equal(deleted.connections[0].target.id,'entries');
  assert.equal(deleted.studies.length,3);
});
