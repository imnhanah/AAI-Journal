import { privateCache } from './privateCacheRuntime';

const keyFor = userId => `journal:${userId || 'anonymous'}:pending-trades`;
const usable = value => Array.isArray(value) ? value.filter(item => item?.trade?.id && item?.accountId) : [];
// The queue is a safeguard, never a prerequisite for the primary cloud save.
// IndexedDB may be unavailable in privacy mode, so cache errors intentionally
// fall back to a session-only retry state rather than interrupting the trade.
const read = async userId => {
  try { return usable(await privateCache.read(keyFor(userId))); }
  catch { return []; }
};
const write = async (userId, items) => {
  try { await privateCache.write(keyFor(userId), items); return true; }
  catch { return false; }
};

export const pendingTradeSaves = userId => read(userId);

export const queueTradeSave = async (userId, accountId, trade, kind) => {
  const items = await read(userId);
  const next = { accountId, trade, kind:kind === 'update' ? 'update' : 'create', savedAt:new Date().toISOString() };
  const index = items.findIndex(item => item.accountId === accountId && item.trade?.id === trade.id);
  if (index >= 0) items[index] = next; else items.unshift(next);
  await write(userId, items);
  return next;
};

export const clearPendingTradeSave = async (userId, accountId, tradeId) => {
  const next = (await read(userId)).filter(item => item.accountId !== accountId || item.trade?.id !== tradeId);
  await write(userId, next);
  return next;
};
