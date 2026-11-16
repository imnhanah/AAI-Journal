import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Check, Info, Layers, Lock, Minus, Plus, Trash2, X } from 'lucide-react';
import {
  buildChallengePlan, challengeFitRange, challengeFundingLimit, challengeModeActivationRule, challengeRewardRange,
  challengeSetupFits, defaultChallengeReward, snapChallengeReward,
} from './challengeModel.js';
import { ADAPTIVE_STEP_BACK_RULES, normaliseAdaptiveStepBack } from './challengeRules.js';
import SetupPanel from './SetupPanel.jsx';
import './challengeSetupWindow.css';

// One setup window for every challenge (desktop two-column dialog, phone bottom sheet),
// built from the approved design. It only edits the `setup` draft; plan maths stay in
// challengeModel.js and persistence in handleSaveChallengeSetup.
export const ADAPTIVE_PRESETS = [
  ['conservative', 'Conservative', 5, 25],
  ['balanced', 'Balanced', 10, 50],
  ['aggressive', 'Aggressive', 15, 60],
];
export const ADAPTIVE_DEFAULT = { risk: 10, drawdown: 50 };
const LENGTHS = [10, 15, 20, 30];
const MODES = {
  risk: { kicker: 'MODE 1', title: 'Risk limit', short: 'M1', text: 'Step back when the net loss on the level reaches its risk.' },
  streak: { kicker: 'MODE 2', title: 'Two-loss streak', short: 'M2', text: 'Step back after two losses on the same level.' },
  adaptive: { kicker: 'MODE 3', title: 'Adaptive Balance', short: 'M3', text: 'Use your own balance, drawdown and percent risk.' },
};
const STEP_BACK = {
  one: ['One loss', 'A single loss steps you back'],
  two: ['Two losses', 'Two losses on the level'],
  net: ['Net loss', 'Wins and losses add up'],
};
export const rewardNote = (mode) => mode === 'adaptive' ? 'Any reward from 1R upward.' : `${challengeRewardRange(mode)[0]}R to ${challengeRewardRange(mode)[1]}R.`;
const rangeText = (mode) => mode === 'adaptive' ? 'Any R · from 1R' : `${challengeRewardRange(mode)[0]}R – ${challengeRewardRange(mode)[1]}R`;
const r1 = (value) => Math.round(value * 10) / 10;

export default function ChallengeSetupWindow({ setup, setSetup, account, balance, locked, saving, deleting, isNew, onCancel, onSave, onDelete }) {
  const [compat, setCompat] = useState(false);
  const [askDelete, setAskDelete] = useState(false);
  const [toast, setToast] = useState('');
  const busy = saving || deleting;
  const currency = account.baseCurrency || 'USD';
  const sym = currency === 'USD' ? '$' : `${currency} `;
  const money = (value) => `${sym}${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: Number(value) % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
  const start = Number(balance ?? setup.startingBalance) || 0;
  const mode = setup.mode || null;
  // A new challenge starts with no mode picked; the trader must choose one.
  const modeChosen = !!mode && !!MODES[mode];
  const adaptive = mode === 'adaptive';
  const levelCount = Number(setup.levelCount) || 30;
  const reward = Number(setup.reward);
  const stepBack = normaliseAdaptiveStepBack(setup.adaptiveStepBack);
  const risk = Number(setup.adaptiveRiskPct), draw = Number(setup.adaptiveDrawdownPct);
  const [rDraft, setRDraft] = useState(String(setup.reward ?? ''));
  useEffect(() => { setRDraft(String(setup.reward ?? '')); }, [setup.reward]);
  useEffect(() => {
    const escape = (event) => { if (event.key === 'Escape' && compat) setCompat(false); };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [compat]);

  const patch = (next) => setSetup((current) => ({ ...current, ...next }));
  const fits = useMemo(() => challengeSetupFits({ balance: start }), [start]);
  const issue = useMemo(() => modeChosen ? challengeModeActivationRule({ mode, reward: adaptive && !(reward > 0) ? null : reward, balance: start, levelCount }) : null, [mode, modeChosen, adaptive, reward, start, levelCount]);
  const limit = modeChosen && !adaptive && reward > 0 ? challengeFundingLimit({ mode, reward, levelCount, balance: start }) : null;
  const where = !modeChosen ? { level: 1, max: Math.floor(levelCount / 2), ok: true } : adaptive ? { level: 1, max: Math.floor(levelCount / 2), ok: true } : { level: limit?.fundedLevel ?? 1, max: limit?.maxLevel ?? Math.floor(levelCount / 2), ok: !!limit?.allowed };
  const fitR = modeChosen && !adaptive ? challengeFitRange({ mode, balance: start, levelCount }) : null;
  const [low, high] = adaptive || !modeChosen ? [1, 5.5] : challengeRewardRange(mode);
  const pos = (value) => Math.max(0, Math.min(100, (value - 1) / 4.5 * 100));
  const plan = useMemo(() => modeChosen && start > 0 && reward > 0 ? buildChallengePlan(start, mode, levelCount, reward, { adaptiveRiskPct: risk, adaptiveDrawdownPct: draw }) : [], [start, mode, modeChosen, levelCount, reward, risk, draw]);
  const adaptiveValid = !adaptive || (risk > 0 && risk <= 100 && draw >= 0 && draw < 100);
  const valid = modeChosen && !issue && adaptiveValid && !!setup.name?.trim() && start > 0 && where.ok;
  const preset = ADAPTIVE_PRESETS.find(([, , r, d]) => risk === r && draw === d)?.[0];
  const straightLosses = adaptive && draw > 0 && risk > 0 && risk < 100 ? Math.ceil(Math.log(1 - draw / 100) / Math.log(1 - risk / 100)) : 0;

  const commitR = (raw) => {
    if (!modeChosen) return;
    const typed = parseFloat(raw);
    if (!Number.isFinite(typed)) { setRDraft(String(setup.reward ?? '')); return; }
    const value = r1(typed);
    const snapped = adaptive ? Math.max(1, value) : snapChallengeReward(mode, value);
    setToast(snapped !== value ? `Adjusted to ${snapped}R. ${MODES[mode].kicker.replace('MODE', 'Mode')} allows ${rangeText(mode)}.` : '');
    patch({ reward: snapped }); setRDraft(String(snapped));
  };
  const pickMode = (value) => {
    if (locked || value === mode) return;
    setToast('');
    const next = { mode: value };
    if (value === 'adaptive') { next.reward = reward >= 1 ? reward : 3; next.adaptiveRiskPct = setup.adaptiveRiskPct || ADAPTIVE_DEFAULT.risk; next.adaptiveDrawdownPct = setup.adaptiveDrawdownPct || ADAPTIVE_DEFAULT.drawdown; next.adaptiveStepBack = stepBack; }
    else { const base = defaultChallengeReward(value); next.reward = base; setToast(`${MODES[value].kicker.replace('MODE', 'Mode')} starts at its default, ${base}R.`); }
    patch(next);
  };
  const explain = (rule) => {
    const level = Math.max(start * (risk || 0) / 100, 0.01), half = level / 2, m = (value) => money(Math.round(value * 100) / 100);
    if (rule === 'one') return { t: 'One loss steps you back', d: 'Any losing trade sends you back one level. Level 1 has nowhere lower, so you stay on it.', ex: `You risk ${m(level)} on Level 3 and lose it. You step back to Level 2.` };
    if (rule === 'two') return { t: 'Two losses on the level', d: 'The first loss keeps you on the level. The second loss steps you back. A win that does not pass the level never clears the count. Only passing the level does.', ex: `Lose ${m(level)}, win ${m(level * 0.3)} (not enough to pass), lose ${m(level)}. Second loss, so you step back.` };
    return { t: 'Net loss reaches the risk', d: 'Every trade on the level is added together, wins and losses. You step back when the total loss reaches the level’s risk. Same rule as Mode 1.', ex: `Lose ${m(half)}, win ${m(level * 0.3)}, lose ${m(half)}: net −${m(level * 0.7)}, you stay. One more small loss reaches −${m(level)} and you step back.` };
  };
  const sbText = explain(stepBack);
  const finalTarget = plan.at(-1)?.end;
  const Fixed = ({ children }) => <div className="csw2-in is-dis">{locked && <Lock size={13} />}<span>{children}</span></div>;
  const modeLabel = modeChosen ? `${MODES[mode].kicker.replace('MODE', 'Mode')} · ${reward || '—'}R · ${levelCount} levels` : `No mode chosen · ${levelCount} levels`;

  return <SetupPanel label={isNew ? 'Start a challenge' : 'Edit challenge'} panelKey="challenge" busy={busy} onClose={onCancel}>{(close) =>
    <section className="csw2" role="dialog" aria-modal="true" aria-labelledby="csw2-title">
      <span className="csw2-grab" aria-hidden="true" />
      <header className="csw2-mh">
        <span className="csw2-av">{(setup.name || '?').slice(0, 1).toUpperCase()}</span>
        <div><span className="csw2-eb">{isNew ? 'Start a challenge' : 'Edit challenge'}</span><h2 id="csw2-title">{setup.name || 'Untitled'}</h2></div>
        <button type="button" className="csw2-xb" aria-label="Close" onClick={close} disabled={busy}><X size={18} /></button>
      </header>
      <div className="csw2-mb">
        <div className="csw2-ml">
          <section>
            <div className="csw2-sh"><span>Plan</span>{locked ? <span className="csw2-lkb"><Lock size={11} />Locked · trades are linked</span> : <span className="csw2-lkb is-gh">Editable until a trade is linked</span>}</div>
            <div className="csw2-name"><label className="csw2-fld"><small>Challenge name</small><span className="csw2-in"><input value={setup.name} onChange={(event) => patch({ name: event.target.value })} /></span></label></div>
            <div className="csw2-mt3" role="radiogroup" aria-label="Challenge mode">
              {Object.entries(MODES).map(([value, item]) => <button type="button" key={value} role="radio" aria-checked={mode === value} disabled={locked} className={`csw2-mtl ${mode === value ? 'is-on' : ''}`} onClick={() => pickMode(value)}>
                <span className="csw2-dot">{mode === value && <Check size={11} />}</span><small>{item.kicker}</small><b>{item.title}</b>
              </button>)}
            </div>
            <div className="csw2-detail" aria-live="polite">{modeChosen ? <><span>{MODES[mode].text}</span><em>{rangeText(mode)}</em></> : <span>Choose a mode to continue. Nothing is picked for you.</span>}</div>
          </section>
          <section>
            <div className="csw2-rrow">
              <div className="csw2-fld"><small>{adaptive ? 'Target (R)' : 'Risk to reward'}</small>
                {locked ? <Fixed>1:{reward}</Fixed> : <div className="csw2-step">
                  <button type="button" aria-label="Decrease" onClick={() => commitR(String(r1((reward || 1) - 0.1)))}><Minus size={16} /></button>
                  <label className="csw2-in"><input type="number" inputMode="decimal" step="0.1" value={rDraft} onChange={(event) => setRDraft(event.target.value)} onBlur={(event) => commitR(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') commitR(event.currentTarget.value); }} /></label>
                  <button type="button" aria-label="Increase" onClick={() => commitR(String(r1((reward || 1) + 0.1)))}><Plus size={16} /></button>
                </div>}
                <div className="csw2-rtk"><span className="is-al" style={{ left: `${pos(low)}%`, right: `${100 - pos(high)}%` }} />{fitR && <span className="is-ft" style={{ left: `${pos(fitR.rewardMin)}%`, right: `${100 - pos(Math.min(fitR.rewardMax, 5.5))}%` }} />}<span className="is-th" style={{ left: `${pos(reward || 1)}%` }} /></div>
                <div className="csw2-rlab"><span>1R</span><span>{!modeChosen ? 'choose a mode first' : adaptive ? 'any value from 1R' : `allowed ${rangeText(mode)}`}</span><span>5R+</span></div>
                <div className="csw2-leg"><span><i className="is-allowed" />Allowed</span>{!adaptive && <span><i className="is-fits" />{fitR ? `Fits (${fitR.rewardMin}–${fitR.rewardMax}R)` : `No R fits ${levelCount} levels`}</span>}</div>
                {toast && <div className="csw2-toast"><Info size={14} /><span>{toast}</span></div>}
              </div>
              <div className="csw2-fld"><small>Plan length</small>
                {locked ? <Fixed>{levelCount} levels</Fixed> : <div className="csw2-lseg" role="radiogroup" aria-label="Plan length">{LENGTHS.map((count) => {
                  const fit = adaptive || !modeChosen || !!challengeFitRange({ mode, balance: start, levelCount: count });
                  return <button type="button" key={count} role="radio" aria-checked={levelCount === count} className={levelCount === count ? 'is-on' : ''} onClick={() => { setToast(''); patch({ levelCount: count }); }}><b>{count}</b><small className={fit ? '' : 'is-no'}><s />{fit ? 'levels' : 'no fit'}</small></button>;
                })}</div>}
              </div>
            </div>
          </section>
          {adaptive && <section>
            <div className="csw2-sh"><span>Risk style</span><span className="csw2-lkb is-gh">{preset ? 'Preset' : 'Custom'}</span></div>
            <div className="csw2-pres">{ADAPTIVE_PRESETS.map(([key, label, r, d]) => <button type="button" key={key} disabled={locked} className={`csw2-pre ${preset === key ? 'is-on' : ''}`} onClick={() => patch({ adaptiveRiskPct: r, adaptiveDrawdownPct: d })}><b>{label}</b><span>{r}% · {d}%</span></button>)}</div>
            <div className="csw2-rrow csw2-gap"><div className="csw2-fld"><small>Risk per trade (%)</small>{locked ? <Fixed>{risk}%</Fixed> : <label className="csw2-in"><input type="number" inputMode="decimal" min="0.01" max="100" step="0.01" value={setup.adaptiveRiskPct} onChange={(event) => patch({ adaptiveRiskPct: event.target.value })} /><em>%</em></label>}<span className="csw2-hint2"><b>{money(start * risk / 100)}</b> risked per trade at Level 1</span></div>
              <div className="csw2-fld"><small>Maximum drawdown (%)</small>{locked ? <Fixed>{draw}%</Fixed> : <label className="csw2-in"><input type="number" inputMode="decimal" min="0" max="99.99" step="0.01" value={setup.adaptiveDrawdownPct} onChange={(event) => patch({ adaptiveDrawdownPct: event.target.value })} /><em>%</em></label>}<span className="csw2-hint2">Challenge pauses below <b>{money(start * (1 - draw / 100))}</b></span></div></div>
          </section>}
          {adaptive && <section>
            <div className="csw2-sh"><span>Step back when</span><span className="csw2-lkb is-gh">{reward >= 3 ? 'At 3R and above, Two losses gives more room' : 'Your choice'}</span></div>
            <div className="csw2-pres" role="radiogroup" aria-label="Step back rule">{ADAPTIVE_STEP_BACK_RULES.map((rule) => <button type="button" key={rule} role="radio" aria-checked={stepBack === rule} disabled={locked} className={`csw2-pre ${stepBack === rule ? 'is-on' : ''}`} onClick={() => patch({ adaptiveStepBack: rule })}><b>{STEP_BACK[rule][0]}</b><span>{rule === 'one' ? 'Default' : STEP_BACK[rule][1]}</span></button>)}</div>
            <div className="csw2-sbx" aria-live="polite"><b>{sbText.t}</b><p>{sbText.d}</p><div className="csw2-sbe"><Info size={13} /><span>{sbText.ex}</span></div></div>
          </section>}
          <section>
            <div className="csw2-sh"><span>Plan preview</span><span className="csw2-lkb is-gh">updates as you choose</span></div>
            {plan.length > 0 && !issue ? <Ladder plan={plan} money={money} where={where} adaptive={adaptive} total={levelCount} /> : <p className="csw2-note">{modeChosen ? 'Fix the setup warning to see your ladder.' : 'Choose a mode to see your ladder.'}</p>}
          </section>
        </div>
        <aside className="csw2-mr">
          <div className="csw2-bal"><small>Starting balance</small>{money(start)}</div>
          <div className="csw2-hint">{locked ? <Lock size={13} /> : <Info size={13} />}<span>Captured from this account’s live trading balance when the challenge starts. Deposits made after you start never count as growth.</span></div>
          <div className="csw2-meter">
            <div className="csw2-mtop"><div><span className="csw2-eb2">Where you start</span><div className={`csw2-big ${where.ok ? 'is-good' : 'is-bad'}`}>Level {where.level}</div></div><div className="csw2-sb2">of {levelCount} levels<br />limit Level {where.max}</div></div>
            <div className="csw2-mbar" style={{ gridTemplateColumns: `repeat(${levelCount},minmax(0,1fr))` }}>{Array.from({ length: levelCount }, (_, index) => <i key={index} className={index + 1 === Math.min(where.level, levelCount) ? `is-me${where.ok ? '' : ' is-bad'}` : index + 1 <= where.max ? 'is-ok' : ''} />)}<u style={{ left: `calc(${where.max / levelCount * 100}% - 1px)` }} /></div>
            <div className="csw2-mlab"><span>1</span><span>Halfway · Level {where.max}</span><span>{levelCount}</span></div>
          </div>
          <div className="csw2-facts">
            <div><span>Plan</span><b>{modeLabel}</b></div>
            <div><span>Level 1 starts at</span><b>{money(plan[0]?.start ?? start)}</b></div>
            {adaptive ? <>
              <div><span>Risk per trade</span><b>{risk}% · {money(start * risk / 100)}</b></div>
              <div><span>Step back when</span><b>{STEP_BACK[stepBack][0]}</b></div>
              <div><span>Pauses below</span><b>{money(start * (1 - draw / 100))}</b></div>
              {straightLosses > 0 && <div><span>Straight losses to pause</span><b>about {straightLosses}</b></div>}
            </> : <div><span>Full challenge target</span><b>{finalTarget ? money(finalTarget) : '—'}</b></div>}
          </div>
          {issue && <div className="csw2-wn" role="alert"><span className="csw2-wi"><AlertTriangle size={16} /></span><div><b>Challenge setup needs attention</b><p>{where.ok ? issue.message : <>Your starting balance would fund <b>Level {where.level}</b>, but a {levelCount}-level plan only allows starting up to <b>Level {where.max}</b>.</>}</p><button type="button" className="csw2-wbtn" onClick={() => setCompat(true)}><Layers size={14} /> See compatible setups</button></div></div>}
          <div className="csw2-hint is-foot"><Info size={14} /><span>A challenge can start at or below the halfway level of its plan (Level {where.max} of {levelCount}). Climb past it by trading, not by funding.</span></div>
        </aside>
      </div>
      <footer className="csw2-mf">
        {askDelete ? <div className="csw2-cf"><span><AlertTriangle size={15} />Delete this challenge and its progress?</span><div><button type="button" className="csw2-bt" onClick={() => setAskDelete(false)} disabled={busy}>Keep</button><button type="button" className="csw2-bt is-dng" onClick={onDelete} disabled={busy}>{deleting ? 'Deleting…' : 'Delete'}</button></div></div>
          : <>{!isNew && <button type="button" className="csw2-bt is-dng csw2-tr" aria-label="Delete challenge" title="Delete challenge" onClick={() => setAskDelete(true)} disabled={busy}><Trash2 size={17} /></button>}
            <span className={`csw2-hl ${valid ? 'is-ok' : 'is-no'}`}>{valid ? <><Check size={15} />Everything checks out.</> : <><AlertTriangle size={15} />{modeChosen ? 'Fix the setup warning to continue.' : 'Choose a mode to continue.'}</>}</span><span className="csw2-sp" />
            <button type="button" className="csw2-bt" onClick={close} disabled={busy}>Cancel</button>
            <button type="button" className="csw2-bt is-pri" disabled={busy || !valid} onClick={() => onSave({ ...setup, adaptiveStepBack: adaptive ? stepBack : undefined })}><Check size={15} />{saving ? 'Saving…' : isNew ? 'Start challenge' : 'Save changes'}</button></>}
      </footer>
      {compat && <CompatibleSetups fits={fits} money={money} mode={mode} levelCount={levelCount} reward={reward} start={start} where={where} onClose={() => setCompat(false)}
        onApply={(choice) => { setToast('Setup updated. It fits your balance.'); patch({ mode: choice.mode, levelCount: choice.levelCount, reward: choice.mode === 'adaptive' ? (reward >= 1 ? reward : 3) : choice.reward, ...(choice.mode === 'adaptive' ? { adaptiveRiskPct: setup.adaptiveRiskPct || ADAPTIVE_DEFAULT.risk, adaptiveDrawdownPct: setup.adaptiveDrawdownPct || ADAPTIVE_DEFAULT.drawdown, adaptiveStepBack: stepBack } : {}) }); setCompat(false); }} />}
    </section>}
  </SetupPanel>;
}

function Ladder({ plan, money, where, adaptive, total }) {
  const W = 320, H = 84;
  const first = Math.max(plan[0].start, 0.01), values = [first, ...plan.map((row) => row.end)];
  const lo = Math.log(first), hi = Math.log(Math.max(values.at(-1), first * 1.0001));
  const X = (index) => index / total * W, Y = (value) => H - 6 - (Math.log(Math.max(value, 0.01)) - lo) / ((hi - lo) || 1) * (H - 14);
  const d = values.map((value, index) => `${index ? 'L' : 'M'}${X(index).toFixed(1)} ${Y(value).toFixed(1)}`).join(' ');
  const mark = adaptive ? 0 : Math.min(total, Math.max(1, where.level)) - 1;
  return <div className="csw2-lad">
    <div className="csw2-lh"><span className="csw2-eb2">Your ladder</span><b>{money(values.at(-1))}</b></div>
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="csw2-lg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" className="csw2-lg-a" /><stop offset="1" className="csw2-lg-b" /></linearGradient></defs>
      <path d={`${d} L${W} ${H} L0 ${H}Z`} fill="url(#csw2-lg)" /><path d={d} className="csw2-line" fill="none" vectorEffect="non-scaling-stroke" />
      {!adaptive && <line x1={X(where.max)} x2={X(where.max)} y1="0" y2={H} className="csw2-half" vectorEffect="non-scaling-stroke" />}
      <circle cx={X(mark)} cy={Y(values[mark])} r="5" className={where.ok ? 'csw2-dotc' : 'csw2-dotc is-bad'} /></svg>

  </div>;
}

function CompatibleSetups({ fits, money, mode, levelCount, reward, start, where, onClose, onApply }) {
  const list = fits.filter((fit) => fit.mode !== 'adaptive');
  const score = (fit) => Math.abs((fit.reward ?? reward) - reward) * 2 + (fit.levelCount === levelCount ? 0 : 1) + (fit.mode === mode ? 0 : 3);
  const closest = [...list].sort((a, b) => score(a) - score(b))[0];
  const key = (fit) => `${fit.mode}|${fit.levelCount}`;
  const [sel, setSel] = useState(closest ? key(closest) : `adaptive|${levelCount}`);
  const [rs, setRs] = useState({});
  const rOf = (fit) => rs[key(fit)] ?? Math.min(fit.rewardMax, Math.max(fit.rewardMin, reward > 0 ? reward : fit.reward));
  const chosen = sel.startsWith('adaptive') ? { mode: 'adaptive', levelCount } : list.find((fit) => key(fit) === sel);
  const groups = ['risk', 'streak'].map((m) => [m, list.filter((fit) => fit.mode === m)]);
  const only = !list.length;
  const bump = (fit, delta) => { const next = r1(Math.min(fit.rewardMax, Math.max(fit.rewardMin, Number(rOf(fit)) + delta))); setRs({ ...rs, [key(fit)]: next }); };
  const rangeLine = (m) => rangeText(m);
  const host = document.querySelector('.tj-root') || document.body;
  return <CompatPortal host={host}><div className="csw2-ov csw2-ovp"><div className="csw2-pov" role="dialog" aria-modal="true" aria-label="Compatible setups">
    <div className="csw2-bk is-in" onClick={onClose} />
    <div className="csw2-dlg csw2-cp">
      <header className="csw2-cph">
        <span className="csw2-ico"><AlertTriangle size={22} /></span>
        <div><h3>{only ? 'Only Adaptive Balance fits' : 'Choose a compatible setup'}</h3>
          <p className="csw2-sub">{only ? <>Your balance <b>{money(start)}</b> is above the halfway level of every Mode 1 and Mode 2 plan.</> : <>Your balance starts at <b>Level {where.level}</b>. {MODES[mode].kicker.replace('MODE', 'Mode')} · {reward}R · {levelCount} levels only allows Level {where.max}.</>}</p></div>
        <button type="button" className="csw2-x" aria-label="Close" onClick={onClose}><X size={16} /></button>
      </header>
      <div className="csw2-cpb">
        {groups.map(([m, items]) => <section key={m} className={`csw2-grp ${items.length ? '' : 'is-dim'}`}>
          <span className="csw2-gh"><b>{MODES[m].kicker.replace('MODE', 'Mode')} · {MODES[m].title}</b><span>{rangeLine(m)}</span><em className={items.length ? '' : 'is-no'}>{items.length ? `${items.length} plan${items.length > 1 ? 's' : ''} fit` : 'none fit'}</em></span>
          {items.length === 0 ? <div className="csw2-none">Your balance is too high for this mode at any plan length.</div>
            : <div className="csw2-cgrid">{items.map((fit) => <div key={key(fit)} role="button" tabIndex={0} className={`csw2-cc ${sel === key(fit) ? 'is-pick' : ''}`} onClick={() => setSel(key(fit))} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSel(key(fit)); } }}>
              <div className="csw2-cc1"><span className="csw2-m">{MODES[m].short}</span><b>{fit.levelCount} levels</b>{fit === closest ? <span className="csw2-chip is-sm">Closest</span> : <span className="csw2-chip">Fits</span>}</div>
              <span className="csw2-d">Any R from {fit.rewardMin}R to {fit.rewardMax}R</span>
              <div className="csw2-rin2" onClick={(event) => event.stopPropagation()}><small>Your R</small>
                <button type="button" aria-label="Lower R" onClick={() => bump(fit, -0.1)}><Minus size={14} /></button>
                <input type="number" step="0.1" value={rOf(fit)} onChange={(event) => setRs({ ...rs, [key(fit)]: event.target.value })} onBlur={(event) => { const v = r1(parseFloat(event.target.value)); setRs({ ...rs, [key(fit)]: Number.isFinite(v) ? Math.min(fit.rewardMax, Math.max(fit.rewardMin, v)) : fit.rewardMin }); }} />
                <button type="button" aria-label="Raise R" onClick={() => bump(fit, 0.1)}><Plus size={14} /></button></div>
            </div>)}</div>}
        </section>)}
        <section className="csw2-grp"><span className="csw2-gh"><b>Mode 3 · Adaptive Balance</b><span>1R and above</span><em>always fits</em></span>
          <div role="button" tabIndex={0} className={`csw2-cc csw2-cc-wide ${sel.startsWith('adaptive') ? 'is-pick' : ''}`} onClick={() => setSel(`adaptive|${levelCount}`)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSel(`adaptive|${levelCount}`); } }}>
            <div className="csw2-cc1"><span className="csw2-m">M3</span><b>Adaptive Balance</b><span className="csw2-chip">Fits</span></div>
            <span className="csw2-d">Uses your own balance, drawdown and percent risk. Starts at Level 1.</span></div>
        </section>
      </div>
      <footer className="csw2-cpf"><button type="button" className="csw2-bt" onClick={onClose}>Cancel</button><button type="button" className="csw2-bt is-pri" disabled={!chosen} onClick={() => chosen && onApply(chosen.mode === 'adaptive' ? chosen : { ...chosen, reward: Math.min(chosen.rewardMax, Math.max(chosen.rewardMin, Number(rOf(chosen)))) })}>{chosen?.mode === 'adaptive' ? 'Use Adaptive Balance' : chosen ? `Use ${MODES[chosen.mode].kicker.replace('MODE', 'Mode')} · ${Number(rOf(chosen))}R · ${chosen.levelCount} levels` : 'Choose a setup'}</button></footer>
    </div>
  </div></div></CompatPortal>;
}

function CompatPortal({ host, children }) { return createPortal(children, host); }
