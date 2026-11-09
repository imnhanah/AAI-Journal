import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeft, Check, CheckCircle2, ChevronDown, Edit3, FlaskConical, Image as ImageIcon, Info, Link2, Plus, Save, Trash2, X } from 'lucide-react';
import { ThemeSelect, ThemeInstrument } from './JournalControls';
import { backtestStats, isClosedTest, orderTestTrades, testType, testTypeLabel } from './backtestModel.js';
import { strategyResult, strategyStreakTitle, strategyTradeMeta } from './mobileStrategyTestingModel.js';
import './desktopStrategyTesting.css';

// Desktop Strategy Testing v2 (STRATEGY_V2 in BacktestAccounts.jsx), after aaicorefx-desktop-strategy-testing.html.
// It takes the same props as the phone screen, so syncing, saving and trade editing stay in BacktestAccounts.
const money = (value, currency = 'USD') => new Intl.NumberFormat(undefined, { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value) || 0);
const signed = (value, currency) => `${Number(value) > 0 ? '+' : ''}${money(value, currency)}`;
const rValue = (value) => value == null || value === '' || !Number.isFinite(Number(value)) ? '—' : `${Number(value) > 0 ? '+' : ''}${Number(value).toFixed(2)}R`;
const pct = (value) => value == null ? '—' : `${Math.round(value)}%`;
const tone = (value) => Number(value) > 0 ? 'is-gain' : Number(value) < 0 ? 'is-loss' : '';
const dateText = (value) => { const date = value && new Date(`${String(value).slice(0, 10)}T12:00:00`); return !date || Number.isNaN(date.getTime()) ? 'Date not set' : new Intl.DateTimeFormat(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date); };
const imageSource = (image) => typeof image === 'string' ? image : image?.src || image?.url || image?.dataUrl || image?.source || image?.data || '';
const list = (values) => (values || []).filter(Boolean).join(', ');
const TIMEFRAMES = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1'];
const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'NZD', 'GHS'];

function Ring({ value, target, size = 104, stroke = 9 }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, p = Math.min(100, value / Math.max(1, Number(target) || 1) * 100);
  return <div className="st2-rg" style={{ width: size, height: size }} role="img" aria-label={`${value} of ${target} trades`}><svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true"><circle cx={size / 2} cy={size / 2} r={r} className="st2-rg-track" strokeWidth={stroke}/><circle cx={size / 2} cy={size / 2} r={r} className="st2-rg-value" strokeWidth={stroke} strokeDasharray={`${c * p / 100} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`}/></svg><div><b>{value}<em>/{target}</em></b><small>trades</small></div></div>;
}

function Equity({ stats, run }) {
  const wrap = useRef(null), [width, setWidth] = useState(640), [hover, setHover] = useState(null);
  useEffect(() => { const node = wrap.current; if (!node) return undefined; const measure = () => setWidth(Math.max(320, node.clientWidth)); measure(); const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null; observer?.observe(node); return () => observer?.disconnect(); }, []);
  const points = stats.equity.map((point) => Number(point.balance));
  if (points.length < 2) return <div className="st2-eq" ref={wrap}><p className="st2-emp">The equity curve appears after your first closed trade.</p></div>;
  const H = 300, L = 72, R = 18, T = 18, B = 26, pw = width - L - R, ph = H - T - B;
  const start = Number(run.startingBalance) || 0, low = Math.min(...points, start), high = Math.max(...points, start), pad = (high - low) * .12 || Math.max(1, Math.abs(high) * .05);
  const lo = low - pad, hi = high + pad, X = (i) => L + i / (points.length - 1) * pw, Y = (v) => T + (1 - (v - lo) / (hi - lo)) * ph;
  let d = `M${X(0)} ${Y(points[0])}`; for (let i = 1; i < points.length; i++) d += ` H${X(i)} V${Y(points[i])}`;
  const ticks = Array.from({ length: 5 }, (_, i) => lo + (hi - lo) * i / 4);
  const step = Math.max(1, Math.ceil(points.length / 12));
  const move = (event) => { const box = event.currentTarget.getBoundingClientRect(); setHover(Math.max(0, Math.min(points.length - 1, Math.round((event.clientX - box.left - L) / pw * (points.length - 1))))); };
  const trade = hover ? stats.closed[hover - 1] : null;
  return <div className="st2-eq" ref={wrap}>
    <svg width={width} height={H} role="img" aria-label="Simulated equity after each trade" onPointerMove={move} onPointerLeave={() => setHover(null)}>
      <defs><linearGradient id="st2-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" className="st2-fill-a"/><stop offset="1" className="st2-fill-b"/></linearGradient></defs>
      {ticks.map((v) => <g key={v}><line x1={L} x2={width - R} y1={Y(v)} y2={Y(v)} className="st2-gl"/><text x={L - 10} y={Y(v) + 4} textAnchor="end" className="st2-tx">{money(v, run.currency).replace(/\.00$/, '')}</text></g>)}
      <line x1={L} x2={width - R} y1={Y(start)} y2={Y(start)} className="st2-base"/>
      <path d={`${d} V${T + ph} H${L} Z`} fill="url(#st2-fill)"/><path d={d} className="st2-ln"/>
      {points.length <= 40 && points.map((v, i) => <circle key={i} cx={X(i)} cy={Y(v)} r={hover === i ? 5 : 3.6} className={`st2-dot${hover === i ? ' is-on' : ''}`}/>)}
      {points.map((_, i) => (i % step === 0 || i === points.length - 1) && <text key={`x${i}`} x={X(i)} y={H - 6} textAnchor="middle" className="st2-tx">{i}</text>)}
      {hover != null && <line x1={X(hover)} x2={X(hover)} y1={T} y2={T + ph} className="st2-cx"/>}
    </svg>
    {hover != null && <div className="st2-tp" style={{ left: Math.min(width - 150, Math.max(4, X(hover) + 12)), top: Math.max(4, Y(points[hover]) - 30) }}><b>{hover ? `Trade ${hover}` : 'Start'}</b><span>{money(points[hover], run.currency)}</span>{trade && <small className={tone(trade.pnl)}>{signed(trade.pnl, run.currency)} · {rValue(trade.rr)}</small>}</div>}
  </div>;
}

function Outcomes({ stats, currency }) {
  const n = stats.total, pw = n ? stats.wins / n * 100 : 0, pl = n ? stats.losses / n * 100 : 0, r = 52, c = 2 * Math.PI * r;
  const seg = (p, off, cls) => p > 0 && <circle cx="70" cy="70" r={r} className={cls} strokeWidth="16" strokeDasharray={`${Math.max(0, c * p / 100 - 2)} ${c}`} strokeDashoffset={-c * off / 100} transform="rotate(-90 70 70)"/>;
  return <section className="st2-card st2-pn"><header><div><span className="st2-eb2">Trade outcomes</span><h3>{stats.wins} wins · {stats.losses} losses · {stats.flat} break-even</h3></div></header>
    <div className="st2-dn"><div className="st2-dg"><svg width="140" height="140" viewBox="0 0 140 140" aria-hidden="true"><circle cx="70" cy="70" r={r} className="st2-dg-track" strokeWidth="16"/>{seg(pl, pw, 'st2-dg-l')}{seg(pw, 0, 'st2-dg-w')}</svg><div><b>{pct(stats.winRate)}</b><small>win rate</small></div></div>
      <ul><li><i className="is-w"/>{stats.wins} wins</li><li><i className="is-l"/>{stats.losses} losses</li><li><i/>{stats.flat} break-even</li></ul></div>
    <div className="st2-aw"><div><small>Average win</small><b className="is-gain">{stats.averageWin == null ? '—' : money(stats.averageWin, currency)}</b></div><div><small>Average loss</small><b className="is-loss">{stats.averageLoss == null ? '—' : money(stats.averageLoss, currency)}</b></div></div>
    <p className="st2-fn">{stats.profitFactor == null ? '—' : stats.profitFactor === Infinity ? '∞' : stats.profitFactor.toFixed(2)} profit factor</p></section>;
}

const Bar = ({ label, note, width, value, kind }) => <div className="st2-br"><div><b>{label}</b><small>{note}</small></div><div className="st2-bt"><u className={kind} style={{ width: `${Math.max(0, Math.min(100, width))}%` }}/></div><b className={`st2-bv ${kind === 'is-loss' ? 'is-loss' : kind === 'is-gain' ? 'is-gain' : ''}`}>{value}</b></div>;

function TradeImages({ trade, onLoadMedia, onViewImage }) {
  const [images, setImages] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  useEffect(() => { setImages(null); setError(''); }, [trade.id, trade.updatedAt]);
  const load = async () => { setBusy(true); setError(''); try { setImages(await onLoadMedia(trade) || {}); } catch (reason) { setError(reason.message || 'Could not load screenshots.'); } finally { setBusy(false); } };
  useEffect(() => { if (!trade.screenshots) void load(); }, [trade.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const sources = Object.entries(images || trade.screenshots || {}).flatMap(([label, value]) => (Array.isArray(value) ? value : [value]).map(imageSource).filter(Boolean).map((src) => ({ label, src })));
  if (error) return <p className="st2-err" role="alert">{error} <button type="button" onClick={load}>Retry</button></p>;
  if (busy && !sources.length) return <p className="st2-mu">Loading screenshots…</p>;
  if (!sources.length) return <div className="st2-noshot"><ImageIcon size={20}/><span>No screenshots attached.</span></div>;
  return <div className="st2-xi">{sources.map(({ label, src }, index) => <button type="button" key={`${src}-${index}`} aria-label={`View ${label} screenshot`} onClick={() => onViewImage?.(src)}><img src={src} alt="" loading="lazy"/><span>{label}</span></button>)}</div>;
}

function TradeDetail({ trade, run, onEdit, onDelete, onLoadMedia, onViewImage, busy }) {
  const [ask, setAsk] = useState(false);
  const closed = isClosedTest(trade), rules = trade.ruleEvaluations || [], followed = rules.filter((rule) => rule.checked);
  const session = trade.entrySession || trade.session || '—';
  const rows = [
    ['Result', closed ? <b className={tone(trade.pnl)}>{{ win: 'Win', loss: 'Loss', flat: 'Break-even' }[strategyResult(trade)]} · {signed(trade.pnl, run.currency)} · {rValue(trade.rr)}</b> : <b>Running</b>],
    ['Entry model', <b>{trade.backtestModelSnapshot?.name || trade.strategy || trade.entryType || 'Not set'}</b>],
    ['Open', <b>{dateText(trade.date)} · {trade.time || 'Time not set'}</b>],
    ['Entry price', <b>{trade.entryPrice ?? '—'}</b>], ['Exit price', <b>{trade.exitPrice ?? '—'}</b>],
    ['Risk', <b>{trade.riskPct == null ? 'Not set' : `${trade.riskPct}%`}</b>],
    ['Commission / swap', <b>{money(trade.commission, run.currency)} / {money(trade.swap, run.currency)}</b>],
    ['Mood shift', <b>{trade.moodBefore || 'Neutral'} → {trade.moodAfter || 'Neutral'}</b>],
    ['Rules followed', list(followed.map((rule) => rule.text || rule.name)) ? <b>{list(followed.map((rule) => rule.text || rule.name))}</b> : <span className="st2-mu">{rules.length ? 'None followed' : 'No rules evaluated'}</span>],
    ['Confluences', list(trade.confluence || trade.types) ? <b>{list(trade.confluence || trade.types)}</b> : <span className="st2-mu">No confluences logged.</span>],
    ['Mistakes', list(trade.mistakes) ? <b>{list(trade.mistakes)}</b> : <span className="st2-mu">No mistakes logged.</span>],
  ];
  return <div className="st2-xd">
    <div className="st2-xt"><div><small>Net P&amp;L</small><b className={closed ? tone(trade.pnl) : ''}>{closed ? signed(trade.pnl, run.currency) : '—'}</b></div><div><small>Result</small><b className={closed ? tone(trade.pnl) : ''}>{closed ? rValue(trade.rr) : 'Running'}</b></div><div><small>Session</small><b>{session}</b></div><div><small>Rules checked</small><b>{followed.length}/{rules.length}</b></div></div>
    <div className="st2-xg">
      <div className="st2-xb"><header><span className="st2-eb2">Trade brief</span><div className="st2-xc">{trade.direction && <i>{String(trade.direction).toUpperCase()}</i>}{session !== '—' && <i>{session}</i>}{closed && <i>{rValue(trade.rr)}</i>}</div></header>{rows.map(([label, value]) => <div className="st2-xr" key={label}><span>{label}</span>{value}</div>)}{(trade.notes || trade.note) && <p className="st2-xn">{trade.notes || trade.note}</p>}</div>
      <div className="st2-xs"><header><span className="st2-eb2">Trade screenshots</span></header><TradeImages trade={trade} onLoadMedia={onLoadMedia} onViewImage={onViewImage}/></div>
    </div>
    <footer><p>{testType(run) === 'forward' ? 'Forward test trade.' : 'Backtest trade.'} Results stay inside this test and never change your live journal.</p>
      <div>{ask ? <><span className="st2-xq"><AlertTriangle size={14}/>Delete this trade?</span><button type="button" className="st2-btn" onClick={() => setAsk(false)} disabled={busy}>Keep</button><button type="button" className="st2-btn is-dng" onClick={() => onDelete(trade.id)} disabled={busy}>Delete</button></>
        : <><button type="button" className="st2-ic" aria-label="Edit trade" title="Edit trade" onClick={() => onEdit(trade)} disabled={busy}><Edit3 size={15}/></button><button type="button" className="st2-ic is-dl" aria-label="Delete trade" title="Delete trade" onClick={() => setAsk(true)} disabled={busy}><Trash2 size={15}/></button></>}</div></footer>
  </div>;
}

export function StrategySetupDrawer({ run, hasTrades, busy, instruments, defaultRules = [], onClose, onSave }) {
  const [form, setForm] = useState(run);
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  useEffect(() => { const escape = (event) => { if (event.key === 'Escape' && !busy) onClose(); }; document.addEventListener('keydown', escape); return () => document.removeEventListener('keydown', escape); }, [busy, onClose]);
  const valid = form.name?.trim() && form.instrument && Number(form.startingBalance) > 0 && Number.isInteger(Number(form.tradeTarget)) && Number(form.tradeTarget) > 0 && Number(form.riskPct) >= 0 && Number(form.riskPct) <= 100;
  const rules = [...new Map([...defaultRules, ...(form.rules || [])].map((rule) => [rule.id, rule])).values()];
  const linked = (form.rules || []).length;
  const label = testTypeLabel(form);
  const riskAmount = (Number(form.startingBalance) || 0) * (Number(form.riskPct) || 0) / 100;
  const save = () => { if (!valid || busy) return; const { sequence, __chooseTestType, ...runToSave } = form; onSave({ ...runToSave, startingBalance: Number(form.startingBalance), tradeTarget: Number(form.tradeTarget) }); };
  const shell = (title, eyebrow, body, footer) => <div className="st2-ov" role="presentation"><div className="st2-bk" onClick={() => { if (!busy) onClose(); }}/>
    <aside className="st2-dr" role="dialog" aria-modal="true" aria-labelledby="st2-dr-title" onKeyDown={(event) => { if (event.key === 'Enter' && event.target.tagName === 'INPUT' && event.target.type !== 'checkbox') { event.preventDefault(); save(); } }}>
      <header><span className="st2-av"><FlaskConical size={22}/></span><div><span className="st2-eb">{eyebrow}</span><h2 id="st2-dr-title">{title}</h2>{!form.__chooseTestType && <p className="st2-sub">Never affects your live journal.</p>}</div><button type="button" className="st2-x" aria-label="Close" onClick={onClose} disabled={busy}><X size={18}/></button></header>
      <div className="st2-db">{body}</div><footer>{footer}</footer></aside></div>;
  if (form.__chooseTestType) return shell('Create a strategy test', 'New test', <>
    <p className="st2-lead">Choose how you are testing this strategy. Both stay separate from your live journal and keep their own results.</p>
    {[['backtest', 'Backtest', 'Review historical market trades and past sessions.', FlaskConical], ['forward', 'Forward test', 'Track a live, ongoing strategy test in the current market.', CheckCircle2]].map(([type, name, note, Icon]) => <button type="button" key={type} className="st2-ch" onClick={() => setForm((current) => ({ ...current, __chooseTestType: false, testType: type, name: `${type === 'forward' ? 'Forward Test' : 'Backtest'} ${current.sequence}` }))}><span><Icon size={22}/></span><div><b>{name}</b><small>{note}</small></div><ChevronDown size={16} className="st2-chv"/></button>)}
  </>, <div className="st2-fb"><span/><button type="button" className="st2-btn" onClick={onClose}>Cancel</button></div>);
  return shell(form.name || 'Untitled', run.id && !run.__chooseTestType && !run.sequence ? `${label} settings` : `New ${label.toLowerCase()}`, <>
    <section><h4>Test</h4>
      <div className="st2-f2"><label className="st2-f"><small>Account name</small><span className="st2-in"><input value={form.name || ''} onChange={(event) => set('name', event.target.value)} autoFocus/></span></label><label className="st2-f"><small>Strategy / idea</small><span className="st2-in"><input value={form.strategy || ''} placeholder="e.g. M15 fractal structure" onChange={(event) => set('strategy', event.target.value)}/></span></label></div>
      <div className="st2-f2"><div className="st2-f"><small>Instrument</small>{hasTrades ? <span className="st2-in is-dis" title="Locked because this test already has trades.">{form.instrument}</span> : <ThemeInstrument value={form.instrument} onChange={(value) => set('instrument', value)} options={instruments}/>}</div><div className="st2-f"><small>Timeframe</small><ThemeSelect label="Timeframe" value={form.timeframe} onChange={(event) => set('timeframe', event.target.value)}>{TIMEFRAMES.map((value) => <option key={value} value={value}>{value}</option>)}</ThemeSelect></div></div>
      {hasTrades && <p className="st2-mu">The instrument is locked because this test already has trades.</p>}
    </section>
    <section><h4>Capital &amp; risk <span className="st2-calc">Risk per trade <b>{money(riskAmount, form.currency || 'USD')}</b></span></h4>
      <div className="st2-f2"><label className="st2-f"><small>Starting balance</small><span className="st2-in"><input type="number" min="0.01" step="0.01" value={form.startingBalance} onChange={(event) => set('startingBalance', event.target.value)}/></span></label><div className="st2-f"><small>Currency</small><ThemeSelect label="Currency" value={form.currency} onChange={(event) => set('currency', event.target.value)}>{CURRENCIES.map((value) => <option key={value} value={value}>{value}</option>)}</ThemeSelect></div></div>
      <div className="st2-f2"><label className="st2-f"><small>Default risk %</small><span className="st2-in"><input type="number" min="0" max="100" step="0.1" value={form.riskPct} onChange={(event) => set('riskPct', event.target.value)}/><em>%</em></span></label><label className="st2-f"><small>Trade target</small><span className="st2-in"><input type="number" min="1" step="1" value={form.tradeTarget} onChange={(event) => set('tradeTarget', event.target.value)}/></span></label></div>
    </section>
    {rules.length > 0 && <section><h4>Trading rules <span className="st2-calc"><b>{linked}</b> of {rules.length} linked</span></h4><div className="st2-rl">{rules.map((rule) => { const on = (form.rules || []).some((item) => item.id === rule.id); return <label key={rule.id} className={on ? 'is-on' : ''}><input type="checkbox" checked={on} onChange={(event) => set('rules', event.target.checked ? [...(form.rules || []), { ...rule }] : (form.rules || []).filter((item) => item.id !== rule.id))}/><i><Check size={12} strokeWidth={3}/></i><span>{rule.text || rule.name}</span></label>; })}</div></section>}
    <section><h4>Notes</h4><div className="st2-f2"><label className="st2-f"><small>Pre-run plan</small><textarea value={form.plan || ''} placeholder="What you expect to test" onChange={(event) => set('plan', event.target.value)}/></label><label className="st2-f"><small>Run conclusion</small><textarea value={form.conclusion || ''} placeholder="What you learned" onChange={(event) => set('conclusion', event.target.value)}/></label></div></section>
  </>, <div className="st2-fb"><span className="st2-fe">{valid ? '' : 'Name, balance above 0, a whole-number trade target and risk between 0 and 100% are required.'}</span>{run.__chooseTestType || run.sequence ? <button type="button" className="st2-btn" onClick={() => setForm((current) => ({ ...current, __chooseTestType: true }))} disabled={busy}><ArrowLeft size={15}/>Back</button> : <button type="button" className="st2-btn" onClick={onClose} disabled={busy}>Cancel</button>}<button type="button" className="st2-btn is-pri" onClick={save} disabled={!valid || busy}><Save size={15}/>{busy ? 'Saving…' : run.sequence ? 'Create test' : 'Save test'}</button></div>);
}

export default function DesktopStrategyTesting({ runs = [], getTrades, busy = false, error = '', onRetry, onCreate, onEditSetup, onDeleteRun, onOpenTrade, onEditTrade, onDeleteTrade, onLoadMedia, onViewImage }) {
  const [selectedId, setSelectedId] = useState(null);
  const [tab, setTab] = useState('ov');
  const [collapsed, setCollapsed] = useState(false);
  const [askDelete, setAskDelete] = useState(false);
  const [open, setOpen] = useState({});
  const [result, setResult] = useState('all');
  const run = runs.find((item) => item.id === selectedId) || runs[0] || null;
  useEffect(() => { setAskDelete(false); setOpen({}); setResult('all'); }, [run?.id]);
  const trades = run ? getTrades(run.id) : [];
  const stats = useMemo(() => run ? backtestStats(run, trades) : null, [run, trades]);
  const meta = useMemo(() => stats ? strategyTradeMeta(stats) : new Map(), [stats]);
  const forward = run && testType(run) === 'forward';
  const hero = !run ? ['Test an idea before it costs you.', 'Start with a plan.'] : !stats.total ? ['The test is ready.', 'Log the first trade.'] : stats.net > 0 ? ['The test has an edge to inspect.', stats.losses ? 'Review the losing pattern.' : 'Keep the sample growing.'] : ['The test is not paying yet.', 'Review the losing pattern.'];
  const header = <section className="st2-ho"><div className="st2-ht"><span className="st2-eb">Grow · Strategy Testing</span><h1>{hero[0]}<br/><em>{hero[1]}</em></h1><p>Use the screenshots and notes to check whether the setup rules were followed, especially where outcomes closed negative.</p></div>
    <div className="st2-hr"><div className="st2-sv"><b>{runs.length}</b><span>saved test<br/>account{runs.length === 1 ? '' : 's'}</span></div><button type="button" className="st2-btn is-pri" onClick={onCreate} disabled={busy}><Plus size={16} strokeWidth={2.4}/>New test</button></div></section>;
  if (!run) return <main className="st2" aria-label="Strategy testing">{header}{error && <p className="st2-alert" role="alert">{error} <button type="button" onClick={onRetry}>Retry</button></p>}
    <section className="st2-card st2-empty"><span><FlaskConical size={26}/></span><b>No saved tests yet</b><p>Create a test to start reviewing your edge.</p><button type="button" className="st2-btn is-pri" onClick={onCreate} disabled={busy}><Plus size={16} strokeWidth={2.4}/>New test</button></section></main>;
  const running = trades.length - stats.total;
  const target = Number(run.tradeTarget) || 1;
  const growth = Number(run.startingBalance) ? Math.abs(stats.net) / Math.max(1, Number(run.startingBalance) * .1) * 100 : 0;
  const statusClass = stats.status === 'Completed' ? 'is-ok' : 'is-prog';
  const kpi = (label, value, note, cls = '') => <div className="st2-k"><small>{label}</small><b className={cls}>{value}</b><span>{note}</span></div>;
  const rows = [...orderTestTrades(trades)].reverse().filter((trade) => result === 'all' || strategyResult(trade) === result);
  return <main className="st2" aria-label="Strategy testing">
    {header}
    {runs.length > 1 && <div className="st2-sw" role="tablist" aria-label="Saved tests">{runs.map((item) => <button type="button" role="tab" key={item.id} aria-selected={item.id === run.id} className={item.id === run.id ? 'is-on' : ''} onClick={() => setSelectedId(item.id)}><i className={testType(item) === 'forward' ? 'is-f' : ''}/>{item.name}<small>{item.instrument} · {item.timeframe}</small></button>)}</div>}
    {error && <p className="st2-alert" role="alert">{error} <button type="button" onClick={onRetry}>Retry</button></p>}
    <section className="st2-card st2-cd">
      <header className="st2-ch2"><div className="st2-cn"><h2>{run.instrument} · {run.timeframe}</h2>{run.strategy && <span className="st2-chip">{run.strategy}</span>}<span className="st2-chip">{testTypeLabel(run)}</span><span className={`st2-chip ${statusClass}`}><i/>{stats.status}</span><small>{stats.total} closed · {running} running</small></div>
        <div className="st2-ca">{askDelete ? <div className="st2-cf"><span><AlertTriangle size={15}/>Delete this test and all its trades?</span><button type="button" className="st2-btn" onClick={() => setAskDelete(false)} disabled={busy}>Keep</button><button type="button" className="st2-btn is-dng" onClick={() => { setAskDelete(false); onDeleteRun(run); }} disabled={busy}>Delete</button></div>
          : <><button type="button" className={`st2-ic${collapsed ? '' : ' is-up'}`} aria-label={collapsed ? 'Show test details' : 'Hide test details'} aria-expanded={!collapsed} onClick={() => setCollapsed((value) => !value)}><ChevronDown size={17}/></button><button type="button" className="st2-btn" onClick={() => onEditSetup(run)} disabled={busy}><Edit3 size={15}/>Edit setup</button><button type="button" className="st2-btn is-pri" onClick={() => onOpenTrade(run)} disabled={busy}><Plus size={15} strokeWidth={2.4}/>Log trade</button><button type="button" className="st2-btn is-dg" onClick={() => setAskDelete(true)} disabled={busy}><Trash2 size={15}/>Delete</button></>}</div></header>
      <div className="st2-cb">
        <div className="st2-np"><span className="st2-eb2">Net profit</span><b className={stats.net >= 0 ? 'is-gain' : 'is-loss'}>{signed(stats.net, run.currency)}</b><div className="st2-bl"><span>Balance</span><b>{money(run.startingBalance, run.currency)} <i>→</i> {money(stats.balance, run.currency)}</b></div><div className="st2-bar"><u className={stats.net < 0 ? 'is-loss' : ''} style={{ width: `${Math.min(100, growth)}%` }}/></div></div>
        <div className="st2-pr"><Ring value={stats.total} target={target}/><span className={`st2-chip ${statusClass}`}><i/>{stats.status}</span></div>
        <div className="st2-kg">{kpi('Win rate', pct(stats.winRate), `${stats.wins} wins of ${stats.total}`)}{kpi('Avg R:R', stats.averageR == null ? '—' : `${stats.averageR.toFixed(2)}R`, 'Average per trade')}{kpi('Expectancy', stats.expectancy == null ? '—' : money(stats.expectancy, run.currency), 'Per closed trade', tone(stats.expectancy))}{kpi('Profit factor', stats.profitFactor == null ? '—' : stats.profitFactor === Infinity ? '∞' : stats.profitFactor.toFixed(2), 'Gross win ÷ gross loss')}{kpi('Max drawdown', money(-stats.drawdown, run.currency), 'Peak to trough', stats.drawdown ? 'is-loss' : '')}{kpi('Best day', stats.bestDay ? money(stats.bestDay[1], run.currency) : '—', stats.bestDay ? stats.bestDay[0] : 'No trades yet', stats.bestDay ? 'is-gain' : '')}</div>
      </div>
      {!collapsed && <div className="st2-su">{[['Test type', testTypeLabel(run)], ['Instrument', `${run.instrument} · ${run.timeframe}`], ['Strategy', run.strategy || 'Not set'], ['Starting balance', money(run.startingBalance, run.currency)], ['Risk per trade', `${Number(run.riskPct || 0).toFixed(1)}%`], ['Balance source', 'Uses this test’s balance']].map(([label, value]) => <div key={label}><small>{label}</small><b>{value}</b></div>)}</div>}
    </section>
    {!collapsed && <div className="st2-nt"><div className="st2-n1"><span className="st2-ni"><FlaskConical size={16}/></span><div><small className="st2-eb2">Pre-run plan</small><p className={run.plan?.trim() ? '' : 'st2-mu'}>{run.plan?.trim() || 'No plan written yet. Add your hypothesis in the setup.'}</p></div></div><div className="st2-n1 is-w"><span className="st2-ni"><Info size={16}/></span><div><small className="st2-eb2">Run conclusion</small><p className={run.conclusion?.trim() ? '' : 'st2-mu'}>{run.conclusion?.trim() || 'No conclusion yet. Write it when the run is done.'}</p></div></div></div>}
    <div className="st2-tb" role="tablist" aria-label="Test sections">{[['ov', 'Overview'], ['bd', 'Breakdown'], ['lg', forward ? 'Forward log' : 'Backtest log']].map(([id, label]) => <button type="button" role="tab" key={id} aria-selected={tab === id} className={tab === id ? 'is-on' : ''} onClick={() => setTab(id)}>{label}{id === 'lg' && <em>{trades.length}</em>}</button>)}</div>
    <div className="st2-body" key={tab}>
      {tab === 'ov' && <>
        <div className="st2-g2"><section className="st2-card st2-pn"><header><div><span className="st2-eb2">Simulated equity</span><h3>How the run has compounded</h3></div><b className={`st2-big ${stats.net >= 0 ? 'is-gain' : 'is-loss'}`}>{money(stats.balance, run.currency)}</b></header><Equity stats={stats} run={run}/></section><Outcomes stats={stats} currency={run.currency}/></div>
        <section className="st2-card st2-pn"><header><div><span className="st2-eb2">Recent momentum</span><h3>{strategyStreakTitle(stats)}</h3></div><small className="st2-mu">Newest first</small></header>{stats.total ? <div className="st2-mo">{stats.closed.slice(-5).reverse().map((trade) => { const k = strategyResult(trade); return <div key={trade.id} className={`is-${k}`}><b>{k === 'win' ? 'W' : k === 'loss' ? 'L' : 'BE'}</b><span>{money(trade.pnl, run.currency)}</span><small>{rValue(trade.rr)}</small></div>; })}</div> : <p className="st2-emp">No closed trades yet.</p>}</section>
      </>}
      {tab === 'bd' && <>
        <section className="st2-card st2-pn"><header><div><span className="st2-eb2">Simulation analysis</span><h3>Quick edge read</h3></div><small className="st2-mu">Only this test’s trades</small></header><div className="st2-4">{[['Best instrument', stats.total ? run.instrument : '—'], ['Best session', stats.sessions[0]?.label || '—'], ['Best entry model', stats.models[0]?.label || '—'], ['Best confluence', stats.confluences[0]?.label || '—']].map(([label, value]) => <div key={label}><small>{label}</small><b>{value}</b></div>)}</div></section>
        <div className="st2-g3">
          <section className="st2-card st2-pn"><header><div><span className="st2-eb2">Instrument outcome</span><h3>Net P&amp;L by instrument</h3></div></header>{stats.total ? <Bar label={run.instrument} note={`${stats.total} trades`} width={100} value={money(stats.net, run.currency)} kind={stats.net >= 0 ? 'is-gain' : 'is-loss'}/> : <p className="st2-emp">No closed trades yet.</p>}</section>
          <section className="st2-card st2-pn"><header><div><span className="st2-eb2">Session win rate</span><h3>Which sessions pay</h3></div></header>{stats.sessions.length ? stats.sessions.map((item) => <Bar key={item.label} label={item.label} note={`${item.wins} of ${item.total}`} width={item.rate} value={pct(item.rate)} kind="is-acc"/>) : <p className="st2-emp">No closed trades yet.</p>}</section>
          <section className="st2-card st2-pn"><header><div><span className="st2-eb2">Rule adherence</span><h3>Rules followed</h3></div></header>{stats.ruleRate == null ? <div className="st2-re"><span><Link2 size={18}/></span><b>No rules evaluated yet</b><p>{(run.rules || []).length ? `${run.rules.length} rule${run.rules.length === 1 ? '' : 's'} linked to this test. Check them on each trade to score how often you followed them.` : 'Link your trading rules to this test to see how often you followed them.'}</p><button type="button" className="st2-btn" onClick={() => onEditSetup(run)} disabled={busy}>{(run.rules || []).length ? 'Manage rules' : 'Link rules'}</button></div> : <div className="st2-re"><b className="st2-big is-gain">{pct(stats.ruleRate)}</b><p>From logged rule evaluations across this test’s trades.</p></div>}</section>
        </div>
      </>}
      {tab === 'lg' && <section className="st2-card st2-pn st2-lg">
        <header><div><span className="st2-eb2">{forward ? 'Forward log' : 'Backtest log'}</span><h3>{forward ? 'Live trade results' : 'Historical trade results'}</h3></div>
          <div className="st2-lr"><div className="st2-ct"><b>{trades.length}</b><small>trades</small></div><div className="st2-ct"><b className="is-gain">{stats.wins}</b><small className="is-gain">wins</small></div><div className="st2-ct"><b className="is-loss">{stats.losses}</b><small className="is-loss">losses</small></div>
            <ThemeSelect label="Result filter" value={result} onChange={(event) => setResult(event.target.value)}>{[['all', 'All results'], ['win', 'Wins'], ['loss', 'Losses'], ['flat', 'Break-even'], ['running', 'Running']].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</ThemeSelect>
            <button type="button" className="st2-btn is-pri" onClick={() => onOpenTrade(run)} disabled={busy}><Plus size={15} strokeWidth={2.4}/>Log trade</button></div></header>
        <div className="st2-tw"><div className="st2-th"><span>#</span><span>Date</span><span>Pair</span><span>Setup</span><span>Direction</span><span>Result</span><span>Net P&amp;L</span><span>Balance</span><span/></div>
          {rows.length ? rows.map((trade) => { const k = strategyResult(trade), m = meta.get(trade.id), isOpen = !!open[trade.id], dir = String(trade.direction || '').toUpperCase(); return <div key={trade.id} className={`st2-rw is-${k}${isOpen ? ' is-op' : ''}`}>
            <button type="button" className="st2-rr" aria-expanded={isOpen} onClick={() => setOpen((current) => ({ ...current, [trade.id]: !current[trade.id] }))}><span className="st2-nm">{m?.number ?? '—'}</span><span className="st2-dt"><b>{dateText(trade.closeDate || trade.date)}</b><small>{trade.time || '—'}</small></span><b>{trade.asset || run.instrument}</b><span className="st2-st"><b>{trade.backtestModelSnapshot?.name || trade.entryType || trade.strategy || 'Not set'}</b><em>{trade.timeframe || run.timeframe}</em></span><span>{dir ? <i className={`st2-dp ${dir.startsWith('B') || dir === 'LONG' ? 'is-b' : 'is-s'}`}>{dir}</i> : '—'}</span><b className={tone(trade.pnl)}>{k === 'running' ? 'Running' : rValue(trade.rr)}</b><b className={tone(trade.pnl)}>{k === 'running' ? '—' : signed(trade.pnl, run.currency)}</b><span className="st2-bal">{m?.balance == null ? '—' : money(m.balance, run.currency)}</span><span className="st2-xp" aria-hidden="true"><ChevronDown size={15}/></span></button>
            {isOpen && <TradeDetail trade={trade} run={run} busy={busy} onEdit={onEditTrade} onDelete={onDeleteTrade} onLoadMedia={onLoadMedia} onViewImage={onViewImage}/>}
          </div>; }) : <p className="st2-emp">{trades.length ? 'No trades match this filter.' : 'No trades yet. Results appear here as the test runs.'}</p>}
        </div>
      </section>}
    </div>
  </main>;
}
