import assert from 'node:assert/strict';
import test from 'node:test';
import {matchBrokerTrades} from './brokerImportPlan.js';

const position = (id, closeTime) => {
  const key = `ctrader:EUR/USD:BUY:2026-11-17 ${closeTime}:00:18`;
  return {
    id, importKey:key, context:`Imported cTrader position #${key} [close-only]`,
    asset:'EUR/USD', direction:'BUY', date:'2026-11-17', time:'',
    closeDate:'2026-11-17', closeTime, pnl:18, openingTimestampMissing:true,
  };
};
const stored = ({importKey, ...trade}) => trade;
const match = (existing, incoming) => matchBrokerTrades(existing, incoming, null, trade => !!trade.importHasEvidence);

test('cTrader same-day positions retain separate broker identities after reload', () => {
  const first = position('first','09:30');
  const second = position('second','15:30');
  const result = match([stored(first),stored(second)],[first,second,position('third','17:30')]);
  assert.deepEqual(result.unique.map(trade => trade.id),['third']);
  assert.deepEqual(result.duplicates,[]);
});

test('matching copies with their own evidence or review are preserved', () => {
  const original=stored(position('original','09:30'));
  const reviewed={...original,id:'reviewed',importHasReview:true};
  const evidence={...original,id:'evidence',importHasEvidence:true};
  assert.deepEqual(match([original,reviewed,evidence],[]).duplicates.map(trade=>trade.id),['original']);
});

test('an imported timing repair preserves a manual opening time', () => {
  const incoming=position('incoming','09:30');
  const saved={...stored(incoming),id:'original',time:'07:45',closeDate:'',
    context:incoming.context.replace('[close-only]','[opening-time:manual]')};
  const result=match([saved],[incoming]);
  assert.equal(result.unique.length,0);
  assert.equal(result.importedTradeUpdates[0].time,'07:45');
  assert.match(result.importedTradeUpdates[0].context,/\[opening-time:manual\]/);
});
