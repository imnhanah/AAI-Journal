import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {parse} from '@babel/parser';

function overlay(file, className) {
 const source=readFileSync(new URL(file,import.meta.url),'utf8');
 let found;
 function visit(node) {
  if(!node || typeof node!=='object')return;
  if(node.type==='JSXOpeningElement') {
   const classAttribute=node.attributes.find(attr=>attr.name?.name==='className');
   if(classAttribute && source.slice(classAttribute.start,classAttribute.end).includes(className))found=node;
  }
  for(const [key,value] of Object.entries(node))if(key!=='loc') {
   if(Array.isArray(value))value.forEach(visit);else if(value&&typeof value==='object')visit(value);
  }
 }
 visit(parse(source,{sourceType:'module',plugins:['jsx']}));
 assert.ok(found,`${file}: overlay exists`);
 const handler=found.attributes.find(attr=>attr.name?.name==='onMouseDown')?.value?.expression;
 return handler ? source.slice(handler.start,handler.end) : null;
}

test('shared page popups close for backdrop clicks, never clicks within their contents',()=>{
 const code=overlay('./TradingJournal.jsx','tj-modal-overlay ${centered');
 let closed=0;
 const handler=runInNewContext(`(${code})`,{onClose:()=>closed++});
 const backdrop={};handler({target:{},currentTarget:backdrop});assert.equal(closed,0);
 handler({target:backdrop,currentTarget:backdrop});assert.equal(closed,1);
});
test('Routine has no backdrop dismissal handler',()=>{
 assert.equal(overlay('./DailyRoutine.jsx','tj-routine-overlay'),null);
});
test('Challenge setup dismisses only outside, and not while saving or deleting',()=>{
 const code=overlay('./ChallengeLifecyclePage.jsx','tj-modal-overlay tj-modal-overlay-centered');
 const backdrop={};
 for(const [savingSetup,deleting] of [[false,false],[true,false],[false,true]]) {
  let closed=0;
  const handler=runInNewContext(`(${code})`,{savingSetup,deleting,setSetup:value=>{assert.equal(value,null);closed++;}});
  handler({target:{},currentTarget:backdrop});assert.equal(closed,0);
  handler({target:backdrop,currentTarget:backdrop});assert.equal(closed,savingSetup||deleting?0:1);
 }
});
test('workspace confirmation backdrop dismissal is identical on phone and desktop',()=>{
 const code=overlay('./SettingsDangerZone.jsx','tj-settings-danger-overlay');
 const backdrop={};
 for(const phone of [false,true]) {
  let closed=0;
  const handler=runInNewContext(`(${code})`,{phone,close:()=>closed++});
  handler({target:{},currentTarget:backdrop});assert.equal(closed,0);
  handler({target:backdrop,currentTarget:backdrop});assert.equal(closed,1);
 }
 const source=readFileSync(new URL('./SettingsDangerZone.jsx',import.meta.url),'utf8');
 assert.match(source,/const close = \(\) => \{if \(!inFlight.current\) setAction\(null\);\}/);
});
