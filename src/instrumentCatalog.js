// The journal keeps one canonical name for each commonly traded instrument.
// Broker exports can use suffixes and aliases (for example EURUSDm or NAS100),
// so imports are normalised here before they reach the trade list.
export const INSTRUMENT_GROUPS = Object.freeze([
  'Major Forex', 'Minor Forex', 'Commodities', 'Indices', 'Crypto',
]);

export const INSTRUMENT_CATALOG = Object.freeze({
  'Major Forex': ['EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF', 'AUD/USD', 'USD/CAD', 'NZD/USD'],
  'Minor Forex': [
    'EUR/GBP', 'EUR/JPY', 'EUR/CHF', 'EUR/CAD', 'EUR/AUD', 'EUR/NZD',
    'GBP/JPY', 'GBP/CHF', 'GBP/CAD', 'GBP/AUD', 'GBP/NZD',
    'AUD/JPY', 'AUD/CHF', 'AUD/CAD', 'AUD/NZD',
    'NZD/JPY', 'NZD/CHF', 'NZD/CAD', 'CAD/JPY', 'CAD/CHF', 'CHF/JPY',
  ],
  Commodities: ['XAU/USD', 'XAG/USD'],
  Indices: ['US30', 'US100', 'US500', 'GER40', 'UK100', 'JP225', 'FRA40', 'EU50', 'AUS200', 'HK50'],
  Crypto: ['BTC/USD', 'ETH/USD', 'SOL/USD', 'XRP/USD', 'BNB/USD', 'ADA/USD'],
});

export const DEFAULT_INSTRUMENTS = Object.freeze(Object.values(INSTRUMENT_CATALOG).flat());

const compact = (value) => String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const canonicalByCompact = new Map(DEFAULT_INSTRUMENTS.map((item) => [compact(item), item]));
const groupByInstrument = new Map(Object.entries(INSTRUMENT_CATALOG).flatMap(([group, items]) => items.map((item) => [item, group])));

const ALIASES = {
  'XAU/USD': ['GOLD', 'XAUUSD'],
  'XAG/USD': ['SILVER', 'XAGUSD'],
  US30: ['US30', 'DJ30', 'DJI', 'DOW', 'DOW30', 'WS30'],
  US100: ['US100', 'NAS100', 'NQ100', 'USTEC', 'USNAS100'],
  US500: ['US500', 'SP500', 'SPX500', 'USSPX500'],
  GER40: ['GER40', 'DE40', 'DAX40'],
  UK100: ['UK100', 'FTSE100'],
  JP225: ['JP225', 'NIKKEI225'],
  FRA40: ['FRA40', 'FR40', 'CAC40'],
  EU50: ['EU50', 'STOXX50', 'EUROSTOXX50'],
  AUS200: ['AUS200', 'ASX200'],
  HK50: ['HK50', 'HSI50', 'HANGSENG'],
  'BTC/USD': ['BTCUSD', 'BTCUSDT', 'BITCOIN'],
  'ETH/USD': ['ETHUSD', 'ETHUSDT', 'ETHEREUM'],
  'SOL/USD': ['SOLUSD', 'SOLUSDT', 'SOLANA'],
  'XRP/USD': ['XRPUSD', 'XRPUSDT'],
  'BNB/USD': ['BNBUSD', 'BNBUSDT'],
  'ADA/USD': ['ADAUSD', 'ADAUSDT', 'CARDANO'],
};
const aliasLookup = new Map(Object.entries(ALIASES).flatMap(([instrument, aliases]) => aliases.map((alias) => [compact(alias), instrument])));

export function normalizeInstrument(value) {
  const raw = compact(value);
  if (!raw) return '';
  if (canonicalByCompact.has(raw)) return canonicalByCompact.get(raw);
  if (aliasLookup.has(raw)) return aliasLookup.get(raw);

  // Forex brokers commonly append a suffix such as m, .pro, or _i. Find the
  // two currency codes inside the broker symbol and retain the journal format.
  const forex = raw.match(/(?:EUR|GBP|USD|JPY|CHF|CAD|AUD|NZD){2}/)?.[0];
  if (forex && canonicalByCompact.has(forex)) return canonicalByCompact.get(forex);
  if (/^[A-Z]{6}$/.test(raw)) return `${raw.slice(0, 3)}/${raw.slice(3)}`;
  return raw;
}

export function instrumentGroup(value) {
  const instrument = normalizeInstrument(value);
  if (groupByInstrument.has(instrument)) return groupByInstrument.get(instrument);
  if (/^[A-Z]{3}\/[A-Z]{3}$/.test(instrument)) return instrument.includes('USD') ? 'Major Forex' : 'Minor Forex';
  if (/^(XAU|XAG|XPT|XPD|WTI|BRENT|USOIL|UKOIL)/.test(instrument)) return 'Commodities';
  if (/^(BTC|ETH|SOL|XRP|BNB|ADA|DOGE|LTC|AVAX|DOT)/.test(instrument)) return 'Crypto';
  return 'Indices';
}

export function instrumentsByGroup(instruments = DEFAULT_INSTRUMENTS) {
  return INSTRUMENT_GROUPS.map((group) => ({
    group,
    instruments: instruments.filter((instrument) => instrumentGroup(instrument) === group),
  })).filter(({instruments}) => instruments.length);
}

export const sameInstrument = (left, right) => normalizeInstrument(left) === normalizeInstrument(right);
