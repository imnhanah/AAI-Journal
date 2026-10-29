import React, { useState, useEffect } from 'react';
import { playAlertSound, stopAlertSound, unlockAlertSounds } from './alertSounds';
import { readSavingsSound, saveSavingsSound, SAVINGS_SOUND_EVENT, SAVINGS_SOUND_KEY } from './savingsSoundSettings';

export function useSavingsSoundEnabled() {
  const [enabled, setEnabled] = useState(readSavingsSound);
  useEffect(() => {
    const update = event => { if (event.type !== 'storage' || event.key === SAVINGS_SOUND_KEY || event.key === null) setEnabled(readSavingsSound()); };
    window.addEventListener(SAVINGS_SOUND_EVENT, update);
    window.addEventListener('storage', update);
    return () => { window.removeEventListener(SAVINGS_SOUND_EVENT, update); window.removeEventListener('storage', update); };
  }, []);
  return enabled;
}

export default function SavingsSoundControls() {
  const enabled = useSavingsSoundEnabled();
  const [error, setError] = useState('');
  const preview = async () => {
    const ready = await unlockAlertSounds();
    const played = ready && await playAlertSound('savings');
    setError(played ? '' : 'Sound could not play. Check your browser and device audio settings.');
  };
  const toggle = async () => {
    const next = !enabled;
    if (!saveSavingsSound(next)) { setError('Your sound preference could not be saved in this browser.'); return; }
    window.dispatchEvent(new Event(SAVINGS_SOUND_EVENT));
    if (next) await preview();
    else { stopAlertSound('savings'); setError(''); }
  };
  return <div><div className="tj-settings-switch-row"><button type="button" role="switch" aria-label="Savings alert sound" aria-checked={enabled} className={`tj-settings-switch ${enabled ? 'tj-settings-switch-on' : ''}`} onClick={toggle}><i /></button><span><strong>Savings alert sound</strong></span><button type="button" className="tj-btn-outline tj-btn-small" disabled={!enabled} onClick={preview}>Test sound</button></div>{error && <p role="status" className="tj-muted">{error}</p>}</div>;
}
