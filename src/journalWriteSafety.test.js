import test from 'node:test';
import assert from 'node:assert/strict';
import {requireBaseRevision,writeOperationKey,savingsValues,savingsBase,canonicalWrite} from './journalWriteSafety.js';
import {editReviewIntent,readReviewIntent,reviewIntentAnswers} from './reviewWriteIntent.js';
import {planLegacyCatalogConversion} from './legacyCatalogConversion.js';
import {readEntryConfluenceLibrary,librarySaveValue} from './entryConfluenceLibrary.js';
import {assertClassificationRecovery} from './workspaceClassification.js';
import {backtestCloudModelLinksEnabled} from './backtestEntryModel.js';
const stamp='2026-11-20T12:00:00.123456+00:00';
test('missing or malformed revisions fail before an update can be constructed',()=>{
 for(const value of [undefined,null,'','invalid',1])assert.throws(()=>requireBaseRevision(value),/Load the saved record/);
 assert.equal(requireBaseRevision(stamp),stamp);
});
test('retry operation keys survive key order and reload; a different base or intent changes the key',async()=>{
 const one=await writeOperationKey('savings','owner',{base:null,items:[{id:'draft-1',name:'A'}]});
 assert.equal(await writeOperationKey('savings','owner',{items:[{name:'A',id:'draft-1'}],base:null}),one);
 assert.notEqual(await writeOperationKey('savings','other',{base:null,items:[{id:'draft-1',name:'A'}]}),one);
 assert.notEqual(await writeOperationKey('savings','owner',{base:stamp,items:[{id:'draft-1',name:'A'}]}),one);
});
test('savings validation preserves identities and rejects partial or duplicate inputs',()=>{
 const item={id:'draft-1',name:' A ',target:10,allocationPct:20,reminderMinutes:30};
 assert.equal(savingsValues([item])[0].name,'A');assert.equal(item.name,' A ');
 for(const changes of [{target:-1},{allocationPct:101},{reminderMinutes:0},{reminderMinutes:1.5},{target:Infinity}])assert.throws(()=>savingsValues([{...item,...changes}]));
 assert.throws(()=>savingsValues([item,item]));
 assert.deepEqual(savingsBase([{id:'b',updatedAt:stamp},{id:'a'}]),[{id:'a',updatedAt:null},{id:'b',updatedAt:stamp}]);
});
test('Review edits retain their original server revision across unrelated refreshes and recovery',()=>{
 const first=editReviewIntent({},'notes','Local',{},stamp);
 const later=editReviewIntent(first,'plan','More',{},'2026-11-20T13:00:00Z');
 const recovered=readReviewIntent(JSON.parse(JSON.stringify(later)));
 assert.equal(recovered.baseRevision,stamp);assert.deepEqual(recovered.changed,{notes:'Local',plan:'More'});
 assert.deepEqual(reviewIntentAnswers(later),recovered.changed);
});
test('older recovered Review drafts are retained but cannot acquire a new base silently',()=>{
 const old={notes:'Original recovered draft'};
 assert.throws(()=>readReviewIntent(old),/comparison/);
 const changed=editReviewIntent(old,'plan','New edit',{},stamp);
 assert.throws(()=>readReviewIntent(changed),/comparison/);
 assert.equal(changed.notes,old.notes);
});
test('new reviews have an explicit null base; unverified reviews cannot save',()=>{
 assert.equal(readReviewIntent(editReviewIntent({},'notes','New',{},null)).baseRevision,null);
 assert.throws(()=>readReviewIntent(editReviewIntent({},'notes','Unknown',{},undefined)),/comparison/);
});
const source=()=>({version:1,entries:[{id:'old-entry',label:'Trend',description:'Description',archived:false,aliases:[]}],categories:[{id:'structure',label:'Structure',description:'Category',archived:false,mode:'single',tags:[{id:'old-tag',label:'Break',description:'Tag definition',archived:false,aliases:[]}]}]});
const workspace=()=>({id:'workspace',entryConfluenceLibrary:source(),confluenceSessions:['Trend'],typeTags:['Break'],trades:[{id:'trade',entryType:'Trend',confluence:['Break'],direction:'SELL',pnl:12}]});
test('safe legacy catalog plan retains descriptions, historical associations and the entire original catalog',()=>{
 const original=workspace(),before=structuredClone(original),plan=planLegacyCatalogConversion(original);
 assert.equal(plan.classification.entryTypes.items[0].id,'Trend');assert.equal(plan.classification.entryTypes.items[0].description,'Description');
 assert.deepEqual(plan.classification.legacyCatalogSource,original.entryConfluenceLibrary);assert.deepEqual(original,before);
 const converted={...original,classification:plan.classification};
 assertClassificationRecovery([converted]);
 const library=readEntryConfluenceLibrary(converted);assert.equal(librarySaveValue(library,'entryTypes').items[0].description,'Description');
 assert.deepEqual(converted.trades,before.trades);
});
test('mixed modern catalogs, duplicate legacy tag names and used aliases never auto-convert',()=>{
 const mixed={...workspace(),classification:{entryTypes:{revision:1,items:[]}}};assert.throws(()=>planLegacyCatalogConversion(mixed),/Both catalog/);
 const duplicate=workspace();duplicate.entryConfluenceLibrary.categories.push({...duplicate.entryConfluenceLibrary.categories[0],id:'other'});assert.throws(()=>planLegacyCatalogConversion(duplicate),/duplicate/);
 const renamed=workspace();renamed.entryConfluenceLibrary.entries[0].aliases=['Old'];renamed.trades[0].entryType='Old';assert.throws(()=>planLegacyCatalogConversion(renamed),/explicit mapping/);
});
test('unknown historical choices remain archived and changed old metadata blocks settings edits',()=>{
 const w=workspace();w.trades.push({entryType:'Old unknown',confluence:['Legacy signal']});
 const plan=planLegacyCatalogConversion(w),converted={...w,classification:plan.classification};
 assert.equal(plan.classification.entryTypes.items.find(item=>item.id==='Old unknown').archived,true);
 converted.entryConfluenceLibrary={...source(),entries:[]};
 assert.throws(()=>librarySaveValue(readEntryConfluenceLibrary(converted),'entryTypes'),/older custom-definition catalog/);
});
test('cloud Backtest model creation requires explicit paired protocol and feature activation',()=>{
 assert.equal(backtestCloudModelLinksEnabled(true,{}),false);
 assert.equal(backtestCloudModelLinksEnabled(true,{VITE_BACKTEST_MODEL_LINKS_CLOUD:'true'}),false);
 assert.equal(backtestCloudModelLinksEnabled(false,{VITE_JOURNAL_WRITE_SAFETY:'true',VITE_BACKTEST_MODEL_LINKS_CLOUD:'true'}),false);
 assert.equal(backtestCloudModelLinksEnabled(true,{VITE_JOURNAL_WRITE_SAFETY:'true',VITE_BACKTEST_MODEL_LINKS_CLOUD:'true'}),true);
});
