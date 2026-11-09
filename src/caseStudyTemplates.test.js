import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {BUILT_IN_CASE_STUDY_TEMPLATES,applyTemplateToStudy,normalisePersonalTemplate,templateSections} from './caseStudyTemplates.js';

test('Phase 7 starter templates provide protected trading-research sections',()=>{
  assert.deepEqual(BUILT_IN_CASE_STUDY_TEMPLATES.slice(0,3).map(item=>item.name),['Trading Setup Research','Strategy Validation','Market Structure Study']);
  assert.equal(templateSections(BUILT_IN_CASE_STUDY_TEMPLATES[0]).length,7);
  assert.match(BUILT_IN_CASE_STUDY_TEMPLATES[0].guidance['Research Objective'],/specific trading behavior/i);
});
test('applying a template adds only exact missing sections and preserves all study data',()=>{
  const source={id:'study',sections:['Market Context','Custom note'],sectionNotes:{'Custom note':'keep'},evidenceIds:['e1'],review:{conclusion:'keep'}};
  const result=applyTemplateToStudy(source,{sections:['Research Objective','Market Context','Conclusion']});
  assert.deepEqual(result.addedSections,['Research Objective','Conclusion']);
  assert.deepEqual(result.study.evidenceIds,['e1']);
  assert.equal(result.study.review.conclusion,'keep');
  assert.deepEqual(applyTemplateToStudy(result.study,{sections:['Research Objective','Market Context','Conclusion']}).addedSections,[]);
});

test('personal templates normalise duplicate and invalid section identifiers without changing guidance',()=>{
  const template=normalisePersonalTemplate({name:'  Liquidity review ',description:'  A reusable outline ',sections:[{id:'objective',title:'Research objective',guidance:'State the question.'},{id:'again',title:'Research objective',guidance:'Duplicate'},{title:'','guidance':'ignore'}]});
  assert.equal(template.name,'Liquidity review');
  assert.equal(template.description,'A reusable outline');
  assert.deepEqual(template.sections,[{id:'objective',title:'Research objective',guidance:'State the question.'}]);
});

test('existing Case Study outline exposes the existing safe template merge dialog beside Add section',()=>{
  const editor=readFileSync(new URL('./CaseStudyLibrary.jsx',import.meta.url),'utf8');
  const css=readFileSync(new URL('./caseStudyEditor.css',import.meta.url),'utf8');
  assert.ok(editor.includes('<div className="cse-outline-actions"><button className="cse-apply-template"'));
  assert.ok(editor.includes('Apply template</button><button className="cse-add-section"'));
  assert.match(editor,/function ApplyTemplateDialog/);
  assert.match(editor,/Only sections that are not already present will be added/);
  assert.match(css,/\.cse-outline-actions/);
});

test('Template Manager owns its page header and previews optional guidance without keeping the Library header',()=>{
  const source=readFileSync(new URL('./CaseStudyLibrary.jsx',import.meta.url),'utf8');
  const css=readFileSync(new URL('./caseStudyLibraryRedesign.css',import.meta.url),'utf8');
  assert.match(source,/libraryView !== 'templates' && libraryView !== 'connections' && <header className="case-library__header">/);
  assert.match(source,/<h1>Template Manager<\/h1>/);
  assert.match(source,/New template<\/button><\/header>/);
  assert.match(source,/selected\.guidance\?\.\[section\]&&<small>/);
  assert.match(css,/\.case-v2-templates \.case-v2-resource__head h1/);
});
