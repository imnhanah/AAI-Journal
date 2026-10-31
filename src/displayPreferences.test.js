import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normaliseDisplayPreferences, displayMetadata, startOfDisplayWeek, weekStartOffset, displayWeekdays, resolveStartPage, maskMoneyText} from './displayPreferences.js';
import {ownedStoragePaths} from '../supabase/functions/_shared/deleteProfileStorage.js';

test('safe defaults and round-trip metadata for all display controls', () => {
  assert.deepEqual(normaliseDisplayPreferences(), {weekStart:'monday',startPage:'dashboard',hideBalances:false,tradeEntryLayout:'side'});
  const saved = {weekStart:'sunday',startPage:'last',hideBalances:true,tradeEntryLayout:'center'};
  assert.deepEqual(normaliseDisplayPreferences(displayMetadata(saved)), saved);
  assert.equal(resolveStartPage({start_page:'untrusted'},'finance'),'dashboard');
});
test('Sunday and Monday boundaries split a Sunday trade correctly', () => {
  const sunday = new Date(2026, 9, 11, 13);
  assert.equal(startOfDisplayWeek(sunday,'monday').getDate(),5);
  assert.equal(startOfDisplayWeek(sunday,'sunday').getDate(),11);
  assert.equal(weekStartOffset(new Date(2026,9,1),'monday'),3);
  assert.equal(weekStartOffset(new Date(2026,9,1),'sunday'),4);
  assert.equal(displayWeekdays('sunday')[0],'Sun');
  assert.equal(displayWeekdays('monday')[0],'Mon');
  assert.equal(startOfDisplayWeek(new Date(2027,0,1),'monday').getFullYear(),2026);
});
test('saved start page and user-scoped last page safely resolve', () => {
  assert.equal(resolveStartPage({start_page:'analytics'},'markups'),'analytics');
  assert.equal(resolveStartPage({start_page:'last'},'markups'),'markups');
  assert.equal(resolveStartPage({start_page:'last'},'insights'),'psychology');
  assert.equal(resolveStartPage({start_page:'last'},null),'dashboard');
  assert.equal(resolveStartPage({start_page:'finance'},'finance',['dashboard']),'dashboard');
});
test('money masking retains labels, dates and percentages', () => {
  assert.equal(maskMoneyText('Balance +$40,000.00; P&L -€250.50; target £100.00'),'Balance $••••; P&L €••••; target £••••');
  assert.equal(maskMoneyText('10/10/2026 · 20% · 258 trades'),'10/10/2026 · 20% · 258 trades');
  assert.equal(maskMoneyText('GHS 3,000.00'), 'GHS••••');
  assert.equal(maskMoneyText('$••••'), '$••••');
  assert.equal(maskMoneyText('Save $100.00 today'), 'Save $•••• today');
  assert.equal(maskMoneyText('€1\u202f250\u202f000,50 remaining'), '€•••• remaining');
});
test('display changes persist through profile metadata, not financial payloads', () => {
  const auth = readFileSync(new URL('./auth.js',import.meta.url),'utf8');
  assert.match(auth,/data: \{ \.\.\.displayData/);
  const privacy = readFileSync(new URL('./BalancePrivacy.jsx',import.meta.url),'utf8');
  assert.doesNotMatch(privacy,/node\.value\s*=|updateAccount|updateTrade/);
  assert.match(privacy,/MutationObserver/);
  const savings = readFileSync(new URL('./savingsSchedule.js',import.meta.url),'utf8');
  assert.doesNotMatch(savings,/displayPreferences|weekStartOffset/);
  const journal = readFileSync(new URL('./TradingJournal.jsx',import.meta.url),'utf8');
  assert.match(journal,/requestedPage.current \|\| resolveStartPage/);
  assert.match(journal,/if \(pageFromPath\) return pageFromPath/);
});
test('storage cleanup walks folders and pages and rejects spoofed ownership', async () => {
  const pages = { '':[{name:'folder',id:null},{name:'mine',id:'1',owner:'user'},{name:'theirs',id:'2',owner:'other',metadata:{owner:'user'}}], folder:[{name:'nested',id:'3',owner_id:'user'}] };
  const storage = {from:()=>({list:async folder=>({data:pages[folder]})})};
  assert.deepEqual(await ownedStoragePaths(storage,'bucket','user'),['mine','folder/nested']);
  const many = Array.from({length:1001},(_,i)=>({name:`${i}`,id:`id${i}`,owner:'user'}));
  const paged = {from:()=>({list:async (_,options)=>({data:many.slice(options.offset,options.offset+options.limit)})})};
  assert.equal((await ownedStoragePaths(paged,'bucket','user')).length,1001);
  await assert.rejects(ownedStoragePaths({from:()=>({list:async()=>({error:Error('blocked')})})},'bucket','user'));
});
