export const SAVINGS_SOUND_KEY = 'tj-savings-alert-sound';
export const SAVINGS_SOUND_EVENT = 'tj-savings-alert-sound-changed';
export function readSavingsSound(storage = globalThis.localStorage) {
  try { return storage?.getItem(SAVINGS_SOUND_KEY) !== 'off'; } catch { return true; }
}
export function saveSavingsSound(enabled, storage = globalThis.localStorage) {
  try { storage.setItem(SAVINGS_SOUND_KEY, enabled ? 'on' : 'off'); return true; } catch { return false; }
}
