import test from 'node:test';
import assert from 'node:assert/strict';
import {entryDefinitionPosition} from './entryDefinitionPosition.js';

test('long definitions fit the short desktop viewport that previously clipped them',()=>{
  const p=entryDefinitionPosition({top:371,bottom:395,right:1237},{left:0,top:0,width:1280,height:600},2103);
  assert.equal(p.width,400);
  assert.ok(p.top>=12&&p.top+340<=588);
  assert.ok(p.left+p.width<=1268);
  assert.ok(p.top<371);
});
test('phone definitions use available width without horizontal overflow',()=>{
  const p=entryDefinitionPosition({top:310,bottom:342,right:365},{left:0,top:0,width:390,height:844},279);
  assert.equal(p.width,366);
  assert.equal(p.left,12);
  assert.equal(p.top,350);
});
test('keyboard and zoom viewport offsets bound the entire panel',()=>{
  const v={left:80,top:160,width:320,height:250};
  const p=entryDefinitionPosition({top:310,bottom:342,right:390},v,900);
  assert.equal(p.width,296);
  assert.equal(p.maxHeight,226);
  assert.ok(p.top>=172&&p.top+p.maxHeight<=398);
  assert.ok(p.left>=92&&p.left+p.width<=388);
});
test('compact definitions stay near their trigger when there is room',()=>{
  const p=entryDefinitionPosition({top:180,bottom:204,right:1000},{left:0,top:0,width:1440,height:1000},254);
  assert.equal(p.top,212);
  assert.equal(p.left,600);
  assert.equal(p.width,400);
});
