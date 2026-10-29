import test from 'node:test';
import assert from 'node:assert/strict';
import {journalSignal} from './journalSignals.js';
test('empty pages ask for evidence',()=>{for(const page of ['dashboard','tradelog','reviews'])assert.match(journalSignal({page}).detail,/needs evidence/);});
test('dashboard guardrail takes priority',()=>assert.match(journalSignal({page:'dashboard',trades:[{id:'a'}],guardrails:{tradeEntryLocked:true}}).title,/loss limit/));
test('reviews ignore unrelated reviews',()=>assert.match(journalSignal({page:'reviews',trades:[{id:'a'}],reviews:[{tradeId:'b'}]}).detail,/no saved review/));
test('complete reviews respond immediately',()=>assert.match(journalSignal({page:'reviews',trades:[{id:'a'}],reviews:[{tradeId:'a'}]}).title,/up to date/));
test('timing gaps are reported',()=>assert.match(journalSignal({page:'tradelog',trades:[{id:'a',time:'09:30'}]}).detail,/lack full open or close timing/));
test('incomplete markups direct the trader to complete planning evidence',()=>assert.match(journalSignal({page:'markups',markups:[{structure:'Plan'}]}).detail,/missing plan notes or chart captures/));
test('calendar only counts selected month',()=>assert.match(journalSignal({page:'calendar',monthCursor:new Date(2026,8,1),trades:[{date:'2026-08-01',pnl:10}]}).detail,/No trades/));
test('challenge does not claim progress before loading',()=>assert.match(journalSignal({page:'challenge',challenge:{loading:true}}).detail,/loading/));
test('challenge responds to setbacks',()=>assert.match(journalSignal({page:'challenge',challenge:{statuses:{1:'Pass',2:'Step back'}}}).detail,/Some levels are marked Step back/));
test('context messages do not expose numeric values',()=>{
  const examples = [
    journalSignal({page:'dashboard',trades:[{id:'a',pnl:10,mistakes:['late']}]}),
    journalSignal({page:'calendar',monthCursor:new Date(2026,8,1),trades:[{id:'a',date:'2026-09-02',pnl:10}]}),
    journalSignal({page:'analytics',trades:[{id:'a',date:'2026-09-02',time:'09:00',closeDate:'2026-09-02',closeTime:'10:00',mistakes:['late']}]}),
    journalSignal({page:'challenge',challenge:{statuses:{1:'Pass',2:'Step back'}}}),
  ];
  for (const message of examples) assert.doesNotMatch(`${message.title} ${message.subtitle} ${message.detail}`,/\d/);
});
