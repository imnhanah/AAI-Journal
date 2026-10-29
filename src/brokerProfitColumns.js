// Normalised broker column names. Never substring-match short aliases such as
// "pl": stop_loss, stop_loss_price and unrelated price fields can contain them.
const currencySuffix = /^(?:usd|eur|gbp|jpy|chf|cad|aud|nzd|sgd|hkd|zar|cny|inr|aed)$/;
export function brokerProfitColumn(headers, row, aliases) {
  for (const alias of aliases) {
    const exact = headers.indexOf(alias);
    if (exact >= 0) return row[exact] ?? '';
    const currency = headers.findIndex(header => header.startsWith(alias) && currencySuffix.test(header.slice(alias.length)));
    if (currency >= 0) return row[currency] ?? '';
  }
  return '';
}
export function brokerProfitValues(headers, row) {
  return {
    net: brokerProfitColumn(headers, row, ['netprofit','netpnl','netpl','net']),
    gross: brokerProfitColumn(headers, row, ['grossprofit','grosspnl','grosspl','profit','pnl','pl','profitloss']),
  };
}
