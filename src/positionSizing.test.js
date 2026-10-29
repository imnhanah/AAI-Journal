import test from 'node:test';
import assert from 'node:assert/strict';
import { calculatePositionSize, getInstrumentSpec } from './positionSizing.js';
import { DEFAULT_INSTRUMENTS } from './instrumentCatalog.js';

const calculate = input => calculatePositionSize({ accountCurrency:'USD', riskAmount:100, ...input });

test('every built-in journal instrument has a distinct sizing specification', () => {
  for (const instrument of DEFAULT_INSTRUMENTS) assert.ok(getInstrumentSpec(instrument).spec, instrument);
});

test('sizes EURUSD standard lot at one lot for $100 risk and 10 pip stop', () => {
  const result = calculate({ instrument:'EUR/USD', entryPrice:1.1, stopLossPrice:1.099 });
  assert.equal(result.ok, true); assert.equal(result.volume, 1); assert.equal(Number(result.actualRisk.toFixed(2)), 100);
});
test('requires a live conversion rate for AUDJPY on a USD account', () => {
  const missing = calculate({ instrument:'AUD/JPY', entryPrice:100, stopLossDistance:10, distanceUnit:'pips' });
  assert.equal(missing.ok, false); assert.match(missing.error, /JPY\/USD conversion rate/);
  const result = calculate({ instrument:'AUD/JPY', entryPrice:100, stopLossDistance:10, distanceUnit:'pips', conversionRates:{ JPYUSD:{ rate:0.0065, updatedAt:new Date().toISOString() } } });
  assert.equal(result.ok, true); assert.equal(result.volume, 1.53); assert.equal(Number(result.actualRisk.toFixed(2)), 99.45);
});
test('calculates directly when a JPY account trades AUDJPY', () => {
  const result = calculate({ instrument:'AUD/JPY', accountCurrency:'JPY', riskAmount:10000, entryPrice:100, stopLossDistance:10, distanceUnit:'pips' });
  assert.equal(result.ok, true); assert.equal(result.volume, 1); assert.equal(Number(result.actualRisk.toFixed(2)), 10000);
});
test('requires a manual USD-to-EUR rate for EUR account trading EURUSD', () => {
  const missing = calculate({ instrument:'EUR/USD', accountCurrency:'EUR', riskAmount:100, entryPrice:1.25, stopLossDistance:10, distanceUnit:'pips' });
  assert.equal(missing.ok, false); assert.equal(missing.conversionRequired, 'USD/EUR');
  const result = calculate({ instrument:'EUR/USD', accountCurrency:'EUR', riskAmount:100, entryPrice:1.25, stopLossDistance:10, distanceUnit:'pips', conversionRates:{ USDEUR:{rate:0.8,updatedAt:new Date().toISOString(),source:'manual trade entry'} } });
  assert.equal(result.ok, true); assert.equal(result.volume, 1.25); assert.equal(Number(result.actualRisk.toFixed(2)), 100);
});
test('uses explicit commodity and crypto specifications rather than forex pip values', () => {
  const gold = calculate({ instrument:'XAU/USD', entryPrice:2300, stopLossPrice:2290 });
  assert.equal(gold.ok, true); assert.equal(gold.volume, 0.1); assert.equal(gold.actualRisk, 100);
  const bitcoin = calculate({ instrument:'BTC/USD', entryPrice:60000, stopLossPrice:59000 });
  assert.equal(bitcoin.ok, true); assert.equal(bitcoin.volume, 0.1); assert.equal(bitcoin.actualRisk, 100);
});
test('supports silver, oil and indices with their individual tick specifications', () => {
  const silver = calculate({ instrument:'XAG/USD', entryPrice:30, stopLossPrice:29.98 });
  assert.equal(silver.ok, true); assert.equal(silver.volume, 1); assert.equal(Number(silver.actualRisk.toFixed(2)), 100);
  const oil = calculate({ instrument:'USOIL', entryPrice:80, stopLossPrice:79.9 });
  assert.equal(oil.ok, true); assert.equal(oil.volume, 1); assert.equal(Number(oil.actualRisk.toFixed(2)), 100);
  const index = calculate({ instrument:'US30', entryPrice:39000, stopLossPrice:38990 });
  assert.equal(index.ok, true); assert.equal(index.volume, 10); assert.equal(index.actualRisk, 100);
  const indexByTicks = calculate({ instrument:'US30', stopLossDistance:10, distanceUnit:'ticks' });
  assert.equal(indexByTicks.ok, true); assert.equal(indexByTicks.volume, 10);
});
test('handles a cross with a supplied account conversion rate and rounds down safely', () => {
  const result = calculate({ instrument:'EUR/GBP', entryPrice:0.85, stopLossDistance:13, distanceUnit:'pips', conversionRates:{ GBPUSD:{rate:1.25,updatedAt:new Date().toISOString()} } });
  assert.equal(result.ok, true); assert.equal(result.volume, 0.61);
  assert.ok(result.actualRisk <= 100);
  assert.equal(Number(result.actualRisk.toFixed(2)), 99.13);
});
test('supports forex exotics when the required conversion is current', () => {
  const result = calculate({ instrument:'USDZAR', entryPrice:18, stopLossDistance:100, distanceUnit:'pips', conversionRates:{ ZARUSD:{rate:1 / 18,updatedAt:new Date().toISOString()} } });
  assert.equal(result.ok, true); assert.ok(result.volume > 0); assert.ok(result.actualRisk <= 100);
});
test('respects custom broker contract, volume step and actual rounded risk', () => {
  const result = calculate({ instrument:'US30', entryPrice:39000, stopLossPrice:38990, specifications:{ US30:{ contractSize:2, tickSize:1, volumeMin:0.1, volumeMax:10, volumeStep:0.1, profitCurrency:'USD', volumeUnit:'lots', brokerVerified:true } } });
  assert.equal(result.ok, true); assert.equal(result.volume, 5); assert.equal(result.actualRisk, 100);
});
test('warns rather than oversizing when minimum volume exceeds risk', () => {
  const result = calculate({ instrument:'XAU/USD', entryPrice:2300, stopLossPrice:2200, riskAmount:5 });
  assert.equal(result.ok, false); assert.match(result.error, /minimum/);
});
test('rejects stale conversion rates and unknown specifications', () => {
  const stale = calculate({ instrument:'GER40', entryPrice:18000, stopLossPrice:17990, conversionRates:{ EURUSD:{ rate:1.1, updatedAt:'2020-01-01T00:00:00.000Z' } } });
  assert.equal(stale.ok, false); assert.match(stale.error, /stale/);
  const unknown = calculate({ instrument:'CUSTOMXYZ', entryPrice:10, stopLossPrice:9 });
  assert.equal(unknown.ok, false); assert.match(unknown.error, /Missing instrument specification/);
});
test('does not size invalid or missing price stops', () => {
  const missing = calculate({ instrument:'EUR/USD', entryPrice:1.1, stopLossPrice:'' });
  assert.equal(missing.ok, false); assert.match(missing.error, /valid entry and stop loss/);
  const invalid = calculate({ instrument:'EUR/USD', entryPrice:1.1, stopLossPrice:1.1 });
  assert.equal(invalid.ok, false); assert.match(invalid.error, /valid entry and stop loss/);
});
