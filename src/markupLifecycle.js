export const MARKUP_STATUSES = ['Planned', 'Watching', 'Executed', 'Not Executed'];
export const markupStatus = status => status === 'Passed' ? 'Not Executed' : status || 'Planned';

// Preserve the existing device-local 22:00 cutoff, including missed days.
export function expiredUnlinkedMarkups(markups, account, now = new Date()) {
  if (!account || !Number.isFinite(now.getTime())) return [];
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const linked = new Set((account.trades || []).map(trade => String(trade.premarketMarkupId || '')));
  return markups.filter(markup => markup.accountId === account.id
    && ['Planned', 'Watching'].includes(markup.status || 'Planned')
    && /^\d{4}-\d{2}-\d{2}$/.test(markup.date || '')
    && (markup.date < today || (markup.date === today && now.getHours() >= 22))
    && !linked.has(String(markup.id)));
}
