const keyFor = userId => `aaicorefx:backtest-mobile-disclosure:${userId}`;

const normalise = value => ({
  manual: !!value?.manual,
  expanded: Object.fromEntries(Object.entries(value?.expanded || {}).filter(([, open]) => typeof open === 'boolean')),
  lastOpenedId: typeof value?.lastOpenedId === 'string' ? value.lastOpenedId : null,
});

// Disclosure is a device-local view preference, like the sidebar state. It is
// deliberately keyed to the signed-in profile and never written to test data.
export function readBacktestMobileDisclosure(userId, storage = globalThis.localStorage) {
  try { return normalise(JSON.parse(storage?.getItem(keyFor(userId)) || 'null')); } catch { return normalise(null); }
}

export function writeBacktestMobileDisclosure(userId, value, storage = globalThis.localStorage) {
  try { storage?.setItem(keyFor(userId), JSON.stringify(normalise(value))); } catch { /* Private browsing may block storage. */ }
}

export function mobileDefaultExpandedRunId(runs = [], statsFor, lastOpenedId = null) {
  const active = runs.filter(run => statsFor(run).status === 'In progress');
  if (active.some(run => run.id === lastOpenedId)) return lastOpenedId;
  return [...active].sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')) || String(b.id).localeCompare(String(a.id)))[0]?.id || null;
}

export const backtestMobileDisclosureKey = keyFor;
