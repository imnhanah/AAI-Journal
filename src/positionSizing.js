import { normalizeInstrument } from './instrumentCatalog.js';

// These are transparent journal defaults, not broker guarantees. A saved
// account may override any field with broker-provided contract data.
export const DEFAULT_POSITION_SPECS = Object.freeze({
  'XAU/USD': { assetClass:'commodity', contractSize:100, tickSize:0.01, volumeMin:0.01, volumeMax:100, volumeStep:0.01, profitCurrency:'USD', volumeUnit:'lots', brokerVerified:false },
  'XAG/USD': { assetClass:'commodity', contractSize:5000, tickSize:0.001, volumeMin:0.01, volumeMax:100, volumeStep:0.01, profitCurrency:'USD', volumeUnit:'lots', brokerVerified:false },
  'USOIL': { assetClass:'commodity', contractSize:1000, tickSize:0.01, volumeMin:0.01, volumeMax:100, volumeStep:0.01, profitCurrency:'USD', volumeUnit:'lots', brokerVerified:false },
  'UKOIL': { assetClass:'commodity', contractSize:1000, tickSize:0.01, volumeMin:0.01, volumeMax:100, volumeStep:0.01, profitCurrency:'USD', volumeUnit:'lots', brokerVerified:false },
  'NATGAS': { assetClass:'commodity', contractSize:10000, tickSize:0.001, volumeMin:0.01, volumeMax:100, volumeStep:0.01, profitCurrency:'USD', volumeUnit:'lots', brokerVerified:false },
  'US30': { assetClass:'index', contractSize:1, tickSize:1, volumeMin:0.1, volumeMax:100, volumeStep:0.1, profitCurrency:'USD', volumeUnit:'lots', brokerVerified:false },
  'US100': { assetClass:'index', contractSize:1, tickSize:1, volumeMin:0.1, volumeMax:100, volumeStep:0.1, profitCurrency:'USD', volumeUnit:'lots', brokerVerified:false },
  'US500': { assetClass:'index', contractSize:1, tickSize:0.1, volumeMin:0.1, volumeMax:100, volumeStep:0.1, profitCurrency:'USD', volumeUnit:'lots', brokerVerified:false },
  'GER40': { assetClass:'index', contractSize:1, tickSize:1, volumeMin:0.1, volumeMax:100, volumeStep:0.1, profitCurrency:'EUR', volumeUnit:'lots', brokerVerified:false },
  'UK100': { assetClass:'index', contractSize:1, tickSize:1, volumeMin:0.1, volumeMax:100, volumeStep:0.1, profitCurrency:'GBP', volumeUnit:'lots', brokerVerified:false },
  'JP225': { assetClass:'index', contractSize:1, tickSize:1, volumeMin:0.1, volumeMax:100, volumeStep:0.1, profitCurrency:'JPY', volumeUnit:'lots', brokerVerified:false },
  'FRA40': { assetClass:'index', contractSize:1, tickSize:1, volumeMin:0.1, volumeMax:100, volumeStep:0.1, profitCurrency:'EUR', volumeUnit:'lots', brokerVerified:false },
  'EU50': { assetClass:'index', contractSize:1, tickSize:1, volumeMin:0.1, volumeMax:100, volumeStep:0.1, profitCurrency:'EUR', volumeUnit:'lots', brokerVerified:false },
  'AUS200': { assetClass:'index', contractSize:1, tickSize:1, volumeMin:0.1, volumeMax:100, volumeStep:0.1, profitCurrency:'AUD', volumeUnit:'lots', brokerVerified:false },
  'HK50': { assetClass:'index', contractSize:1, tickSize:1, volumeMin:0.1, volumeMax:100, volumeStep:0.1, profitCurrency:'HKD', volumeUnit:'lots', brokerVerified:false },
  'BTC/USD': { assetClass:'crypto', contractSize:1, tickSize:0.01, volumeMin:0.001, volumeMax:100, volumeStep:0.001, profitCurrency:'USD', volumeUnit:'BTC', brokerVerified:false },
  'ETH/USD': { assetClass:'crypto', contractSize:1, tickSize:0.01, volumeMin:0.01, volumeMax:1000, volumeStep:0.01, profitCurrency:'USD', volumeUnit:'ETH', brokerVerified:false },
  'SOL/USD': { assetClass:'crypto', contractSize:1, tickSize:0.01, volumeMin:0.1, volumeMax:100000, volumeStep:0.1, profitCurrency:'USD', volumeUnit:'SOL', brokerVerified:false },
  'XRP/USD': { assetClass:'crypto', contractSize:1, tickSize:0.0001, volumeMin:1, volumeMax:1000000, volumeStep:1, profitCurrency:'USD', volumeUnit:'XRP', brokerVerified:false },
  'BNB/USD': { assetClass:'crypto', contractSize:1, tickSize:0.01, volumeMin:0.01, volumeMax:100000, volumeStep:0.01, profitCurrency:'USD', volumeUnit:'BNB', brokerVerified:false },
  'ADA/USD': { assetClass:'crypto', contractSize:1, tickSize:0.0001, volumeMin:1, volumeMax:1000000, volumeStep:1, profitCurrency:'USD', volumeUnit:'ADA', brokerVerified:false },
});

const FX = new Set(['USD','EUR','GBP','JPY','CHF','CAD','AUD','NZD','ZAR','TRY','MXN','HKD','SGD','NOK','SEK','PLN','CZK','HUF','DKK','GHS']);
const numeric = value => value === '' || value == null ? null : Number.isFinite(Number(value)) ? Number(value) : null;
const compact = value => String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

export function forexSpec(symbol) {
  const normalized = normalizeInstrument(symbol);
  const pair = compact(normalized);
  if (!/^[A-Z]{6}$/.test(pair) || !FX.has(pair.slice(0,3)) || !FX.has(pair.slice(3))) return null;
  const quote = pair.slice(3);
  const jpyStyle = quote === 'JPY';
  return {
    assetClass:'forex', contractSize:100000, pipSize:jpyStyle ? 0.01 : 0.0001,
    tickSize:jpyStyle ? 0.001 : 0.00001, volumeMin:0.01, volumeMax:100,
    volumeStep:0.01, profitCurrency:quote, volumeUnit:'lots', brokerVerified:false,
  };
}

export function getInstrumentSpec(instrument, overrides = {}) {
  const symbol = normalizeInstrument(instrument);
  const override = overrides[symbol] || overrides[compact(symbol)] || null;
  const base = DEFAULT_POSITION_SPECS[symbol] || forexSpec(symbol);
  if (!base && !override) return { symbol, spec:null, error:'Missing instrument specification. Add the broker contract specification before calculating.' };
  const spec = { ...base, ...override };
  const required = ['contractSize','tickSize','volumeMin','volumeStep','profitCurrency'];
  if (required.some(key => !(numeric(spec[key]) > 0) && key !== 'profitCurrency')) return { symbol, spec:null, error:'Instrument specification is incomplete.' };
  if (!spec.profitCurrency) return { symbol, spec:null, error:'Instrument profit currency is missing.' };
  return { symbol, spec:{ ...spec, profitCurrency:String(spec.profitCurrency).toUpperCase() }, error:null };
}

function freshRate(rate) {
  if (typeof rate === 'number') return { rate, stale:true, source:'saved rate', updatedAt:null };
  const value = numeric(rate?.rate);
  const updatedAt = rate?.updatedAt ? Date.parse(rate.updatedAt) : NaN;
  const stale = !Number.isFinite(updatedAt) || Date.now() - updatedAt > 5 * 60 * 1000;
  return { rate:value, stale, source:rate?.source || 'saved rate', updatedAt:rate?.updatedAt || null };
}

export function resolveConversionRate({ fromCurrency, toCurrency, rates = {} }) {
  const from = String(fromCurrency || '').toUpperCase();
  const to = String(toCurrency || '').toUpperCase();
  if (!from || !to) return { error:'Missing currency for conversion.' };
  if (from === to) return { rate:1, source:'same currency', stale:false };
  const direct = freshRate(rates[`${from}${to}`] || rates[`${from}/${to}`]);
  if (direct.rate > 0) return direct.stale ? { error:`${from}/${to} conversion rate is stale. Enter a current rate before calculating.`, requiredPair:`${from}/${to}` } : direct;
  const inverse = freshRate(rates[`${to}${from}`] || rates[`${to}/${from}`]);
  if (inverse.rate > 0) return inverse.stale ? { error:`${to}/${from} conversion rate is stale. Enter a current rate before calculating.`, requiredPair:`${from}/${to}` } : { ...inverse, rate:1 / inverse.rate, source:`inverse ${inverse.source}` };
  return { error:`A current ${from}/${to} conversion rate is required for this account.`, requiredPair:`${from}/${to}` };
}

const floorStep = (value, step) => Math.floor((value + 1e-12) / step) * step;
const decimals = value => Math.max(0, (String(value).split('.')[1] || '').length);

export function calculatePositionSize({ instrument, accountCurrency, riskAmount, entryPrice, stopLossPrice, stopLossDistance, distanceUnit = 'price', specifications = {}, conversionRates = {} }) {
  const { symbol, spec, error } = getInstrumentSpec(instrument, specifications);
  if (error) return { ok:false, symbol, error };
  const risk = numeric(riskAmount);
  if (!(risk > 0)) return { ok:false, symbol, spec, error:'Enter a positive risk amount.' };
  const entry = numeric(entryPrice);
  const stop = numeric(stopLossPrice);
  const distance = distanceUnit === 'pips'
    ? numeric(stopLossDistance) * Number(spec.pipSize || 0)
    : distanceUnit === 'ticks'
      ? numeric(stopLossDistance) * Number(spec.tickSize)
      : entry != null && stop != null ? Math.abs(entry - stop) : numeric(stopLossDistance);
  if (!(distance > 0)) return { ok:false, symbol, spec, error:'Enter a valid entry and stop loss, or a positive stop distance.' };
  const conversion = resolveConversionRate({ fromCurrency:spec.profitCurrency, toCurrency:accountCurrency, rates:conversionRates });
  if (conversion.error) return { ok:false, symbol, spec, error:conversion.error, conversionRequired:conversion.requiredPair || null, profitCurrency:spec.profitCurrency, accountCurrency:String(accountCurrency || '').toUpperCase() };
  const tickValueProfitCurrency = numeric(spec.tickValue) || Number(spec.contractSize) * Number(spec.tickSize);
  const ticks = distance / Number(spec.tickSize);
  const lossPerVolume = ticks * tickValueProfitCurrency * conversion.rate;
  if (!(lossPerVolume > 0)) return { ok:false, symbol, spec, error:'The instrument tick value is invalid.' };
  const theoreticalVolume = risk / lossPerVolume;
  const step = Number(spec.volumeStep);
  const min = Number(spec.volumeMin);
  const max = numeric(spec.volumeMax) || Infinity;
  if (theoreticalVolume + 1e-12 < min) return { ok:false, symbol, spec, theoreticalVolume, error:`The minimum ${min} ${spec.volumeUnit || 'lots'} would exceed your requested risk.`, conversion, lossPerVolume };
  const volume = Math.min(max, floorStep(theoreticalVolume, step));
  if (!(volume >= min)) return { ok:false, symbol, spec, theoreticalVolume, error:'Risk is below the broker minimum volume after rounding.', conversion, lossPerVolume };
  const actualRisk = volume * lossPerVolume;
  return {
    ok:true, symbol, spec, conversion, distance, ticks, tickValueProfitCurrency,
    tickValueAccountCurrency:tickValueProfitCurrency * conversion.rate,
    lossPerVolume, theoreticalVolume, volume:Number(volume.toFixed(decimals(step))),
    actualRisk, requestedRisk:risk, riskDifference:risk - actualRisk,
    estimated:!spec.brokerVerified,
  };
}
