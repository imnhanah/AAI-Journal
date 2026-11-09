// Desktop "challenge complete" celebration and certificate, after
// aaicorefx-desktop-finance-challenge-popups.html. ChallengeCelebration.jsx supplies the facts;
// every figure shown here comes from the trader's own challenge.
import { Play } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { playSynthSound, stopSynthSound, unlockSynthSounds } from './synthSounds';
import { downloadCertificate } from './certificateExport';
import './desktopPopups.css';

const CONFETTI = ['var(--celebrate-gold)', 'var(--accent)', 'var(--tj-blue)', 'var(--celebrate-gold-hi)', 'var(--tj-green)', 'var(--loss)', 'var(--tj-purple)'];

function Trophy() {
  return <svg className="cc2-trophy" viewBox="0 0 140 140" aria-hidden="true">
    <defs><linearGradient id="trophy-gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style={{ stopColor: 'var(--celebrate-gold-hi)' }}/><stop offset=".5" style={{ stopColor: 'var(--celebrate-gold)' }}/><stop offset="1" style={{ stopColor: 'var(--celebrate-gold-deep)' }}/></linearGradient></defs>
    <path d="M30 20c-18 0-22 28 2 40M110 20c18 0 22 28-2 40" fill="none" stroke="url(#trophy-gold)" strokeWidth="7" strokeLinecap="round"/>
    <path d="M32 12h76v34c0 24-17 40-38 40S32 70 32 46z" fill="url(#trophy-gold)"/>
    <path d="M44 20h8v40c-6-6-8-14-8-24z" className="cc2-shine" opacity=".35"/>
    <rect x="62" y="84" width="16" height="18" className="cc2-stem"/>
    <path d="M42 122c0-12 12-20 28-20s28 8 28 20z" fill="url(#trophy-gold)"/>
    <rect x="38" y="120" width="64" height="10" rx="4" className="cc2-base"/>
    <path d="M56 46l10 10 20-22" fill="none" className="cc2-tick" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>;
}

function Seal() {
  return <svg viewBox="0 0 100 100" aria-hidden="true">
    <defs><linearGradient id="seal-gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style={{ stopColor: 'var(--celebrate-gold-hi)' }}/><stop offset=".55" style={{ stopColor: 'var(--celebrate-gold)' }}/><stop offset="1" style={{ stopColor: 'var(--celebrate-gold-deep)' }}/></linearGradient></defs>
    <path d="M30 60 22 98l18-9 10 12 4-30z" className="cc2-ribbon"/><path d="M70 60l8 38-18-9-10 12-4-30z" className="cc2-ribbon is-b"/>
    <path d="M50 4l7 6 9-2 4 8 9 3-1 9 7 6-5 8 3 9-8 5-1 9-9 1-6 7-8-4-8 4-6-7-9-1-1-9-8-5 3-9-5-8 7-6-1-9 9-3 4-8 9 2z" fill="url(#seal-gold)"/>
    <circle cx="50" cy="46" r="26" fill="none" className="cc2-seal-ring" strokeWidth="2" opacity=".85"/>
    <path d="M38 47l9 9 17-19" fill="none" className="cc2-tick" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>;
}

function useCountUp(target, duration = 2200) {
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

export default function ChallengeCompletePopup({ facts, money, soundEnabled = true, onViewJourney, onClose }) {
  const { traderName, accountName, totalLevels, modeName, rewardLabel, finalTarget, daysTaken, trades, stepBacks, growth, completedAt, certificateId } = facts;
  const [view, setView] = useState('popup');
  const [blocked, setBlocked] = useState(false);
  const [saving, setSaving] = useState('');
  const [saveError, setSaveError] = useState('');
  const started = useRef(false), primary = useRef(null), dialog = useRef(null), certificate = useRef(null);
  const shown = useCountUp(finalTarget || 0);
  const levels = Math.max(1, totalLevels || 1);
  const bars = useMemo(() => Array.from({ length: levels }, (_, i) => 8 + Math.pow(levels === 1 ? 1 : i / (levels - 1), 1.9) * 64), [levels]);
  const confetti = useMemo(() => Array.from({ length: 60 }, (_, i) => ({ left: `${(i * 37 + 11) % 100}%`, color: CONFETTI[i % CONFETTI.length], d: `${3 + ((i * 7) % 25) / 10}s`, l: `${((i * 13) % 30) / 10}s`, x: `${((i * 29) % 140) - 70}px`, r: `${(i * 53) % 720}deg` })), []);
  const date = completedAt ? new Date(completedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
  const name = traderName || accountName;
  const portalClass = typeof document !== 'undefined' && document.documentElement.dataset.theme === 'light' ? 'tj-root tj-theme-light' : 'tj-root tj-theme-dark';
  const inViewport = content => createPortal(<div className={portalClass}>{content}</div>, document.body);
  useEffect(() => {
    const previous = document.activeElement;
    primary.current?.focus({ preventScroll: true });
    return () => { stopSynthSound('challenge'); if (previous?.isConnected) previous.focus?.({ preventScroll: true }); };
  }, []);
  useEffect(() => {
    if (started.current || !soundEnabled) return;
    started.current = true;
    playSynthSound('challenge').then((played) => setBlocked(!played));
  }, [soundEnabled]);
  useEffect(() => { primary.current?.focus({ preventScroll: true }); }, [view]);
  const keys = (event) => {
    if (event.key === 'Escape') { event.stopPropagation(); if (view === 'certificate') setView('popup'); else onClose(); }
    if (event.key === 'Tab') {
      const buttons = dialog.current?.querySelectorAll('button:not(:disabled)');
      if (!buttons?.length) return;
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  };
  const stats = [[daysTaken ?? '—', 'Days taken'], [trades ?? '—', 'Trades'], [stepBacks ?? 0, 'Step-backs'], [growth == null ? '—' : `${growth > 0 ? '+' : ''}${growth.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`, 'Growth']];
  const saveCertificate = async (kind) => {
    setSaving(kind); setSaveError('');
    try { await downloadCertificate(certificate.current, name, kind); }
    catch { setSaveError('Could not create the certificate file. Please try again.'); }
    finally { setSaving(''); }
  };
  if (view === 'certificate') return inViewport(<div ref={dialog} className="cc2-cv" role="dialog" aria-modal="true" aria-label="Certificate of achievement" onKeyDown={keys} onMouseDown={(event) => { if (event.target === event.currentTarget) setView('popup'); }}>
    <div className="cc2-wrap">
      <div ref={certificate} className="cc2-cert">
        <i className="cc2-b1"/><i className="cc2-b2"/><i className="cc2-cn is-a"/><i className="cc2-cn is-b"/><i className="cc2-cn is-c"/><i className="cc2-cn is-d"/><i className="cc2-sh"/>
        <div className="cc2-cin">
          <div className="cc2-brand">AAICOREFX · Trading Journal</div>
          <div className="cc2-ttl">Certificate of Achievement</div>
          <div className="cc2-orn" aria-hidden="true"><i/>◆<i/></div>
          <div className="cc2-cer">This certifies that</div>
          <div className="cc2-nm">{name}</div>
          <p className="cc2-txt">has completed all <b>{totalLevels} levels</b> of the <b>{accountName} · {modeName}</b> challenge{rewardLabel ? <> at <b>{rewardLabel}</b></> : null}, respecting every risk rule from the first level to the last.</p>
          <div className="cc2-row">{[[money(finalTarget), 'Final target'], ...stats.slice(0, 2), stats[3]].map(([value, label]) => <div key={label}><b>{value}</b><span>{label}</span></div>)}</div>
          <div className="cc2-bars" aria-hidden="true">{bars.map((h, i) => <i key={i} style={{ '--h': `${Math.round(h * 40 / 72)}px`, '--n': i }}/>)}</div>
          <div className="cc2-foot">
            <div className="cc2-sg"><div className="cc2-l">{date}</div><span>Date completed</span></div>
            <div className="seal-gold"><Seal/></div>
            <div className="cc2-sg"><div className="cc2-l">AAICOREFX</div><span>Issued by</span></div>
          </div>
          <div className="cc2-cid">Certificate No. {certificateId}</div>
        </div>
      </div>
      <div className="cc2-bar">
        <button ref={primary} type="button" className="cc2-cbtn is-pri" disabled={!!saving} onClick={() => saveCertificate('pdf')}>{saving === 'pdf' ? 'Saving…' : 'Save PDF'}</button>
        <button type="button" className="cc2-cbtn" disabled={!!saving} onClick={() => saveCertificate('image')}>{saving === 'image' ? 'Saving…' : 'Save image'}</button>
        <button type="button" className="cc2-cbtn" onClick={() => setView('popup')}>Back</button>
        <button type="button" className="cc2-cbtn" onClick={onClose}>Close</button>
      </div>
      {saveError && <p className="cc2-save-error" role="alert">{saveError}</p>}
    </div>
  </div>);
  return inViewport(<div ref={dialog} className="cc2-scrim" role="dialog" aria-modal="true" aria-labelledby="cc2-title" onKeyDown={keys} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="cc2">
      <div className="cc2-cf" aria-hidden="true">{confetti.map((c, i) => <i key={i} style={{ left: c.left, background: c.color, '--d': c.d, '--l': c.l, '--x': c.x, '--r': c.r }}/>)}</div>
      <div className="cc2-top">
        <i className="cc2-rays" aria-hidden="true"/>
        <button type="button" className="cc2-x" aria-label="Close" onClick={onClose}>✕</button>
        <div className="cc2-tag">★ Full challenge complete ★</div>
        <Trophy/>
      </div>
      <div className="cc2-in">
        <h2 id="cc2-title">You conquered all {totalLevels} levels</h2>
        <p className="cc2-sub">Congratulations{traderName ? `, ${traderName}` : ''}. Every level cleared by respecting its rules. This is rare discipline.</p>
        <div className="cc2-chips"><span>{accountName}</span><span>{modeName}</span>{rewardLabel && <span>{rewardLabel}</span>}</div>
        <div className="cc2-big">
          <small>Full challenge target reached</small>
          <div className="cc2-amt">{money(shown)}</div>
          <div className="cc2-lv" style={{ '--levels': levels }} aria-hidden="true">{bars.map((h, i) => <i key={i} style={{ '--n': i, '--h': `${h}px` }}/>)}</div>
          <div className="cc2-lvl"><span>Level 1</span><span>Level {totalLevels} · {totalLevels} of {totalLevels} passed</span></div>
        </div>
        <div className="cc2-stats">{stats.map(([value, label]) => <div key={label}><b>{value}</b><span>{label}</span></div>)}</div>
        {blocked && <button type="button" className="cc2-play" onClick={async () => { if (await unlockSynthSounds()) setBlocked(!await playSynthSound('challenge')); }}><Play size={12} fill="currentColor"/>Play celebration sound</button>}
        {onViewJourney && <button type="button" className="cc2-link" onClick={onViewJourney}>View your journey</button>}
        <div className="cc2-cta"><button type="button" className="cc2-btn" onClick={onClose}>Later</button><button ref={primary} type="button" className="cc2-btn is-pri" onClick={() => setView('certificate')}>View certificate</button></div>
      </div>
    </section>
  </div>);
}
