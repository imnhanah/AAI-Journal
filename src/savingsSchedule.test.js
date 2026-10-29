import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { savingsAllocation, savingsReminderDue, savingsReminderScheduledAt, londonSavingsWindow, reminderMinutes, shouldRepeatReminder } from './savingsSchedule.js';

const saving = { id:'s', allocationPct:10, interval:'Weekly' };
const trade = (pnl, date='2026-10-08') => ({ pnl, date, closeDate:date });
const movement = (type, amount, date='2026-10-09', extra={}) => ({ type, amount, date, source:'trading', savingsAccountId:'s', ...extra });
const account = (trades=[trade(1000)], financeMovements=[]) => ({ balance:10000, trades, financeMovements });

test('deposits and both kinds of withdrawals leave earned profit unchanged', () => {
  const result = savingsAllocation(account(undefined,[movement('deposit',100),movement('withdrawal',20),movement('withdrawal',30,undefined,{source:'savings'})]),saving);
  assert.equal(result.profit,1000); assert.equal(result.remaining,100);
});
test('partial transfers leave a remainder; full percentage starts a new cycle', () => {
  assert.equal(savingsAllocation(account(undefined,[movement('transfer',20)]),saving).remaining,80);
  assert.equal(savingsAllocation(account(undefined,[movement('transfer',20),movement('transfer',80)]),saving).remaining,0);
  const result = savingsAllocation(account([trade(1000),trade(500,'2026-10-10')],[movement('transfer',100)]),saving);
  assert.equal(result.profit,500); assert.equal(result.remaining,50);
});
test('losses, open trades, unrelated transfers and deleted transfers replay correctly', () => {
  assert.equal(savingsAllocation(account([trade(1000),trade(-200),{pnl:900,status:'open'}],[movement('transfer',100,undefined,{savingsAccountId:'other'})]),saving).remaining,80);
  assert.equal(savingsAllocation(account(),saving).remaining,100);
});
test('multiple account savings use only their owner results', () => {
  const a={workspaceType:'multi_balance',balances:[{id:'a',isActive:true},{id:'b',isActive:true}],trades:[{date:'2026-10-08',closeDate:'2026-10-08',balanceResults:[{balanceId:'a',netPnl:1000},{balanceId:'b',netPnl:2000}]}],financeMovements:[movement('transfer',20,undefined,{balanceId:'b'})]};
  assert.equal(savingsAllocation(a,{...saving,balanceId:'a'}).remaining,80);
  assert.equal(savingsAllocation(a,{...saving,id:'other',balanceId:'b'}).remaining,200);
});
test('London reset handles BST, GMT, and Monday before the open', () => {
  assert.equal(londonSavingsWindow(new Date('2026-10-12T07:00:00Z')).toISOString(),'2026-10-12T07:00:00.000Z');
  assert.equal(londonSavingsWindow(new Date('2026-10-12T06:59:00Z')).toISOString(),'2026-10-05T07:00:00.000Z');
  assert.equal(londonSavingsWindow(new Date('2026-10-26T08:00:00Z')).toISOString(),'2026-10-26T08:00:00.000Z');
});
test('weekly and manual begin at the New York Forex open and expire at the London reset', () => {
  for(const interval of ['Weekly','Manual']) {
    const s={...saving,interval};
    assert.equal(savingsReminderDue(s,new Date('2026-10-09T11:59:00Z')),false);
    assert.equal(savingsReminderDue(s,new Date('2026-10-09T12:00:00Z')),true);
    assert.equal(savingsReminderDue(s,new Date('2026-10-11T20:00:00Z')),true);
    assert.equal(savingsReminderDue(s,new Date('2026-10-12T07:00:00Z')),false);
  }
});
test('15th and 28th schedules start at the New York Forex open, not month end', () => {
  assert.equal(savingsReminderDue({...saving,interval:'Bi-weekly'},new Date('2026-10-15T12:00:00Z')),true);
  assert.equal(savingsReminderDue({...saving,interval:'Monthly'},new Date('2026-10-28T11:59:00Z')),false);
  assert.equal(savingsReminderDue({...saving,interval:'Monthly'},new Date('2026-10-28T12:00:00Z')),true);
});
test('New York 08:00 resolves through daylight saving time independently of device timezone', () => {
  const weekly = { interval:'Weekly' };
  const summerNow = new Date('2026-10-09T12:00:00Z'); // 08:00 EDT
  const winterNow = new Date('2026-01-09T13:00:00Z'); // 08:00 EST
  assert.equal(savingsReminderScheduledAt(weekly, summerNow).toISOString(), '2026-10-09T12:00:00.000Z');
  assert.equal(savingsReminderScheduledAt(weekly, winterNow).toISOString(), '2026-01-09T13:00:00.000Z');
  assert.equal(savingsReminderScheduledAt(weekly, new Date('2026-03-13T11:00:00Z')).toISOString(), '2026-03-06T13:00:00.000Z');
  assert.equal(savingsReminderDue(weekly, new Date('2026-01-09T12:59:59Z')), false);
  assert.equal(savingsReminderDue(weekly, winterNow), true);

  const moduleUrl = new URL('./savingsSchedule.js', import.meta.url).href;
  const script = `import {savingsReminderScheduledAt} from ${JSON.stringify(moduleUrl)}; console.log(savingsReminderScheduledAt({interval:'Weekly'},new Date('2026-01-09T13:00:00Z')).toISOString())`;
  for (const TZ of ['Africa/Accra', 'Asia/Tokyo', 'America/Los_Angeles']) {
    const output = execFileSync(process.execPath, ['--input-type=module', '-e', script], { env:{ ...process.env, TZ } }).toString().trim();
    assert.equal(output, '2026-01-09T13:00:00.000Z', `device timezone ${TZ}`);
  }
});
test('new plan can alert immediately outside scheduled hours; creation override expires', () => {
  const s={...saving,interval:'Monthly',createdAt:'2026-10-10T09:00:00Z'};
  assert.equal(savingsReminderDue(s,new Date('2026-10-10T09:01:00Z')),true);
  assert.equal(savingsReminderDue(s,new Date('2026-10-12T07:00:00Z')),false);
});
test('repeat interval defaults to 30 minutes and accepts chosen intervals', () => {
  assert.equal(reminderMinutes({}),30); assert.equal(reminderMinutes({reminderMinutes:15}),15);
  assert.equal(reminderMinutes({reminderMinutes:30}),30); assert.equal(reminderMinutes({reminderMinutes:-1}),30);
});

test('repeat eligibility uses last display; a brand-new plan has no display time', () => {
  const last = new Date('2026-10-09T12:00:00Z').getTime();
  const s={...saving,reminderMinutes:15};
  assert.equal(shouldRepeatReminder(s,last,new Date('2026-10-09T12:14:59Z')),false);
  assert.equal(shouldRepeatReminder(s,last,new Date('2026-10-09T12:15:00Z')),true);
  assert.equal(shouldRepeatReminder(s,undefined,new Date('2026-10-09T12:01:00Z')),true);
});

test('a contribution before any earnings does not prepay future profit', () => {
  assert.equal(savingsAllocation(account([trade(1000,'2026-10-10')],[movement('transfer',100)]),saving).remaining,100);
});
