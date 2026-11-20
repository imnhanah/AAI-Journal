import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {libraryEntryControlModel, librarySaveValue, readEntryConfluenceLibrary} from './entryConfluenceLibrary.js';

const library = () => ({entries:[
  {id:'Counter Trend',label:'Reversal',description:'Current definition',archived:false},
  {id:'aai-entry:123',label:'Archived model',description:'Keep history',archived:true},
],categories:[]});

test('journal entry control defaults to stable IDs after renames', () => {
  const model=libraryEntryControlModel(library(),'Counter Trend');
  assert.equal(model.entries[0].value,'Counter Trend');
  assert.equal(model.entries[0].label,'Reversal');
  assert.equal(model.entry.description,'Current definition');
  assert.equal(model.historical,false);
});

test('Strategy Testing control retains model names without converting stored records', () => {
  const input=library(),before=structuredClone(input);
  const model=libraryEntryControlModel(input,'Reversal','label');
  assert.equal(model.entries[0].value,'Reversal');
  assert.equal(model.historical,false);
  assert.deepEqual(input,before);
});

test('unknown and archived Strategy Testing model names stay selectable unchanged', () => {
  const archived=libraryEntryControlModel(library(),'Archived model','label');
  assert.equal(archived.historical,true);
  assert.equal(archived.entry.description,'Keep history');
  assert.equal(archived.entries.some(entry=>entry.value==='Archived model'),false);
  const unknown=libraryEntryControlModel(library(),'Earlier model','label');
  assert.equal(unknown.historical,true);
  assert.equal(unknown.entry,undefined);
});

test('legacy local descriptions stay readable in Strategy Testing without activating or converting the catalog', () => {
  const account={id:'workspace',confluenceSessions:['Earlier model'],entryConfluenceLibrary:{version:1,entries:[
    {id:'legacy-model',label:'Newer local model',description:'Local description',aliases:['Earlier model'],archived:false},
  ]}};
  const before=structuredClone(account),lib=readEntryConfluenceLibrary(account);
  const model=libraryEntryControlModel(lib,'Earlier model','label');
  assert.equal(model.entry.description,'Local description');
  assert.equal(model.historical,true);
  assert.equal(model.entries[0].value,'Newer local model');
  assert.throws(()=>librarySaveValue(lib,'entryTypes'),/older custom-definition catalog/);
  assert.deepEqual(account,before);
});

test('journal stable-ID choices never inherit legacy label-mode metadata', () => {
  const input=library();input.legacyCatalog={version:1,entries:[{label:'Local only',description:'Preserved separately'}]};
  assert.equal(libraryEntryControlModel(input,'Counter Trend').entries[0].value,'Counter Trend');
  assert.equal(libraryEntryControlModel(input,'Local only','label').entries[0].value,'Local only');
});

test('only the Strategy Testing Entry Model explicitly opts into label values', () => {
  const source=readFileSync(new URL('./TradingJournal.jsx',import.meta.url),'utf8');
  assert.equal((source.match(/valueMode="label"/g)||[]).length,1);
  assert.match(source,/<Field label="Entry Model"><EntryTypeControl label="Entry Model" valueMode="label"/);
  assert.match(source,/onChange=\{selectEntryModel\}/);
  assert.match(source,/valueMode=\{backtest \? 'label' : 'id'\}/);
  assert.match(source,/selectBacktestModel\(form,modelWorkspace,value,choice\)/);
  assert.match(source,/onClassificationSave=\{handleClassificationSave\}/);
});

test('new backtest references require the actual device-only adapter, not just device journal mode',()=>{
  const source=readFileSync(new URL('./TradingJournal.jsx',import.meta.url),'utf8');
  assert.match(source,/backtestModelLinksEnabled\(backtestLocalOnly && localJournal\.isLocalJournal\(\)\)/);
  assert.match(source,/<NewTradeModal backtest backtestLocalOnly=\{localBacktests\}/);
});
