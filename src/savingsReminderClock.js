import { shouldRepeatReminder } from './savingsSchedule.js';

// Persist the last display, not page visits. Custom durations survive reloads.
// One record per user/journal/plan avoids retaining an unlimited window history.
export function claimSavingsReminder({ key, windowKey, saving, now = new Date(), storage, fallback = new Map() }) {
  const storageKey = `tj-savings-reminder:${key}`;
  let record = fallback.get(storageKey);
  try {
    storage ||= globalThis.localStorage;
    const saved = JSON.parse(storage?.getItem(storageKey) || 'null');
    if (saved && Number.isFinite(saved.lastShown) && (!record || saved.lastShown > record.lastShown)) record = saved;
  } catch { /* A blocked storage device still gets in-session reminders. */ }
  const last = record?.windowKey === windowKey ? record.lastShown : undefined;
  if (!shouldRepeatReminder(saving, last, now)) return false;
  const next = { windowKey, lastShown: now.getTime() };
  fallback.set(storageKey, next);
  try { storage?.setItem(storageKey, JSON.stringify(next)); } catch { /* Keep the in-session clock. */ }
  return true;
}
