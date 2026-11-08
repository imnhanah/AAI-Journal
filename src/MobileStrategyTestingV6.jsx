import {useNavStep} from './useBackNavigation.js';
import {useStepMotion} from './MobilePageStage.jsx';
import React, {useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import PhoneHeaderSlot from './PhoneHeaderSlot.jsx';
import {ArrowRight, CheckCircle2, ChevronDown, ChevronLeft, Edit3, FlaskConical, Image as ImageIcon, Plus, Settings, SlidersHorizontal, Trash2, X} from 'lucide-react';
import {ConfirmDeleteButton} from './JournalControls.jsx';
import {backtestStats, isClosedTest, orderTestTrades, testType, testTypeLabel} from './backtestModel.js';
import {strategyEquityPath, strategyResult, strategyStreakTitle, strategyTotals, strategyTradeMeta} from './mobileStrategyTestingModel.js';
import './mobileStrategyTestingV6.css';

const money = (value, currency = 'USD') => new Intl.NumberFormat(undefined, {style:'currency', currency, maximumFractionDigits:2, minimumFractionDigits:2}).format(Number(value) || 0);
const signedMoney = (value, currency) => `${Number(value) > 0 ? '+' : ''}${money(value, currency)}`;
const rValue = (value, signed = true) => value == null || value === '' || !Number.isFinite(Number(value)) ? '—' : `${signed && Number(value) > 0 ? '+' : ''}${Number(value).toFixed(2)}R`;
const dateLabel = value => { const date = value && new Date(`${String(value).slice(0,10)}T12:00:00`); return !date || Number.isNaN(date.getTime()) ? 'Date not set' : new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric'}).format(date); };
const imageSource = image => typeof image === 'string' ? image : image?.src || image?.url || image?.dataUrl || image?.source || image?.data || '';
const tone = value => Number(value) > 0 ? 'is-profit' : Number(value) < 0 ? 'is-loss' : '';
const figureSize = text => text.length > 15 ? 'is-longest' : text.length > 11 ? 'is-long' : '';
const sheetHost = () => document.querySelector('.tj-root') || document.body;
const list = values => (values || []).filter(Boolean).join(', ') || 'None logged';
const RESULTS = [['all','All results'],['win','Wins'],['loss','Losses'],['flat','Break-even'],['running','Running']];

function Sheet({label,title,action,footer,onClose,children}) {
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement;
    const keydown = event => { if (event.key === 'Escape') { event.preventDefault(); close.current(); } };
    document.addEventListener('keydown',keydown);
    return () => { document.removeEventListener('keydown',keydown); if (previous?.isConnected) previous.focus(); };
  },[]);
  return createPortal(<div className="tj-st6-sheet-layer" role="presentation">
    <button type="button" className="tj-st6-sheet-dismiss" aria-label={`Close ${label}`} onClick={onClose}/>
    <section className="tj-st6-sheet" role="dialog" aria-modal="true" aria-label={label}>
      <i aria-hidden="true" className="tj-st6-sheet-handle"/>
      <header><h2>{title}</h2>{action || <button type="button" autoFocus aria-label={`Close ${label}`} onClick={onClose}><X size={16}/></button>}</header>
      <div className="tj-st6-sheet-body">{children}</div>
      {footer && <footer>{footer}</footer>}
    </section>
  </div>,sheetHost());
}

function Ring({value,target}) {
  const progress = Math.min(100,value / Math.max(1,Number(target) || 1) * 100);
  return <div className="tj-st6-ring" role="img" aria-label={`${value} of ${target} trades`} style={{'--ring':`${progress}%`}}><div><b>{value}/{target}</b><small>Trades</small></div></div>;
}

function Vitals({stats,currency}) {
  const items = [
    ['Win rate',stats.winRate == null ? '—' : `${Math.round(stats.winRate)}%`],
    ['Avg R:R',rValue(stats.averageR,false)],
    ['Expectancy',stats.expectancy == null ? '—' : money(stats.expectancy,currency),tone(stats.expectancy)],
    ['Profit factor',stats.profitFactor == null ? '—' : stats.profitFactor === Infinity ? '∞' : stats.profitFactor.toFixed(2)],
    ['Max drawdown',money(-stats.drawdown,currency),stats.drawdown ? 'is-loss' : '','Peak to trough'],
    ['Best day',stats.bestDay ? money(stats.bestDay[1],currency) : '—',stats.bestDay ? 'is-profit' : '',stats.bestDay?.[0]],
  ];
  return <div className="tj-st6-vitals" data-scroll-row="true">{items.map(([label,value,color,note]) => <div key={label}><span>{label}</span><b className={color || undefined}>{value}</b>{note && <small>{note}</small>}</div>)}</div>;
}

function Summary({run,stats}) {
  const progress = Math.min(100,stats.total / Math.max(1,Number(run.tradeTarget) || 1) * 100), net = money(stats.net,run.currency);
  return <div className="tj-st6-net">
    <div><small>Net profit</small><strong className={`${tone(stats.net)} ${figureSize(net)}`}>{net}</strong><span>Balance {money(run.startingBalance,run.currency)} → {money(stats.balance,run.currency)}</span><i aria-hidden="true"><b style={{width:`${progress}%`}}/></i></div>
    <Ring value={stats.total} target={run.tradeTarget}/>
  </div>;
}

function RunCard({run,getTrades,busy,detailsOpen,onToggleDetails,onOpen,onEdit,onDelete}) {
  const trades = getTrades(run.id), stats = backtestStats(run,trades), running = trades.filter(trade => !isClosedTest(trade)).length, forward = testType(run) === 'forward';
  return <article className={`tj-st6-card ${forward ? 'is-forward' : 'is-backtest'}`} aria-label={run.name || 'Strategy test'}>
    <header><i aria-hidden="true">{forward ? <CheckCircle2 size={22}/> : <FlaskConical size={22}/>}</i><div><h2>{run.instrument} · {run.timeframe}</h2><p>{stats.total} closed · {running} running</p></div></header>
    <div className="tj-st6-tags"><span>{run.strategy || run.name || 'No strategy'}</span><span className="is-type">{testTypeLabel(run)}</span><span className={stats.status === 'Completed' ? 'is-done' : 'is-progress'}>{stats.status}</span></div>
    <Summary run={run} stats={stats}/>
    <Vitals stats={stats} currency={run.currency}/>
    <div className="tj-st6-card-actions"><button type="button" className="is-primary" onClick={onOpen}>Open test<ArrowRight size={15}/></button><button type="button" disabled={busy} onClick={onEdit}><Settings size={15}/>Edit</button><button type="button" className="is-danger" disabled={busy} aria-label={`Delete ${run.name || 'test'}`} onClick={onDelete}><Trash2 size={16}/></button></div>
    <button type="button" className="tj-st6-toggle" aria-expanded={detailsOpen} onClick={onToggleDetails}>Setup details<ChevronDown size={14}/></button>
    {detailsOpen && <dl className="tj-st6-setup">{[['Test type',testTypeLabel(run)],['Instrument',`${run.instrument} · ${run.timeframe}`],['Strategy',run.strategy || run.name || 'Not set'],['Starting balance',money(run.startingBalance,run.currency)],['Risk per trade',`${Number(run.riskPct).toFixed(1)}%`],['Balance source','Uses this test’s balance']].map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>}
  </article>;
}

function EquityChart({stats,currency}) {
  const points = stats.equity.map(point => Number(point.balance)), path = strategyEquityPath(points);
  const [inspect,setInspect] = useState(null), up = points.at(-1) >= points[0];
  const move = event => { const box = event.currentTarget.getBoundingClientRect(); setInspect(Math.round(Math.max(0,Math.min(1,(event.clientX - box.left) / box.width)) * (points.length - 1))); };
  const trade = inspect ? stats.closed[inspect - 1] : null;
  return <section className="tj-st6-section">
    <header><div><small>Simulated equity</small><h3>How the run has compounded</h3></div><b className="is-profit">{money(stats.balance,currency)}</b></header>
    <svg className={`tj-st6-equity ${up ? 'is-up' : 'is-down'}`} viewBox="0 0 340 170" preserveAspectRatio="none" role="img" aria-label="Simulated equity chart" onPointerDown={move} onPointerMove={move}>
      <line className="is-base" x1="6" x2="334" y1={path.baseline} y2={path.baseline}/>
      <path className="is-area" d={path.area}/><path className="is-line" d={path.line}/>
      {inspect != null && <line className="is-cursor" x1={path.x(inspect)} x2={path.x(inspect)} y1="12" y2="158"/>}
    </svg>
    <p className="tj-st6-readout">{inspect == null ? 'Drag across the chart to inspect each trade.' : inspect === 0 ? <><b>Start</b> · Balance <b>{money(points[0],currency)}</b></> : <><b>Trade #{inspect}</b> · {dateLabel(trade?.closeDate || trade?.date)} · {rValue(trade?.rr)} · Balance <b>{money(points[inspect],currency)}</b></>}</p>
  </section>;
}

function Bars({rows}) { return rows.map(row => <div className="tj-st6-bar" key={row.label}><div><span>{row.label}<small>{row.note}</small></span><b className={row.color || undefined}>{row.value}</b></div><i aria-hidden="true"><b className={row.fill} style={{width:`${row.width}%`}}/></i></div>); }

function Overview({run,stats,onEditSetup}) {
  const [notes,setNotes] = useState('plan'), currency = run.currency, text = notes === 'plan' ? run.plan : run.conclusion;
  const win = stats.total ? stats.wins / stats.total * 100 : 0, loss = stats.total ? stats.losses / stats.total * 100 : 0;
  return <>
    <section className="tj-st6-notes"><div>{[['plan','Pre-run plan'],['conclusion','Run conclusion']].map(([value,label]) => <button type="button" key={value} aria-pressed={notes === value} onClick={() => setNotes(value)}><span>{label}</span></button>)}</div><p className={text ? undefined : 'is-empty'}>{text || 'Nothing written yet. Open settings to add it.'}</p></section>
    <EquityChart stats={stats} currency={currency}/>
    <Vitals stats={stats} currency={currency}/>
    <section className="tj-st6-section"><header><div><small>Trade outcomes</small><h3>{stats.wins} wins · {stats.losses} losses · {stats.flat} break-even</h3></div></header>
      <div className="tj-st6-outcomes"><div className="tj-st6-donut" role="img" aria-label={`Win rate ${stats.winRate == null ? 'not available' : `${Math.round(stats.winRate)}%`}`} style={{'--win':`${win}%`,'--loss':`${win + loss}%`}}><b>{stats.winRate == null ? '—' : `${Math.round(stats.winRate)}%`}</b></div><ul><li className="is-win">{stats.wins} wins</li><li className="is-lose">{stats.losses} losses</li><li>{stats.flat} break-even</li></ul></div>
      <div className="tj-st6-pair"><div><span>Average win</span><b className="is-profit">{stats.averageWin == null ? '—' : money(stats.averageWin,currency)}</b></div><div><span>Average loss</span><b className="is-loss">{stats.averageLoss == null ? '—' : money(stats.averageLoss,currency)}</b></div></div>
      <p className="tj-st6-foot">{stats.profitFactor == null ? '—' : stats.profitFactor === Infinity ? '∞' : stats.profitFactor.toFixed(2)} profit factor</p>
    </section>
    <section className="tj-st6-section"><header><div><small>Simulation analysis</small><h3>Quick edge read</h3></div></header><div className="tj-st6-pair">{[['Best instrument',stats.total ? run.instrument : '—'],['Best session',stats.sessions[0]?.label || '—'],['Best entry model',stats.models[0]?.label || '—'],['Best confluence',stats.confluences[0]?.label || '—']].map(([label,value]) => <div key={label}><span>{label}</span><b>{value}</b></div>)}</div></section>
    <section className="tj-st6-section"><header><div><small>Recent momentum</small><h3>{strategyStreakTitle(stats)}</h3></div><span>Newest first</span></header>{stats.total ? <div className="tj-st6-momentum" data-scroll-row="true">{stats.closed.slice(-8).reverse().map(trade => <div key={trade.id} data-result={strategyResult(trade)}><b>{Number(trade.pnl) > 0 ? 'W' : Number(trade.pnl) < 0 ? 'L' : 'BE'}</b><small>{money(trade.pnl,currency)}</small></div>)}</div> : <p className="tj-st6-foot">No closed trades yet.</p>}</section>
    <section className="tj-st6-section"><header><div><small>Instrument outcome</small><h3>Net P&amp;L by instrument</h3></div></header>{stats.total ? <Bars rows={[{label:run.instrument,note:`${stats.total} trades`,value:money(stats.net,currency),color:tone(stats.net),fill:stats.net >= 0 ? 'is-gain' : 'is-drop',width:100}]}/> : <p className="tj-st6-foot">No closed trades yet.</p>}</section>
    <section className="tj-st6-section"><header><div><small>Session win rate</small><h3>Which sessions pay</h3></div></header>{stats.sessions.length ? <Bars rows={stats.sessions.map(item => ({label:item.label,note:`${item.wins} of ${item.total}`,value:`${Math.round(item.rate)}%`,fill:'is-purple',width:item.rate}))}/> : <p className="tj-st6-foot">No closed trades yet.</p>}</section>
    <section className="tj-st6-section"><small>Rule adherence</small><h3>{stats.ruleRate == null ? 'No rules evaluated yet' : `Rules followed ${Math.round(stats.ruleRate)}%`}</h3><p className="tj-st6-foot">{stats.ruleRate == null ? 'Link your trading rules to this test to see how often you followed them.' : 'From logged rule evaluations across this test’s trades.'}</p>{stats.ruleRate == null && <button type="button" className="tj-st6-link" onClick={onEditSetup}><span>Link rules</span></button>}</section>
  </>;
}

function TradeImages({trade,onLoadMedia,onViewImage}) {
  const [images,setImages] = useState(null), [error,setError] = useState('');
  useEffect(() => { setImages(null); setError(''); },[trade.id,trade.updatedAt]);
  const load = async () => { setError(''); try { setImages(await onLoadMedia(trade) || {}); } catch (reason) { setError(reason.message || 'Could not load screenshots.'); } };
  const sources = Object.entries(images || trade.screenshots || {}).flatMap(([label,value]) => (Array.isArray(value) ? value : [value]).map(imageSource).filter(Boolean).map(src => ({label,src})));
  if (error) return <p className="tj-st6-foot is-error" role="alert">{error}</p>;
  if (!sources.length && !images) return <button type="button" className="tj-st6-load" onClick={load}><ImageIcon size={15}/>Load screenshots</button>;
  if (!sources.length) return <p className="tj-st6-foot">No screenshots attached.</p>;
  return <div className="tj-st6-shots">{sources.map(({label,src},index) => <button key={`${src}-${index}`} type="button" aria-label={`View ${label} screenshot`} onClick={() => onViewImage?.(src)}><img src={src} alt="" loading="lazy"/><small>{label}</small></button>)}</div>;
}

function TradeDetail({trade,run,onEdit,onDelete,onLoadMedia,onViewImage}) {
  const closed = isClosedTest(trade), rules = trade.ruleEvaluations || [], followed = rules.filter(rule => rule.checked);
  const rows = [
    ['Result',closed ? `${{win:'Win',loss:'Loss',flat:'Break-even'}[strategyResult(trade)]} · ${money(trade.pnl,run.currency)} · ${rValue(trade.rr,false)}` : 'Running'],
    ['Entry model',trade.backtestModelSnapshot?.name || trade.strategy || trade.entryType || 'Not set'],
    ['Open',`${dateLabel(trade.date)} · ${trade.time || 'Time not set'}`],
    ['Entry price',trade.entryPrice ?? '—'],['Exit price',trade.exitPrice ?? '—'],
    ['Risk',trade.riskPct == null ? 'Not set' : `${trade.riskPct}%`],
    ['Commission / swap',`${money(trade.commission,run.currency)} / ${money(trade.swap,run.currency)}`],
    ['Mood shift',`${trade.moodBefore || 'Neutral'} → ${trade.moodAfter || 'Neutral'}`],
    ['Rules checked',`${followed.length}/${rules.length}`],
    ['Rules followed',list(followed.map(rule => rule.text || rule.name))],
    ['Confluences',list(trade.confluence || trade.types)],['Mistakes',list(trade.mistakes)],
  ];
  return <div className="tj-st6-trade-detail">
    <div className="tj-st6-trio"><div><span>Net P&amp;L</span><b className={closed ? tone(trade.pnl) : undefined}>{closed ? money(trade.pnl,run.currency) : '—'}</b></div><div><span>Result</span><b>{closed ? rValue(trade.rr,false) : '—'}</b></div><div><span>Session</span><b>{trade.entrySession || trade.session || '—'}</b></div></div>
    <dl>{rows.map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    {(trade.notes || trade.note) && <p className="tj-st6-foot">{trade.notes || trade.note}</p>}
    <TradeImages trade={trade} onLoadMedia={onLoadMedia} onViewImage={onViewImage}/>
    <div className="tj-st6-trade-actions"><button type="button" onClick={() => onEdit(trade)}><Edit3 size={14}/>Edit</button><ConfirmDeleteButton className="tj-st6-trade-delete" title="Delete simulated trade" onClick={() => onDelete(trade.id)}><Trash2 size={14}/>Delete</ConfirmDeleteButton></div>
  </div>;
}

export default function MobileStrategyTestingV6({runs=[],getTrades,busy=false,error='',onRetry,onCreate,onOpenRun,onCloseRun,onEditSetup,onDeleteRun,onOpenTrade,onEditTrade,onDeleteTrade,onLoadMedia,onViewImage,activeRun=null}) {
  useNavStep('test-run', !!activeRun, onCloseRun);
  useStepMotion(activeRun ? 1 : 0);
  const [detailTab,setDetailTab] = useState('overview'), [historyFilter,setHistoryFilter] = useState('all'), [instrument,setInstrument] = useState('all'), [timeframe,setTimeframe] = useState('all'), [selectedTradeId,setSelectedTradeId] = useState(null);
  const [showAll,setShowAll] = useState(false), [filtersOpen,setFiltersOpen] = useState(false), [deleting,setDeleting] = useState(null), [detailsId,setDetailsId] = useState(null);
  useEffect(() => { setDetailTab('overview'); setHistoryFilter('all'); setInstrument('all'); setTimeframe('all'); setSelectedTradeId(null); setShowAll(false); setFiltersOpen(false); document.querySelector('.tj-content')?.scrollTo(0,0); },[activeRun?.id]);
  const errorBanner = error && <div className="tj-st6-error" role="alert"><span>{error}</span><button type="button" onClick={onRetry}>Retry</button></div>;
  const deleteSheet = deleting && <Sheet label="Delete test" title="Delete this test?" onClose={() => setDeleting(null)}><p className="tj-st6-foot">{deleting.instrument} · {deleting.timeframe} and its {getTrades(deleting.id).length} trades will be removed. Your live journal is not affected.</p><div className="tj-st6-sheet-actions"><button type="button" className="is-danger" disabled={busy} onClick={async () => { await onDeleteRun(deleting); setDeleting(null); }}>{busy ? 'Deleting…' : 'Delete test'}</button><button type="button" onClick={() => setDeleting(null)}>Cancel</button></div></Sheet>;

  if (!activeRun) return <main className="tj-st6" aria-label="Strategy Testing">
    {errorBanner}
    <p className="tj-st6-count">{runs.length} saved test account{runs.length === 1 ? '' : 's'}</p>
    {runs.map(run => <RunCard key={run.id} run={run} getTrades={getTrades} busy={busy} detailsOpen={detailsId === run.id} onToggleDetails={() => setDetailsId(id => id === run.id ? null : run.id)} onOpen={() => onOpenRun(run.id)} onEdit={() => onEditSetup(run)} onDelete={() => setDeleting(run)}/>)}
    {!runs.length && <p className="tj-st6-empty">Your testing library starts here. Create a backtest or forward test, kept apart from your live journal.</p>}
    <button type="button" className="tj-st6-add" disabled={busy} onClick={onCreate}><Plus size={18}/>{runs.length ? 'Add another test' : 'Create a test'}</button>
    {deleteSheet}
  </main>;

  const trades = orderTestTrades(getTrades(activeRun.id)).reverse(), stats = backtestStats(activeRun,trades), meta = strategyTradeMeta(stats), forward = testType(activeRun) === 'forward', running = trades.filter(trade => !isClosedTest(trade)).length;
  const instruments = ['all',...new Set(trades.map(trade => trade.asset).filter(Boolean))], timeframes = ['all',...new Set(trades.map(trade => trade.timeframe).filter(Boolean))];
  const filteredTrades = trades.filter(trade => (historyFilter==='all'||historyFilter==='running'&&!isClosedTest(trade)||historyFilter==='win'&&isClosedTest(trade)&&Number(trade.pnl)>0||historyFilter==='loss'&&isClosedTest(trade)&&Number(trade.pnl)<0||historyFilter==='flat'&&isClosedTest(trade)&&Number(trade.pnl)===0)&&(instrument==='all'||trade.asset===instrument)&&(timeframe==='all'||trade.timeframe===timeframe));
  const shown = showAll ? filteredTrades : filteredTrades.slice(0,10), totals = strategyTotals(filteredTrades), filterCount = (historyFilter !== 'all') + (instrument !== 'all') + (timeframe !== 'all');
  const filterGroup = (label,value,set,options) => <div className="tj-st6-filter-group"><span>{label}</span><div>{options.map(([option,text]) => <button type="button" key={option} aria-pressed={value === option} onClick={() => set(option)}>{text}</button>)}</div></div>;
  return <main className="tj-st6" aria-label={`${activeRun.name || 'Strategy test'} workspace`}>
    <PhoneHeaderSlot><div className="tj-st6-nav"><button type="button" onClick={() => onEditSetup(activeRun)} aria-label="Edit test setup"><span><Settings size={16}/></span></button></div></PhoneHeaderSlot>
    {errorBanner}
    <section className={`tj-st6-card ${forward ? 'is-forward' : 'is-backtest'}`}>
      <header><div><h2>{activeRun.instrument} · {activeRun.timeframe}</h2><p>{activeRun.strategy || activeRun.name || testTypeLabel(activeRun)} · {stats.total} closed · {running} running</p></div></header>
      <div className="tj-st6-tags"><span className="is-type">{testTypeLabel(activeRun)}</span><span className={stats.status === 'Completed' ? 'is-done' : 'is-progress'}>{stats.status}</span></div>
      <Summary run={activeRun} stats={stats}/>
    </section>
    <div className="tj-st6-tabs" role="tablist" aria-label="Test sections" data-tab={detailTab}><i aria-hidden="true"/><button type="button" role="tab" aria-selected={detailTab==='overview'} onClick={() => setDetailTab('overview')}>Overview</button><button type="button" role="tab" aria-selected={detailTab==='history'} onClick={() => setDetailTab('history')}>{forward ? 'Forward' : 'Backtest'} log</button></div>
    {detailTab === 'overview' ? <Overview run={activeRun} stats={stats} onEditSetup={() => onEditSetup(activeRun)}/> : <>
      <div className="tj-st6-log-head"><div><b>{trades.length}</b>trades</div><div className="is-profit"><b>{stats.wins}</b>wins</div><div className="is-loss"><b>{stats.losses}</b>losses</div><button type="button" aria-label={`Filters${filterCount ? `, ${filterCount} active` : ''}`} onClick={() => setFiltersOpen(true)}><span><SlidersHorizontal size={17}/>{filterCount > 0 && <em>{filterCount}</em>}</span></button></div>
      <section className="tj-st6-log" aria-label="Trade log">
        {shown.map(trade => { const result = strategyResult(trade), open = selectedTradeId === trade.id, info = meta.get(trade.id); return <div className="tj-st6-trade" data-result={result} key={trade.id}>
          <button type="button" aria-expanded={open} onClick={() => setSelectedTradeId(id => id === trade.id ? null : trade.id)}><i aria-hidden="true"/><span className="tj-st6-trade-main"><span><b>#{info?.number ?? '—'}</b>{dateLabel(trade.date)}{trade.time ? ` · ${trade.time}` : ''}{trade.direction && <em className={`is-${String(trade.direction).toLowerCase()}`}>{trade.direction}</em>}</span><small>{[trade.asset || activeRun.instrument,trade.backtestModelSnapshot?.name || trade.strategy || trade.entryType,trade.timeframe || activeRun.timeframe].filter(Boolean).join(' · ')}</small></span><span className="tj-st6-trade-value"><b>{result === 'running' ? 'Running' : signedMoney(trade.pnl,activeRun.currency)}</b><small>{result === 'running' ? 'open' : `${rValue(trade.rr)} · ${money(info?.balance,activeRun.currency)}`}</small></span></button>
          {open && <TradeDetail trade={trade} run={activeRun} onEdit={onEditTrade} onDelete={onDeleteTrade} onLoadMedia={onLoadMedia} onViewImage={onViewImage}/>}
        </div>; })}
        {!shown.length && <p className="tj-st6-empty">{trades.length ? 'No trades match these filters.' : 'No trades logged yet.'}</p>}
        <footer><span>{filteredTrades.length ? `1–${shown.length} of ${filteredTrades.length}` : '0 trades'}{!showAll && filteredTrades.length > 10 && <button type="button" className="tj-st6-link" onClick={() => setShowAll(true)}><span>Show all</span></button>}</span><span>Total <b className={tone(totals.r)}>{rValue(totals.r)}</b> · <b className={tone(totals.pnl)}>{signedMoney(totals.pnl,activeRun.currency)}</b> · <b>{money(stats.balance,activeRun.currency)}</b></span></footer>
      </section>
      <button type="button" className="tj-st6-new" disabled={busy} onClick={() => onOpenTrade(activeRun)}><Plus size={17}/>New trade</button>
    </>}
    {filtersOpen && <Sheet label="Filter log" title="Filter log" onClose={() => setFiltersOpen(false)} action={<button type="button" className="tj-st6-reset" onClick={() => { setHistoryFilter('all'); setInstrument('all'); setTimeframe('all'); }}>Reset</button>} footer={<button type="button" onClick={() => setFiltersOpen(false)}>Show {filteredTrades.length} trade{filteredTrades.length === 1 ? '' : 's'}</button>}>
      {filterGroup('Pair',instrument,setInstrument,instruments.map(value => [value,value === 'all' ? 'All pairs' : value]))}
      {filterGroup('Timeframe',timeframe,setTimeframe,timeframes.map(value => [value,value === 'all' ? 'All timeframes' : value]))}
      {filterGroup('Result',historyFilter,setHistoryFilter,RESULTS)}
    </Sheet>}
  </main>;
}
