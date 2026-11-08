import test from 'node:test';
import assert from 'node:assert/strict';
import { clearCaseStudySyncOutbox, conflictCaseStudySnapshot, pendingCaseStudySnapshot, readCaseStudySyncOutbox, saveCaseStudySyncOutbox } from './caseStudySyncOutbox.js';

const memoryStorage = () => {
  const values=new Map();
  return { getItem:key=>values.get(key) || null, setItem:(key,value)=>values.set(key,value), removeItem:key=>values.delete(key), values };
};
const workspace = title => ({ studies:[{id:`study-${title}`,title,evidenceIds:['chart'],evidencePlacements:{chart:{richDocument:{type:'doc',content:[{type:'text',text:title}]}}}},{id:'other',title:'Other'}], evidence:[{id:'chart'}], notebooks:[], personalTemplates:[], connections:[{id:`connection-${title}`,source:{type:'case-study',id:`study-${title}`},target:{type:'case-study',id:'other'},relationship:'related-to',explanation:'Related research'}] });

test('pending Case Study snapshots are durable, user-scoped, and retain rich content and connections',()=>{
  const storage=memoryStorage(); const local=workspace('local');
  assert.ok(!saveCaseStudySyncOutbox('user-a',pendingCaseStudySnapshot(local,4),storage).error);
  const restored=readCaseStudySyncOutbox('user-a',storage).data;
  assert.equal(restored.pending.baseRevision,4);
  assert.equal(restored.pending.workspace.studies[0].evidencePlacements.chart.richDocument.content[0].text,'local');
  assert.equal(restored.pending.workspace.connections[0].explanation,'Related research');
  assert.equal(readCaseStudySyncOutbox('user-b',storage).data,null);
  assert.deepEqual(clearCaseStudySyncOutbox('user-a',storage),{});
  assert.equal(readCaseStudySyncOutbox('user-a',storage).data,null);
});

test('conflict snapshots retain both versions through a reload',()=>{
  const storage=memoryStorage();
  saveCaseStudySyncOutbox('user-a',conflictCaseStudySnapshot(workspace('local'),workspace('cloud'),8),storage);
  const restored=readCaseStudySyncOutbox('user-a',storage).data;
  assert.equal(restored.conflict.local.studies[0].title,'local');
  assert.equal(restored.conflict.cloud.studies[0].title,'cloud');
  assert.equal(restored.conflict.cloudRevision,8);
});

test('local persistence failures are reported instead of being treated as durable',()=>{
  const broken={getItem(){throw new Error('blocked');},setItem(){throw new Error('blocked');},removeItem(){throw new Error('blocked');}};
  assert.match(saveCaseStudySyncOutbox('user-a',pendingCaseStudySnapshot(workspace('x'),0),broken).error,/could not be saved/i);
  assert.match(readCaseStudySyncOutbox('user-a',broken).error,/could not be read/i);
  assert.match(clearCaseStudySyncOutbox('user-a',broken).error,/could not be cleared/i);
});
