import test from 'node:test';
import assert from 'node:assert/strict';
import {loadRevisionedImage} from './journalImageLoader.js';
const ref = extra => 'tj-image:'+JSON.stringify({user:'u',table:'premarket_markups',id:'m',path:['preM15','0'],version:'old',...extra});
test('current screenshots load without refreshing metadata', async () => {
  assert.equal(await loadRevisionedImage(ref(),{readImage:async()=> 'data:image/png;base64,ok',refreshMetadata:()=>{throw Error('unexpected refresh');}}),'data:image/png;base64,ok');
});
test('review save revision change recovers the original image through fresh metadata', async () => {
  const versions=[];
  assert.equal(await loadRevisionedImage(ref(),{readImage:async r=>{versions.push(r.version);return r.version==='new'?'data:image/png;base64,ok':null;},refreshMetadata:async()=>({premarket_markups:[{id:'m',screenshots:{preM15:[ref({version:'new'})]}}]})}),'data:image/png;base64,ok');
  assert.deepEqual(versions,['old','new']);
});
test('deleted screenshots, unchanged revisions and wrong owners never fall back to unrelated images', async () => {
  for(const source of [undefined,ref(),ref({version:'new',user:'other'}),ref({version:'new',id:'other'}),ref({version:'new',path:['postM15','0']})]){
    await assert.rejects(loadRevisionedImage(ref(),{readImage:async()=>null,refreshMetadata:async()=>({premarket_markups:[{id:'m',screenshots:{preM15:[source]}}]})}),/unavailable/);
  }
});
test('network/authentication failures propagate without unsafe fallback', async () => {
  await assert.rejects(loadRevisionedImage(ref(),{readImage:async()=>{throw Error('Sign in again');},refreshMetadata:()=>{throw Error('unexpected refresh');}}),/Sign in again/);
  assert.equal(await loadRevisionedImage('data:image/png;base64,local',{}),'data:image/png;base64,local');
});
