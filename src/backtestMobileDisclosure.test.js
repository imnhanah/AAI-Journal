import test from 'node:test';
import assert from 'node:assert/strict';
import {backtestMobileDisclosureKey,mobileDefaultExpandedRunId,readBacktestMobileDisclosure,writeBacktestMobileDisclosure} from './backtestMobileDisclosure.js';

const storage = () => { const values=new Map(); return {getItem:key=>values.has(key)?values.get(key):null,setItem:(key,value)=>values.set(key,value)}; };
const stats = run => ({status:run.status});

test('mobile Strategy Testing expands only the newest active run when no manual preference exists',()=>{
 const runs=[{id:'ready',status:'Ready',updatedAt:'2026-11-01T10:00:00Z'},{id:'older',status:'In progress',updatedAt:'2026-11-01T09:00:00Z'},{id:'newer',status:'In progress',updatedAt:'2026-11-01T11:00:00Z'}];
 assert.equal(mobileDefaultExpandedRunId(runs,stats), 'newer');
 assert.equal(mobileDefaultExpandedRunId(runs,stats,'older'), 'older');
 assert.equal(mobileDefaultExpandedRunId([{id:'ready',status:'Ready'}],stats), null);
});

test('mobile Strategy Testing disclosure preferences persist explicit choices per profile only',()=>{
 const device=storage();
 assert.deepEqual(readBacktestMobileDisclosure('one',device),{manual:false,expanded:{},lastOpenedId:null});
 writeBacktestMobileDisclosure('one',{manual:true,expanded:{one:false,two:true},lastOpenedId:'two'},device);
 assert.deepEqual(readBacktestMobileDisclosure('one',device),{manual:true,expanded:{one:false,two:true},lastOpenedId:'two'});
 assert.deepEqual(readBacktestMobileDisclosure('two',device),{manual:false,expanded:{},lastOpenedId:null});
 assert.notEqual(backtestMobileDisclosureKey('one'),backtestMobileDisclosureKey('two'));
});
