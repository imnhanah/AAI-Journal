import React, {useEffect, useRef, useState} from 'react';
import {ArrowRight, Brain, ChevronDown, Coins, Flag, Shield, Star, Target, TrendingUp} from 'lucide-react';
import {growthChart, holdComparison, holdWidths, moodBarTone} from './mobilePsychologyModel.js';
import './mobilePsychologyLab.css';

const percentage = value => value == null ? '—' : `${value.toFixed(0)}%`;
const ACCORDION = {
  performance:['is-green',Star], edge:['is-purple',Target], goals:['is-neutral',Shield], challenge:['is-amber',Flag],
  finance:['is-green',Coins], discipline:['is-purple',Brain], focus:['is-amber',TrendingUp],
};
const signTone = value => Number(value) > 0 ? 'is-profit' : Number(value) < 0 ? 'is-loss' : '';

function Ring({value}) {
  return <div className="tj-psy-ring" role="img" aria-label={`Clean execution ${percentage(value)}`} style={{'--ring':`${value || 0}%`}}><div><b>{percentage(value)}</b></div></div>;
}

function PsychologyTab({data,money,onOpenReview}) {
  const [lens,setLens] = useState('win'), topMistake = data.mistakes[0], wins = lens === 'win';
  return <>
    <section className="tj-psy-hero is-purple"><small>Behavioral journal</small><h2>Psychology Lab</h2><p>See which emotional states support clean execution, where mistakes cluster, and what deserves a closer review.</p>
      <div className="tj-psy-verified"><Ring value={data.cleanRate}/><div><small>Verified clean execution</small><p>{data.clean} of {data.total} trades with mood, all saved rules checked, and no mistake tag.</p></div></div>
    </section>
    <div className="tj-psy-tiles">
      <div><span>Mood coverage</span><b>{percentage(data.coverage)}</b><small>{data.tagged} of {data.total} trades tagged</small><i aria-hidden="true"><em className="is-gain" style={{width:`${data.coverage || 0}%`}}/></i></div>
      <div><span>Mistake tag rate</span><b>{percentage(data.mistakeRate)}</b><small>{data.mistakeTrades} trades with a mistake tag</small><i aria-hidden="true"><em className="is-drop" style={{width:`${data.mistakeRate || 0}%`}}/></i></div>
      <div className="is-win"><span>Leading state · 3+ trades</span><b className="is-text">{data.leading?.mood || 'Not enough data'}</b><small>{data.leading ? `${percentage(data.leading.winRate)} win rate across ${data.leading.count} trades` : 'At least 3 trades in one state required'}</small></div>
      <div className="is-lose"><span>Top mistake</span><b className="is-text">{topMistake?.name || 'None recorded'}</b><small>{topMistake ? `${topMistake.count} tagged trades` : 'No mistake tags saved'}</small></div>
    </div>
    <section className="tj-psy-card"><header><div><h3>Emotion lab</h3><p>{wins ? 'How your pre-entry state shows up in outcomes.' : 'Which pre-entry states keep the plan intact.'}</p></div><span>{data.moodRows.length} state{data.moodRows.length === 1 ? '' : 's'}</span></header>
      <div className="tj-psy-lens" role="tablist" aria-label="Emotion lab view">{[['win','Win rate'],['rules','Rule adherence']].map(([value,label]) => <button type="button" role="tab" key={value} aria-selected={lens === value} onClick={() => setLens(value)}><span>{label}</span></button>)}</div>
      {data.moodRows.length ? data.moodRows.map(mood => { const rate = wins ? mood.winRate : mood.adherence; return <div className="tj-psy-mood" key={mood.mood}><div><span><b>{mood.mood}</b><small>{wins ? `${mood.count} trades` : `${mood.evaluated} trades evaluated`}</small></span><span className="tj-psy-mood-value"><b className={wins ? signTone(mood.pnl) : ''}>{percentage(rate)}</b>{wins && <small>{money(mood.pnl)}</small>}</span></div><i aria-hidden="true"><em className={moodBarTone(rate)} style={{width:`${rate || 0}%`}}/></i></div>; }) : <p className="tj-psy-empty">{wins ? 'Log trades with a mood to see this.' : 'Log moods and rule checks to see this.'}</p>}
      <div className="tj-psy-line"><span>{wins ? 'Best state to trade from' : 'Overall rule adherence'}</span><b>{wins ? data.leading?.mood || '—' : percentage(data.overallAdherence)}</b></div>
    </section>
    <section className="tj-psy-card"><header><div><h3>State shifts</h3><p>What changes between entry and exit.</p></div><span>{data.changed}/{data.statePairs} changed</span></header>
      {data.shifts.length ? data.shifts.map(shift => <div className="tj-psy-shift" key={shift.label}><div><em>{shift.label}</em><small>{shift.count} trade{shift.count === 1 ? '' : 's'}</small></div><b className={shift.pnl >= 0 ? 'is-profit' : 'is-loss'}>{money(shift.pnl)}</b></div>) : <p className="tj-psy-empty">{data.statePairs ? 'No mood shifts recorded.' : 'Log both entry and exit moods to compare.'}</p>}
      <div className="tj-psy-line"><span>Stable state through execution</span><b>{percentage(data.stableRate)}</b></div>
    </section>
    <section className="tj-psy-card"><header><div><h3>After-loss recovery</h3><p>How the next trade behaves after a losing result.</p></div><span>{data.recoveryCount} next trades</span></header>
      <div className="tj-psy-line is-first"><span>Next-trade win rate</span><b>{percentage(data.recoveryWinRate)}</b></div>
      <div className="tj-psy-line"><span>No mistake tagged</span><b>{percentage(data.recoveryCleanRate)}</b></div>
      <div className="tj-psy-line"><span>Average next P&amp;L</span><b className={data.recoveryPnl == null ? '' : data.recoveryPnl >= 0 ? 'is-profit' : 'is-loss'}>{data.recoveryPnl == null ? '—' : money(data.recoveryPnl)}</b></div>
      <p className="tj-psy-tip">Use a short reset before the next entry: name the loss, re-check the setup, then decide.</p>
    </section>
    <section className="tj-psy-card"><header><div><h3>Mistake patterns</h3><p>Where execution is drifting from the plan.</p></div><span>{data.mistakes.length} pattern{data.mistakes.length === 1 ? '' : 's'}</span></header>
      {data.mistakes.length ? data.mistakes.map(mistake => <div className="tj-psy-mistake" key={mistake.name}><div><b>{mistake.name}</b><small>{percentage(mistake.share)} of all trades</small></div><strong>{mistake.count}</strong><i aria-hidden="true"><em className="is-drop" style={{width:`${mistake.share}%`}}/></i></div>) : <p className="tj-psy-empty">No mistakes recorded. Keep tagging trades to protect the clean baseline.</p>}
    </section>
    <section className="tj-psy-next"><small>Next review</small><h3>{topMistake ? `Review ${topMistake.name}` : data.evaluated ? 'Protect your clean process' : 'Build your behavioral baseline'}</h3><p>{topMistake ? `${topMistake.count} trades carry this tag. Read those notes for the moment the plan changed.` : 'Record mood before and after the trade, complete your rule checks, and review the result.'}</p>
      {topMistake && <button type="button" onClick={onOpenReview}>Open the {topMistake.count} trades<ArrowRight size={14}/></button>}
      <p className="is-foot">{data.overallAdherence == null ? 'Save rule checks to measure process adherence independently of profit.' : `Your saved rule adherence is ${percentage(data.overallAdherence)}. Keep checking the plan before entry, not after the result.`}</p>
    </section>
  </>;
}

function GrowthChart({rows,goalPct,money,moneyShort}) {
  const chart = growthChart(rows), [index,setIndex] = useState(Math.max(0,rows.length - 1));
  useEffect(() => { setIndex(Math.max(0,rows.length - 1)); },[rows.length]);
  if (!chart) return <p className="tj-psy-empty">Log trades to see monthly growth.</p>;
  const move = event => { const box = event.currentTarget.getBoundingClientRect(), left = chart.left / 340, right = chart.right / 340; setIndex(Math.round(Math.max(0,Math.min(1,((event.clientX - box.left) / box.width - left) / (right - left))) * (rows.length - 1))); };
  const row = rows[Math.min(index,rows.length - 1)];
  return <>
    <svg className="tj-psy-growth" viewBox="0 0 340 190" role="img" aria-label="Monthly growth evolution" onPointerDown={move} onPointerMove={move}>
      {chart.ticks.map(tick => <g key={tick}><line className="is-grid" x1={chart.left} x2={chart.right} y1={chart.y(tick)} y2={chart.y(tick)}/><text className="is-tick" x={chart.left - 6} y={chart.y(tick) + 4} textAnchor="end">{moneyShort(tick)}</text></g>)}
      <path className="is-area" d={chart.area}/><path className="is-target" d={chart.target}/><path className="is-actual" d={chart.actual}/>
      {rows.map((item,position) => <circle key={item.label} className={position === index ? 'is-on' : ''} cx={chart.x(position)} cy={chart.y(Number(item.actual))} r="5"/>)}
      <text className="is-tick" x={chart.left} y={chart.height - 6} textAnchor="start">{rows[0].label}</text>
      {rows.length > 1 && <text className="is-tick" x={chart.right} y={chart.height - 6} textAnchor="end">{rows.at(-1).label}</text>}
    </svg>
    <div className="tj-psy-legend"><span><i/>Real equity</span><span><i className="is-dash"/>Projected target baseline</span></div>
    <p className="tj-psy-tip is-read"><b>{row.label}</b><br/>Real equity: <b className="is-profit">{money(row.actual)}</b><br/>Target baseline: <b className="is-purple-text">{money(row.target)}</b></p>
    <p className="tj-psy-sr">{goalPct ? `${goalPct.toFixed(2)}% target a month` : 'No monthly target set'}</p>
  </>;
}

function RiskTab({risk,riskStats,money,moneyShort}) {
  const widths = holdWidths(risk.winHold,risk.lossHold), rail = useRef(null), timer = useRef(0), [card,setCard] = useState(0);
  useEffect(() => () => clearTimeout(timer.current),[]);
  const onScroll = () => { clearTimeout(timer.current); timer.current = setTimeout(() => { const el = rail.current; if (el) setCard(Math.round(el.scrollLeft / Math.max(1,el.clientWidth + 12))); },80); };
  return <>
    <div className="tj-psy-rail" ref={rail} data-scroll-row="true" onScroll={onScroll}>
      <div className="is-purple"><span>Average risk-to-reward</span><b>{risk.averageRR.toFixed(2)}R</b><small>Across {riskStats.total} trades</small></div>
      <div className="is-red"><span>Max observed drawdown</span><b>-{risk.drawdownPct.toFixed(2)}%</b><small>{money(-risk.maxDrawdown)} peak-to-floor</small></div>
      <div className="is-plain"><span>Max allowed drawdown</span><b>{risk.monthlyCapPct ? `${risk.monthlyCapPct.toFixed(2)}%` : 'Not set'}</b><small>{risk.monthlyCapPct ? 'Using the monthly risk cap' : 'Configure in Account Settings'}</small></div>
    </div>
    <div className="tj-psy-dots" aria-hidden="true">{[0,1,2].map(dot => <i key={dot} className={dot === card ? 'is-on' : ''}/>)}</div>
    <section className="tj-psy-card"><header><div><h3>How long you hold</h3><p>Average trade hold time by outcome.</p></div><span>Live journal data</span></header>
      <div className="tj-psy-hold"><div><span>Winning trades<small>{risk.winHold == null ? 'Add entry and exit times' : `${risk.winningHolds.length} timed winning trades`}</small></span><b className="is-profit">{risk.formatHold(risk.winHold)}</b></div><i aria-hidden="true"><em className="is-gain" style={{width:`${widths.win}%`}}/></i></div>
      <div className="tj-psy-hold"><div><span>Losing trades<small>{risk.lossHold == null ? 'Add entry and exit times' : `${risk.losingHolds.length} timed losing trades`}</small></span><b className="is-loss">{risk.formatHold(risk.lossHold)}</b></div><i aria-hidden="true"><em className="is-drop" style={{width:`${widths.loss}%`}}/></i></div>
      <p className="tj-psy-tip">{holdComparison(risk.winHold,risk.lossHold)}</p>
    </section>
    <section className="tj-psy-card"><header><div><h3>Monthly growth evolution</h3><p>Drag across the chart to read a month.</p></div><span>{risk.monthlyGoalPct ? `${risk.monthlyGoalPct.toFixed(2)}% / month` : 'No monthly target'}</span></header><GrowthChart rows={risk.growthData} goalPct={risk.monthlyGoalPct} money={money} moneyShort={moneyShort}/></section>
    <section className="tj-psy-card"><header><div><h3>Actionable recommendations</h3></div><span>{risk.recommendations.length} signal{risk.recommendations.length === 1 ? '' : 's'}</span></header>
      <div className="tj-psy-recs">{risk.recommendations.map(item => <div key={item.label} data-tone={item.tone}><span>{item.label}</span><b>{item.title}</b><p>{item.body}</p></div>)}</div>
    </section>
  </>;
}

function InsightsTab({insights,briefing,money,formatRatio}) {
  const [open,setOpen] = useState(briefing?.sections[0]?.key ?? null), {stats,bestSession,bestTag,expectancy,currentEquity,compoundedReturn} = insights;
  return <>
    <section className="tj-psy-hero is-green"><small>Insight · Journal intelligence</small><h2>Edge Optimization</h2><p>Turn real execution history into clearer decisions on risk, growth, and where discipline needs tightening.</p>
      <div className="tj-psy-return"><div><span>Compounded return</span><b className={compoundedReturn >= 0 ? 'is-profit' : 'is-loss'}>{compoundedReturn >= 0 ? '+' : ''}{compoundedReturn.toFixed(2)}%</b></div><small>{money(currentEquity)} live balance</small></div>
      <div className="tj-psy-chips"><span>{bestSession ? <><b>{bestSession.session}</b> is the strongest session</> : 'Build a session sample'}</span><span>{bestTag ? <><b>{bestTag.tag}</b> is the strongest tagged setup</> : 'Tag entry models to find the edge'}</span><span><b>{money(expectancy)}</b> expectancy per trade</span></div>
    </section>
    {briefing ? <>
      <div className="tj-psy-read"><h3>Your journal, risk plan, and capital in one read</h3><div><b className={stats.netPnl >= 0 ? 'is-profit' : 'is-loss'}>{money(stats.netPnl)}</b><small>Net journal result · {stats.total} trades · {stats.winRate.toFixed(0)}% win rate</small></div></div>
      <div className="tj-psy-tiles">
        <div><span>Profit factor</span><b>{formatRatio(stats.profitFactor)}</b><small>{formatRatio(stats.avgWinLoss)} average win/loss</small></div>
        <div className={stats.netPnl >= 0 ? 'is-win' : 'is-lose'}><span>Expectancy</span><b>{money(stats.netPnl / stats.total)}</b><small>Expected result per trade</small></div>
        <div><span>Average risk / reward</span><b className="is-purple-text">{briefing.averageRR.toFixed(2)}R</b><small>Across the full journal</small></div>
        <div className="is-lose"><span>Max drawdown</span><b>-{briefing.drawdownPct.toFixed(2)}%</b><small>{money(-briefing.maxDrawdown)} peak to floor</small></div>
      </div>
      {briefing.sections.map(section => { const [tone,Icon] = ACCORDION[section.key] || ACCORDION.goals, isOpen = open === section.key; return <section className={`tj-psy-accordion ${tone}`} key={section.key}><button type="button" aria-expanded={isOpen} onClick={() => setOpen(key => key === section.key ? null : section.key)}><i aria-hidden="true"><Icon size={17}/></i><span><small>{section.label}</small><b>{section.title}</b></span><ChevronDown size={16} aria-hidden="true"/></button>{isOpen && <p>{section.body}</p>}</section>; })}
    </> : <p className="tj-psy-empty">Log trades to build your detailed performance briefing.</p>}
  </>;
}

export default function MobilePsychologyLab({data,money,moneyShort,risk,riskStats,insights,briefing,formatRatio,onOpenReview}) {
  const [tab,setTab] = useState('psychology'), root = useRef(null);
  const choose = value => { setTab(value); root.current?.closest('.tj-content')?.scrollTo({top:0}); };
  const tabs = [['psychology','Psychology'],['risk','Risk'],['insights','Insights']], index = tabs.findIndex(([value]) => value === tab);
  return <main className="tj-psy" ref={root} aria-label="Psychology">
    <div className="tj-psy-tabs" role="tablist" aria-label="Psychology sections" style={{'--i':index}}><i aria-hidden="true"/>{tabs.map(([value,label]) => <button type="button" role="tab" key={value} aria-selected={tab === value} onClick={() => choose(value)}>{label}</button>)}</div>
    {tab === 'psychology' && <PsychologyTab data={data} money={money} onOpenReview={onOpenReview}/>}
    {tab === 'risk' && <RiskTab risk={risk} riskStats={riskStats} money={money} moneyShort={moneyShort}/>}
    {tab === 'insights' && <InsightsTab insights={insights} briefing={briefing} money={money} formatRatio={formatRatio}/>}
  </main>;
}
