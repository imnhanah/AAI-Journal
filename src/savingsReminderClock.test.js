import test from 'node:test';
import assert from 'node:assert/strict';
import { claimSavingsReminder } from './savingsReminderClock.js';
import { reminderMinutes } from './savingsSchedule.js';

const makeStorage=()=>{const data=new Map();return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)};};
const options=(storage,minute=0,extra={})=>({storage,key:'user:journal:plan',windowKey:'london-week',saving:{reminderMinutes:20},now:new Date(Date.UTC(2026,9,9,12,minute)),...extra});

test('custom timer survives reload and page changes without an extra alert',()=>{
  const storage=makeStorage();
  assert.equal(claimSavingsReminder(options(storage)),true);
  assert.equal(claimSavingsReminder(options(storage,1)),false);
  assert.equal(claimSavingsReminder(options(storage,19)),false);
  assert.equal(claimSavingsReminder(options(storage,20)),true);
  assert.equal(claimSavingsReminder(options(storage,21)),false);
});
test('a reload when genuinely overdue emits one consolidated reminder',()=>{
  const storage=makeStorage();
  claimSavingsReminder(options(storage));
  assert.equal(claimSavingsReminder(options(storage,59)),true);
  assert.equal(claimSavingsReminder(options(storage,59)),false);
});
test('new plans and separate users have independent immediate checks',()=>{
  const storage=makeStorage();
  claimSavingsReminder(options(storage));
  assert.equal(claimSavingsReminder(options(storage,1,{key:'user:journal:new-plan'})),true);
  assert.equal(claimSavingsReminder(options(storage,1,{key:'other-user:journal:plan'})),true);
});
test('London window reset is independent from prior reminder timestamps',()=>{
  const storage=makeStorage();
  claimSavingsReminder(options(storage));
  assert.equal(claimSavingsReminder(options(storage,1,{windowKey:'next-london-week'})),true);
});
test('custom duration changes use the saved last display and validate input',()=>{
  const storage=makeStorage();
  claimSavingsReminder(options(storage));
  assert.equal(claimSavingsReminder(options(storage,10,{saving:{reminderMinutes:7}})),true);
  assert.equal(reminderMinutes({reminderMinutes:37}),37);
  for(const value of ['',0,-1,1.5,10081,Infinity])assert.equal(reminderMinutes({reminderMinutes:value}),30);
});
test('unavailable storage falls back to the session clock without throwing',()=>{
  const storage={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}};
  const fallback=new Map();
  assert.equal(claimSavingsReminder(options(storage,0,{fallback})),true);
  assert.equal(claimSavingsReminder(options(storage,1,{fallback})),false);
});
