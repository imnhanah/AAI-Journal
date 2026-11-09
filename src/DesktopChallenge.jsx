import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowDownToLine, ArrowRight, BookOpen, Check, ChevronDown, Lock, Save, Settings, Trash2, TrendingUp, Undo2, X } from 'lucide-react';
import { ThemeSelect } from './JournalControls';
import { targetAmount, changeSetupTarget } from './challengeSetupTargets';
import './desktopChallenge.css';

// Desktop Challenge v2 (CHALLENGE_V2 in ChallengeLifecyclePage.jsx), after aaicorefx-desktop-challenge.html.
// It renders from the same view props as the phone and previous desktop views, so plan maths, progress,
// step-backs and funding stay in the challenge lifecycle code.
const STATUS = [['', 'not', 'Not started'], ['In progress', 'progress', 'In progress'], ['Pass', 'passed', 'Passed'], ['Step back', 'step', 'Step back']];
export const challengeVisual = (state, level) => {
  const status = state.statuses?.[level] || '';
  if (status === 'Pass') return 'passed';
  if (status === 'Step back') return 'step';
  if (status === 'Jumped' || state.fundingJumps?.[level]) return 'funded';
  if (status === 'In progress') return 'progress';
  return 'not';
};
const LABEL = { not: 'Not started', progress: 'In progress', passed: 'Passed', step: 'Step back', funded: 'Deposit-funded' };

export function ChallengeHero({ cards, selectedId, onSelect }) {
  return <section className="ch2-hero">
    <div className="ch2-hl"><span className="ch2-eb">Grow · Challenge</span><h1><em>Start with a plan.</em><br/>Respect each level.</h1><p>Progress is recorded across the challenge. Planned balances are targets, not guaranteed outcomes.</p></div>
    {cards.length > 1 && <div className="ch2-sw" role="tablist" aria-label="Challenges">{cards.map((card) => <button type="button" role="tab" key={card.id} aria-selected={card.id === selectedId} className={card.id === selectedId ? 'is-on' : ''} onClick={() => onSelect(card.id)}><span className="ch2-av">{(card.name || '?').slice(0, 1).toUpperCase()}</span><span><b>{card.name}</b><small>{card.level ? `Level ${card.level} of ${card.total}` : 'Loading…'}</small></span></button>)}</div>}
  </section>;
}

function Spark({ plan, current }) {
  const W = 300, H = 84;
  const first = Math.max(plan[0]?.start || 1, 0.01), last = Math.max(plan.at(-1)?.end || first, first * 1.0001);
  const y = (value) => H - 6 - (Math.log(Math.max(value, first)) - Math.log(first)) / (Math.log(last) - Math.log(first) || 1) * (H - 14);
  const points = plan.map((row, index) => [plan.length > 1 ? index / (plan.length - 1) * W : W / 2, y(row.end)]);
  const d = points.map((point, index) => `${index ? 'L' : 'M'}${point[0].toFixed(1)} ${point[1].toFixed(1)}`).join(' ');
  const dot = points[Math.max(0, Math.min(points.length - 1, current.level - 1))];
  return <div className="ch2-spw" aria-hidden="true"><svg viewBox={`0 0 ${W} ${H}`} className="ch2-sp" preserveAspectRatio="none"><defs><linearGradient id="ch2-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" className="ch2-fill-a"/><stop offset="1" className="ch2-fill-b"/></linearGradient></defs><path d={`${d} L${W} ${H} L0 ${H} Z`} fill="url(#ch2-fill)"/><path d={d} className="ch2-spl"/></svg>{dot && <i className="ch2-spd" style={{ left: `${dot[0] / W * 100}%`, top: `${dot[1] / H * 100}%` }}/>}</div>;
}

function RulesPopover({ rules, onClose, anchor }) {
  const ref = useRef(null);
  useEffect(() => {
    const away = (event) => { if (!ref.current?.contains(event.target) && !anchor?.contains(event.target)) onClose(); };
    const escape = (event) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('pointerdown', away); document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', escape); };
  }, [anchor, onClose]);
  return <div className="ch2-pop" ref={ref} role="dialog" aria-label={rules.title}>
    <header><b>{rules.title}</b><button type="button" className="ch2-x" aria-label="Close rules" onClick={onClose}><X size={15}/></button></header>
    {rules.items.map(([label, text]) => <div key={label}><b>{label}</b><p>{text}</p></div>)}
  </div>;
}

function GoalRow({ label, field, setup, setSetup, currency, limit, tone }) {
  const base = Number(setup.startingBalance) || 0;
  const amount = setup[`${field}Amount`] ?? targetAmount(setup[field], base);
  return <div className="ch2-grow"><span className="ch2-gl"><i className={tone}/>{label}</span>
    <label className="ch2-in"><input aria-label={`${label} percent`} type="number" min="0" max={limit ? 100 : undefined} step="0.01" value={setup[field]} onChange={(event) => setSetup((current) => changeSetupTarget(current, field, event.target.value, 'percentage'))}/><em>%</em></label>
    <label className="ch2-in"><em>{currency === 'USD' ? '$' : currency}</em><input aria-label={`${label} amount`} type="number" min="0" max={limit ? base : undefined} step="0.01" value={amount} onChange={(event) => setSetup((current) => changeSetupTarget(current, field, event.target.value, 'amount'))}/></label>
  </div>;
}

function SettingsDrawer({ setup, setSetup, account, locked, saving, deleting, onCancel, onSave, onDelete }) {
  const [askDelete, setAskDelete] = useState(false);
  const busy = saving || deleting;
  useEffect(() => { const escape = (event) => { if (event.key === 'Escape' && !busy) onCancel(); }; document.addEventListener('keydown', escape); return () => document.removeEventListener('keydown', escape); }, [busy, onCancel]);
  const currency = account.baseCurrency || 'USD';
  const Fixed = ({ children }) => <div className="ch2-in is-dis"><Lock size={13}/><span>{children}</span></div>;
  const modeName = setup.mode === 'adaptive' ? 'Mode 3 — Adaptive Balance' : setup.mode === 'streak' ? 'Mode 2 — Two-Loss Streak' : 'Mode 1 — Risk Limit';
  return <div className="ch2-ov" role="presentation">
    <div className="ch2-bk" onClick={() => { if (!busy) onCancel(); }}/>
    <aside className="ch2-dr" role="dialog" aria-modal="true" aria-labelledby="ch2-dr-title">
      <header><span className="ch2-av2">{(setup.name || '?').slice(0, 1).toUpperCase()}</span><div><span className="ch2-eb">Edit challenge setup</span><h2 id="ch2-dr-title">{setup.name || 'Untitled'}</h2></div><button type="button" className="ch2-x2" aria-label="Close" onClick={onCancel} disabled={busy}><X size={18}/></button></header>
      <div className="ch2-db">
        <section><h4>Account</h4><div className="ch2-f2">
          <label className="ch2-f"><small>Account name</small><span className="ch2-in"><input value={setup.name} onChange={(event) => setSetup({ ...setup, name: event.target.value })} autoFocus/></span></label>
          <div className="ch2-f"><small>Starting balance</small><div className="ch2-in is-dis" title="Captured from this account’s live trading balance when the challenge starts. Change it in Account Settings."><Lock size={13}/><span>{(currency === 'USD' ? '$' : `${currency} `) + Number(setup.startingBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div></div>
        </div></section>
        <section><h4>Plan {locked ? <span className="ch2-lkb"><Lock size={11}/>Locked · trades are linked</span> : <span className="ch2-lkb is-ghost">Editable until a trade is linked</span>}</h4>
          {locked ? <>
            <div className="ch2-f"><small>Mode</small><Fixed>{modeName}</Fixed></div>
            <div className="ch2-f2"><div className="ch2-f"><small>Plan length</small><Fixed>{setup.levelCount} levels</Fixed></div><div className="ch2-f"><small>{setup.mode === 'adaptive' ? 'Target (R)' : 'Risk to reward'}</small><Fixed>{setup.mode === 'adaptive' ? `${setup.reward}R` : `1:${setup.reward}`}</Fixed></div></div>
            {setup.mode === 'adaptive' && <div className="ch2-f2"><div className="ch2-f"><small>Risk per trade</small><Fixed>{setup.adaptiveRiskPct}%</Fixed></div><div className="ch2-f"><small>Maximum drawdown</small><Fixed>{setup.adaptiveDrawdownPct}%</Fixed></div></div>}
          </> : <>
            <div className="ch2-f"><small>Mode</small><ThemeSelect label="Challenge mode" value={setup.mode} onChange={(event) => setSetup({ ...setup, mode: event.target.value })}><option value="risk">Mode 1 — Risk Limit</option><option value="streak" disabled={Number(setup.reward) <= 2.8}>Mode 2 — Two-Loss Streak</option><option value="adaptive">Mode 3 — Adaptive Balance</option></ThemeSelect></div>
            <div className="ch2-f2"><div className="ch2-f"><small>Plan length</small><ThemeSelect label="Plan length" value={setup.levelCount} onChange={(event) => setSetup({ ...setup, levelCount: event.target.value })}>{[10, 15, 20, 30].map((value) => <option key={value} value={value}>{value} levels</option>)}</ThemeSelect></div>
              <label className="ch2-f"><small>{setup.mode === 'adaptive' ? 'Target (R)' : 'Risk to reward'}</small><span className="ch2-in"><input type="number" min="0.01" step="0.01" value={setup.reward} onChange={(event) => setSetup({ ...setup, reward: event.target.value, mode: setup.mode === 'streak' && Number(event.target.value) <= 2.8 ? 'risk' : setup.mode })}/></span></label></div>
            {setup.mode === 'adaptive' && <div className="ch2-f2"><label className="ch2-f"><small>Risk per trade (%)</small><span className="ch2-in"><input type="number" min="0.01" max="100" step="0.01" value={setup.adaptiveRiskPct} onChange={(event) => setSetup({ ...setup, adaptiveRiskPct: event.target.value })}/></span></label><label className="ch2-f"><small>Maximum drawdown (%)</small><span className="ch2-in"><input type="number" min="0" max="99.99" step="0.01" value={setup.adaptiveDrawdownPct} onChange={(event) => setSetup({ ...setup, adaptiveDrawdownPct: event.target.value })}/></span></label></div>}
          </>}
        </section>
        <section><h4>Goals &amp; guardrails <span className="ch2-lkb is-ghost">{currency} follows your starting balance</span></h4>
          <div className="ch2-gr"><div className="ch2-gh"><span/><span>Percent</span><span>{currency}</span></div>
            <GoalRow label="Monthly goal" field="monthlyGoalPct" setup={setup} setSetup={setSetup} currency={currency} tone="is-gain"/>
            <GoalRow label="Yearly goal" field="yearlyGoalPct" setup={setup} setSetup={setSetup} currency={currency} tone="is-gain"/>
            <GoalRow label="Daily loss limit" field="dailyLossLimitPct" setup={setup} setSetup={setSetup} currency={currency} tone="is-loss" limit/>
            <GoalRow label="Monthly loss limit" field="monthlyLossLimitPct" setup={setup} setSetup={setSetup} currency={currency} tone="is-loss" limit/>
          </div><p className="ch2-note">Set 0 to turn a goal or loss cap off. Loss caps pause trading for this account only.</p></section>
      </div>
      <footer>{askDelete ? <div className="ch2-cf"><span><AlertTriangle size={15}/>Delete this challenge and its progress?</span><div><button type="button" className="ch2-btn" onClick={() => setAskDelete(false)} disabled={busy}>Keep</button><button type="button" className="ch2-btn is-dng" onClick={onDelete} disabled={busy}>{deleting ? 'Deleting…' : 'Delete'}</button></div></div>
        : <div className="ch2-fb"><button type="button" className="ch2-tr" aria-label="Delete challenge" title="Delete challenge" onClick={() => setAskDelete(true)} disabled={busy}><Trash2 size={17}/></button><span/><button type="button" className="ch2-btn" onClick={onCancel} disabled={busy}>Cancel</button><button type="button" className="ch2-btn is-pri" onClick={onSave} disabled={busy || !setup.name.trim()}><Save size={15}/>{saving ? 'Saving…' : 'Save changes'}</button></div>}</footer>
    </aside>
  </div>;
}

function NoteField({ level, value, disabled, onSave }) {
  const [draft, setDraft] = useState(value || '');
  useEffect(() => setDraft(value || ''), [level, value]);
  return <textarea aria-label={`Level ${level} notes`} placeholder="Add a note about this level" maxLength={2000} disabled={disabled} value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={() => { if (draft !== (value || '')) onSave(level, draft); }}/>;
}

export default function DesktopChallengeCard(p) {
  const { account, plan, current, state, life, failed, complete, modeName, rewardLabel, reward, adaptive, failureFloor, linked, fmt, challenge, openSetup, setup, setSetup, saveSetup, savingSetup, deleting, setDeleting, onDelete, locked, settingsLocked, rules, saving, error } = p;
  const ranges = useMemo(() => Array.from({ length: Math.ceil(plan.length / 10) }, (_, index) => ({ key: `${index * 10 + 1}`, start: index * 10 + 1, end: Math.min(plan.length, index * 10 + 10) })), [plan.length]);
  const rangeOf = (level) => `${Math.floor((level - 1) / 10) * 10 + 1}`;
  const [range, setRange] = useState(() => rangeOf(current.level));
  const [selected, setSelected] = useState(current.level);
  const [rulesAnchor, setRulesAnchor] = useState(null);
  // The selection stays where the trader put it; "Go to current level" jumps back.
  const passed = Object.values(state.statuses || {}).filter((status) => status === 'Pass').length;
  const mid = plan[Math.min(Math.ceil(plan.length / 2) - 1, plan.length - 1)];
  const all = range === 'all';
  const shownRange = all ? { start: 1, end: plan.length } : ranges.find((item) => item.key === range) || ranges[0];
  const shown = plan.filter((row) => row.level >= shownRange.start && row.level <= shownRange.end);
  const row = plan.find((item) => item.level === selected) || current;
  const visual = (level) => challengeVisual(state, level);
  const selVisual = visual(row.level);
  const growth = row.start ? row.end / row.start : 0;
  const riskRate = row.start ? row.risk / row.start * 100 : 0;
  const fill = all || shown.length < 2 ? 0 : Math.max(0, Math.min(100, (current.level - shownRange.start) / (shown.length - 1) * 100));
  const statusLocked = locked || saving || !!error || selVisual === 'funded';
  const goCurrent = () => { setSelected(current.level); setRange(rangeOf(current.level)); };
  const statusChip = failed ? ['is-loss', 'Paused'] : complete ? ['is-gain', 'Complete'] : ['is-gain', 'Active'];
  return <article className="ch2-card-wrap" aria-label={`${account.name} challenge`}>
    <section className="ch2-card ch2-ov-card">
      <header className="ch2-ovh">
        <div className="ch2-tt"><h2>{account.name}</h2><span className="ch2-chip">{modeName}</span>{rewardLabel && <span className="ch2-chip">{rewardLabel}</span>}<span className="ch2-chip">{plan.length} levels</span></div>
        <div className="ch2-ovr">
          <span className="ch2-rw"><button type="button" className="ch2-btn" aria-haspopup="dialog" aria-expanded={!!rulesAnchor} onClick={(event) => setRulesAnchor(rulesAnchor ? null : event.currentTarget)}><BookOpen size={15}/>Rules<ChevronDown size={13}/></button>{rulesAnchor && <RulesPopover rules={rules} anchor={rulesAnchor} onClose={() => setRulesAnchor(null)}/>}</span>
          <span className={`ch2-act ${statusChip[0]}`}><i/>{statusChip[1]}</span>
          <button type="button" className="ch2-btn" onClick={openSetup}><Settings size={16}/>Settings</button>
        </div>
      </header>
      {error && <p className="ch2-alert" role="alert">{error} <button type="button" onClick={challenge.retry}>Retry</button></p>}
      {failed && <p className="ch2-alert" role="alert"><b>Challenge is paused.</b> Live capital {fmt(life.liveBalance)} is below the {fmt(failureFloor)} minimum. Deposit at least {fmt(Math.max(0, failureFloor - life.liveBalance))} in Finance to reactivate it, or delete this run and start again.</p>}
      <div className="ch2-ovg">
        <div className="ch2-ovl"><span className="ch2-eb2">Challenge progress</span><div className="ch2-lv"><b>{complete ? 'Complete' : `Level ${current.level}`}</b><span>of {plan.length}</span></div>
          <div className="ch2-seg" style={{ '--n': plan.length }}>{plan.map((item) => { const v = visual(item.level); return <i key={item.level} title={`Level ${item.level} · ${LABEL[v]}`} className={item.level === current.level && !complete ? 'is-cur' : v === 'funded' ? 'is-fund' : v === 'passed' ? 'is-pass' : v === 'step' ? 'is-stp' : ''}/>; })}</div>
          <div className="ch2-sgl"><span>1</span><span>{mid?.level}</span><span>{plan.length}</span></div>
          <p>{passed} of {plan.length} levels passed · Deposit-funded levels are not trading passes</p></div>
        <div className="ch2-bx"><small>Available trading capital</small><b className={life.liveBalance >= (plan[0]?.start || 0) ? 'is-gain' : 'is-loss'}>{fmt(life.liveBalance)}</b><span>This level · {fmt(current.start)} <ArrowRight size={12} strokeWidth={2.4}/> {fmt(current.end)}</span></div>
        <div className="ch2-bx"><small>Full challenge target</small><b>{fmt(plan.at(-1).end)}</b><Spark plan={plan} current={current}/><span>Planned across {plan.length} levels</span></div>
      </div>
      <div className="ch2-str">
        {adaptive ? <div className="ch2-st"><span className="ch2-si"><AlertTriangle size={17}/></span><div><small>Max drawdown</small><b>{state.automation?.adaptiveDrawdownPct ?? 10}%</b></div></div>
          : <div className="ch2-st"><span className="ch2-si"><AlertTriangle size={17}/></span><div><small>Loss streak</small><b>{state.lossStreak || 0}</b></div>{p.mode === 'streak' && <div className="ch2-pips" title="Two losses in a row trigger a step-back"><i className={(state.lossStreak || 0) >= 1 ? 'is-on' : ''}/><i className={(state.lossStreak || 0) >= 2 ? 'is-on' : ''}/></div>}</div>}
        <div className="ch2-st"><span className="ch2-si"><TrendingUp size={17}/></span><div><small>Trades taken</small><b>{linked}</b></div></div>
        <div className="ch2-st"><span className="ch2-si"><Undo2 size={17}/></span><div><small>Step-backs</small><b>{state.stepBacks || 0}</b></div></div>
      </div>
    </section>

    <section className="ch2-card ch2-pn" aria-label="Compounding plan">
      <header className="ch2-pnh"><div><span className="ch2-eb2">Compounding plan</span><h3>One step at a time, build the life you once only imagined.</h3></div><button type="button" className="ch2-btn" onClick={goCurrent}>Go to current level<ArrowRight size={14} strokeWidth={2.4}/></button></header>
      <div className="ch2-rt" role="tablist" aria-label="Plan levels">{ranges.map((item) => <button type="button" role="tab" key={item.key} aria-selected={range === item.key} className={range === item.key ? 'is-on' : ''} onClick={() => setRange(item.key)}>Levels {item.start}–{item.end}</button>)}{ranges.length > 1 && <button type="button" role="tab" aria-selected={all} className={all ? 'is-on' : ''} onClick={() => setRange('all')}>All {plan.length}</button>}</div>
      <div className={`ch2-trk${all ? ' is-all' : ''}`}>{!all && <div className="ch2-ln" aria-hidden="true"><u style={{ width: `${fill}%` }}/></div>}
        {shown.map((item) => { const v = visual(item.level); return <button type="button" key={item.level} aria-label={`Level ${item.level}, ${LABEL[v]}${item.level === current.level ? ', current' : ''}`} aria-pressed={item.level === row.level} className={['ch2-node', `is-${v}`, item.level === current.level && !complete ? 'is-cur' : '', item.level === row.level ? 'is-sel' : ''].join(' ')} onClick={() => setSelected(item.level)}>{(v === 'passed' || v === 'funded') && <em>{v === 'funded' ? <ArrowDownToLine size={11} strokeWidth={2.6}/> : <Check size={11} strokeWidth={3}/>}</em>}<b>{item.level}</b></button>; })}
      </div>
      <div className="ch2-dt">
        <div className="ch2-dl">
          <header><div><span className="ch2-eb2">Selected level</span><h3>Level {row.level}</h3></div><div className="ch2-pl">{selVisual === 'funded' ? <span className="ch2-pill is-bl"><ArrowDownToLine size={12} strokeWidth={2.6}/>Deposit-funded</span> : <span className={`ch2-pill is-${selVisual}`}>{LABEL[selVisual]}</span>}{row.level === current.level && !complete && <span className="ch2-pill is-cu">Current</span>}</div></header>
          <div className="ch2-bal"><div><small>Balance at start</small><b>{fmt(row.start)}</b></div><div className="ch2-mid"><span>×{growth.toFixed(2)}</span><i/></div><div className="is-r"><small>Balance at target</small><b className="is-gain">{fmt(row.end)}</b></div></div>
          <div className="ch2-tl"><div><small>Risk</small><b className="is-loss">{fmt(row.risk)}</b><span>{riskRate.toFixed(2)}% of balance</span></div><div><small>Profit target</small><b className="is-gain">{fmt(row.profit)}</b><span>{reward ? `${reward}R reward` : 'Level target'}</span></div><div><small>Growth this level</small><b>+{Math.round((growth - 1) * 100)}%</b><span>×{growth.toFixed(2)}</span></div></div>
          <div className="ch2-sf"><small>Status</small><div className="ch2-stb" role="radiogroup" aria-label={`Level ${row.level} status`}>{STATUS.map(([value, key, label]) => { const on = (state.statuses?.[row.level] || '') === value && selVisual !== 'funded'; return <button type="button" role="radio" key={key} aria-checked={on} className={`${on ? 'is-on' : ''} is-${key}`} disabled={statusLocked} onClick={() => challenge.setStatus(row.level, value)}>{label}</button>; })}</div>
            {selVisual === 'funded' && <p className="ch2-note2">This level was funded by a deposit, so it does not count as a trading pass.</p>}
            {locked && !failed && <p className="ch2-note">Trading is locked by a loss guardrail; statuses can be changed once it resets.</p>}</div>
        </div>
        <div className="ch2-dr2">
          <div className="ch2-sz"><span className="ch2-eb2">Execution sizing</span>{[['Risk percentage', `${row.riskPct.toFixed(2)}%`], ['Profit percentage', `${row.profitPct.toFixed(2)}%`], ['Stop loss', row.sl.toFixed(2)], ['Take profit', row.tp], ['Lot size', `${row.lots.toFixed(2)} lots`]].map(([label, value]) => <div key={label}><span>{label}</span><b>{value}</b></div>)}</div>
          <div className="ch2-nt"><span className="ch2-eb2">Notes</span><NoteField level={row.level} value={state.notes?.[row.level]} disabled={saving || !!error} onSave={challenge.setNote}/></div>
        </div>
      </div>
    </section>
    {setup && <SettingsDrawer setup={setup} setSetup={setSetup} account={account} locked={settingsLocked} saving={savingSetup} deleting={deleting} onCancel={() => setSetup(null)} onSave={saveSetup} onDelete={async () => { setDeleting(true); try { if (await onDelete()) setSetup(null); } finally { setDeleting(false); } }}/>}
  </article>;
}
