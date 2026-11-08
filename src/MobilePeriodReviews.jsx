import React, {useEffect, useRef, useState} from 'react';
import {AlertTriangle, Check, ChevronDown, ChevronLeft, ChevronRight} from 'lucide-react';
import PhoneHeaderSlot from './PhoneHeaderSlot.jsx';
import {useLeaveGuard} from './useLeaveGuard.js';
import './mobilePeriodReviews.css';

// The phone view of Review. ReviewPage still owns the drafts, questions and saving; this only lays
// them out. `h` holds the shared number formatting and charts, so both views show the same figures.
const KV = ({rows}) => <dl className="tj-pr-kv">{rows.map(([label, value, tone]) => <div key={label}><dt>{label}</dt><dd className={tone || ''}>{value ?? '—'}</dd></div>)}</dl>;

function AutoText({label, value, onChange, tone}) {
  const area = useRef(null);
  useEffect(() => { const node = area.current; if (!node) return; node.style.height = 'auto'; node.style.height = `${Math.max(92, node.scrollHeight)}px`; }, [value]);
  return <label className="tj-pr-q"><span className={tone || ''}>{label}</span><textarea ref={area} placeholder="Start writing…" value={value} onChange={event => onChange(event.target.value)}/></label>;
}

const Group = ({title, children}) => <div className="tj-pr-group"><h4>{title}</h4>{children}</div>;

function Reflection({kind, questions, val, set, written, sectionCount}) {
  const long = (key, label) => <AutoText key={key} label={label} value={val(key)} onChange={text => set(key, text)}/>;
  const glance = <Group title="Short reads">{questions.glance.map(item => <label className="tj-pr-q" key={item.key}><span>{item.label}</span><input placeholder="Add a short read…" value={val(item.key)} onChange={event => set(item.key, event.target.value)}/></label>)}</Group>;
  const bars = <div className="tj-pr-prog" aria-label={`${written} of ${sectionCount} reflection sections written`}>{Array.from({length:sectionCount}, (_, index) => <i key={index} className={index < written ? 'is-done' : ''}/>)}</div>;
  if (kind === 'quarter') return <>{bars}
    <Group title="Action plan">{long('goals', 'What are my goals for next quarter?')}{long('habits', 'Which habits will I keep or strengthen next quarter?')}{long('mistakes', 'Which recurring mistakes will I address?')}</Group>
    <Group title="Technical">{long('technical0', 'What commonalities were present in my winning trades?')}{long('technical1', 'What commonalities were present in my losing trades?')}{long('technical2', 'Are there any strategy rules I need to tweak, add, or remove?')}</Group>
    <Group title="Markups · Overall">{long('markups', 'How accurate were my markups and directional bias?')}{long('overall', 'What did I do well across this quarter?')}</Group>
  </>;
  const period = kind === 'year' ? 'this period' : 'this month';
  const technical = kind === 'year'
    ? questions.technical.map(item => long(item.key, item.prompt))
    : [long('technical0', 'What commonalities were present in my winning trades?'), long('technical1', 'What commonalities were present in my losing trades?'), long('technical2', 'Are there any strategy rules I need to tweak, add, or remove?')];
  return <>{bars}{glance}
    <Group title="Technical">{technical}</Group>
    <Group title="Mistakes · Habits · Markups">{long('mistakes', `What mistakes did I make ${period} and what caused them?`)}{long('habits', `How consistently did I follow my trading routine ${period}?`)}{long('markups', 'How accurate was my overall directional bias?')}</Group>
  </>;
}

function NextSteps({kind, val, set}) {
  const long = (key, label) => <AutoText key={key} label={label} value={val(key)} onChange={text => set(key, text)}/>;
  if (kind === 'year') return <Group title="Next-year planning">{long('goals', 'Did I complete the goals I set for this period? Why or why not?')}{long('overall', 'What did I do well this period?')}</Group>;
  return <Group title="Next month">{long('goals', 'What are my goals for next month?')}{long('overall', 'What did I do well this month?')}</Group>;
}

function Stats({rows}) {
  return <div className="tj-pr-stats">{rows.map(([label, value, tone]) => <div key={label}><small>{label}</small><b className={tone || ''}>{value}</b></div>)}</div>;
}

function detailSections({review, h, onJump, reflection, nextSteps}) {
  const m = review.metrics, {money, pct, has, rate, sign} = h, EquityChart = h.EquityChart, QuarterTrendChart = h.QuarterTrendChart;
  const signed = value => has(value) ? money(value, true) : null;
  if (review.kind === 'year') {
    const quarters = m.quarters || [], live = quarters.filter(q => q.trades > 0);
    const best = [...live].sort((a, b) => b.returnPct - a.returnPct)[0];
    const list = arr => (arr && arr.length ? arr.map(x => `${x.name} ${money(x.pnl, true)}`).join(' · ') : null);
    return [
      ['Equity & performance', <>
        <div className="tj-pr-card"><h3>Equity growth</h3>{m.equity && m.equity.length > 1 ? <EquityChart points={m.equity}/> : <p className="tj-pr-empty">The equity curve needs your account balance and trades.</p>}</div>
        <div className="tj-pr-card"><h3>Key figures</h3><KV rows={[['Net profit', signed(m.netPnl)], ['Profit factor', m.profitFactor], ['Average R', m.avgR], ['Maximum drawdown', has(m.maxDrawdown) ? `${Number(m.maxDrawdown) > 0 ? '−' : ''}${Math.abs(Number(m.maxDrawdown)).toFixed(2)}%` : null], ['Gross profit', signed(m.grossProfit)], ['Total trading costs', has(m.costs) ? money(m.costs) : null]]}/></div>
      </>],
      ['Twelve months', <div className="tj-pr-months12">{(m.months || []).map(month => <button type="button" key={month.id} disabled={!month.trades} className={month.trades ? (month.returnPct < 0 ? 'is-loss' : 'is-gain') : ''} aria-label={`${month.name} ${pct(month.returnPct)}`} onClick={() => onJump(month.id)}>{month.name.slice(0, 3)}<b>{month.trades ? h.short(month.returnPct) : '—'}</b></button>)}</div>, 'Tap a month to open'],
      ['Quarters', <div className="tj-pr-qscroll" data-scroll-row="true">{quarters.map(q => <button type="button" key={q.id} onClick={() => onJump(q.id)}><b>{q.label}{q === best && <em>Best</em>}</b><strong className={h.tone(q.returnPct)}>{pct(q.returnPct)}</strong><small>{has(q.netPnl) ? `${money(q.netPnl, true)} · ` : ''}{rate(q.winRate)} win</small><small>{q.reviewed}/{q.trades} reviewed</small></button>)}</div>],
      ['Execution', <>
        <div className="tj-pr-card"><h3>Strategy</h3><KV rows={[['Best context', m.bestContext ? `${m.bestContext.label} · ${m.bestContext.note}` : null], ['Best entry models', list(m.bestEntryModels)], ['Worst entry models', list(m.worstEntryModels)]]}/></div>
        <div className="tj-pr-card"><h3>Discipline</h3><KV rows={[['Process score', m.process], ['Active days', m.activeDays], ['Review depth', `${m.reviewed}/${m.trades}`], ['Common mistakes', m.commonMistakes && m.commonMistakes.length ? m.commonMistakes.join(', ') : null], ['Mood shifts', m.moodShifts]]}/></div>
      </>],
      ['Reflection', reflection, 'written'],
      ['Next-year planning', nextSteps],
    ];
  }
  if (review.kind === 'quarter') {
    const months = m.months || [], live = months.filter(x => x.trades > 0);
    const best = [...live].sort((a, b) => b.returnPct - a.returnPct)[0], worst = [...live].sort((a, b) => a.returnPct - b.returnPct)[0];
    const max = Math.max(1, ...months.map(x => Math.abs(x.returnPct)));
    return [
      ['Three-month comparison', <div className="tj-pr-compare">{months.map((month, index) => {
        const prev = index ? months[index - 1] : null, up = prev ? month.returnPct >= prev.returnPct : null;
        return <div key={month.id}><header><b>{month.name}</b>{month === best && <em className="is-gain">Best</em>}{month === worst && month !== best && <em className="is-loss">Weakest</em>}</header>
          <span className="tj-pr-track"><i className={month.returnPct < 0 ? 'is-loss' : ''} style={{width:`${Math.max(2, Math.abs(month.returnPct) / max * 100)}%`}}/></span>
          <strong className={h.tone(month.returnPct)}>{pct(month.returnPct)}</strong><small>{rate(month.winRate)} win · {month.trades} trades</small><small>{prev ? `${up ? 'Improved' : 'Declined'} vs ${prev.name.slice(0, 3)}` : 'Quarter opener'}</small></div>;
      })}</div>],
      ['Trends', <>
        <div className="tj-pr-card"><h3>Equity curve</h3><QuarterTrendChart points={m.equity}/></div>
        <Stats rows={[['Payoff quality', m.profitFactor || '—'], ['Average R', m.avgR || '—'], ['Process score', m.process || '—'], ['Mistakes', has(m.mistakes) ? `${m.mistakes} logged` : '—']]}/>
        <div className="tj-pr-card"><h3>Drawdown</h3><strong className={has(m.drawdown) ? 'is-loss tj-pr-big' : 'tj-pr-big'}>{has(m.drawdown) ? `−${Number(m.drawdown).toFixed(2)}%` : '—'}</strong><p className="tj-pr-empty">Largest fall from a quarter high</p></div>
      </>],
      ['Evaluation', <div className="tj-pr-card"><KV rows={[['Best month', best ? `${best.name} · ${pct(best.returnPct)}` : null], ['Weakest month', worst ? `${worst.name} · ${pct(worst.returnPct)}` : null], ['Best context', m.bestContext ? m.bestContext.label : null], ['Review depth', `${m.reviewed}/${m.trades}${has(m.rating) ? ` · avg rating ${m.rating}/5` : ''}`]]}/></div>],
      ['Quarterly action plan', reflection, 'written'],
    ];
  }
  const [wins, losses] = h.winLoss(m);
  return [
    ['Performance', <div className="tj-pr-card"><h3>Performance breakdown<span>{wins}W · {losses}L</span></h3><span className="tj-pr-wl"><i style={{flex:wins || 0}}/><i style={{flex:losses || 0}}/></span><KV rows={[['Average R', m.avgR], ['Profit factor', m.profitFactor], ['Gross profit', signed(m.grossProfit)], ['Costs', has(m.costs) ? money(m.costs) : null], ['Best trade', m.bestTrade ? `${m.bestTrade.label} · ${money(m.bestTrade.pnl, true)}` : null], ['Worst trade', m.worstTrade ? `${m.worstTrade.label} · ${money(m.worstTrade.pnl, true)}` : null]]}/></div>],
    ['Execution', <div className="tj-pr-card"><h3>Execution quality</h3><KV rows={[['Process score', m.process], ['Active days', m.activeDays], ['Mistakes logged', has(m.mistakes) ? String(m.mistakes) : null], ['Mood shifts', m.moodShifts]]}/>
      <h5>Entry-model performance</h5>{m.entryModels && m.entryModels.length ? <div className="tj-pr-models">{m.entryModels.map(entry => <div key={entry.name}><span>{entry.name} · {entry.trades} trade{entry.trades === 1 ? '' : 's'}</span><b className={h.tone(entry.pnl)}>{money(entry.pnl, true)}</b></div>)}</div> : <p className="tj-pr-empty">Entry-model results aren't available for this month yet.</p>}</div>],
    ['Monthly improvement', reflection, 'written'],
    ['Next month', nextSteps],
  ];
}

function Detail({review, h, questions, val, set, written, sectionCount, onJump, onReviewTrades, onCancel, onSave, dirty, saving, saveLocked, error, pendingNotice}) {
  useLeaveGuard(dirty, 'review-detail');
  const m = review.metrics, {money, pct, has, rate} = h;
  const reflection = <Reflection kind={review.kind} questions={questions} val={val} set={set} written={written} sectionCount={sectionCount}/>;
  const nextSteps = <NextSteps kind={review.kind} val={val} set={set}/>;
  const sections = detailSections({review, h, onJump, reflection, nextSteps});
  const root = useRef(null);
  // A review always opens at its top, wherever the list had been scrolled to.
  useEffect(() => { root.current?.closest('.tj-content')?.scrollTo(0, 0); }, [review.id]);
  const jump = index => root.current?.querySelector(`[data-pr-section="${index}"]`)?.scrollIntoView({block:'start'});
  const eyebrow = {year:'Annual trading performance', quarter:`${review.label} · ${review.year}`, month:`Net P&L · ${review.label} ${review.year}`}[review.kind];
  const stats = review.kind === 'year'
    ? [['Total trades', m.trades], ['Win rate', rate(m.winRate)], ['Start balance', has(m.startBalance) ? money(m.startBalance) : '—'], ['End balance', has(m.endBalance) ? money(m.endBalance) : '—']]
    : review.kind === 'quarter'
      ? [['Win rate', rate(m.winRate)], ['Trades', m.trades], ['Reviewed', `${m.reviewed}/${m.trades}`], ['Status', {done:'Done', need:'Needs review', none:'No trades'}[h.statusOf(m)]]]
      : [['Win rate', rate(m.winRate)], ['Trades', m.trades], ['Reviewed', `${m.reviewed}/${m.trades}`], ['Average R', m.avgR || '—']];
  const toReview = m.trades - m.reviewed;
  return <div className="tj-pr is-detail" ref={root}>
    <PhoneHeaderSlot><span className={`tj-pr-saved ${dirty ? 'is-dirty' : ''}`}>{saveLocked ? 'Unlocks in Q4' : dirty ? 'Unsaved changes' : <><Check size={14} aria-hidden="true"/>Saved</>}</span></PhoneHeaderSlot>
    <nav className="tj-pr-tabs" aria-label="Review sections" data-scroll-row="true">{sections.map(([title], index) => <button type="button" key={title} onClick={() => jump(index)}><span>{title}</span></button>)}</nav>
    {pendingNotice}
    <section className="tj-pr-hero">
      <small>{eyebrow}</small>
      <div className="tj-pr-hero-row"><strong className={has(m.netPnl) ? h.tone(m.netPnl) : ''}>{has(m.netPnl) ? money(m.netPnl, true) : '—'}</strong><span className={h.tone(m.returnPct)}><small>Return</small>{pct(m.returnPct)}</span></div>
      <Stats rows={stats}/>
      {review.kind === 'month' && toReview > 0 && <button type="button" className="tj-pr-needs" onClick={() => onReviewTrades?.(review)}><AlertTriangle size={16} aria-hidden="true"/><span>{toReview} trade{toReview === 1 ? '' : 's'} still need{toReview === 1 ? 's' : ''} review</span><ChevronRight size={16} aria-hidden="true"/></button>}
    </section>
    {sections.map(([title, content, side], index) => <section className="tj-pr-sec" key={title} data-pr-section={index}>
      <header><i>{String(index + 1).padStart(2, '0')}</i><h2>{title}</h2>{side && <span>{side === 'written' ? `${written} of ${sectionCount} written` : side}</span>}</header>
      {content}
    </section>)}
    {(dirty || error) && <div className="tj-pr-savebar" role="group" aria-label="Save review">
      {error && <p role="alert">{error}</p>}
      <div><button type="button" disabled={saving} onClick={onCancel}>Cancel</button><button type="button" className="is-save" disabled={saving || saveLocked || !dirty} onClick={onSave}>{saving ? 'Saving…' : 'Save review'}</button></div>
    </div>}
  </div>;
}

function MonthTile({review, h, onOpen}) {
  const m = review.metrics;
  if (!m.trades) return <div className="tj-pr-month is-empty"><b>{review.label}</b><small>No trades</small></div>;
  const [wins, losses] = h.winLoss(m), status = h.statusOf(m);
  return <button type="button" className="tj-pr-month" onClick={() => onOpen(review.id)}>
    <span><b>{review.label}</b><em className={status === 'done' ? 'is-gain' : 'is-warn'}>{status === 'done' ? 'Done' : 'To review'}</em></span>
    <span><strong className={h.tone(m.returnPct)}>{h.pct(m.returnPct)}</strong><span className="tj-pr-wl"><i style={{flex:wins || 0}}/><i style={{flex:losses || 0}}/></span></span>
  </button>;
}

function QuarterCard({group, h, open, onToggle, onOpen}) {
  const {quarter, months} = group, m = quarter.metrics, has = m.trades > 0, status = h.statusOf(m);
  const peak = Math.max(1, ...months.map(month => Math.abs(month.metrics.returnPct)));
  return <div className={`tj-pr-quarter ${has ? 'has-trades' : ''}`}>
    <div className="tj-pr-qhead">
      <button type="button" className="tj-pr-qopen" disabled={!has} onClick={() => onOpen(quarter.id)}>
        <span className="tj-pr-qname"><strong>{quarter.label}</strong><em className={status === 'done' ? 'is-gain' : status === 'need' ? 'is-warn' : ''}>{status === 'done' ? 'Done' : status === 'need' ? 'Needs review' : 'No trades'}</em></span>
        <span className="tj-pr-qmeta"><b className={has ? h.tone(m.returnPct) : ''}>{h.pct(m.returnPct)}</b><span>{has && h.has(m.netPnl) ? `${h.money(m.netPnl, true)} · ` : ''}{m.trades} trades</span></span>
      </button>
      <span className="tj-pr-mini" aria-hidden="true">{months.map(month => <i key={month.id} className={!month.metrics.trades ? 'is-zero' : month.metrics.returnPct < 0 ? 'is-loss' : ''} style={month.metrics.trades ? {height:`${Math.max(18, Math.abs(month.metrics.returnPct) / peak * 100)}%`} : undefined}/>)}</span>
      <button type="button" className="tj-pr-expand" aria-label={`${open ? 'Hide' : 'Show'} ${quarter.label} months`} aria-expanded={open} onClick={onToggle}><b className={open ? 'is-open' : ''}><ChevronDown size={16} aria-hidden="true"/></b></button>
    </div>
    {open && <div className="tj-pr-months">{months.map(month => <MonthTile key={month.id} review={month} h={h} onOpen={onOpen}/>)}</div>}
  </div>;
}

function PeriodList({year, quarterGroups, h, onOpen, controls}) {
  const m = year?.metrics;
  const [expanded, setExpanded] = useState(() => {
    const active = [...quarterGroups].reverse().find(group => group.quarter.metrics.trades > 0);
    return active ? {[active.quarter.id]:true} : {};
  });
  const fraction = m?.trades ? m.reviewed / m.trades : 0;
  return <div className="tj-pr">
    {controls?.year != null && <PhoneHeaderSlot><div className="tj-pr-year"><button type="button" aria-label="Previous review year" onClick={() => controls.onYear(controls.year - 1)}><ChevronLeft size={16}/></button><b>{controls.year}</b><button type="button" aria-label="Next review year" onClick={() => controls.onYear(controls.year + 1)}><ChevronRight size={16}/></button></div></PhoneHeaderSlot>}
    {controls?.account && <div className="tj-pr-account">{controls.account}</div>}
    {year && <button type="button" className="tj-pr-annual" onClick={() => onOpen(year.id)}>
      <span className="tj-pr-annual-top">
        <span className="tj-pr-ring" style={{'--ring':`${Math.round(fraction * 100)}%`}}><i>{Math.round(fraction * 100)}%<small>reviewed</small></i></span>
        <span><small>{year.year} Annual</small><strong className={h.tone(m.returnPct)}>{h.pct(m.returnPct)}</strong><span>{h.has(m.netPnl) ? `${h.money(m.netPnl, true)} net` : 'Net P&L —'}</span></span>
      </span>
      <span className="tj-pr-chips"><em>{m.trades} trades</em><em>{h.rate(m.winRate)} win</em><em className={m.reviewed >= m.trades ? 'is-gain' : 'is-warn'}>{m.reviewed}/{m.trades} reviewed</em></span>
    </button>}
    <div className="tj-pr-label"><span>Quarters</span><span>Tap to open</span></div>
    {quarterGroups.map(group => <QuarterCard key={group.quarter.id} group={group} h={h} open={!!expanded[group.quarter.id]} onToggle={() => setExpanded(value => ({...value, [group.quarter.id]:!value[group.quarter.id]}))} onOpen={onOpen}/>)}
  </div>;
}

export default function MobilePeriodReviews({showDetail, review, years, quarterGroups, h, questions, val, set, written, sectionCount, onOpen, onReviewTrades, onCancel, onSave, dirty, saving, saveLocked, error, pendingNotice, controls, onPhoneTitle}) {
  const title = showDetail && review ? review.title : 'Period reviews';
  useEffect(() => { onPhoneTitle?.(title); return () => onPhoneTitle?.(''); }, [title]);
  if (showDetail && review) return <Detail review={review} h={h} questions={questions} val={val} set={set} written={written} sectionCount={sectionCount} onJump={onOpen} onReviewTrades={onReviewTrades} onCancel={onCancel} onSave={onSave} dirty={dirty} saving={saving} saveLocked={saveLocked} error={error} pendingNotice={pendingNotice}/>;
  return <PeriodList year={years[0]} quarterGroups={quarterGroups} h={h} onOpen={onOpen} controls={controls}/>;
}
