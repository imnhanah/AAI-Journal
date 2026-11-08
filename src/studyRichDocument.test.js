import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyRichDocument, isSafeLink, migrateRichDocument, migrateSectionRichDocument, normaliseRichDocument, patchSectionRichDocument, richDocumentFromSections, richDocumentText } from './studyRichDocument.js';
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
test('section documents preserve legacy notes and isolate rich edits by outline section',()=>{
  const study={body:'Overview body',sectionNotes:{Hypothesis:'Legacy hypothesis'}};
  assert.equal(richDocumentText(migrateSectionRichDocument(study,'Hypothesis',1)),'Legacy hypothesis');
  assert.equal(richDocumentText(migrateSectionRichDocument(study,'Overview',0)),'Overview body');
  const document={version:1,content:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Structured hypothesis'}]}]}};
  const patch=patchSectionRichDocument(study,'Hypothesis',1,document);
  assert.equal(richDocumentText(patch.sectionDocuments.Hypothesis),'Structured hypothesis');
  assert.equal(patch.body,undefined);
  assert.equal(patch.sectionNotes,undefined);
});
test('structured section documents retain formatting and image presentation attributes',()=>{
  const document={version:1,content:{type:'doc',content:[
    {type:'heading',attrs:{level:2},content:[{type:'text',text:'Evidence'}]},
    {type:'paragraph',content:[{type:'text',marks:[{type:'bold'}],text:'Observed sweep'}]},
    {type:'image',attrs:{src:'tj-case-study-image:image-1',alt:'HTF chart',width:65,align:'right',caption:'Sweep before reversal'}}
  ]}};
  const saved=patchSectionRichDocument({sectionNotes:{Evidence:'Legacy'}},'Evidence',1,document);
  assert.deepEqual(saved.sectionDocuments.Evidence,document);
  assert.match(richDocumentText(saved.sectionDocuments.Evidence),/Observed sweep/);
  assert.equal(saved.sectionDocuments.Evidence.content.content[2].attrs.caption,'Sweep before reversal');
});
test('rapid section-document patches retain prior image references instead of rebuilding from a stale study',()=>{
  const overview={version:1,content:{type:'doc',content:[{type:'image',attrs:{src:'tj-case-study-image:chart-a',width:75,align:'center',caption:'Context'}}]}};
  const hypothesis={version:1,content:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Confirm displacement'}]}]}};
  const first=patchSectionRichDocument({sections:['Overview','Hypothesis']},'Overview',0,overview);
  const second=patchSectionRichDocument({...first,sections:['Overview','Hypothesis']},'Hypothesis',1,hypothesis);
  assert.equal(second.sectionDocuments.Overview.content.content[0].attrs.src,'tj-case-study-image:chart-a');
  assert.equal(richDocumentText(second.sectionDocuments.Hypothesis),'Confirm displacement');
});

test('a later text edit retains an existing image, caption, dimensions, and formatting after section switching',()=>{
  const image={type:'image',attrs:{src:'tj-case-study-image:chart-a',width:65,align:'right',caption:'Liquidity sweep'}};
  const overview={version:1,content:{type:'doc',content:[{type:'paragraph',content:[{type:'text',marks:[{type:'bold'}],text:'Initial context'}]},image]}};
  const edited={version:1,content:{type:'doc',content:[{type:'paragraph',content:[{type:'text',marks:[{type:'bold'}],text:'Initial context updated'}]},image]}};
  const first=patchSectionRichDocument({sections:['Overview','Review']},'Overview',0,overview);
  const switched=patchSectionRichDocument(first,'Review',1,{version:1,content:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Review notes'}]}]}});
  const final=patchSectionRichDocument(switched,'Overview',0,edited);
  const savedImage=final.sectionDocuments.Overview.content.content[1];
  assert.equal(savedImage.attrs.src,'tj-case-study-image:chart-a');
  assert.equal(savedImage.attrs.caption,'Liquidity sweep');
  assert.equal(savedImage.attrs.width,65);
  assert.equal(savedImage.attrs.align,'right');
  assert.deepEqual(final.sectionDocuments.Review,switched.sectionDocuments.Review);
});
