import test from 'node:test';
import assert from 'node:assert/strict';
import {loadRecoveryAccountMedia} from './cloudRecoveryAccountMedia.js';

const owner='synthetic-owner';
const image='data:image/png;base64,original';
const rows=[{id:'a',profile_image:image,updated_at:'v1'},{id:'b',profile_image:null,updated_at:'v2'}];
const accounts=[{id:'b',name:'Second',trades:[]},{id:'a',name:'First',profileImage:'',trades:[{id:'trade'}]}];
const versions=rows.map(({id,updated_at})=>({id,updated_at}));
function transport(records,{cap=500,fail=false,page}={}) {
  const calls=[];
  return {calls,from(table){
    assert.equal(table,'accounts');
    const filters={};
    const request={
      select(value){assert.equal(value,'id,profile_image,updated_at');return request;},
      eq(key,value){assert.equal(key,'user_id');assert.equal(value,owner);return request;},
      order(key,options){assert.equal(key,'id');assert.deepEqual(options,{ascending:true});return request;},
      limit(value){assert.equal(value,500);return request;},
      gt(key,value){assert.equal(key,'id');filters.after=value;return request;},
      then(resolve,reject){calls.push({...filters});const data=page? page(calls.length,filters) : records.filter(row=>!filters.after||row.id>filters.after).slice(0,cap);return Promise.resolve(fail?{error:{message:'Synthetic failure'}}:{data,error:null}).then(resolve,reject);},
    };
    return request;
  }};
}
const read=(cloud,extra={})=>loadRecoveryAccountMedia({cloud,userId:owner,accounts,versions,assertSession:()=>{},...extra});

test('cloud recovery hydrates only account image fields and preserves source order and original data',async()=>{
  const original=structuredClone(accounts),source=structuredClone(rows),cloud=transport(rows);
  assert.deepEqual(await read(cloud),[{...accounts[0],profileImage:''},{...accounts[1],profileImage:image}]);
  assert.deepEqual(accounts,original);assert.deepEqual(rows,source);
  assert.deepEqual(cloud.calls,[{}, {after:'b'}]);
});
test('account recovery follows keyset pages even when a service row cap is below the requested size',async()=>{
  const cloud=transport(rows,{cap:1});
  assert.equal((await read(cloud))[1].profileImage,image);
  assert.deepEqual(cloud.calls,[{}, {after:'a'}, {after:'b'}]);
});
test('empty cloud accounts recover cleanly after a confirmed empty owner-scoped page',async()=>{
  const cloud=transport([]);
  assert.deepEqual(await read(cloud,{accounts:[],versions:[]}),[]);assert.equal(cloud.calls.length,1);
});
test('account additions, removals, or revision changes abort recovery instead of silently losing images',async()=>{
  for(const records of [rows.slice(0,1),[...rows,{id:'c',profile_image:image,updated_at:'v3'}],[{...rows[0],updated_at:'new'},rows[1]]]) {
    await assert.rejects(read(transport(records)),/Accounts changed during recovery/);
  }
});
test('missing metadata, malformed pages, and unadvancing cursors cannot produce a success',async()=>{
  await assert.rejects(read(transport(rows),{versions:[]}),/metadata is incomplete/);
  for(const records of [[{id:'a',updated_at:'v1'}],[{id:'a',profile_image:{unexpected:true},updated_at:'v1'}]])await assert.rejects(read(transport(records)),/incomplete page/);
  await assert.rejects(read(transport(rows,{page:()=>[rows[0]]})),/incomplete page/);
  await assert.rejects(read(transport(rows,{page:()=>null})),/Could not read account images/);
});
test('network failure aborts export and a later retry still recovers the originals',async()=>{
  await assert.rejects(read(transport(rows,{fail:true})),/Could not read account images/);
  assert.equal((await read(transport(rows)))[1].profileImage,image);
});
test('account switching during the image read invalidates the whole recovery',async()=>{
  let checks=0;
  await assert.rejects(read(transport(rows),{assertSession:()=>{checks++;if(checks===3)throw new Error('Account changed during recovery');}}),/Account changed during recovery/);
});
