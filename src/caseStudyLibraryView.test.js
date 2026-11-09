import test from 'node:test';
import assert from 'node:assert/strict';
import {continuingCaseStudies, filterCaseStudies, pinnedCaseStudies, sortCaseStudies, studyInstruments, studyTags} from './caseStudyLibraryView.js';

const studies = [
  {id:'one',title:'London continuation',status:'Researching',notebookId:'entries',tradeIds:['trade-1'],markupIds:['markup-1'],evidenceIds:['evidence-1'],updatedAt:'2026-11-03T10:00:00Z',createdAt:'2026-11-01T10:00:00Z'},
  {id:'two',title:'Risk review',status:'Draft',notebookId:'risk',tags:['process'],updatedAt:'2026-11-02T10:00:00Z',createdAt:'2026-10-30T10:00:00Z'},
];
const linked = {trades:[{id:'trade-1',asset:'EUR/USD'}],markups:[{id:'markup-1',instrument:'GBP/USD'}],evidence:[{id:'evidence-1',tags:['London','M15']}]};

test('case-study library derives filter metadata from existing study links without mutating studies', () => {
  assert.deepEqual(studyInstruments(studies[0], linked.trades, linked.markups), ['EUR/USD','GBP/USD']);
  assert.deepEqual(studyTags(studies[0], linked.evidence), ['London','M15']);
  assert.deepEqual(filterCaseStudies(studies, {query:'',status:'All',notebook:'All',instrument:'EUR/USD',tag:'London'}, linked).map(item => item.id), ['one']);
  assert.deepEqual(filterCaseStudies(studies, {query:'risk',status:'All',notebook:'All',instrument:'All',tag:'All'}, linked).map(item => item.id), ['two']);
});

test('case-study library supports updated, created, and title ordering', () => {
  assert.deepEqual(sortCaseStudies(studies, 'recent').map(item => item.id), ['one','two']);
  assert.deepEqual(sortCaseStudies(studies, 'created').map(item => item.id), ['two','one']);
  assert.deepEqual(sortCaseStudies(studies, 'title').map(item => item.id), ['one','two']);
});

test('research shelves use current activity and only explicit pinned state', () => {
  const shelfStudies = [
    {id:'draft',status:'Draft',updatedAt:'2026-11-01T10:00:00Z'},
    {id:'research',status:'Researching',updatedAt:'2026-11-03T10:00:00Z'},
    {id:'validated',status:'Validated',updatedAt:'2026-11-04T10:00:00Z'},
    {id:'template-only',status:'Validated',templateId:'playbook',updatedAt:'2026-11-05T10:00:00Z'},
    {id:'pinned-old',status:'Validated',pinned:true,updatedAt:'2026-11-01T11:00:00Z'},
    {id:'pinned-new',status:'Validated',pinned:true,updatedAt:'2026-11-04T11:00:00Z'},
  ];
  assert.deepEqual(continuingCaseStudies(shelfStudies).map(item => item.id), ['research','draft']);
  assert.deepEqual(pinnedCaseStudies(shelfStudies).map(item => item.id), ['pinned-new','pinned-old']);
  assert.deepEqual(pinnedCaseStudies(shelfStudies, 1).map(item => item.id), ['pinned-new']);
});
