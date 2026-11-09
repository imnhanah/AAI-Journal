import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Brain, Clock, Coins, Flag, Heart, Scale, Settings, Shield, Sparkles, Star, Tag, TrendingDown, TrendingUp, Zap } from 'lucide-react';
import { holdComparison } from './mobilePsychologyModel.js';
import './desktopPsychology.css';

// Desktop Psychology v2 (PSYCHOLOGY_V2 in TradingJournal.jsx), after aaicorefx-desktop-psychology.html.
// It reads the same models as the phone Psychology Lab, so both always show the same numbers.
const percentage = (value) => value == null ? '—' : `${value.toFixed(0)}%`;
const tone = (value) => Number(value) > 0 ? 'is-gain' : Number(value) < 0 ? 'is-loss' : '';
const SECTION_LOOK = {
  performance: ['is-gn', TrendingUp], edge: ['is-pu', Zap], goals: ['', Shield], challenge: ['is-am', Flag],
  finance: ['is-gn', Coins], discipline: ['is-pu', Brain], focus: ['is-am', Flag],
};

function Ring({ value }) {
  const r = 50, c = 2 * Math.PI * r, [shown, setShown] = useState(0);
  useEffect(() => { const frame = requestAnimationFrame(() => setShown(value || 0)); return () => cancelAnimationFrame(frame); }, [value]);
  return <div className="ps2-rg" role="img" aria-label={`Verified clean execution ${percentage(value)}`}>
    <svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r={r} className="ps2-rg-track"/><circle cx="60" cy="60" r={r} className="ps2-rg-value" strokeDasharray={`${c * shown / 100} ${c}`} transform="rotate(-90 60 60)"/></svg>
    <b>{value == null ? '—' : Math.round(value)}<i>{value == null ? '' : '%'}</i></b>
  </div>;
}
const Bar = ({ value, kind = '' }) => <div className={`ps2-bar ${kind}`} aria-hidden="true"><i style={{ width: `${Math.max(0, Math.min(100, value || 0))}%` }}/></div>;
const Kpi = ({ icon: Icon, label, value, note, look = '' }) => <div className={`ps2-kc ${look}`}><span className="ps2-ic"><Icon size={17}/></span><small>{label}</small><b className={look}>{value}</b><span>{note}</span></div>;
const Head = ({ title, note, badge }) => <header className="ps2-hd"><div><h3>{title}</h3><span>{note}</span></div>{badge && <em>{badge}</em>}</header>;

function GrowthChart({ start, trades, goalPct, money, moneyShort = money }) {
  const wrap = useRef(null), [width, setWidth] = useState(900), [hover, setHover] = useState(null);
  const [show, setShow] = useState({ eq: true, bl: true, dd: true });
  useEffect(() => {
    const node = wrap.current; if (!node) return undefined;
    const measure = () => setWidth(Math.max(320, node.clientWidth - 16)); measure();
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null; observer?.observe(node);
    return () => observer?.disconnect();
  }, []);
  const points = useMemo(() => { let equity = Number(start) || 0; return [equity, ...trades.map((trade) => (equity += Number(trade.pnl) || 0))]; }, [start, trades]);
  if (points.length < 2) return <p className="ps2-note">Log trades to see your equity curve.</p>;
  const H = 324, L = 56, R = 14, T = 16, B = 30;
  const low = Math.min(...points, Number(start) || 0), high = Math.max(...points, Number(start) || 0), spare = (high - low || Math.abs(high) || 100) * .15;
  const min = Math.max(0, low - spare), max = high + spare;
  const X = (i) => L + (width - L - R) * i / (points.length - 1), Y = (v) => T + (H - T - B) * (1 - (v - min) / (max - min || 1));
  const line = points.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join(' ');
  let peak = points[0], peakAt = 0, worst = 0, from = 0, to = 0;
  points.forEach((v, i) => { if (v > peak) { peak = v; peakAt = i; } if (peak - v > worst) { worst = peak - v; from = peakAt; to = i; } });
  const ticks = [0, .25, .5, .75, 1].map((step) => min + step * (max - min));
  const move = (event) => { const box = event.currentTarget.getBoundingClientRect(), vx = (event.clientX - box.left) / box.width * width; setHover(Math.max(0, Math.min(points.length - 1, Math.round((vx - L) / (width - L - R) * (points.length - 1))))); };
  const tip = hover == null ? null : { x: X(hover) / width * 100, v: points[hover], change: hover ? points[hover] - points[hover - 1] : null };
  return <>
    <div className="ps2-lg" role="group" aria-label="Chart layers">
      {[['eq', 'Real equity', ''], ['bl', goalPct ? 'Projected target baseline' : 'Starting balance', 'is-dsh'], ['dd', 'Max drawdown', 'is-r']].map(([key, label, mark]) => <button type="button" key={key} aria-pressed={show[key]} className={show[key] ? 'is-on' : ''} onClick={() => setShow((current) => ({ ...current, [key]: !current[key] }))}><i className={mark}/>{label}</button>)}
    </div>
    <div className="ps2-cw" ref={wrap}>
      <svg viewBox={`0 0 ${width} ${H}`} role="img" aria-label="Equity after each trade" onPointerMove={move} onPointerLeave={() => setHover(null)}>
        <defs><linearGradient id="ps2-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" className="ps2-fill-a"/><stop offset="1" className="ps2-fill-b"/></linearGradient></defs>
        {ticks.map((tick) => <g key={tick}><line x1={L} x2={width - R} y1={Y(tick)} y2={Y(tick)} className="ps2-gl"/><text x={L - 8} y={Y(tick) + 4} textAnchor="end" className="ps2-gt">{moneyShort(tick)}</text></g>)}
        {show.dd && worst > 0 && <g><rect x={X(from)} y={Y(points[from])} width={Math.max(2, X(to) - X(from))} height={Y(points[to]) - Y(points[from])} className="ps2-ddr"/><line x1={X(from)} x2={X(to)} y1={Y(points[from])} y2={Y(points[from])} className="ps2-ddl"/><text x={(X(from) + X(to)) / 2} y={Y(points[from]) - 8} textAnchor="middle" className="ps2-ddt">Max drawdown {money(-worst)}</text></g>}
        {show.bl && <g><line x1={L} x2={width - R} y1={Y(Number(start) || 0)} y2={Y(Number(start) || 0)} className="ps2-bl"/><text x={width - R - 4} y={Y(Number(start) || 0) - 7} textAnchor="end" className="ps2-gt is-b">Start {moneyShort(start)}</text></g>}
        {show.eq && <g><path d={`${line} L${X(points.length - 1)} ${Y(min)} L${X(0)} ${Y(min)} Z`} fill="url(#ps2-fill)"/><path d={line} className="ps2-ln"/>{points.map((v, i) => (points.length <= 40 || hover === i) && <circle key={i} cx={X(i)} cy={Y(v)} r={hover === i ? 7 : 4.5} className={`ps2-dot${hover === i ? ' is-on' : ''}`}/>)}</g>}
        {hover != null && <line x1={X(hover)} x2={X(hover)} y1={T} y2={H - B} className="ps2-cx"/>}
        <text x={L} y={H - 8} className="ps2-gt">Start</text><text x={width - R} y={H - 8} textAnchor="end" className="ps2-gt">Trade {points.length - 1}</text>
      </svg>
      {tip && <div className="ps2-tp" style={{ left: `${Math.min(88, Math.max(4, tip.x))}%` }}><small>{hover ? `Trade ${hover}` : 'Start'}</small><b>{money(tip.v)}</b><span className={tip.change == null ? '' : tone(tip.change)}>{tip.change == null ? 'Opening balance' : `${tip.change >= 0 ? '+' : ''}${money(tip.change)}`}</span></div>}
    </div>
  </>;
}

export default function DesktopPsychologyV2({ data, trades, account, risk, riskStats, insights, briefing, money, moneyShort = money, formatRatio, onOpenReview, onReviewExits }) {
  const topMistake = data.mistakes[0];
  const [section, setSection] = useState('beh');
  const refs = { beh: useRef(null), risk: useRef(null), edge: useRef(null) };
  useEffect(() => {
    const nodes = Object.entries(refs).map(([key, ref]) => [key, ref.current]).filter(([, node]) => node);
    if (typeof IntersectionObserver !== 'function' || !nodes.length) return undefined;
    const observer = new IntersectionObserver((entries) => { const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]; if (visible) setSection(visible.target.dataset.sec); }, { rootMargin: '-140px 0px -55% 0px' });
    nodes.forEach(([, node]) => observer.observe(node));
    return () => observer.disconnect();
  }, []);
  const go = (key) => { setSection(key); refs[key].current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  const clean = data.cleanRate;
  const verdict = clean == null || !data.total ? ['Build your behavioural baseline.', 'Tag moods and rule checks on each trade.'] : !data.evaluated ? ['Clean execution needs rule checks.', 'Save your rule checks on each trade.'] : clean >= 70 ? ['Your process is holding.', 'Keep protecting the clean entries.'] : clean >= 40 ? ['Your behaviour needs attention.', 'Review the repeated triggers.'] : ['Your process is slipping.', 'Slow down and review the triggers.'];
  const pill = clean == null || !data.total || !data.evaluated ? ['', 'Not enough data'] : clean >= 70 ? ['is-gain', 'On track'] : clean >= 40 ? ['is-warn', 'Needs attention'] : ['is-loss', 'Act now'];
  const evaluated = trades.filter((trade) => (trade.ruleEvaluations || []).length);
  const rewardSignal = risk.recommendations.find((item) => item.label === 'REWARD QUALITY');
  const statsReady = !!briefing;
  return <main className="ps2" aria-label="Psychology">
    <section className="ps2-hero">
      <div className="ps2-hl"><span className="ps2-eb">Behavioural journal · Psychology Lab</span><h1><em>{verdict[0]}</em><br/>{verdict[1]}</h1><p>Look for the conditions where mistake tags or mood records change your decision quality. See which emotional states support clean execution, where mistakes cluster, and what deserves a closer review.</p></div>
      <div className="ps2-ring"><Ring value={clean}/><div><span className="ps2-eb2">Verified clean execution</span><p>{data.clean} of {data.total} trades with mood, all saved rules checked, and no mistake tag.</p><span className={`ps2-pill ${pill[0]}`}><Shield size={13}/>{pill[1]}</span></div></div>
    </section>
    <div className="ps2-kp">
      <Kpi icon={Heart} label="Mood coverage" value={percentage(data.coverage)} note={`${data.tagged} of ${data.total} trades tagged`}/>
      <Kpi icon={Tag} label="Mistake tag rate" value={percentage(data.mistakeRate)} note={`${data.mistakeTrades} trades with a mistake tag`} look="is-warn"/>
      <Kpi icon={Brain} label="Leading state · 3+ trades" value={data.leading?.mood || 'Not enough data'} note={data.leading ? `${percentage(data.leading.winRate)} win rate across ${data.leading.count} trades` : 'At least 3 trades in one state required'} look="is-gain"/>
      <Kpi icon={Flag} label="Top mistake" value={topMistake?.name || 'None recorded'} note={topMistake ? `${topMistake.count} tagged trades` : 'No mistake tags saved'} look="is-loss"/>
    </div>
    <nav className="ps2-snav" aria-label="Psychology sections">{[['beh', 'Behaviour'], ['risk', 'Risk & growth'], ['edge', 'Edge summary']].map(([key, label]) => <button type="button" key={key} aria-current={section === key ? 'true' : undefined} className={section === key ? 'is-on' : ''} onClick={() => go(key)}>{label}</button>)}</nav>

    <section className="ps2-sec" ref={refs.beh} data-sec="beh">
      <div className="ps2-sech"><h2>Behaviour</h2><span>How your emotional state and discipline shape each trade</span></div>
      <div className="ps2-g3">
        <div className="ps2-card">
          <Head title="Emotion × Rule Adherence" note="Which pre-entry states keep the plan intact." badge={`${data.moodRows.length} state${data.moodRows.length === 1 ? '' : 's'}`}/>
          {data.moodRows.length ? data.moodRows.map((mood) => <div className="ps2-br" key={mood.mood}><div><b>{mood.mood}</b><small>{mood.evaluated} trades evaluated</small></div><Bar value={mood.adherence}/><strong className={mood.adherence == null ? '' : mood.adherence >= 80 ? 'is-gain' : mood.adherence >= 50 ? 'is-warn' : 'is-loss'}>{percentage(mood.adherence)}</strong></div>) : <p className="ps2-note">Log a mood before entry to see which states keep the plan intact.</p>}
          {evaluated.length > 0 && <div className="ps2-dots" aria-label="Rule checks per trade">{evaluated.slice(-16).map((trade, index) => { const ok = trade.ruleEvaluations.every((rule) => rule.checked); return <i key={trade.id || index} className={ok ? '' : 'is-miss'} title={`${trade.asset || trade.instrument || 'Trade'} · ${trade.date || ''}: ${ok ? 'all rules checked' : 'a rule was missed'}`}><Shield size={13}/></i>; })}</div>}
          {evaluated.length > 0 && <p className="ps2-note">{evaluated.filter((trade) => trade.ruleEvaluations.every((rule) => rule.checked)).length} of {evaluated.length} evaluated trades followed every saved rule before entry.</p>}
          <div className="ps2-foot"><span>Overall rule adherence</span><b>{percentage(data.overallAdherence)}</b></div>
        </div>
        <div className="ps2-card">
          <Head title="State Shifts" note="What changes between entry and exit." badge={`${data.changed} / ${data.statePairs} changed`}/>
          {data.shifts.length ? data.shifts.map((shift) => { const [from, to] = shift.label.split(' → '); return <div className="ps2-shift" key={shift.label}><div className="ps2-fl"><span className="ps2-chip">{from}</span><ArrowRight size={14}/><span className={`ps2-chip ${shift.pnl >= 0 ? 'is-gn' : 'is-ls'}`}>{to}</span></div><div><b className={tone(shift.pnl)}>{money(shift.pnl)}</b><small>{shift.count} trade{shift.count === 1 ? '' : 's'}</small></div></div>; }) : <p className="ps2-note">{data.statePairs ? 'No mood shifts recorded: your state held from entry to exit.' : 'Log both entry and exit moods to compare states.'}</p>}
          <div className="ps2-foot"><span>Stable state through execution</span><b>{percentage(data.stableRate)}</b></div>
        </div>
        <div className="ps2-card">
          <Head title="After-Loss Recovery" note="How the next trade behaves after a losing result." badge={`${data.recoveryCount} next trades`}/>
          <div className="ps2-rec"><div><span>Next-trade win rate</span><b>{percentage(data.recoveryWinRate)}</b></div><div><span>No mistake tagged</span><b>{percentage(data.recoveryCleanRate)}</b></div><div><span>Average next P&amp;L</span><b className={data.recoveryPnl == null ? '' : tone(data.recoveryPnl)}>{data.recoveryPnl == null ? '—' : money(data.recoveryPnl)}</b></div></div>
          <p className="ps2-tip"><Sparkles size={14}/>Use a short reset before the next entry: name the loss, re-check the setup, then decide.</p>
        </div>
      </div>
      <div className="ps2-g2">
        <div className="ps2-card">
          <Head title="Win Rate by Emotion" note="How your pre-entry state is showing up in outcomes." badge={`${data.moodRows.length} state${data.moodRows.length === 1 ? '' : 's'}`}/>
          {data.moodRows.length ? data.moodRows.map((mood) => <div className="ps2-em" key={mood.mood}><div className="ps2-emh"><b>{mood.mood}</b><span>{mood.count} trade{mood.count === 1 ? '' : 's'}</span><strong className={mood.winRate >= 60 ? 'is-gain' : mood.winRate >= 40 ? 'is-warn' : 'is-loss'}>{percentage(mood.winRate)}</strong><strong className={tone(mood.pnl)}>{money(mood.pnl)}</strong></div><div className="ps2-bar is-big"><i style={{ width: `${mood.winRate || 0}%` }}/><u/></div><div className="ps2-scale"><span>0%</span><span>50%</span><span>100%</span></div></div>) : <p className="ps2-note">Tag a mood before entry to see how each state performs.</p>}
          {data.moodRows.length === 1 && <p className="ps2-note">Only one mood has been logged so far. Tag more moods before entry to compare states.</p>}
        </div>
        <div className="ps2-card ps2-next">
          <Head title="Next Review" note="One useful action from your current journal sample."/>
          <div className="ps2-act"><span className="ps2-ic is-loss"><Flag size={17}/></span><div><b>{topMistake ? `Review ${topMistake.name}` : data.evaluated ? 'Protect your clean process' : 'Build your behavioural baseline'}</b><p>{topMistake ? `${topMistake.count} trade${topMistake.count === 1 ? ' carries' : 's carry'} this tag. Read those notes for the moment the plan changed.` : 'Record mood before and after the trade, complete your rule checks, and review the result.'}</p></div></div>
          {topMistake && <button type="button" className="ps2-btn is-pri" onClick={onOpenReview}>Open the {topMistake.count} trade{topMistake.count === 1 ? '' : 's'}<ArrowRight size={15}/></button>}
          <p className="ps2-note">{data.overallAdherence == null ? 'Save rule checks to measure process adherence independently of profit.' : `Your saved rule adherence is ${percentage(data.overallAdherence)}. Keep checking the plan before entry, not after the result.`}</p>
        </div>
      </div>
      <div className="ps2-card">
        <Head title="Mistake Patterns" note="Where execution is drifting from the plan." badge={`${data.mistakes.length} pattern${data.mistakes.length === 1 ? '' : 's'}`}/>
        {data.mistakes.length ? <div className="ps2-mp">{data.mistakes.map((mistake) => <div className="ps2-mpi" key={mistake.name}><div><b>{mistake.name}</b><small>{percentage(mistake.share)} of all trades</small></div><span className="ps2-cnt">{mistake.count}</span><Bar value={mistake.share} kind="is-ls"/></div>)}</div> : <p className="ps2-note">No mistakes recorded. Keep tagging trades to see where execution drifts.</p>}
      </div>
    </section>

    <section className="ps2-sec" ref={refs.risk} data-sec="risk">
      <div className="ps2-sech"><h2>Risk &amp; growth</h2><span>Live journal data: drawdown, hold time and equity</span></div>
      <div className="ps2-rk">
        <Kpi icon={Scale} label="Average risk-to-reward" value={`${risk.averageRR.toFixed(2)}R`} note={`Across ${riskStats.total} trades`} look="is-blue"/>
        <Kpi icon={TrendingDown} label="Max observed drawdown" value={`−${risk.drawdownPct.toFixed(2)}%`} note={`${money(-risk.maxDrawdown)} peak-to-floor`} look="is-loss"/>
        <Kpi icon={Settings} label="Max allowed drawdown" value={risk.monthlyCapPct ? `${risk.monthlyCapPct.toFixed(2)}%` : 'Not set'} note={risk.monthlyCapPct ? 'Using the monthly risk cap' : 'Configure in Account Settings'}/>
        <Kpi icon={Clock} label="Winning trade hold" value={risk.formatHold(risk.winHold)} note={risk.winHold == null ? 'Add entry and exit times' : `${risk.winningHolds.length} timed winning trades`} look="is-gain"/>
        <Kpi icon={Clock} label="Losing trade hold" value={risk.formatHold(risk.lossHold)} note={risk.lossHold == null ? 'Add entry and exit times' : `${risk.losingHolds.length} timed losing trades`} look="is-loss"/>
      </div>
      <p className="ps2-note ps2-holdnote">{holdComparison(risk.winHold, risk.lossHold)}</p>
      <div className="ps2-card ps2-chart">
        <Head title="Monthly Growth Evolution" note="Your real equity against the starting balance." badge={risk.monthlyGoalPct ? `${risk.monthlyGoalPct.toFixed(2)}% / month target` : 'No monthly target'}/>
        <GrowthChart start={account.balance} trades={trades} goalPct={risk.monthlyGoalPct} money={money} moneyShort={moneyShort}/>
      </div>
      {risk.recommendations.map((item) => <div className={`ps2-rec2 is-${item.tone}`} key={item.label}><span className="ps2-ic"><Zap size={17}/></span><div><span className="ps2-eb2">{item.label.toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase())} · {risk.recommendations.length} signal{risk.recommendations.length === 1 ? '' : 's'}</span><b>{item.title}</b><p>{item.body}</p></div>{item === rewardSignal && <button type="button" className="ps2-btn" onClick={onReviewExits}>Review exits<ArrowRight size={14}/></button>}</div>)}
    </section>

    <section className="ps2-sec" ref={refs.edge} data-sec="edge">
      <div className="ps2-sech"><h2>Edge summary</h2><span>Your journal, risk plan and capital in one read</span></div>
      <div className="ps2-edge"><div className="ps2-el"><span className="ps2-eb">Insight · Journal intelligence</span><h2>Edge Optimization</h2><p>Turn real execution history into clearer decisions on risk, growth, and where discipline needs tightening.</p>
        <div className="ps2-chips"><span><Clock size={13}/>{insights.bestSession ? `${insights.bestSession.session} is the strongest session` : 'Build a session sample'}</span><span><Star size={13}/>{insights.bestTag ? `${insights.bestTag.tag} is the strongest tagged setup` : 'Tag entry models to find the edge'}</span><span><TrendingUp size={13}/>{money(insights.expectancy)} expectancy per trade</span></div></div>
        <div className="ps2-ce"><small>Compounded return</small><b className={tone(insights.compoundedReturn)}>{insights.compoundedReturn >= 0 ? '+' : ''}{insights.compoundedReturn.toFixed(2)}%</b><span>{money(insights.currentEquity)} live balance</span></div></div>
      {statsReady ? <>
        <div className="ps2-net">
          <div className="ps2-card ps2-nr"><small>Net journal result</small><b className={tone(insights.stats.netPnl)}>{money(insights.stats.netPnl)}</b><span>{insights.stats.total} trades · {insights.stats.winRate.toFixed(0)}% win rate</span><div className="ps2-mini" aria-hidden="true"><i style={{ width: `${insights.stats.winRate}%` }}/></div></div>
          <div className="ps2-card ps2-nm"><small>Profit factor</small><b>{formatRatio(insights.stats.profitFactor)}</b><span>{formatRatio(insights.stats.avgWinLoss)} average win/loss</span></div>
          <div className="ps2-card ps2-nm"><small>Expectancy</small><b className={tone(insights.stats.netPnl)}>{money(insights.stats.netPnl / insights.stats.total)}</b><span>Expected result per trade</span></div>
          <div className="ps2-card ps2-nm"><small>Average risk / reward</small><b className="is-blue">{briefing.averageRR.toFixed(2)}R</b><span>Across the full journal</span></div>
          <div className="ps2-card ps2-nm"><small>Max drawdown</small><b className="is-loss">−{briefing.drawdownPct.toFixed(2)}%</b><span>{money(-briefing.maxDrawdown)} peak to floor</span></div>
        </div>
        <div className="ps2-ins">{briefing.sections.map((item) => { const [look, Icon] = SECTION_LOOK[item.key] || SECTION_LOOK.goals; return <article className={`ps2-card ps2-in ${look}`} key={item.key}><span className="ps2-ic"><Icon size={17}/></span><small>{item.label}</small><h4>{item.title}</h4><p>{item.body}</p></article>; })}</div>
      </> : <p className="ps2-note">Log trades to build your detailed performance briefing.</p>}
    </section>
  </main>;
}

