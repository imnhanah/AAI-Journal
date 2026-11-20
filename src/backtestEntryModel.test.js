import test from 'node:test';
import assert from 'node:assert/strict';
import {backtestModelLinksEnabled,rawBacktestEntryModel,selectBacktestModel,presentBacktestEntryModel,assertBacktestModelWrite,backtestModelLabel,backtestModelWorkspace} from './backtestEntryModel.js';
import {protectTestTrade,mergeBacktestDelta,backtestStats} from './backtestModel.js';
const workspace=(name='With trend',id='workspace')=>({id,classification:{entryTypes:{revision:1,items:[{id:'entry-1',name,description:'Definition',archived:false}]}}});
const row=()=>({id:'trade',asset:'EUR/USD',strategy:'With trend',entryType:'With trend',direction:'SELL',pnl:10,commission:2,swap:1,screenshots:{entry:['local-image']}});
const linked=()=>selectBacktestModel(row(),workspace(),'With trend',{id:'entry-1'});

test('renaming changes backtest display without rewriting names, finances, images or identity',()=>{
  const stored=linked(),before=structuredClone(stored),view=presentBacktestEntryModel(stored,[workspace('Reversal')]);
  assert.equal(view.entryType,'Reversal');assert.equal(view.strategy,'Reversal');
  assert.deepEqual(rawBacktestEntryModel(view),stored);assert.deepEqual(stored,before);
  assert.equal(view.direction,'SELL');assert.equal(view.pnl,10);assert.deepEqual(view.screenshots,stored.screenshots);
});
test('same entry key in another workspace cannot redirect a model association',()=>{
  const stored=linked();assert.equal(backtestModelLabel(stored,[workspace('Other','different')]),'With trend');
  assert.equal(backtestModelLabel(stored,[workspace('Other','different'),workspace('Right')]),'Right');
  assert.equal(backtestModelWorkspace(stored,[workspace('Other','different')]),null);
});
test('new types with reused labels never reclassify existing linked trades',()=>{
  const w=workspace('Renamed');w.classification.entryTypes.items.push({id:'entry-2',name:'With trend',archived:false});
  assert.equal(backtestModelLabel(linked(),[w]),'Renamed');
});
test('name-only historical trades stay unchanged instead of guessing an association',()=>{
  const old=row();assert.deepEqual(presentBacktestEntryModel(old,[workspace('Changed')]),old);
  assert.equal(old.entryModelRef,undefined);
});
test('archived models remain readable; unrelated editing preserves their reference',()=>{
  const w=workspace('Archived rename');w.classification.entryTypes.items[0].archived=true;
  const stored=linked();assert.equal(backtestModelLabel(stored,[w]),'Archived rename');
  assert.deepEqual(selectBacktestModel(stored,w,'Archived rename',undefined),stored);
  assert.throws(()=>selectBacktestModel(stored,w,'Archived rename',{id:'entry-1'}),/definition changed/);
});
test('save strips presentation fields while keeping stable reference and original label snapshots',()=>{
  const stored=linked(),view=presentBacktestEntryModel(stored,[workspace('Changed')]);
  const {metadata}=protectTestTrade({instrument:'EUR/USD'},view);
  assert.equal(metadata.entryType,'With trend');assert.deepEqual(metadata.entryModelRef,stored.entryModelRef);
  assert.equal('_entryModelStored' in metadata,false);assert.equal('_entryModelKey' in metadata,false);
});
test('an older writer cannot silently drop or invalidate an existing local model reference',()=>{
  const current=linked(),next=structuredClone(current);delete next.entryModelRef;
  assert.throws(()=>assertBacktestModelWrite(current,next),/cannot preserve/);
  assert.throws(()=>assertBacktestModelWrite(current,{...current,strategy:'Different'}),/inconsistent/);
  assert.doesNotThrow(()=>assertBacktestModelWrite(current,{...current,context:'Unrelated note'}));
});
test('explicitly clearing the selector removes only its model association',()=>{
  const current=linked(),next=selectBacktestModel(current,workspace(),'');
  assert.equal(next.entryModelRef,null);assert.equal(next.entryType,'');assert.equal(next.pnl,current.pnl);
  assert.doesNotThrow(()=>assertBacktestModelWrite(current,next));
});
test('delta synchronization and JSON recovery retain model references on a second device',()=>{
  const record={...linked(),runId:'run',updatedAt:'2026-11-20T15:00:00Z'};
  const delta=JSON.parse(JSON.stringify({runVersions:[],runs:[],tradeVersions:[{id:record.id,updatedAt:record.updatedAt}],trades:[record]}));
  const received=mergeBacktestDelta({runs:[],trades:[]},delta).trades[0];
  assert.deepEqual(received.entryModelRef,record.entryModelRef);assert.equal(backtestModelLabel(received,[workspace('Latest name')]),'Latest name');
});
test('new links require an explicit loopback, device-only development preview',()=>{
  const env={DEV:true,VITE_BACKTEST_MODEL_LINKS_PREVIEW:'true'};
  assert.equal(backtestModelLinksEnabled(true,env,'127.0.0.1'),true);
  assert.equal(backtestModelLinksEnabled(false,env,'127.0.0.1'),false);
  assert.equal(backtestModelLinksEnabled(true,{...env,DEV:false,PROD:true},'127.0.0.1'),false);
  assert.equal(backtestModelLinksEnabled(true,env,'aaijournal.trade'),false);
});

test('same-named models in different workspaces keep separate analytical groups',()=>{
  const a=linked(),b=selectBacktestModel({...row(),id:'other-trade'},workspace('With trend','other-workspace'),'With trend',{id:'entry-1'});
  const views=[presentBacktestEntryModel(a,[workspace()]),presentBacktestEntryModel(b,[workspace('With trend','other-workspace')])];
  const stats=backtestStats({startingBalance:1000,tradeTarget:20},views);
  assert.equal(stats.models.length,2);assert.notEqual(stats.models[0].id,stats.models[1].id);
  assert.equal(stats.net,20);
});

test('presentation snapshots cannot inject financial fields into a save',()=>{
  const stored=linked(),view=presentBacktestEntryModel(stored,[workspace('Current')]);
  view._entryModelStored.pnl=9999;view._entryModelStored.direction='BUY';
  const raw=rawBacktestEntryModel(view);assert.equal(raw.pnl,10);assert.equal(raw.direction,'SELL');
});

test('legacy model snapshots display the current linked name without rewriting saved rules or history',()=>{
  const stored={...linked(),backtestModelSnapshot:{name:'Earlier label',rules:[{ruleId:'rule',checked:true}]}};
  const before=structuredClone(stored),view=presentBacktestEntryModel(stored,[workspace('Current label')]);
  assert.equal(view.backtestModelSnapshot.name,'Current label');
  assert.deepEqual(view.backtestModelSnapshot.rules,stored.backtestModelSnapshot.rules);
  assert.deepEqual(rawBacktestEntryModel(view),before);assert.deepEqual(stored,before);
});
