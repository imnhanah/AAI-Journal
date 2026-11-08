import test from 'node:test';
import assert from 'node:assert/strict';
import {caseStudyDraftError, createCaseStudyDraft, hasCaseStudyDraftChanges, initialCaseStudyDraft} from './caseStudyCreation.js';

const notebooks = [{id:'structure',name:'Market Structure'},{id:'notes',name:'Personal Notes'}];
const templates = [{id:'research',name:'Research study',sections:['Question','Evidence']}];

test('new Case Study setup starts unpersisted with the existing notes notebook default', () => {
  assert.deepEqual(initialCaseStudyDraft({notebooks,templates}), {title:'',notebookId:'notes',templateId:'research',instrument:'',context:''});
});

test('new Case Study setup validates title and detects meaningful unsaved changes', () => {
  const initial=initialCaseStudyDraft({notebooks,templates});
  assert.equal(caseStudyDraftError(initial), 'Enter a study title before creating the draft.');
  assert.equal(hasCaseStudyDraftChanges({...initial,title:'   '},initial), false);
  assert.equal(hasCaseStudyDraftChanges({...initial,title:'London sweep'},initial), true);
});

test('creating a Case Study draft preserves selected setup without creating duplicate metadata', () => {
  const study=createCaseStudyDraft({draft:{title:'London sweep',notebookId:'structure',templateId:'research',instrument:'EUR/USD',context:'Test the sweep.'},template:templates[0],id:'study-1',createdAt:'2026-11-03T12:00:00.000Z',richDocument:'<p>Question</p>'});
  assert.deepEqual(study, {id:'study-1',title:'London sweep',notebookId:'structure',templateId:'research',instrument:'EUR/USD',sections:['Question','Evidence'],body:'Test the sweep.',sectionNotes:{Question:'Test the sweep.'},richDocument:'<p>Question</p>',status:'Draft',evidenceIds:[],tradeIds:[],markupIds:[],relatedStudyIds:[],favorite:false,pinned:false,archived:false,createdAt:'2026-11-03T12:00:00.000Z',updatedAt:'2026-11-03T12:00:00.000Z',revisionCount:1});
});
