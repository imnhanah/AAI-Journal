import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyRichDocument, isSafeLink, migrateRichDocument, normaliseRichDocument, richDocumentFromSections, richDocumentText } from './studyRichDocument.js';
import { caseStudyBackup, mergeCaseStudyWorkspace } from './caseStudyWorkspace.js';

test('empty and legacy Overview documents migrate to versioned Tiptap JSON without discarding text',()=>{
  const empty=migrateRichDocument({sections:['Overview'],body:''},'Overview');
  assert.equal(empty.version,1); assert.equal(empty.content.type,'doc');
  const note=migrateRichDocument({sectionNotes:{Overview:'Market context\nLiquidity was taken.'},body:'ignored'},'Overview');
  assert.match(richDocumentText(note),/Market context/);
  const body=migrateRichDocument({body:'Legacy body'},'Overview'); assert.equal(richDocumentText(body),'Legacy body');
});
test('conflicting legacy note and body remain readable in deterministic migration order',()=>{
  const document=migrateRichDocument({sectionNotes:{Overview:'Current note'},body:'Older body'},'Overview');
  assert.match(richDocumentText(document),/Current note/); assert.match(richDocumentText(document),/Legacy overview/); assert.match(richDocumentText(document),/Older body/);
});
test('valid rich documents survive repeated initialization and malformed documents fall back safely',()=>{
  const document=richDocumentFromSections(['Overview','Risk']); const study={body:'stale',richDocument:document};
  assert.deepEqual(migrateRichDocument(study,'Overview'),document);
  assert.equal(normaliseRichDocument({version:99,content:{type:'doc',content:[]}}),null);
  assert.equal(migrateRichDocument({body:'Safe fallback',richDocument:{version:99}},'Overview').version,1);
  assert.equal(emptyRichDocument().content.type,'doc');
});
test('rich document text, templates, backup, and restore preserve structured document data',()=>{
  const document=richDocumentFromSections(['Market context','Entry model']); assert.match(richDocumentText(document),/Market context/);
  const workspace={studies:[{id:'study-1',title:'Research',richDocument:document}],notebooks:[],evidence:[],personalTemplates:[]};
  const backup=caseStudyBackup(workspace); assert.deepEqual(backup.workspace.studies[0].richDocument,document);
  const restored=mergeCaseStudyWorkspace({studies:[],notebooks:[],evidence:[],personalTemplates:[]},backup.workspace);
  assert.deepEqual(restored.studies[0].richDocument,document);
});
test('only safe link protocols are accepted for rich documents',()=>{
  assert.equal(isSafeLink('https://example.com'),true); assert.equal(isSafeLink('mailto:research@example.com'),true); assert.equal(isSafeLink('javascript:alert(1)'),false);
});
