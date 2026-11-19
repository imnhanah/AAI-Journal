import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyClassificationSave, assertClassificationRecovery, classificationLookup, classificationSaveRequest,
  classificationSection, classifiedTags, entryTypeKey, entryTypeLabel, entryTypeOptions, moveClassificationItem,
  newClassificationItem, orderedRules, presentTradeClassification, rawTradeClassification, selectionConflicts,
  toggleConfluence,
} from './workspaceClassification.js';
import {journalActiveFilters,journalFilterOptions} from './mobileJournalTimeline.js';

const legacyWorkspace = {id:'a',confluenceSessions:['Counter Trend'],typeTags:['Volume','Breakout']};
const oldTrade = {id:'trade',entryType:'Counter Trend',confluence:['Volume','Breakout'],direction:'SELL'};
const item=(id,name,description='')=>({id,name,description,archived:false});

test('rename displays across forty historical trades without changing the serialized key or direction',()=>{
  const values={items:[item('Counter Trend','Reversal','Optional notes')]};
  const config=applyClassificationSave(legacyWorkspace,classificationSaveRequest(legacyWorkspace,'entryTypes',values));
  const workspace={...legacyWorkspace,classification:config};
  const lookup=classificationLookup(workspace);
  const trades=Array.from({length:40},(_,i)=>({...oldTrade,id:`trade-${i}`}));
  const projected=trades.map(trade=>presentTradeClassification(trade,lookup));
  assert.equal(projected.filter(trade=>entryTypeLabel(trade)==='Reversal').length,40);
  assert.equal(new Set(projected.map(entryTypeKey)).size,1);
  assert.deepEqual(projected.map(rawTradeClassification),trades);
  assert.equal(entryTypeLabel(presentTradeClassification(oldTrade,classificationLookup(legacyWorkspace))),'Counter Trend');
  assert.equal(entryTypeOptions(workspace,oldTrade.entryType)[0].description,'Optional notes');
  assert.equal(journalFilterOptions(projected).modelLabels['Counter Trend'],'Reversal');
  assert.deepEqual(journalActiveFilters({model:'Counter Trend'},{'Counter Trend':'Reversal'}),[{key:'model',label:'Reversal'}]);
});

test('creating a new type matching a historical-only label and archiving it never reassigns trades',()=>{
  const itemNew=newClassificationItem('entry','Reversal');
  const orphan={entryType:'Reversal'};
  const workspace={...legacyWorkspace,classification:{entryTypes:{revision:1,items:[itemNew]}}};
  assert.notEqual(itemNew.id,entryTypeKey(orphan));
  assert.equal(entryTypeLabel(presentTradeClassification(orphan,classificationLookup(workspace))),'Reversal');
  const inactive={...workspace,classification:{entryTypes:{revision:2,items:[{...itemNew,archived:true}]}}};
  assert.equal(entryTypeOptions(inactive).length,0);
  assert.equal(entryTypeOptions(inactive,itemNew.id)[0].id,itemNew.id);
});

test('confluence category moves and duplicate display names retain distinct tag associations',()=>{
  const original=classificationSection(legacyWorkspace,'confluences').categories[0];
  assert.equal(original.mode,'multi');
  assert.deepEqual(original.tags.map(tag=>tag.id),oldTrade.confluence);
  const duplicate=newClassificationItem('tag','Volume','Second category');
  const a={...original,name:'Category A',tags:[{...original.tags[0],description:'Legacy definition'},original.tags[1]]};
  const b={id:'b',name:'Category B',mode:'single',archived:false,tags:[duplicate]};
  const trade={...oldTrade,confluence:['Volume',duplicate.id]};
  const make=categories=>classificationLookup({classification:{confluences:{revision:1,categories}}});
  assert.deepEqual(classifiedTags(presentTradeClassification(trade,make([a,b]))).map(x=>x.label),['Volume · Category A','Volume · Category B']);
  const moved={...a.tags[0],name:'Renamed'};
  const updated=presentTradeClassification(trade,make([{...b,tags:[moved,duplicate]},{...a,tags:[a.tags[1]]}]));
  assert.deepEqual(classifiedTags(updated).map(x=>x.id),trade.confluence);
  assert.deepEqual(classifiedTags(updated).map(x=>x.label),['Renamed','Volume']);
  assert.equal(moved.description,'Legacy definition');
  assert.deepEqual(selectionConflicts([{...b,tags:[moved,duplicate]}],trade.confluence).map(category=>category.id),['b']);
});

test('single-select replacement is scoped to one category',()=>{
  const a={mode:'single',tags:[item('first','First'),item('second','Second'),item('third','Third')]};
  const previous=['first','third','other'];
  assert.deepEqual(toggleConfluence(a,previous,'second'),['other','second']);
  assert.deepEqual(toggleConfluence(a,previous,'first'),['third','other']);
  assert.deepEqual(toggleConfluence({...a,mode:'multi'},previous,'second'),[...previous,'second']);
  assert.deepEqual(previous,['first','third','other']);
});

test('rule order is deterministic, supports arbitrary position moves and preserves rule identity',()=>{
  const older={id:'rule-1',createdAt:'2026-01-01',active:true};
  const newer={id:'rule-2',createdAt:'2026-02-01',active:false};
  assert.deepEqual(orderedRules([newer,older]),[older,newer]);
  const ids=Array.from({length:10},(_,i)=>String(i+1));
  assert.deepEqual(moveClassificationItem(ids,'10',1),['1','10','2','3','4','5','6','7','8','9']);
  assert.equal(orderedRules([older,newer],['rule-2','stale'])[0],newer);
});

test('stale section edits and stale legacy bootstraps are rejected while independent sections can commit',()=>{
  const initial=classificationSaveRequest(legacyWorkspace,'entryTypes',{items:[item('Counter Trend','Reversal')]});
  const classification=applyClassificationSave(legacyWorkspace,initial);
  assert.throws(()=>applyClassificationSave({...legacyWorkspace,classification},initial),/changed on another device/);
  assert.throws(()=>applyClassificationSave({...legacyWorkspace,confluenceSessions:['New value']},initial),/changed on another device/);
  const request=classificationSaveRequest(legacyWorkspace,'confluences',{categories:[]});
  const next=applyClassificationSave({...legacyWorkspace,classification},request);
  assert.deepEqual(next.entryTypes,classification.entryTypes);
});

test('recovery accepts legacy or complete catalogs and refuses references with missing definitions',()=>{
  assert.doesNotThrow(()=>assertClassificationRecovery([{...legacyWorkspace,trades:[oldTrade]}]));
  const newEntry=newClassificationItem('entry','New');
  const missing={...legacyWorkspace,trades:[{...oldTrade,entryType:newEntry.id}]};
  assert.throws(()=>assertClassificationRecovery([missing]),/missing Entry Type or Confluence/);
  assert.doesNotThrow(()=>assertClassificationRecovery([{...missing,classification:{entryTypes:{revision:1,items:[{...newEntry,archived:true}]}}}]));
});
