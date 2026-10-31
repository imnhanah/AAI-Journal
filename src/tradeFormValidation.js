const blank = value => value === '' || value == null;
const finite = value => !blank(value) && Number.isFinite(Number(value));
const dateValue = value => {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const [, year, month, day] = match.map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
};
const timeValue = value => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value || ''));

export function validateTradeForm({ form, accountId, multiBalance = false, validBalanceIds = [], isRunning, realizedR }) {
  const errors = {};
  const add = (field, message) => { if (!errors[field]) errors[field] = message; };
  if (!String(form.asset || '').trim()) add('asset', 'Choose an instrument.');
  if (!['BUY', 'SELL'].includes(form.direction)) add('direction', 'Choose BUY or SELL.');
  if (!dateValue(form.date)) add('date', 'Choose a valid open date.');
  if (!timeValue(form.time)) add('time', 'Choose a valid open time.');
  if (!accountId) add('account', 'Select an active journal before logging a trade.');
  const selected = (form.balanceResults || []).filter(result => validBalanceIds.includes(result?.balanceId));
  if (multiBalance && !selected.length) add('balanceTargets', 'Select at least one account target.');
  if (!isRunning) {
    if (!finite(form.grossPnl) && !multiBalance) add('grossPnl', 'Enter a valid Gross P&L for this closed trade.');
    if (!dateValue(form.closeDate)) add('closeDate', 'Choose a valid close date.');
    if (!timeValue(form.closeTime)) add('closeTime', 'Choose a valid close time.');
    if (dateValue(form.date) && dateValue(form.closeDate) && timeValue(form.time) && timeValue(form.closeTime) && `${form.closeDate} ${form.closeTime}` < `${form.date} ${form.time}`) add('closeTime', 'Close date and time cannot be before the opening.');
    if (form.calculationMethod === 'price') {
      if (!['BUY', 'SELL'].includes(form.direction)) errors.direction = 'Choose BUY or SELL to calculate Realized R.';
      if (!finite(form.entryPrice)) add('entryPrice', 'Enter the entry price to calculate Realized R.');
      if (!finite(form.stopLossPrice)) add('stopLossPrice', 'Enter the stop-loss price to calculate Realized R.');
      if (!finite(form.exitPrice)) add('exitPrice', 'Enter the actual exit price for this closed trade.');
      if (finite(form.entryPrice) && finite(form.stopLossPrice) && ['BUY', 'SELL'].includes(form.direction)) {
        const risk = form.direction === 'SELL' ? Number(form.stopLossPrice) - Number(form.entryPrice) : Number(form.entryPrice) - Number(form.stopLossPrice);
        if (!(risk > 0)) add('stopLossPrice', 'Entry price and stop loss must define a valid risk distance.');
      }
    } else if (form.calculationMethod === 'pips') {
      if (blank(form.stopLossPips)) add('stopLossPips', 'Enter your stop-loss distance to calculate Realized R.');
      else if (!finite(form.stopLossPips) || !(Number(form.stopLossPips) > 0)) add('stopLossPips', 'Stop-loss distance must be greater than zero.');
      if (blank(form.exitPips)) add('exitPips', 'Enter actual closed pips or ticks for this closed trade.');
      else if (!finite(form.exitPips)) add('exitPips', 'Enter a valid number of closed pips or ticks.');
    }
    if ((form.calculationMethod === 'price' || form.calculationMethod === 'pips') && !Number.isFinite(realizedR)) {
      if (form.calculationMethod === 'price' && !errors.entryPrice && !errors.stopLossPrice && !errors.exitPrice && !errors.direction) add('exitPrice', 'Enter the actual exit price for this closed trade.');
      if (form.calculationMethod === 'pips' && !errors.stopLossPips && !errors.exitPips) add('exitPips', 'Enter a valid number of closed pips or ticks.');
    }
  }
  if (!blank(form.commission) && !finite(form.commission)) add('commission', 'Commission must be a valid number.');
  if (!blank(form.swap) && !finite(form.swap)) add('swap', 'Swap must be a valid number.');
  for (const result of selected) {
    if (!blank(result.commission) && !finite(result.commission)) { add(`commission-${result.balanceId}`, 'Commission must be a valid number.'); add('commission', 'Commission must be a valid number.'); }
    if (!blank(result.swap) && !finite(result.swap)) { add(`swap-${result.balanceId}`, 'Swap must be a valid number.'); add('swap', 'Swap must be a valid number.'); }
    if (!blank(result.grossPnl) && !finite(result.grossPnl)) { add(`grossPnl-${result.balanceId}`, 'Enter a valid Gross P&L for this closed account target.'); add('grossPnl', 'Enter a valid Gross P&L for this closed trade.'); }
  }
  return { valid: Object.keys(errors).length === 0, errors, firstField: Object.keys(errors)[0] || null };
}
