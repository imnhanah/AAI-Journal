import { activeBalances, isMultiBalanceWorkspace } from './balanceModel.js';
import { savingsOwner } from './financeScope.js';
import {invalidFinancialResult, validateAccountFinancialData} from './financialValidation.js';

const cents = value => Math.round((value + Number.EPSILON) * 100) / 100;
// Cash movements never erase profit. Partial transfers pay down this plan.
export function savingsAllocation(account, saving) {
  const validation = validateAccountFinancialData(account);
  if (!validation.valid) return invalidFinancialResult(validation.issues, { profit:null, target:null, transferred:null, remaining:null });
  const owner = savingsOwner(account, saving);
  const scoped = isMultiBalanceWorkspace(account);
  const first = activeBalances(account)[0]?.id;
  const rate = Math.max(0, Math.min(100, Number(saving.allocationPct) || 0)) / 100;
  const events = [];
  for (const trade of account.trades || []) {
    if (!trade.closeDate || trade.status === 'open') continue;
    const result = (trade.balanceResults || []).find(item => item.balanceId === owner);
    if (scoped && !result && (trade.balanceResults?.length || owner !== first)) continue;
    const profit = scoped && result ? Number(result.netPnl ?? (Number(result.grossPnl || 0) - Number(result.commission || 0) - Number(result.swap || 0))) : Number(trade.pnl || 0);
    events.push({ date: trade.closeDate || trade.date, kind: 'profit', amount: profit });
  }
  for (const movement of account.financeMovements || []) {
    if (movement.type === 'transfer' && movement.savingsAccountId === saving.id)
      events.push({ date: movement.date, kind: 'transfer', amount: Number(movement.amount) || 0, createdAt: movement.createdAt });
  }
  // Date-only records retain the journal's same-day convention: trades first.
  events.sort((a, b) => String(a.date).slice(0, 10).localeCompare(String(b.date).slice(0, 10)) || (a.kind === b.kind ? String(a.createdAt || '').localeCompare(String(b.createdAt || '')) : a.kind === 'profit' ? -1 : 1));
  let profit = 0, transferred = 0;
  for (const event of events) {
    if (event.kind === 'profit') profit += event.amount;
    else {
      const target = cents(Math.max(0, profit) * rate);
      if (target <= 0) continue;
      transferred += event.amount;
      if (cents(transferred) >= target) { profit = 0; transferred = 0; }
    }
  }
  const target = cents(Math.max(0, profit) * rate);
  return { profit: cents(profit), target, transferred: cents(transferred), remaining: cents(Math.max(0, target - transferred)) };
}

// Monday 08:00 London resets reminders, not unpaid profit. Handles GMT/BST.
export function londonSavingsWindow(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(now).map(p => [p.type, p.value]));
  const day = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)));
  const days = (day.getUTCDay() + 6) % 7;
  day.setUTCDate(day.getUTCDate() - days - (days === 0 && Number(parts.hour) < 8 ? 7 : 0));
  const wall = day.getTime() + 8 * 3600000;
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', hourCycle: 'h23' }).format(new Date(wall)));
  return new Date(wall - (hour - 8) * 3600000);
}

const zonedParts = (date, timeZone) => Object.fromEntries(
  new Intl.DateTimeFormat('en-GB', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date).map(part => [part.type, part.value]),
);

// Resolve a wall-clock time without consulting the device timezone. The two
// passes account for the UTC offset on either side of a daylight-saving shift.
const zonedWallTime = ({ year, month, day, hour, minute = 0 }, timeZone) => {
  const target = Date.UTC(year, month - 1, day, hour, minute);
  let instant = target;
  for (let pass = 0; pass < 2; pass += 1) {
    const parts = zonedParts(new Date(instant), timeZone);
    const displayed = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute));
    instant = target - (displayed - instant);
  }
  return new Date(instant);
};

const previousMonth = ({ year, month }) => month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
const shiftCalendarDays = ({ year, month, day }, days) => {
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1, day: shifted.getUTCDate() };
};

// Savings plans open at the New York Forex-session opening: 08:00 New York.
// This is deliberately independent from both the user's device timezone and
// the London trading-week reset used to group reminder windows.
export function savingsReminderScheduledAt(saving, now = new Date()) {
  const local = zonedParts(now, 'America/New_York');
  let year = Number(local.year);
  let month = Number(local.month);
  let day;
  const interval = saving.interval || 'Manual';

  if (interval === 'Weekly' || interval === 'Manual') {
    const nyDay = new Date(Date.UTC(year, month - 1, Number(local.day))).getUTCDay();
    day = Number(local.day) - ((nyDay + 2) % 7); // Friday
    if (day < 1) {
      const prior = previousMonth({ year, month });
      year = prior.year;
      month = prior.month;
      day += new Date(Date.UTC(year, month, 0)).getUTCDate();
    }
  } else {
    day = interval === 'Bi-weekly' ? 15 : 28;
  }

  let scheduled = zonedWallTime({ year, month, day, hour: 8 }, 'America/New_York');
  if (scheduled > now) {
    if (interval === 'Weekly' || interval === 'Manual') {
      const priorFriday = shiftCalendarDays({ year, month, day }, -7);
      scheduled = zonedWallTime({ ...priorFriday, hour: 8 }, 'America/New_York');
    } else {
      const prior = previousMonth({ year, month });
      scheduled = zonedWallTime({ year: prior.year, month: prior.month, day, hour: 8 }, 'America/New_York');
    }
  }
  return scheduled;
}

export function savingsReminderDue(saving, now = new Date()) {
  const window = londonSavingsWindow(now);
  const created = saving.createdAt ? new Date(saving.createdAt) : null;
  if (created && created >= window && created <= now) return true;
  const scheduled = savingsReminderScheduledAt(saving, now);
  return scheduled <= now && scheduled >= window;
}

export function reminderMinutes(saving) {
  const minutes = Number(saving.reminderMinutes);
  return Number.isInteger(minutes) && minutes >= 1 && minutes <= 10080 ? minutes : 30;
}

export function shouldRepeatReminder(saving, lastShown, now = new Date()) {
  return lastShown == null || now.getTime() - lastShown >= reminderMinutes(saving) * 60000;
}
