export const compactBacktestMoney=(value,currency='USD')=>new Intl.NumberFormat(undefined,{style:'currency',currency,notation:'compact',maximumFractionDigits:1}).format(Number(value)||0);
