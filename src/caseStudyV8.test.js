import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Editor} from '@tiptap/core';
import {DOMParser as ProseMirrorParser} from '@tiptap/pm/model';
import {savedOutcome} from './syncOutcome.js';
import {JSDOM} from 'jsdom';
import {caseStudyDocumentExtensions, RichCaseStudyImage, validateCaseStudyDocument, usesV8CaseStudyContent, caseStudyLibraryUsesV8, isPlainCaseStudyDocument, caseStudyV8Preview, caseStudyV8CloudEnabled} from './caseStudyRichFormat.js';
import {migrateSectionRichDocument, patchSectionRichDocument, richDocumentText} from './studyRichDocument.js';
import {caseStudyBackup, mergeCaseStudyWorkspace, normaliseCaseStudyWorkspace} from './caseStudyWorkspace.js';
import {createCaseStudyReconciliationProposal} from './caseStudyReconciliation.js';
import {createMobileStudyDraftController} from './mobileCaseStudyDraftController.js';
import {createJournalDraftController} from './journalDraftController.js';
import {createSyncSession} from './syncSession.js';
import {createDurableSync} from './durableSync.js';
import {encodeDraftValue,decodeDraftValue} from './journalPayloadCodecs.js';

const paragraph = text => ({type:'paragraph',content:text?[{type:'text',text}]:[]});
const document = () => ({version:1,content:{type:'doc',content:[
  paragraph('Original research'),
  {type:'table',attrs:{styleVariant:'striped'},content:[{type:'tableRow',content:[
    {type:'tableCell',content:[paragraph('Entry')]},{type:'tableCell',content:[paragraph('Result')]}
  ]}]},
  {type:'taskList',content:[{type:'taskItem',attrs:{checked:true},content:[paragraph('Verify hypothesis')]}]},
  {type:'image',attrs:{src:'tj-case-study-media:asset-original',localOnly:false,cloudRef:'private-original',
    alt:'Original image',width:65,align:'right',caption:'Original caption',rotation:90,flipX:true,flipY:false,wrap:true}},
  {type:'caseStudyObject',attrs:{kind:'chart',shape:'arrow',chart:'line',values:[5,20,10],text:'',strokes:[],width:60,align:'center',rotation:0,flipX:false,flipY:false,wrap:false}},
  paragraph('Last note'),
]}});
const workspace = () => ({notebooks:[],evidence:[{id:'e',url:'tj-case-study-media:asset-original',cloudRef:'private-original'}],
  studies:[{id:'s',title:'Study',sections:['Overview'],sectionDocuments:{Overview:document()},evidenceIds:['e']}],personalTemplates:[]});

function memoryStorage() {
  const stores = Object.fromEntries(['drafts','history','operations','receipts'].map(name => [name,new Map()]));
  return {
    async transaction(mode, callback) {
      const working=structuredClone(stores);
      const result=await callback({
        get:async(name,key)=>structuredClone(working[name].get(JSON.stringify(key))??null),
        put:async(name,value)=>working[name].set(JSON.stringify(value.key),structuredClone(value)),
        delete:async(name,key)=>working[name].delete(JSON.stringify(key)),
        list:async(name,scope)=>[...working[name].values()].filter(row=>!scope||JSON.stringify(row.scope)===JSON.stringify(scope)).map(row=>structuredClone(row)),
      });
      if(mode==='readwrite')for(const name of Object.keys(stores))stores[name]=working[name];
      return result;
    },
  };
}

function mobile(workspaceValue, transport, storage=memoryStorage()) {
  const session=createSyncSession();
  session.activate({projectId:'synthetic',ownerId:'owner'});
  const repository=createDurableSync({storage,session});
  let controller;
  const context={draft(feature,recordId,initialValue,onSaved,merge){
    controller=createJournalDraftController({repository,feature,recordId,initialValue,onError:onSaved,mergeRecovered:merge});
    return controller;
  }};
  const drafts=createMobileStudyDraftController({context,workspace:workspaceValue,revision:1,
    textToDoc:text=>({version:1,content:{type:'doc',content:[paragraph(text)]}}),
    submit:transport,timers:{clearTimeout(){},setTimeout(){return 1;}}});
  return {drafts,controller,repository,storage};
}

test('V8 actual editor round-trip retains notes, tables, checks, image references and transformations',t=>{
  const dom=new JSDOM('<main/>');
  const previous={window:globalThis.window,document:globalThis.document};
  globalThis.window=dom.window;globalThis.document=dom.window.document;
  try {
    assert.equal(validateCaseStudyDocument(document()),true);
    const editor=new Editor({element:dom.window.document.querySelector('main'),
      extensions:[...caseStudyDocumentExtensions,RichCaseStudyImage],content:document().content,enableContentCheck:true});
    editor.commands.focus=()=>false;
    editor.commands.setTextSelection(2);
    editor.commands.insertContent('Updated ');
    const value={version:1,content:editor.getJSON()};
    assert.equal(validateCaseStudyDocument(value),true);
    assert.match(richDocumentText(value),/Updated/);
    assert.equal(value.content.content.find(node=>node.type==='image').attrs.src,'tj-case-study-media:asset-original');
    assert.equal(value.content.content.find(node=>node.type==='image').attrs.cloudRef,'private-original');
    assert.equal(value.content.content.find(node=>node.type==='image').attrs.rotation,90);
    assert.equal(value.content.content.find(node=>node.type==='taskList').content[0].attrs.checked,true);
    assert.deepEqual(value.content.content.find(node=>node.type==='caseStudyObject').attrs.values,[5,20,10]);
    const html=editor.getHTML();
    const fragment=dom.window.document.createElement('div');fragment.innerHTML=html;
    const pastedDocument=ProseMirrorParser.fromSchema(editor.schema).parse(fragment).toJSON();
    editor.destroy();
    const reopened=new Editor({element:dom.window.document.querySelector('main'),
      extensions:[...caseStudyDocumentExtensions,RichCaseStudyImage],content:value.content,enableContentCheck:true});
    assert.deepEqual(reopened.getJSON(),value.content);
    reopened.destroy();
    const pasted=new Editor({element:dom.window.document.querySelector('main'),
      extensions:[...caseStudyDocumentExtensions,RichCaseStudyImage],content:pastedDocument,enableContentCheck:true});
    t.after(()=>pasted.destroy());
    const copied=pasted.getJSON().content;
    const pastedImage=copied.find(node=>node.type==='image');
    assert.deepEqual(pastedImage.attrs,value.content.content.find(node=>node.type==='image').attrs);
    assert.deepEqual(copied.find(node=>node.type==='caseStudyObject').attrs,value.content.content.find(node=>node.type==='caseStudyObject').attrs);
    pasted.destroy();
  }finally{Object.assign(globalThis,previous);dom.window.close();}
});

test('unknown nodes, attributes, marks, malformed tables and future document versions are rejected before editing',()=>{
  for(const mutate of [
    doc=>{doc.version=2;},
    doc=>{doc.content.content.push({type:'futureObject'});},
    doc=>{doc.content.content[0].attrs={unknownSetting:true};},
    doc=>{doc.content.content[0].content[0].marks=[{type:'unknownMark'}];},
    doc=>{doc.content.content[1].content=[paragraph('invalid table row')];},
    doc=>{doc.content.content[4].attrs.values=[Infinity];},
  ]){const value=document();mutate(value);assert.equal(validateCaseStudyDocument(value),false);}
});

test('unsupported original sections cannot be replaced through legacy or rich patch APIs',()=>{
  const original=workspace().studies[0];
  original.sectionDocuments.Overview.content.content.push({type:'futureObject'});
  const before=structuredClone(original);
  assert.throws(()=>patchSectionRichDocument(original,'Overview',0,document()),/protected/);
  assert.deepEqual(original,before);
});

test('rich content is detected across saved sections and templates and preview is disabled outside the local build',()=>{
  assert.equal(usesV8CaseStudyContent(document().content),true);
  assert.equal(caseStudyLibraryUsesV8(workspace()),true);
  assert.equal(caseStudyLibraryUsesV8({personalTemplates:[{richDocument:document()}]}),true);
  assert.equal(caseStudyLibraryUsesV8({caseStudyDocumentProtocol:'v8'}),true);
  assert.equal(caseStudyV8Preview(true),false);
  assert.equal(isPlainCaseStudyDocument(document()),false);
  assert.equal(isPlainCaseStudyDocument({version:1,content:{type:'doc',content:[paragraph('Legacy')]}}),true);
});

test('backup, recovery and reviewed two-device reconciliation keep V8 rich structures and private references',()=>{
  const original=workspace(),backup=caseStudyBackup(original);
  const restored=mergeCaseStudyWorkspace({},backup.workspace);
  assert.deepEqual(restored.studies[0].sectionDocuments,original.studies[0].sectionDocuments);
  assert.deepEqual(restored.evidence,normaliseCaseStudyWorkspace(original).evidence);
  const remote=structuredClone(original);remote.studies[0].title='Other device title';
  const proposal=createCaseStudyReconciliationProposal({local:original,cloud:remote,selections:{'study:s:field:title':'cloud'}});
  assert.equal(proposal.canSave,true);
  assert.deepEqual(proposal.workspace.studies[0].sectionDocuments,original.studies[0].sectionDocuments);
  assert.deepEqual(decodeDraftValue(encodeDraftValue(original)),original);
});

test('mobile durable rich edits survive failed writes, detach and reload without flattening',async()=>{
  const original=workspace(),before=structuredClone(original);
  const first=mobile(original,async()=>{throw new Error('Offline');});
  await first.controller.ready();
  assert.throws(()=>first.drafts.editSection('s',{name:'Overview',index:0,text:'Flattened'}),/rich editor/);
  const edited=document();edited.content.content.push(paragraph('Typed offline'));
  first.drafts.editSection('s',{name:'Overview',index:0,document:edited});
  await first.drafts.flushLocal();
  assert.equal(await first.drafts.flushCloud(),false);
  first.drafts.detachView();
  const second=mobile(original,async request=>({workspace:request.workspace,revision:2,outcome:savedOutcome({target:'cloud',operationId:request.operationId,revision:'2'})}),first.storage);
  await second.controller.ready();
  assert.deepEqual(second.drafts.getSnapshot().workspace.studies[0].sectionDocuments.Overview,edited);
  assert.equal(await second.drafts.flushCloud(),true);
  assert.deepEqual(original,before);
  second.drafts.detachView();
});

test('remote changes while dirty retain the complete local rich draft for reconciliation',async()=>{
  const original=workspace(),f=mobile(original,async()=>({outcome:{status:'conflict',error:'Newer version'}}));
  await f.controller.ready();
  const edited=document();edited.content.content.push(paragraph('Local edit'));
  f.drafts.editSection('s',{name:'Overview',index:0,document:edited});
  const remote=structuredClone(original);remote.studies[0].title='Remote';
  f.drafts.receiveConfirmed(remote,2);
  assert.match(f.drafts.getSnapshot().error.message,/local edits are retained/);
  assert.equal(await f.drafts.flushCloud(),false);
  assert.deepEqual(f.drafts.getSnapshot().workspace.studies[0].sectionDocuments.Overview,edited);
  f.drafts.detachView();
});

test('compatible-reader rollback stops V8 cloud writes before the RPC while saves retain pause and revision guards',()=>{
  const source=readFileSync(new URL('./caseStudyCloud.js',import.meta.url),'utf8');
  assert.ok(source.indexOf('__tjCloudWritesPaused')<source.indexOf('caseStudyLibraryUsesV8(library)'));
  assert.ok(source.indexOf('caseStudyLibraryUsesV8(library)')<source.indexOf("supabase.rpc("));
  assert.match(source,/expected_revision:expectedRevision \?\? null/);
});


test('paired release enables V8 while explicit compatible-reader rollback disables authoring and cloud writes',()=>{
  const production={PROD:true,DEV:false};
  assert.equal(caseStudyV8CloudEnabled(production),true);
  assert.equal(caseStudyV8Preview(false,production,'aaijournal.trade'),true);
  const rollback={...production,VITE_CASE_STUDY_V8_ENABLED:'false'};
  assert.equal(caseStudyV8CloudEnabled(rollback),false);
  assert.equal(caseStudyV8Preview(false,rollback,'aaijournal.trade'),false);
  assert.equal(caseStudyV8CloudEnabled({DEV:true}),false);
  assert.equal(caseStudyV8Preview(true,{DEV:true,VITE_CASE_STUDY_V8_PREVIEW:'true'},'127.0.0.1'),true);
  assert.equal(caseStudyV8Preview(false,{DEV:true,VITE_CASE_STUDY_V8_PREVIEW:'true'},'127.0.0.1'),false);
});
