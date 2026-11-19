import test from 'node:test';
import assert from 'node:assert/strict';
import {readEntryConfluenceLibrary,saveLibraryItem,librarySaveValue,libraryTagLabel,moveLibraryItem,archiveLibraryItem,toggleLibraryConfluence} from './entryConfluenceLibrary.js';
import {classificationLookup,classificationSaveRequest,applyClassificationSave,presentTradeClassification} from './workspaceClassification.js';
const fixture=()=>({id:'workspace',typeTags:['Break','Volume','Sweep'],confluenceSessions:['Counter Trend'],classification:{entryTypes:{revision:1,items:[{id:'Counter Trend',name:'Counter Trend',description:'Preserved definition',archived:false}]},confluences:{revision:1,categories:[{id:'structure',name:'Structure',mode:'single',archived:false,tags:[{id:'Break',name:'Signal',description:'',archived:false},{id:'Volume',name:'Volume',description:'',archived:false}]},{id:'liquidity',name:'Liquidity',mode:'multi',archived:false,tags:[{id:'Sweep',name:'Signal',description:'',archived:false}]}]}}});
test('latest UI adapter renames forty historical trades without changing stored keys or direction',()=>{
 const w=fixture(),before=structuredClone(w),rows=Array.from({length:40},()=>({entryType:'Counter Trend',direction:'SELL'}));
 const lib=readEntryConfluenceLibrary(w);const edited=saveLibraryItem(lib,'entry','Counter Trend',{label:'Reversal',description:lib.entries[0].description});
 const value=librarySaveValue(edited,'entryTypes');const next={...w,classification:applyClassificationSave(w,classificationSaveRequest(edited.base,'entryTypes',value))};
 for(const row of rows){const view=presentTradeClassification(row,classificationLookup(next));assert.equal(view.entryTypeLabel,'Reversal');assert.equal(view.entryType,'Counter Trend');assert.equal(view.direction,'SELL');}
 assert.equal(value.items[0].description,'Preserved definition');assert.deepEqual(w,before);
});
test('creating and describing a new type allocates an independent server-compatible identity',()=>{
 const w=fixture();const lib=saveLibraryItem(readEntryConfluenceLibrary(w),'entry',undefined,{label:'Reversal',description:'Different classification'});
 assert.equal(lib.entries[0].id,'Counter Trend');assert.match(lib.entries[1].id,/^aai-entry:[0-9a-f-]{36}$/);assert.equal(classificationLookup(w).entry('Counter Trend'),'Counter Trend');
});
test('tag names may repeat across categories but not within one active category',()=>{
 const lib=readEntryConfluenceLibrary(fixture());assert.equal(libraryTagLabel(lib,'Break'),'Signal · Structure');assert.equal(libraryTagLabel(lib,'Sweep'),'Signal · Liquidity');
 assert.throws(()=>saveLibraryItem(lib,'tag',undefined,{categoryId:'structure',label:'Signal',description:''}),/already used/);
 const added=saveLibraryItem(lib,'tag',undefined,{categoryId:'liquidity',label:'Volume',description:''});assert.match(added.categories[1].tags[1].id,/^aai-tag:/);
 assert.throws(()=>moveLibraryItem(lib,'tag','Break',1,'liquidity'),/already used/);
});
test('single selection changes only its own category and preserves grandfathered selections until changed',()=>{
 const lib=readEntryConfluenceLibrary(fixture()),selected=['Break','Volume','Sweep'];
 assert.deepEqual(selected,['Break','Volume','Sweep']);assert.deepEqual(toggleLibraryConfluence(lib,selected,'Break'),['Volume','Sweep']);
 const withNew=saveLibraryItem(lib,'tag',undefined,{categoryId:'structure',label:'New',description:''});const id=withNew.categories[0].tags[2].id;
 assert.deepEqual(toggleLibraryConfluence(withNew,selected,id),['Sweep',id]);
});
test('archives, reorder and valid category moves preserve existing IDs and descriptions',()=>{
 const lib=readEntryConfluenceLibrary(fixture());const archived=archiveLibraryItem(lib,'entry','Counter Trend');assert.equal(archived.entries[0].id,'Counter Trend');assert.equal(archived.entries[0].description,'Preserved definition');
 const moved=moveLibraryItem(lib,'tag','Volume',2,'liquidity');assert.equal(moved.categories[1].tags[1].id,'Volume');
 const reordered=moveLibraryItem(lib,'category','liquidity',1);assert.equal(reordered.categories[0].id,'liquidity');assert.equal(reordered.categories[0].tags[0].id,'Sweep');
});
test('an open editor keeps its original section revision after a remote save',()=>{
 const w=fixture();const draft=readEntryConfluenceLibrary(w);const remote={...w,classification:{...w.classification,entryTypes:{...w.classification.entryTypes,revision:2}}};
 const next=saveLibraryItem(draft,'entry','Counter Trend',{label:'Old draft',description:'draft'});
 assert.throws(()=>applyClassificationSave(remote,classificationSaveRequest(next.base,'entryTypes',librarySaveValue(next,'entryTypes'))),/another device/);
});
test('legacy plain settings remain compatible and an older custom catalog is never discarded silently',()=>{
 const plain=readEntryConfluenceLibrary({id:'a',confluenceSessions:['Original'],typeTags:['Break']});assert.equal(plain.entries[0].id,'Original');assert.equal(plain.categories[0].label,'Ungrouped');assert.equal(plain.categories[0].mode,'multi');
 const old={id:'a',confluenceSessions:['Original'],entryConfluenceLibrary:{version:1,entries:[{label:'Original',description:'Must survive'}]}};
 assert.throws(()=>librarySaveValue(readEntryConfluenceLibrary(old),'entryTypes'),/older custom-definition catalog/);assert.equal(old.entryConfluenceLibrary.entries[0].description,'Must survive');
});
