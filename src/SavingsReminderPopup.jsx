// Desktop savings transfer reminder, after aaicorefx-desktop-finance-challenge-popups.html.
// FinanceReminderModal supplies the numbers; this only presents them, plays the chosen sound
// and lets the trader pick another one (or silence) from the speaker menu.
import { ArrowRight, Landmark, Play, Volume2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { SAVINGS_SOUNDS, playSynthSound, stopSynthSound } from './synthSounds';
import './desktopPopups.css';

function useCountUp(target, duration = 900) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setValue(target); return undefined; }
    let frame = 0; const start = performance.now();
    const step = (now) => { const p = Math.min((now - start) / duration, 1); setValue(target * (1 - Math.pow(1 - p, 3))); if (p < 1) frame = requestAnimationFrame(step); };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);
  return value;
}

export default function SavingsReminderPopup({ rows, profit, total, money, sound, onSound, onLater, onOpenFinance }) {
  const [menu, setMenu] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const dialog = useRef(null), primary = useRef(null);
  const shown = useCountUp(total);
  const pct = profit > 0 ? Math.max(0, Math.min(100, total / profit * 100)) : 100;
  const stays = Math.max(0, profit - total);
  useEffect(() => {
    primary.current?.focus();
    if (sound === 'off') return undefined;
    const timer = setTimeout(() => { playSynthSound(sound, 'savings').then((played) => setBlocked(!played)); }, 250);
    return () => { clearTimeout(timer); stopSynthSound('savings'); };
    // The sound plays once when the reminder opens; picking another one plays it on its own.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const key = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault(); event.stopPropagation();
      if (menu) setMenu(false); else onLater();
    };
    document.addEventListener('keydown', key, true);
    return () => document.removeEventListener('keydown', key, true);
  }, [menu, onLater]);
  const pick = (id) => { onSound(id); setBlocked(false); if (id === 'off') stopSynthSound('savings'); else playSynthSound(id, 'savings').then((played) => setBlocked(!played)); };
  return <div className="sv2-scrim" onMouseDown={(event) => { if (event.target === event.currentTarget) onLater(); }}>
    <section ref={dialog} className="sv2" role="dialog" aria-modal="true" aria-labelledby="sv2-title">
      <i className="sv2-glow" aria-hidden="true"/>
      <header className="sv2-top">
        <span className="sv2-eb"><b aria-hidden="true"/><span id="sv2-title">Savings transfer reminder</span></span>
        <button type="button" className="sv2-ib" aria-label="Alert sound" aria-expanded={menu} title="Alert sound" onClick={() => setMenu((open) => !open)}><Volume2 size={16}/></button>
        <button type="button" className="sv2-ib" aria-label="Close savings reminder" title="Close" onClick={onLater}><X size={16}/></button>
      </header>
      {menu && <div className="sv2-snd" role="menu" aria-label="Alert sound">
        <h6>Alert sound</h6>
        {[...SAVINGS_SOUNDS, { id: 'off', name: 'Silent', note: 'No sound' }].map((item) => <button key={item.id} type="button" role="menuitemradio" aria-checked={sound === item.id} className={`sv2-so ${sound === item.id ? 'is-on' : ''}`} onClick={() => pick(item.id)}>
          <span className="sv2-pl" aria-hidden="true">{item.id === 'off' ? <X size={12}/> : <Play size={11} fill="currentColor"/>}</span><span><b>{item.name}</b><small>{item.note}</small></span>
        </button>)}
      </div>}
      <div className="sv2-hero">
        <div className="sv2-badge" aria-hidden="true"><i/><i/><span><Landmark size={30} strokeWidth={1.8}/></span></div>
        <p className="sv2-lab">Ready to move to Savings</p>
        <div className="sv2-amt">{money(shown)}</div>
        <p className="sv2-sub">Profit since your last cash movement is ready to be set aside.</p>
        {blocked && <button type="button" className="sv2-play" onClick={() => pick(sound)}><Play size={12} fill="currentColor"/>Play sound</button>}
      </div>
      <div className="sv2-body">
        <div className="sv2-split">
          <div className="sv2-sh"><span>Profit since last cash movement</span><b>{money(profit)}</b></div>
          <div className="sv2-bar" aria-hidden="true"><i style={{ '--sv2-w': `${pct}%` }}/></div>
          <div className="sv2-legend"><span><u/>To savings <b>{money(total)}</b></span><span><u className="is-stay"/>Stays in account <b>{money(stays)}</b></span></div>
        </div>
        {rows.map((row) => <div className="sv2-row" key={row.id}>
          <span className="sv2-d" aria-hidden="true"><Landmark size={18}/></span>
          <span className="sv2-n"><b>{row.name}</b><small>{row.owner}</small></span>
          <span className="sv2-pct">{row.pct}%</span><em>+{money(row.amount)}</em>
        </div>)}
      </div>
      <footer className="sv2-act">
        <button type="button" className="sv2-btn" onClick={onLater}>Later</button>
        <button ref={primary} type="button" className="sv2-btn is-pri" onClick={onOpenFinance}>Open Finance<ArrowRight size={16}/></button>
      </footer>
    </section>
  </div>;
}
