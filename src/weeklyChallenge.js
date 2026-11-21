import { replayChallenge } from './challengeAutomation.js';
import { cashImpact, tradeLoggedAt } from './challengeLifecycle.js';

// Weekly challenge progress for the Daily Routine. Informational only: every level comes from the existing
// challenge replay, run up to a chosen moment. Nothing here changes a challenge or stores anything new.
const DAY = 86400000;
export const MODE_LABELS = { risk: 'Mode 1 · Risk limit', streak: 'Mode 2 · Two-loss streak', adaptive: 'Mode 3 · Adaptive balance' };

export function weekStartMs(now = new Date(), weekStart = 'monday') {
  const day = new Date(now); day.setHours(0, 0, 0, 0);
  day.setDate(day.getDate() - (day.getDay() - (weekStart === 'sunday' ? 0 : 1) + 7) % 7);
  return day.getTime();
}
export const dayKeyOf = ms => new Date(ms).toLocaleDateString('en-CA');
const movementAt = item => Date.parse(item.createdAt || `${item.date}T23:59:59`);

// The challenge's level as it stood at atMs (Infinity = now). Before the challenge began it reports the opening level.
export function challengeLevelAt(progress, scoped, atMs = Infinity) {
  const config = progress?.automation;
  if (!config?.startedAt || !scoped) return null;
  const startedAt = Date.parse(config.startedAt);
  const cut = Math.max(atMs, startedAt);
  const account = {
    ...scoped,
    trades: (scoped.trades || []).filter(trade => !(tradeLoggedAt(trade) >= cut)),
    financeMovements: (scoped.financeMovements || []).filter(item => !(movementAt(item) >= cut)),
  };
  const baseline = { activeLevel: progress.activeLevel ?? progress.active_level ?? 1, statuses: progress.statuses || {}, notes: progress.notes || {}, automation: { ...config, rewardRatio: config.rewardRatio ?? scoped.challengeReward } };
  const state = replayChallenge(baseline, account);
  const total = Number(config.levelCount || scoped.challengeLevelCount) || 30;
  const raw = Number(state.activeLevel) || 1;
  return { level: Math.min(Math.max(raw, 1), total), total, failed: !!state.failed, complete: raw > total, existed: atMs >= startedAt };
}

// entry = { id, name, progress, scoped }. Only running challenges get a row.
export function weeklyChallengeRow(entry, now = new Date(), weekStart = 'monday') {
  const thisStart = weekStartMs(now, weekStart), lastStart = thisStart - 7 * DAY;
  const current = challengeLevelAt(entry.progress, entry.scoped);
  if (!current || current.failed || current.complete) return null;
  const startedAt = Date.parse(entry.progress.automation.startedAt);
  const atStart = challengeLevelAt(entry.progress, entry.scoped, thisStart);
  const atLast = challengeLevelAt(entry.progress, entry.scoped, lastStart);
  const last = startedAt < lastStart ? atLast.level : null;
  return {
    id: entry.id, name: entry.name, mode: MODE_LABELS[entry.progress.automation.mode] || '', total: current.total,
    now: current.level, start: atStart.level, last,
    startedThisWeek: startedAt >= thisStart,
    delta: current.level - atStart.level,
    lastDelta: last == null ? null : atStart.level - last,
  };
}
export const weeklyChallengeRows = (entries, now, weekStart) => entries.map(entry => weeklyChallengeRow(entry, now, weekStart)).filter(Boolean);
export const lastWeekTotal = rows => rows.reduce((sum, row) => sum + (row.lastDelta || 0), 0);

// True until the member has saved any routine this week: the first open of the week gets the look back.
export function firstRoutineOfWeek(routine, now = new Date(), weekStart = 'monday') {
  const from = dayKeyOf(weekStartMs(now, weekStart));
  return !Object.keys(routine?.completions || {}).some(key => key >= from);
}

// This week's net trading result as a percentage of the balance the week opened with.
export function weekPnlPercent({ trades = [], financeMovements = [], balance, now = new Date(), weekStart = 'monday' }) {
  const from = weekStartMs(now, weekStart), fromKey = dayKeyOf(from);
  const pnl = trades.filter(trade => trade.status !== 'open' && !String(trade.context || '').includes('[aaicorefx-running-trade]') && String(trade.closeDate || trade.date || '').slice(0, 10) >= fromKey)
    .reduce((sum, trade) => sum + (Number(trade.pnl) || 0), 0);
  const cash = financeMovements.filter(item => movementAt(item) >= from).reduce((sum, item) => sum + cashImpact(item), 0);
  const opening = Number(balance) - pnl - cash;
  if (!(opening > 0)) return null;
  return Math.round(pnl / opening * 1000) / 10;
}
