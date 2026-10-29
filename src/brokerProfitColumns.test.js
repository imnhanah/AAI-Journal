import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {brokerProfitValues} from './brokerProfitColumns.js';

test('stop-loss before profit never supplies the P&L',()=>{
  assert.deepEqual(brokerProfitValues(['stoploss','takeprofit','profit'],['1.12048','1.11578','-4.8']),{net:'',gross:'-4.8'});
});
test('net columns take priority and currency-qualified columns are supported',()=>{
  assert.deepEqual(brokerProfitValues(['profit','netusd'],['20','-3.06']),{net:'-3.06',gross:'20'});
  assert.deepEqual(brokerProfitValues(['stoplossprice','grossprofitusd'],['1.12','-4.8']),{net:'',gross:'-4.8'});
  assert.deepEqual(brokerProfitValues(['netpercentage','stoploss','takeprofit'],['12','1.12','1.15']),{net:'',gross:''});
});

// Exercise the actual parser without mounting React or touching journal storage.
const source=readFileSync(new URL('./TradingJournal.jsx',import.meta.url),'utf8');
const parserSource=source.slice(source.indexOf('const importNumber ='),source.indexOf('const normaliseImportHeader ='));
const sandbox={brokerProfitValues,uid:()=> 'test',entrySessionFromOpenTime:()=> 'London'};
vm.runInNewContext(`${parserSource};this.parse=parseBrokerTrades;`,sandbox);
test('broker CSV with empty fees imports the loss, prices and timestamps correctly',()=>{
  const csv='ticket,opening_time_utc,closing_time_utc,type,lots,original_position_size,symbol,opening_price,closing_price,stop_loss,take_profit,commission,swap,profit,equity,margin_level,close_reason\n1,2026-10-07T14:57:34,2026-10-07T15:13:50,sell,0.05,0.05,EURUSD,1.11938,1.12034,1.12048,1.11578,,,-4.8,,,user';
  const [trade]=sandbox.parse(csv);
  assert.equal(trade.pnl,-4.8);assert.equal(trade.grossPnl,-4.8);assert.equal(trade.rr,-1);
  assert.equal(trade.entryPrice,1.11938);assert.equal(trade.exitPrice,1.12034);
  assert.equal(trade.commission,0);assert.equal(trade.swap,0);
  assert.equal(trade.time,'14:57');assert.equal(trade.closeTime,'15:13');
});
test('explicit net zero stays zero and gross results retain signed fees',()=>{
  assert.equal(sandbox.parse('symbol,type,opening_time_utc,closing_time_utc,profit,net\nEURUSD,buy,2026-10-07T10:00,2026-10-07T11:00,20,0')[0].pnl,0);
  assert.equal(sandbox.parse('symbol,type,opening_time_utc,closing_time_utc,stop_loss,profit,commission,swap\nEURUSD,sell,2026-10-07T10:00,2026-10-07T11:00,1.12,-4.8,-0.2,-0.1')[0].pnl,-5.1);
});
