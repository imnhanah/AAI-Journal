import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Trophy, CheckCircle2, ArrowDown, Target } from 'lucide-react';
import { buildChallengePlan, isChallengeEnabled } from './challengeModel';
import { challengeStartingBalance, liveChallengeBalance } from './challengeLifecycle';
import { activeBalances, isMultiBalanceWorkspace } from './balanceModel';
import useBalanceChallenge from './useBalanceChallenge';
import './challenge.css';
import { ThemeSelect } from './JournalControls';
import JournalSignalHeader from './JournalSignalHeader';
import ChallengeLifecyclePage from './ChallengeLifecyclePage';

const currencySymbols = { USD: '$', EUR: '€', GBP: '£', GHS: '₵' };
const money = (value, currency = 'USD') => `${currencySymbols[currency] || '$'}${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const statusClass = status => status === 'Pass' ? 'pass' : status === 'Step back' ? 'back' : status === 'In progress' ? 'progress' : '';
const isClosedTrade = trade => Boolean(trade?.closeDate) && trade?.status !== 'open';
const balanceNetPnl = (trades, balanceId) => (trades || []).reduce((total, trade) => {
  if (!isClosedTrade(trade)) return total;
  const result = balanceId ? (trade.balanceResults || []).find((item) => item.balanceId === balanceId) : null;
  if (balanceId && !result) return total;
  const net = result
    ? Number(result.netPnl ?? (Number(result.grossPnl || 0) - Number(result.commission || 0) - Number(result.swap || 0)))
    : Number(trade.pnl || 0);
  return total + (Number.isFinite(net) ? net : 0);
}, 0);
const POPPER_PARTICLES = Array.from({ length: 76 }, (_, index) => {
  const fan = (index % 38) / 37;
  const radius = 310 + (index % 6) * 52;
  const angle = Math.PI * fan;
  return {
    origin: index % 2 === 0 ? -36 : 36,
    x: Math.round(Math.cos(angle) * radius),
    y: -Math.round(82 + Math.sin(angle) * (255 + (index % 5) * 34)),
    turn: `${index % 2 === 0 ? 1 : -1}turn`,
    delay: `${(index % 7) * 28}ms`,
  };
});

function useCompletionCelebration(complete) {
  const wasComplete = useRef(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (complete && !wasComplete.current) setOpen(true);
    wasComplete.current = complete;
  }, [complete]);
  return [open, setOpen];
}

function ChallengeCompletionCelebration({ accountName, totalLevels, onClose }) {
  return <div className="tj-challenge-celebration-overlay" onMouseDown={event=>{if(event.target===event.currentTarget)onClose();}} role="dialog" aria-modal="true" aria-labelledby="challenge-complete-title">
    <div className="tj-challenge-confetti" aria-hidden="true">{POPPER_PARTICLES.map((particle, index) => <i key={index} style={{ "--origin": `${particle.origin}px`, "--burst-x": `${particle.x}px`, "--burst-y": `${particle.y}px`, "--turn": particle.turn, "--delay": particle.delay }} />)}</div>
    <section className="tj-challenge-completion-card">
      <div className="tj-challenge-completion-trophy"><Trophy size={31} /></div>
      <span>CHALLENGE COMPLETE</span>
      <h2 id="challenge-complete-title">You did it.</h2>
      <p>{accountName} has completed {totalLevels ? `all ${totalLevels} levels` : 'the full challenge plan'}. Take a moment to celebrate the patience, courage, and discipline that brought you here.</p>
      <button type="button" className="tj-btn-primary" onClick={onClose}>Continue</button>
    </section>
  </div>;
}

export default function ChallengePage(props) {
  return <ChallengeLifecyclePage {...props}/>;
}

function MultiBalanceChallengePage({ account, loginQuote, userId }) {
  const balances = activeBalances(account).filter((balance) => balance.challengeEnabled && Number(balance.startingBalance) > 0);
  const signalProgress = useBalanceChallenge(balances[0] ? { ...balances[0], trades:account.trades || [] } : null, userId);
  const signalChallenge = { ...signalProgress.state, loading:signalProgress.loading, error:signalProgress.error, automation:{ ...(signalProgress.state.automation || {}), levelCount:signalProgress.state.automation?.levelCount || balances[0]?.challengeLevelCount || 30 } };
  useEffect(() => {
    const panels = [...document.querySelectorAll('.tj-balance-challenge-panel')];
    if (panels.length < 2) return undefined;
    const cleanups = panels.map((panel, index) => {
      const header = panel.querySelector(':scope > header');
      if (!header) return () => {};
      const setExpanded = (expanded) => {
        panel.classList.toggle('tj-balance-challenge-collapsed', !expanded);
      };
      setExpanded(index === 0);
      // Participate in the journal's pointer-light system without becoming a
      // keyboard-tab stop (which would draw the global focus rectangle).
      header.tabIndex = -1;
      const toggle = (event) => {
        if (event.target.closest('button, a, input, select, textarea')) return;
        setExpanded(panel.classList.contains('tj-balance-challenge-collapsed'));
      };
      header.addEventListener('click', toggle);
      return () => header.removeEventListener('click', toggle);
    });
    return () => cleanups.forEach((cleanup) => cleanup());
  }, [balances.length]);
  if (!balances.length) return <section className="tj-challenge"><JournalSignalHeader page="challenge" challenge={signalChallenge} loginQuote={loginQuote}/><div className="tj-panel"><strong>No account challenge is enabled.</strong><p>Open Account Settings → Accounts to enable a challenge for an account.</p></div></section>;
  return <section className="tj-challenge"><JournalSignalHeader page="challenge" challenge={signalChallenge} loginQuote={loginQuote}/><header className="tj-challenge-heading"><div><h2><Trophy size={21}/> Challenges</h2><p>{account.name}</p></div></header><div className="tj-balance-challenge-stack">{balances.map((balance) => <BalanceChallengePanel key={balance.id} balance={balance} trades={account.trades || []} userId={userId}/>)}</div></section>;
}

function BalanceChallengePanel({ balance, trades, userId }) {
  const [completion, setCompletion] = useState({ complete:false, totalLevels:30 });
  const [showCelebration, setShowCelebration] = useCompletionCelebration(completion.complete);
  const onCompletionChange = useCallback((complete, totalLevels) => setCompletion((current) => current.complete === complete && current.totalLevels === totalLevels ? current : { complete, totalLevels }), []);
  return <><BalanceChallengePanelContentNew balance={balance} trades={trades} userId={userId} onCompletionChange={onCompletionChange}/>{showCelebration && <ChallengeCompletionCelebration accountName={balance.name} totalLevels={completion.totalLevels} onClose={() => setShowCelebration(false)} />}</>;
}

function BalanceChallengePanelContentNew({ balance, trades, userId, onCompletionChange }) {
  const challenge = useBalanceChallenge({ ...balance, trades }, userId);
  const [details, setDetails] = useState(false);
  const activeRow = useRef(null);
  const challengeAccount = {...balance,trades};
  const accountBalance = challengeStartingBalance(challenge.state,challengeAccount);
  const plan = buildChallengePlan(accountBalance, balance.challengeMode || 'risk', challenge.state.automation?.levelCount || balance.challengeLevelCount);
  const totalLevels = plan.length;
  const passed = Object.values(challenge.state.statuses || {}).filter((status) => status === 'Pass').length;
  const activeLevel = Math.min(Math.max(Number(challenge.state.activeLevel) || 1, 1), totalLevels);
  const current = plan[activeLevel - 1];
  const complete = Number(challenge.state.activeLevel) === totalLevels + 1 || passed === totalLevels;
  const currentBalance = liveChallengeBalance(challengeAccount);
  const currentBalanceClass = currentBalance >= accountBalance ? 'tj-challenge-positive' : 'tj-challenge-negative';
  useEffect(() => onCompletionChange(complete, totalLevels), [complete, totalLevels, onCompletionChange]);
  return <article className="tj-panel tj-balance-challenge-panel">
    <header><div><h3>{balance.name}</h3><p>{balance.challengeMode === 'streak' ? 'Mode 2 — Two-Loss Streak' : 'Mode 1 — Risk Limit'} · {totalLevels} levels</p></div></header>
    {challenge.error && <div role="alert" className="tj-balance-challenge-error">{challenge.error} <button type="button" onClick={challenge.retry}>Retry</button></div>}
    <div className="tj-challenge-metrics">
      <article className="tj-panel tj-challenge-metric-split"><div><small>STARTING BALANCE</small><strong>{money(accountBalance, balance.baseCurrency)}</strong></div><div className="tj-challenge-metric-side"><small>CURRENT BALANCE</small><strong className={currentBalanceClass}>{money(currentBalance, balance.baseCurrency)}</strong></div></article>
      <article className="tj-panel tj-challenge-metric-split"><div><small>ACTIVE LEVEL</small><strong>{complete ? 'Complete' : `${activeLevel} / ${totalLevels}`}</strong><span>{complete ? 'All levels reached' : <><b className="tj-challenge-negative">{money(current.risk, balance.baseCurrency)}</b> planned risk</>}</span></div><div className="tj-challenge-metric-side"><small>PROFIT TARGET</small><strong className="tj-challenge-positive">{complete ? '—' : money(current.profit, balance.baseCurrency)}</strong></div></article>
      <article className="tj-panel"><small>LEVELS PASSED</small><strong>{passed} / {totalLevels}</strong><progress aria-label={`${balance.name} levels passed`} value={passed} max={totalLevels}/></article>
      <article className="tj-panel"><small>PLANNED FINAL BALANCE</small><strong className="tj-challenge-positive">{money(plan.at(-1).end, balance.baseCurrency)}</strong><span>Small beginnings can grow into a life you are proud of.</span></article>
    </div>
    <div className="tj-panel tj-challenge-current"><Target size={20}/><div><strong>{complete ? 'Challenge complete' : `Level ${current.level} · ${money(current.start, balance.baseCurrency)} → ${money(current.end, balance.baseCurrency)}`}</strong></div><button className="tj-btn" onClick={() => activeRow.current?.scrollIntoView({ behavior:'smooth', block:'center' })}><ArrowDown size={14}/> {complete ? 'Final level' : 'Active level'}</button></div>
    <div className="tj-challenge-table-head"><div><h3>Compounding plan</h3><p>Every disciplined step compounds into the life you want.</p></div><label><input type="checkbox" checked={details} onChange={(event) => setDetails(event.target.checked)}/> Show sizing details</label></div>
    <div className="tj-challenge-scroll" role="region" aria-label={`${balance.name} ${totalLevels}-level compounding plan`} tabIndex={0}><table><thead><tr><th>Level</th><th>Starting balance</th><th>Risk amount</th><th>Profit amount</th><th>Ending balance</th>{details && <><th>Risk %</th><th>Profit %</th><th>SL pips</th><th>TP pips</th><th>Std. lots</th></>}<th>Status</th><th>Notes</th></tr></thead><tbody>{plan.map((row) => <tr data-milestone={[10, 20, 30].includes(row.level) ? row.level : undefined} key={row.level} ref={row.level === activeLevel ? activeRow : null} className={row.level === activeLevel ? 'tj-challenge-active' : ''}><th scope="row">{row.level}{[10,20,30].includes(row.level) && <span className="tj-challenge-milestone-badge"><Trophy size={12} aria-hidden="true"/> Milestone</span>}</th><td>{money(row.start, balance.baseCurrency)}</td><td className="tj-challenge-negative">{money(row.risk, balance.baseCurrency)}</td><td className="tj-challenge-positive">{money(row.profit, balance.baseCurrency)}</td><td><b>{money(row.end, balance.baseCurrency)}</b></td>{details && <><td>{row.riskPct.toFixed(2)}%</td><td>{row.profitPct.toFixed(2)}%</td><td>{row.sl.toFixed(2)}</td><td>{row.tp}</td><td>{row.lots.toFixed(2)}</td></>}<td><ThemeSelect disabled={challenge.loading || challenge.saving} aria-label={`${balance.name} level ${row.level} status`} className={`tj-challenge-status ${statusClass(challenge.state.statuses[row.level])}`} value={challenge.state.statuses[row.level] || ''} onChange={(event) => challenge.setStatus(row.level, event.target.value)}><option value="">Not started</option><option>Pass</option><option>In progress</option><option>Step back</option></ThemeSelect></td><td><input disabled={challenge.loading || challenge.saving} className="tj-input" aria-label={`${balance.name} level ${row.level} notes`} placeholder="Add a note…" maxLength={2000} defaultValue={challenge.state.notes[row.level] || ''} onBlur={(event) => { if (event.target.value !== (challenge.state.notes[row.level] || '')) challenge.setNote(row.level, event.target.value); }}/></td></tr>)}</tbody></table></div>
  </article>;
}

function BalanceChallengePanelContent({ balance, trades, userId, onCompletionChange }) {
  const challenge = useBalanceChallenge({ ...balance, trades }, userId);
  const [details, setDetails] = useState(false);
  const activeRow = useRef(null);
  const challengeAccount = {...balance,trades};
  const accountBalance = challengeStartingBalance(challenge.state,challengeAccount);
  const plan = buildChallengePlan(accountBalance, balance.challengeMode || 'risk', challenge.state.automation?.levelCount);
  const totalLevels = plan.length;
  const passed = Object.values(challenge.state.statuses || {}).filter((status) => status === 'Pass').length;
  const activeLevel = Math.min(Math.max(Number(challenge.state.activeLevel) || 1, 1), totalLevels);
  const current = plan[activeLevel - 1];
  const complete = Number(challenge.state.activeLevel) === totalLevels + 1 || passed === totalLevels;
  useEffect(() => onCompletionChange(complete), [complete, onCompletionChange]);
  const currentBalance = liveChallengeBalance(challengeAccount);
  const currentBalanceClass = currentBalance >= accountBalance ? 'tj-challenge-positive' : 'tj-challenge-negative';
  return <article className="tj-panel tj-balance-challenge-panel"><header><div><h3>{balance.name}</h3><p>{balance.challengeMode === 'streak' ? 'Mode 2 — Two-Loss Streak' : 'Mode 1 — Risk Limit'}</p></div></header>{challenge.error && <div role="alert" className="tj-balance-challenge-error">{challenge.error} <button type="button" onClick={challenge.retry}>Retry</button></div>}<div className="tj-challenge-metrics"><article className="tj-panel tj-challenge-metric-split"><div><small>STARTING BALANCE</small><strong>{money(accountBalance, balance.baseCurrency)}</strong><span>Build the life you want, one disciplined step at a time.</span></div><div className="tj-challenge-metric-side"><small>CURRENT BALANCE</small><strong className={currentBalanceClass}>{money(currentBalance, balance.baseCurrency)}</strong></div></article><article className="tj-panel tj-challenge-metric-split"><div><small>ACTIVE LEVEL</small><strong>{complete ? 'Complete' : `${activeLevel} / 30`}</strong><span>{complete ? 'All levels reached' : <><b className="tj-challenge-negative">{money(current.risk, balance.baseCurrency)}</b> planned risk</>}</span></div><div className="tj-challenge-metric-side"><small>PROFIT TARGET</small><strong className="tj-challenge-positive">{complete ? '—' : money(current.profit, balance.baseCurrency)}</strong></div></article><article className="tj-panel"><small>LEVELS PASSED</small><strong>{passed} / 30</strong><progress aria-label={`${balance.name} levels passed`} value={passed} max={30}/></article><article className="tj-panel"><small>PLANNED FINAL BALANCE</small><strong className="tj-challenge-positive">{money(plan.at(-1).end, balance.baseCurrency)}</strong><span>Small beginnings can grow into a life you are proud of.</span></article></div><div className="tj-panel tj-challenge-current"><Target size={20}/><div><strong>{complete ? 'Challenge complete' : `Level ${current.level} · ${money(current.start, balance.baseCurrency)} → ${money(current.end, balance.baseCurrency)}`}</strong></div><button className="tj-btn" onClick={() => activeRow.current?.scrollIntoView({ behavior:'smooth', block:'center' })}><ArrowDown size={14}/> {complete ? 'Final level' : 'Active level'}</button></div><div className="tj-challenge-table-head"><div><h3>Compounding plan</h3><p>Every disciplined step compounds into the life you want.</p></div><label><input type="checkbox" checked={details} onChange={(event) => setDetails(event.target.checked)}/> Show sizing details</label></div><div className="tj-challenge-scroll" role="region" aria-label={`${balance.name} 30-level compounding plan`} tabIndex={0}><table><thead><tr><th>Level</th><th>Starting balance</th><th>Risk amount</th><th>Profit amount</th><th>Ending balance</th>{details && <><th>Risk %</th><th>Profit %</th><th>SL pips</th><th>TP pips</th><th>Std. lots</th></>}<th>Status</th><th>Notes</th></tr></thead><tbody>{plan.map((row) => <tr data-milestone={[10, 20, 30].includes(row.level) ? row.level : undefined} key={row.level} ref={row.level === activeLevel ? activeRow : null} className={row.level === activeLevel ? 'tj-challenge-active' : ''}><th scope="row">{row.level}{[10,20,30].includes(row.level) && <span className="tj-challenge-milestone-badge"><Trophy size={12} aria-hidden="true"/> Milestone</span>}</th><td>{money(row.start, balance.baseCurrency)}</td><td className="tj-challenge-negative">{money(row.risk, balance.baseCurrency)}</td><td className="tj-challenge-positive">{money(row.profit, balance.baseCurrency)}</td><td><b>{money(row.end, balance.baseCurrency)}</b></td>{details && <><td>{row.riskPct.toFixed(2)}%</td><td>{row.profitPct.toFixed(2)}%</td><td>{row.sl.toFixed(2)}</td><td>{row.tp}</td><td>{row.lots.toFixed(2)}</td></>}<td><ThemeSelect disabled={challenge.loading || challenge.saving} aria-label={`${balance.name} level ${row.level} status`} className={`tj-challenge-status ${statusClass(challenge.state.statuses[row.level])}`} value={challenge.state.statuses[row.level] || ''} onChange={(event) => challenge.setStatus(row.level, event.target.value)}><option value="">Not started</option><option>Pass</option><option>In progress</option><option>Step back</option></ThemeSelect></td><td><input disabled={challenge.loading || challenge.saving} className="tj-input" aria-label={`${balance.name} level ${row.level} notes`} placeholder="Add a note…" maxLength={2000} defaultValue={challenge.state.notes[row.level] || ''} onBlur={(event) => { if (event.target.value !== (challenge.state.notes[row.level] || '')) challenge.setNote(row.level, event.target.value); }}/></td></tr>)}</tbody></table></div></article>;
}
function ActiveChallengePage({ account, challenge, loginQuote }) {
  const accountMoney = value => money(value, account.baseCurrency || 'USD');
  const {state, loading, saving, error} = challenge;
  const mode = state.automation?.mode || 'risk';
  const challengeBalance = challengeStartingBalance(state,account);
  const CHALLENGE_PLAN = buildChallengePlan(challengeBalance, mode, state.automation?.levelCount);
  const totalLevels = CHALLENGE_PLAN.length;
  const [details, setDetails] = useState(false);
  const activeRow = useRef(null);
  const passed = Object.values(state.statuses).filter(status => status === 'Pass').length;
  const current = CHALLENGE_PLAN[Math.min(state.activeLevel, totalLevels) - 1];
  const complete = state.activeLevel === totalLevels + 1 || passed === totalLevels;
  const [showCelebration, setShowCelebration] = useCompletionCelebration(complete);
  const currentBalance = challengeBalance + balanceNetPnl(account.trades);
  const currentBalanceClass = currentBalance >= challengeBalance ? 'tj-challenge-positive' : 'tj-challenge-negative';
  return <section className="tj-challenge">
    {showCelebration && <ChallengeCompletionCelebration accountName={account.name} totalLevels={totalLevels} onClose={() => setShowCelebration(false)} />}
    <JournalSignalHeader page="challenge" challenge={{...state, loading, error}} loginQuote={loginQuote}/>
    <header className="tj-challenge-heading"><div><h2><Trophy size={21}/> Challenge</h2><p>{account.name}</p></div></header>
    {error && <div role="alert" className="tj-panel">{error} <button type="button" onClick={challenge.retry}>Retry</button></div>}
    {state.automation?.mode && !loading && <div className="tj-panel tj-challenge-auto-progress" role="status"><strong>{state.automation.mode === "risk" ? "Mode 1 — Risk Limit" : "Mode 2 — Two-Loss Streak"}</strong><span>Level gross P&L: {accountMoney(state.levelPnl)} · Loss streak: {state.lossStreak} · {state.counted} logged trades</span><small>Progress recalculates when you edit or delete a counted trade.</small></div>}
    <div className="tj-challenge-metrics">
      <article className="tj-panel tj-challenge-metric-split"><div><small>STARTING BALANCE</small><strong>{accountMoney(challengeBalance)}</strong></div><div className="tj-challenge-metric-side"><small>CURRENT BALANCE</small><strong className={currentBalanceClass}>{accountMoney(currentBalance)}</strong></div></article>
      <article className="tj-panel tj-challenge-metric-split"><div><small>ACTIVE LEVEL</small><strong>{complete ? 'Complete' : `${state.activeLevel} / ${totalLevels}`}</strong><span>{complete ? 'All levels reached' : <><b className="tj-challenge-negative">{accountMoney(current.risk)}</b> planned risk</>}</span></div><div className="tj-challenge-metric-side"><small>PROFIT TARGET</small><strong className="tj-challenge-positive">{complete ? '—' : accountMoney(current.profit)}</strong></div></article>
      <article className="tj-panel"><small>LEVELS PASSED</small><strong>{passed} / {totalLevels}</strong><progress aria-label="Levels passed" value={passed} max={totalLevels}/></article>
      <article className="tj-panel"><small>PLANNED FINAL BALANCE</small><strong className="tj-challenge-positive">{accountMoney(CHALLENGE_PLAN.at(-1).end)}</strong><span>Small beginnings can grow into a life you are proud of.</span></article>
    </div>
    <div className="tj-panel tj-challenge-current"><Target size={22}/><div><strong>{complete ? 'Challenge complete' : `Level ${current.level} · ${accountMoney(current.start)} → ${accountMoney(current.end)}`}</strong></div><button className="tj-btn" onClick={() => activeRow.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })}><ArrowDown size={14}/> {complete ? 'Final level' : 'Active level'}</button></div>
    <div className="tj-panel tj-challenge-plan"><div className="tj-challenge-table-head"><div><h3>Compounding plan</h3><p>One step at a time, build the life you once only imagined.</p></div><label><input type="checkbox" checked={details} onChange={event => setDetails(event.target.checked)}/> Show sizing details</label></div>
      {loading ? <p role="status" className="tj-challenge-loading">Loading Challenge…</p> : <div className="tj-challenge-scroll" role="region" aria-label={`${totalLevels}-level compounding plan`} tabIndex={0}><table><thead><tr><th>Level</th><th>Starting balance</th><th>Risk amount</th><th>Profit amount</th><th>Ending balance</th>{details && <><th>Risk %</th><th>Profit %</th><th>SL pips</th><th>TP pips</th><th>Std. lots</th></>}<th>Status</th><th>Notes</th></tr></thead><tbody>{CHALLENGE_PLAN.map(row => <tr data-milestone={[10, 20, 30].includes(row.level) ? row.level : undefined} key={row.level} ref={row.level === Math.min(state.activeLevel, totalLevels) ? activeRow : null} className={row.level === state.activeLevel ? 'tj-challenge-active' : ''}>
        <th scope="row">{row.level}{[10, 20, 30].includes(row.level) && <span className="tj-challenge-milestone-badge"><Trophy size={12} aria-hidden="true"/> Milestone</span>}<span>{row.level === state.activeLevel ? 'Active' : state.statuses[row.level] === 'Pass' ? <CheckCircle2 size={14} aria-label="Passed"/> : ''}</span></th>
        <td>{accountMoney(row.start)}</td><td className="tj-challenge-negative">{accountMoney(row.risk)}</td><td className="tj-challenge-positive">{accountMoney(row.profit)}</td><td><b>{accountMoney(row.end)}</b></td>
        {details && <><td>{row.riskPct.toFixed(2)}%</td><td>{row.profitPct.toFixed(2)}%</td><td>{row.sl.toFixed(2)}</td><td>{row.tp}</td><td>{row.lots.toFixed(2)}</td></>}
        <td><ThemeSelect disabled={loading || saving || !!error} aria-label={`Level ${row.level} status`} className={`tj-challenge-status ${statusClass(state.statuses[row.level])}`} value={state.statuses[row.level] || ''} onChange={event => challenge.setStatus(row.level, event.target.value)}><option value="">Not started</option><option>Pass</option><option>In progress</option><option>Step back</option></ThemeSelect></td>
        <td><input disabled={loading || saving || !!error} className="tj-input" aria-label={`Level ${row.level} notes`} placeholder="Add a note…" maxLength={2000} defaultValue={state.notes[row.level] || ''} onBlur={event => {if(event.target.value !== (state.notes[row.level] || '')) challenge.setNote(row.level,event.target.value);}}/></td>
      </tr>)}</tbody></table></div>}
    </div>
  </section>;
}
