// Plain helpers for the savings setup window (kept out of the JSX so they can be unit tested).
let draftCounter = 0;
export const newSavingsDraft = (balanceId = null) => ({ id: `draft-${Date.now()}-${draftCounter++}`, name: 'Savings', balanceId, target: 0, allocationPct: 0, interval: 'Manual', reminderMinutes: 30 });
const minutesOk = (value) => { const n = Number(value ?? 30); return Number.isInteger(n) && n >= 1 && n <= 10080; };
export const savingsIssue = (plan) => {
  if (!String(plan.name || '').trim()) return 'Give this savings account a name.';
  if (!(Number(plan.target) >= 0)) return 'Target cannot be negative.';
  const pct = Number(plan.allocationPct);
  if (!(pct >= 0 && pct <= 100)) return 'Profit allocation must be from 0 to 100%.';
  if (!minutesOk(plan.reminderMinutes)) return 'Reminder must be 1 to 10,080 whole minutes.';
  return '';
};

