import React, {useEffect, useMemo, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {ArrowRight, BookOpen, CircleAlert, Settings, X} from 'lucide-react';
import {mobileChallengeCounts, mobileChallengeLevelState, mobileChallengeRanges, mobileChallengeRowStatus} from './mobileChallengesV6Model.js';
import './mobileChallengesV6.css';

export {mobileChallengeCounts, mobileChallengeLevelState};

const rewardRatio = row => row.risk ? Number((row.profit / row.risk).toFixed(2)) : 0;
const sheetHost = () => document.querySelector('.tj-root') || document.body;

function useSheetKeys(onClose) {
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement;
    const keydown = event => { if (event.key === 'Escape') { event.preventDefault(); close.current(); } };
    document.addEventListener('keydown', keydown);
    return () => { document.removeEventListener('keydown', keydown); if (previous?.isConnected) previous.focus(); };
  }, []);
}

function RulesSheet({rules, onClose}) {
  useSheetKeys(onClose);
  return createPortal(<div className="tj-mc6-sheet-layer" role="presentation">
    <button type="button" className="tj-mc6-sheet-dismiss" aria-label="Close challenge rules" onClick={onClose}/>
    <section className="tj-mc6-sheet" role="dialog" aria-modal="true" aria-label={rules.title}>
      <i aria-hidden="true" className="tj-mc6-sheet-handle"/>
      <header><h2>{rules.title}</h2><button type="button" autoFocus aria-label="Close challenge rules" onClick={onClose}><X size={16}/></button></header>
      <div className="tj-mc6-sheet-body">{rules.items.map(([label, description]) => <div className="tj-mc6-rule" key={label}><b>{label}</b><p>{description}</p></div>)}</div>
    </section>
  </div>, sheetHost());
}

function StatusSheet({row, status, shownStatus, note, locked, challenge, onClose}) {
  const [nextStatus, setNextStatus] = useState(shownStatus);
  const [noteDraft, setNoteDraft] = useState(note || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useSheetKeys(onClose);
  const save = async () => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      if (!locked && nextStatus !== shownStatus && nextStatus !== status && await challenge.setStatus(row.level, nextStatus) === false) throw new Error('This level cannot be changed while the challenge is locked.');
      if (noteDraft !== note && await challenge.setNote(row.level, noteDraft) === false) throw new Error('Could not save this level note.');
      onClose();
    } catch (failure) { setError(failure.message || 'Could not save level details.'); }
    finally { setBusy(false); }
  };
  return createPortal(<div className="tj-mc6-sheet-layer" role="presentation">
    <button type="button" className="tj-mc6-sheet-dismiss" aria-label="Close level details" onClick={onClose}/>
    <section className="tj-mc6-sheet" role="dialog" aria-modal="true" aria-label={`Level ${row.level} status`}>
      <i aria-hidden="true" className="tj-mc6-sheet-handle"/>
      <header><h2>Level {row.level} status</h2><button type="button" autoFocus aria-label="Close level details" onClick={onClose}><X size={16}/></button></header>
      <div className="tj-mc6-sheet-body">
        <fieldset disabled={locked || status === 'Jumped'} className="tj-mc6-status-edit"><legend>Level status</legend>{[['', 'Not started'], ['In progress', 'In progress'], ['Pass', 'Passed'], ['Step back', 'Step back']].map(([value, label]) => <button type="button" key={label} aria-pressed={nextStatus === value} data-status={label} onClick={() => setNextStatus(value)}>{label}</button>)}</fieldset>
        {status === 'Jumped' && <p className="tj-mc6-sheet-lock">This level was funded by a deposit, so its status can't be changed.</p>}
        {locked && <p className="tj-mc6-sheet-lock">Trading progress has locked status changes. Your saved note remains editable.</p>}
        <label className="tj-mc6-note"><span>Level note</span><textarea value={noteDraft} maxLength={2000} placeholder="Add a note about this level" onChange={event => setNoteDraft(event.target.value)} disabled={busy}/></label>
        {error && <p className="tj-mc6-sheet-error" role="alert">{error}</p>}
      </div>
      <footer><button type="button" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save level'}</button></footer>
    </section>
  </div>, sheetHost());
}

function LevelRow({row, rowStatus, isNow, open, adaptive, fmt, onToggle, onStatus}) {
  const growth = row.start ? (row.end / row.start - 1) * 100 : 0;
  return <div className={`tj-mc6-row is-${rowStatus.tone} ${open ? 'is-open' : ''}`}>
    <button type="button" className="tj-mc6-row-main" aria-expanded={open} onClick={onToggle}><span className="tj-mc6-dot">{row.level}</span><span className="tj-mc6-row-copy"><b>Level {row.level}{isNow && <em>Now</em>}</b><small>{fmt(row.start)} → {fmt(row.end)}</small></span></button>
    <button type="button" className={`tj-mc6-status is-${rowStatus.tone}`} aria-label={`Change status of level ${row.level}: ${rowStatus.label}`} onClick={onStatus}><span>{rowStatus.label}</span></button>
    {open && <div className="tj-mc6-row-detail">
      <div className="tj-mc6-row-tiles"><div className="is-risk"><small>Risk</small><b>{fmt(row.risk)}</b></div><div className="is-gain"><small>Profit</small><b>{fmt(row.profit)}</b></div><div><small>Growth</small><b>+{Math.round(growth)}%</b></div></div>
      <dl><div><dt>Risk percentage</dt><dd>{row.riskPct.toFixed(2)}%</dd></div><div><dt>Reward ratio</dt><dd>1:{rewardRatio(row)}</dd></div><div><dt>Stop loss</dt><dd>{adaptive ? 'Unavailable for adaptive sizing' : row.sl.toFixed(2)}</dd></div><div><dt>Take profit</dt><dd>{row.tp}</dd></div><div><dt>Lot size</dt><dd>{adaptive ? 'Unavailable' : `${row.lots.toFixed(2)} lots`}</dd></div></dl>
    </div>}
  </div>;
}

export default function MobileChallengesV6({account, plan, current, state, life, failed, complete, modeName, rewardLabel, adaptive, failureFloor, linked, fmt, challenge, locked, settingsLocked, onOpenSettings, error, onRetry, rules, rail, order = 0, completionArchived, onContinueAdaptive}) {
  const [rulesOpen, setRulesOpen] = useState(false);
  const [statusLevel, setStatusLevel] = useState(null);
  const currentLevel = current.level;
  const ranges = useMemo(() => mobileChallengeRanges(plan.length), [plan.length]);
  const currentRange = Math.max(0, ranges.findIndex(range => currentLevel >= range.from && currentLevel <= range.to));
  const [rangeIndex, setRangeIndex] = useState(currentRange);
  const [openLevel, setOpenLevel] = useState(currentLevel);
  const heroRef = useRef(null);
  const selected = !rail || rail.selectedId === account.id;
  useEffect(() => { setOpenLevel(currentLevel); setRangeIndex(currentRange); }, [currentLevel, currentRange]);
  useEffect(() => { if (selected && !rail?.userMoved.current && rail?.railEl && heroRef.current) rail.railEl.scrollTo({left:heroRef.current.offsetLeft - rail.railEl.offsetLeft}); }, [selected, rail?.railEl]);
  const range = ranges[Math.min(rangeIndex, ranges.length - 1)];
  const rows = plan.filter(row => row.level >= range.from && row.level <= range.to);
  const statusRow = statusLevel ? plan.find(row => row.level === statusLevel) : null;
  const rawStatus = level => state.statuses?.[level] || '';
  const statusNote = statusRow ? state.notes?.[statusRow.level] || (rawStatus(statusRow.level) === 'Jumped' ? state.fundingJumps?.[statusRow.level] || 'Jumped due to balance' : '') : '';
  const riskLabel = adaptive ? 'Maximum drawdown' : 'Loss streak';
  const riskValue = adaptive ? `${state.automation?.adaptiveDrawdownPct ?? 10}%` : `${state.lossStreak || 0}`;

  const hero = <article ref={heroRef} className="tj-mc6-card" data-card-id={account.id} style={{order}} aria-label={`${account.name} challenge`}>
    <header><h2>{account.name}</h2><b className={failed ? 'is-failed' : complete ? 'is-complete' : 'is-active'}>{failed ? 'Paused' : complete ? 'Complete' : 'Active'}</b></header>
    <div className="tj-mc6-tags"><span>{modeName}</span><span>{rewardLabel || `1:${rewardRatio(current)}`}</span></div>
    <div className="tj-mc6-level"><b>Level {currentLevel}</b><small>of {plan.length}</small></div>
    <div className="tj-mc6-segments" aria-hidden="true">{plan.map(row => { const status = mobileChallengeRowStatus(state, row.level, currentLevel, failed); return <i key={row.level} className={row.level === currentLevel ? 'is-now' : `is-${status.tone}`}/>; })}</div>
    <div className="tj-mc6-two"><div><span>This level</span><b>{fmt(current.start)} <em>→</em> {fmt(current.end)}</b></div><div><span>Full target</span><b className="is-gain">{fmt(plan.at(-1)?.end)}</b></div></div>
    <div className="tj-mc6-mini"><span><b>{linked}</b> trade{linked === 1 ? '' : 's'} taken</span><span><b>{state.stepBacks || 0}</b> step-back{state.stepBacks === 1 ? '' : 's'}</span></div>
    {complete && <div className="tj-mc6-complete"><span>Challenge completed</span><b>All {plan.length} levels are complete.</b><small>{completionArchived ? 'Certificate saved in Journal Setup.' : 'Complete the certificate to archive this achievement.'}</small><button type="button" onClick={onContinueAdaptive}>Continue with Adaptive <ArrowRight size={14}/></button></div>}
    <div className="tj-mc6-buttons"><button type="button" onClick={() => setRulesOpen(true)}><BookOpen size={15}/>Rules</button><button type="button" aria-label={`Open ${account.name} challenge settings`} onClick={onOpenSettings}><Settings size={15}/>Settings</button></div>
  </article>;

  const lower = <section className="tj-mobile-challenges-v6" aria-label={`${account.name} plan`}>
    {error && <p className="tj-mc6-error" role="alert">{error} <button type="button" onClick={onRetry}>Retry</button></p>}
    {failed && <p className="tj-mc6-failed"><CircleAlert size={16}/> Challenge paused. Available capital is below {fmt(failureFloor)}.</p>}
    <div className="tj-mc6-tiles">
      <div className="is-gain"><span>Available capital</span><b>{fmt(life.liveBalance)}</b></div>
      <div className="is-amber"><span>{riskLabel}</span><b>{riskValue}</b></div>
      <div className="is-risk"><span>Risk at level start</span><b>{fmt(current.risk)}</b></div>
      <div className="is-gain"><span>Profit target</span><b>{fmt(current.profit)}</b></div>
    </div>
    <h2 className="tj-mc6-plan-title">Compounding plan</h2>
    {ranges.length > 1 && <div className="tj-mc6-chips">{ranges.map((item, index) => <button type="button" key={item.label} aria-pressed={index === rangeIndex} onClick={() => setRangeIndex(index)}><span>{item.label}</span></button>)}</div>}
    <div className="tj-mc6-timeline">{rows.map(row => <LevelRow key={row.level} row={row} rowStatus={mobileChallengeRowStatus(state, row.level, currentLevel, failed)} isNow={row.level === currentLevel} open={openLevel === row.level} adaptive={adaptive} fmt={fmt} onToggle={() => setOpenLevel(level => level === row.level ? null : row.level)} onStatus={() => setStatusLevel(row.level)}/>)}</div>
  </section>;

  return <>
    {rail?.railEl ? createPortal(hero, rail.railEl) : !rail ? hero : null}
    {selected && (rail?.lowerEl ? createPortal(lower, rail.lowerEl) : !rail ? lower : null)}
    {rulesOpen && <RulesSheet rules={rules} onClose={() => setRulesOpen(false)}/>}
    {statusRow && <StatusSheet row={statusRow} status={rawStatus(statusRow.level)} shownStatus={rawStatus(statusRow.level) || mobileChallengeRowStatus(state, statusRow.level, currentLevel, failed).value} note={statusNote} locked={locked || settingsLocked} challenge={challenge} onClose={() => setStatusLevel(null)}/>}
  </>;
}
