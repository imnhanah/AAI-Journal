import { useMemo, useState } from 'react';
import { AlertTriangle, Check, Info, Landmark, Plus, Trash2, X } from 'lucide-react';
import { useSavingsSoundEnabled } from './SavingsSoundControls';
import { playAlertSound, stopAlertSound, unlockAlertSounds } from './alertSounds';
import { saveSavingsSound, SAVINGS_SOUND_EVENT } from './savingsSoundSettings';
import { newSavingsDraft, savingsIssue } from './savingsSetup.js';
import SetupPanel from './SetupPanel.jsx';
import './challengeSetupWindow.css';

// Savings accounts are managed on the Finance page in this window (same look as the
// challenge setup window). It edits a draft list; onSave receives the full list and
// the Finance page persists it (create / update / delete) through handleSaveSavings.
const INTERVALS = ['Manual', 'Weekly', 'Bi-weekly', 'Monthly'];
function SoundRow() {
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
    if (next) await preview(); else { stopAlertSound('savings'); setError(''); }
  };
  return <div className="csw2-snd"><button type="button" role="switch" aria-label="Savings alert sound" aria-checked={enabled} className={`csw2-sw ${enabled ? 'is-on' : ''}`} onClick={toggle}><i /></button>
    <span><b>Savings alert sound</b><small>Plays when a savings reminder is due.</small></span>
    <button type="button" className="csw2-bt" onClick={preview}>Test sound</button>
    {error && <p className="csw2-snd-err" role="alert">{error}</p>}</div>;
}

export default function SavingsSetupWindow({ plans, balances = [], currency = 'USD', saving, onClose, onSave, startNew }) {
  const multi = balances.length > 1;
  const first = balances[0]?.id || null;
  const [draft, setDraft] = useState(() => {
    const list = (plans || []).map((plan) => ({ ...plan }));
    return startNew || !list.length ? [...list, newSavingsDraft(first)] : list;
  });
  const [sel, setSel] = useState(() => (startNew || !(plans || []).length ? draft[draft.length - 1]?.id : (plans || [])[0]?.id));
  const [askDelete, setAskDelete] = useState(false);
  const sym = currency === 'USD' ? '$' : `${currency} `;
  const money = (value) => `${sym}${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  const plan = draft.find((item) => item.id === sel) || draft[0];
  const patch = (next) => setDraft((list) => list.map((item) => (item.id === plan.id ? { ...item, ...next } : item)));
  const issues = useMemo(() => draft.map((item) => [item, savingsIssue(item)]).filter(([, issue]) => issue), [draft]);
  const valid = issues.length === 0;
  const ownerName = balances.find((item) => item.id === plan?.balanceId)?.name;
  const add = () => { const item = newSavingsDraft(first); setDraft((list) => [...list, item]); setSel(item.id); setAskDelete(false); };
  const remove = () => {
    const rest = draft.filter((item) => item.id !== plan.id);
    setDraft(rest); setSel(rest[0]?.id); setAskDelete(false);
  };
  const pct = Number(plan?.allocationPct) || 0;

  return <SetupPanel label="Savings accounts" panelKey="savings" defaultWidth={760} busy={saving} onClose={onClose}>{(close) =>
    <section className="csw2" role="dialog" aria-modal="true" aria-labelledby="sv-title">
      <span className="csw2-grab" aria-hidden="true" />
      <header className="csw2-mh">
        <span className="csw2-av"><Landmark size={22} /></span>
        <div><span className="csw2-eb">Finance</span><h2 id="sv-title">Savings accounts</h2></div>
        <button type="button" className="csw2-xb" aria-label="Close" onClick={close} disabled={saving}><X size={18} /></button>
      </header>
      <div className="csw2-mb">
        <div className="csw2-ml">
          <section>
            <div className="csw2-sh"><span>Your savings accounts</span><span className="csw2-lkb is-gh">{draft.length} in total</span></div>
            <div className="csw2-pres csw2-sv-list">
              {draft.map((item) => <button type="button" key={item.id} className={`csw2-pre ${item.id === plan?.id ? 'is-on' : ''}`} onClick={() => { setSel(item.id); setAskDelete(false); }}>
                <b>{item.name || 'Untitled'}</b><span>{Number(item.allocationPct) || 0}% of profit · {item.interval}</span>
              </button>)}
              <button type="button" className="csw2-pre csw2-sv-add" onClick={add}><b><Plus size={15} /> Add</b><span>New savings account</span></button>
            </div>
          </section>
          {plan ? <>
            <section>
              <div className="csw2-sh"><span>Details</span><span className="csw2-lkb is-gh">{plan.id.startsWith('draft-') ? 'New' : 'Saved'}</span></div>
              <div className="csw2-name"><label className="csw2-fld"><small>Account name</small><span className="csw2-in"><input value={plan.name || ''} onChange={(event) => patch({ name: event.target.value })} /></span></label></div>
              {multi && <div className="csw2-fld csw2-gap"><small>Owner</small><div className="csw2-pres" role="radiogroup" aria-label="Owner">{balances.map((item) => <button type="button" key={item.id} role="radio" aria-checked={(plan.balanceId || first) === item.id} className={`csw2-pre ${(plan.balanceId || first) === item.id ? 'is-on' : ''}`} onClick={() => patch({ balanceId: item.id })}><b>{item.name}</b><span>Owner</span></button>)}</div></div>}
              <div className="csw2-rrow csw2-gap">
                <label className="csw2-fld"><small>Savings target</small><span className="csw2-in"><input type="number" inputMode="decimal" min="0" value={plan.target} onChange={(event) => patch({ target: event.target.value })} /><em>{currency}</em></span></label>
                <label className="csw2-fld"><small>Profit allocation</small><span className="csw2-in"><input type="number" inputMode="decimal" min="0" max="100" value={plan.allocationPct} onChange={(event) => patch({ allocationPct: event.target.value })} /><em>%</em></span><span className="csw2-hint2">Share of each profit cycle set aside for this account.</span></label>
              </div>
            </section>
            <section>
              <div className="csw2-sh"><span>Transfer interval</span><span className="csw2-lkb is-gh">How often you move money</span></div>
              <div className="csw2-pres csw2-pres4" role="radiogroup" aria-label="Transfer interval">{INTERVALS.map((value) => <button type="button" key={value} role="radio" aria-checked={plan.interval === value} className={`csw2-pre ${plan.interval === value ? 'is-on' : ''}`} onClick={() => patch({ interval: value })}><b>{value}</b></button>)}</div>
              <label className="csw2-fld csw2-gap"><small>Remind me every (minutes)</small><span className="csw2-in"><input type="number" inputMode="numeric" min="1" max="10080" step="1" value={plan.reminderMinutes ?? 30} onChange={(event) => patch({ reminderMinutes: event.target.value })} /></span><span className="csw2-hint2">From 1 to 10,080 minutes.</span></label>
            </section>
            <section>
              <div className="csw2-sh"><span>Reminder sound</span><span className="csw2-lkb is-gh">Applies to all savings accounts</span></div>
              <SoundRow />
            </section>
          </> : <p className="csw2-note">No savings account yet. Add one to plan transfers.</p>}
        </div>
        <aside className="csw2-mr">
          <div className="csw2-bal"><small>Savings target</small>{money(plan?.target)}</div>
          <div className="csw2-hint"><Info size={13} /><span>Transfers to savings never change your trading statistics.</span></div>
          <div className="csw2-meter">
            <div className="csw2-mtop"><div><span className="csw2-eb2">Profit allocation</span><div className="csw2-big is-good">{pct}%</div></div><div className="csw2-sb2">of each profit<br />cycle</div></div>
            <div className="csw2-mbar" style={{ gridTemplateColumns: 'repeat(10,minmax(0,1fr))' }}>{Array.from({ length: 10 }, (_, index) => <i key={index} className={index < Math.round(Math.min(100, Math.max(0, pct)) / 10) ? 'is-ok' : ''} />)}</div>
            <div className="csw2-mlab"><span>0%</span><span>Kept in trading · {100 - Math.min(100, Math.max(0, pct))}%</span><span>100%</span></div>
          </div>
          <div className="csw2-facts">
            <div><span>Account</span><b>{plan?.name || '—'}</b></div>
            {multi && <div><span>Owner</span><b>{ownerName || balances[0]?.name || '—'}</b></div>}
            <div><span>Interval</span><b>{plan?.interval}</b></div>
            <div><span>Reminder</span><b>every {plan?.reminderMinutes ?? 30} min</b></div>
          </div>
          <div className="csw2-how"><b>How savings accounts work</b>
            <ul><li>Each account sets aside its share of your profit.</li><li>Transfers move money out of trading, never into your statistics.</li><li>Your reminder tells you when a transfer is due.</li></ul></div>
          {!valid && <div className="csw2-wn" role="alert"><span className="csw2-wi"><AlertTriangle size={16} /></span><div><b>Needs attention</b><p>{issues[0][0].name ? `${issues[0][0].name}: ` : ''}{issues[0][1]}</p></div></div>}
        </aside>
      </div>
      <footer className="csw2-mf">
        {askDelete ? <div className="csw2-cf"><span><AlertTriangle size={15} />Delete {plan?.name || 'this account'} when you save?</span><div><button type="button" className="csw2-bt" onClick={() => setAskDelete(false)}>Keep</button><button type="button" className="csw2-bt is-dng" onClick={remove}>Delete</button></div></div>
          : <>{plan && <button type="button" className="csw2-bt is-dng csw2-tr" aria-label="Delete savings account" title="Delete savings account" onClick={() => setAskDelete(true)} disabled={saving}><Trash2 size={17} /></button>}
            <span className={`csw2-hl ${valid ? 'is-ok' : 'is-no'}`}>{valid ? <><Check size={15} />Everything checks out.</> : <><AlertTriangle size={15} />Fix the warning to save.</>}</span><span className="csw2-sp" />
            <button type="button" className="csw2-bt" onClick={close} disabled={saving}>Cancel</button>
            <button type="button" className="csw2-bt is-pri" disabled={saving || !valid} onClick={() => onSave(draft)}><Check size={15} />{saving ? 'Saving…' : 'Save savings'}</button></>}
      </footer>
    </section>}
  </SetupPanel>;
}
