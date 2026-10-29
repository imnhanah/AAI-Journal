const keyFor = userId => `aaicorefx:sidebar-expanded:${userId}`;

// The preference is intentionally device-local and profile-specific. Reading
// happens synchronously in the React state initializer so desktop users do
// not see an expanded-to-collapsed flash during startup.
export function readSidebarExpanded(userId, storage = globalThis.localStorage) {
  try {
    const value = storage?.getItem(keyFor(userId));
    return value === null ? true : value === 'true';
  } catch { return true; }
}

export function writeSidebarExpanded(userId, expanded, storage = globalThis.localStorage) {
  try { storage?.setItem(keyFor(userId), String(!!expanded)); } catch {}
}

export const sidebarPreferenceKey = keyFor;
