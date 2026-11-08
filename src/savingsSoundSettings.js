export const SAVINGS_SOUND_KEY = 'tj-savings-alert-sound';
export const SAVINGS_SOUND_EVENT = 'tj-savings-alert-sound-changed';
// Which synthesised sound the reminder plays (synthSounds.js). Silent is the on/off key above.
export const SAVINGS_SOUND_CHOICE_KEY = 'tj-savings-alert-sound-choice';
export const SAVINGS_SOUND_CHOICES = ['coin', 'vault', 'ledger'];
export function readSavingsSoundChoice(storage = globalThis.localStorage) {
  try { const value = storage?.getItem(SAVINGS_SOUND_CHOICE_KEY); return SAVINGS_SOUND_CHOICES.includes(value) ? value : 'vault'; } catch { return 'vault'; }
}
export function saveSavingsSoundChoice(choice, storage = globalThis.localStorage) {
  if (!SAVINGS_SOUND_CHOICES.includes(choice)) return false;
  try { storage.setItem(SAVINGS_SOUND_CHOICE_KEY, choice); return true; } catch { return false; }
}
export function readSavingsSound(storage = globalThis.localStorage) {
  try { return storage?.getItem(SAVINGS_SOUND_KEY) !== 'off'; } catch { return true; }
}
export function saveSavingsSound(enabled, storage = globalThis.localStorage) {
  try { storage.setItem(SAVINGS_SOUND_KEY, enabled ? 'on' : 'off'); return true; } catch { return false; }
}
