import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readTemporaryCaseStudyLibrary,saveTemporaryCaseStudyLibrary} from './temporaryCaseStudyLibrary.js';

const storage = () => { const values=new Map(); return {getItem:key=>values.get(key) || null,setItem:(key,value)=>values.set(key,value),values}; };
test('temporary Case Study workspace persists separately per user and never shares a cloud/profile key',()=>{
  const device=storage();
  const first={studies:[{id:'one'}],evidence:[],notebooks:[],personalTemplates:[]};
  assert.equal(saveTemporaryCaseStudyLibrary('user-one',first,device).error,undefined);
  assert.equal(readTemporaryCaseStudyLibrary('user-one',device).data.studies[0].id,'one');
  assert.equal(readTemporaryCaseStudyLibrary('user-two',device).data,null);
  assert.ok([...device.values.keys()].every(key=>key.startsWith('aaicorefx-temporary-case-study-library:')));
});
test('recovery renders the normal editable library only through the isolated temporary save handler',()=>{
  const journal=readFileSync(new URL('./TradingJournal.jsx',import.meta.url),'utf8');
  assert.match(journal,/profileCaseStudyState\.status === 'recovery' && temporaryCaseStudyWorkspaceOwnerRef\.current === user\.id \? temporaryCaseStudyWorkspace/);
  assert.match(journal,/profileCaseStudyState\.status === 'recovery' \? handleSaveTemporaryCaseStudyWorkspace : handleSaveCaseStudyWorkspace/);
  assert.match(journal,/saveTemporaryCaseStudyLibrary\(user\.id, caseStudyWorkspace\)/);
  assert.doesNotMatch(journal,/handleSaveTemporaryCaseStudyWorkspace[\s\S]{0,280}setTemporaryCaseStudyWorkspace\(saved\.data\)/);
  const library=readFileSync(new URL('./CaseStudyLibrary.jsx',import.meta.url),'utf8');
  assert.match(library,/Saved only on this device\. Your recovered legacy library is unchanged/);
  assert.match(library,/Work in Progress — Coming Soon/);
  assert.match(library,/Some features, including cloud synchronization, may be temporarily unavailable/);
  assert.doesNotMatch(library,/case-temporary-notice/);
});
