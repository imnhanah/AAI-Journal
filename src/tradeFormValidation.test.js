import test from 'node:test';
import assert from 'node:assert/strict';
import { validateTradeForm } from './tradeFormValidation.js';

const base = { asset:'EUR/USD', direction:'BUY', date:'2026-10-30', time:'16:00', closeDate:'2026-10-30', closeTime:'16:30', grossPnl:'0', commission:'0', swap:'0', calculationMethod:'pips', stopLossPips:'10', exitPips:'0', balanceResults:[] };
const validate = (form, options={}) => validateTradeForm({ form:{...base,...form}, accountId:'account', isRunning:false, realizedR:0, ...options });

test('running trades permit empty close fields and outcome fields', () => {
  const result = validate({grossPnl:'',closeDate:'',closeTime:'',stopLossPips:'',exitPips:''},{isRunning:true,realizedR:null});
  assert.equal(result.valid,true);
});
test('closed pips trades require stop distance and actual closed pips, while zero is valid', () => {
  assert.match(validate({stopLossPips:'',exitPips:''}).errors.stopLossPips,/stop-loss distance/);
  assert.match(validate({stopLossPips:'10',exitPips:''}).errors.exitPips,/actual closed pips/);
  assert.equal(validate({stopLossPips:'10',exitPips:'0'},{realizedR:0}).valid,true);
  assert.equal(validate({stopLossPips:'10',exitPips:'-10'},{realizedR:-1}).valid,true);
});
test('closed price trades require entry, stop, exit and positive risk distance', () => {
  const missing=validate({calculationMethod:'price',entryPrice:'',stopLossPrice:'',exitPrice:''},{realizedR:null});
  assert.match(missing.errors.entryPrice,/entry price/); assert.match(missing.errors.stopLossPrice,/stop-loss price/); assert.match(missing.errors.exitPrice,/actual exit price/);
  assert.match(validate({calculationMethod:'price',entryPrice:'1.2',stopLossPrice:'1.2',exitPrice:'1.21'},{realizedR:null}).errors.stopLossPrice,/valid risk distance/);
  assert.equal(validate({calculationMethod:'price',entryPrice:'1.2',stopLossPrice:'1.19',exitPrice:'1.21'},{realizedR:1}).valid,true);
});
test('validates open date, account target, and optional numeric fields', () => {
  assert.match(validate({date:''}).errors.date,/valid open date/);
  assert.match(validate({date:'2026-02-30'}).errors.date,/valid open date/);
  assert.match(validate({}, {multiBalance:true,validBalanceIds:['one']}).errors.balanceTargets,/account target/);
  assert.match(validate({commission:'no'}).errors.commission,/valid number/);
});
test('closed trades require close timing and a finite gross P&L, while running trades do not', () => {
  const closed = validate({closeDate:'',closeTime:'',grossPnl:'not-a-number'});
  assert.match(closed.errors.closeDate,/valid close date/);
  assert.match(closed.errors.closeTime,/valid close time/);
  assert.match(closed.errors.grossPnl,/valid Gross P&L/);
  assert.match(validate({closeDate:'2026-10-29',closeTime:'15:00'}).errors.closeTime,/cannot be before/);
  assert.equal(validate({grossPnl:'',closeDate:'',closeTime:''},{isRunning:true,realizedR:null}).valid,true);
});
test('multi-account target values are checked without requiring a shared gross P&L', () => {
  const form = {...base, balanceResults:[{balanceId:'one',grossPnl:'0',commission:'',swap:''}]};
  const valid = validateTradeForm({form,accountId:'account',multiBalance:true,validBalanceIds:['one'],isRunning:false,realizedR:0});
  assert.equal(valid.valid,true);
  const invalid = validateTradeForm({form:{...form,balanceResults:[{...form.balanceResults[0],grossPnl:'bad'}]},accountId:'account',multiBalance:true,validBalanceIds:['one'],isRunning:false,realizedR:0});
  assert.match(invalid.errors.grossPnl,/valid Gross P&L/);
});
test('field errors clear when their source values become valid again', () => {
  const missing = validate({stopLossPips:'',exitPips:''},{realizedR:null});
  assert.ok(missing.errors.stopLossPips);
  assert.ok(missing.errors.exitPips);
  const corrected = validate({stopLossPips:'10',exitPips:'5'},{realizedR:0.5});
  assert.equal(corrected.errors.stopLossPips,undefined);
  assert.equal(corrected.errors.exitPips,undefined);
});
