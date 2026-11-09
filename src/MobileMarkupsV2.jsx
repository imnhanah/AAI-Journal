import React, {useEffect, useMemo, useState} from 'react';
import {ArrowUpRight, ChevronDown, ChevronUp, Edit3, Image as ImageIcon, Plus, Search, SlidersHorizontal, Trash2} from 'lucide-react';
import {ConfirmDeleteButton} from './JournalControls.jsx';
import {markupStatus} from './markupLifecycle.js';
import {loadJournalImage} from './journalCloudCache.js';
import {usePageState} from './NavigationSession.jsx';
import {useNavStep} from './useBackNavigation.js';
import {useStepMotion} from './MobilePageStage.jsx';
import {scrollPhoneTo} from './phoneScroll.js';
import './mobileMarkupsV2.css';

const SLOT_LABELS = {
  preHTF: 'HTF chart', preH4: 'MTF chart', preM15: 'LTF chart',
  postH4: 'Post-session MTF', postM15: 'Post-session LTF',
};
const PRE_SLOTS = ['preHTF', 'preH4', 'preM15'];
const POST_SLOTS = ['postH4', 'postM15'];
const FILTERS = ['All', 'Executed', 'Planned', 'Watching', 'Not Executed', 'Linked'];

const imageSource = image => {
  if (typeof image === 'string') return image;
  if (!image || typeof image !== 'object') return '';
  return image.src || image.url || image.dataUrl || image.source || image.data || image.image || image.preview || image.file?.dataUrl || image.file?.src || '';
};
const dateLabel = value => {
  if (!value) return 'Undated';
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat(undefined, {month:'short', day:'numeric', year:'numeric'}).format(date);
};
const monthLabel = value => {
  const date = new Date(`${String(value || '').slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? 'Undated' : new Intl.DateTimeFormat(undefined, {month:'long', year:'numeric'}).format(date);
};
const money = (value, currency = 'USD') => {
  const amount = Number(value || 0);
  try { return `${amount >= 0 ? '+' : '−'}${new Intl.NumberFormat(undefined, {style:'currency', currency, minimumFractionDigits:2, maximumFractionDigits:2}).format(Math.abs(amount))}`; }
  catch { return `${amount >= 0 ? '+' : '−'}$${Math.abs(amount).toFixed(2)}`; }
};
const statusClass = value => String(value || 'Planned').toLowerCase().replace(/\s+/g, '-');
const biasClass = value => /bullish/i.test(value || '') ? 'bullish' : /bearish/i.test(value || '') ? 'bearish' : 'neutral';

function MarkupImage({source, label, onView, cover = false}) {
  const [resolved, setResolved] = useState('');
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    setResolved(''); setError(false);
    if (!source) { setError(true); return undefined; }
    loadJournalImage(source).then(value => { if (active) setResolved(value); }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [source]);
  if (cover) return <div className={`tj-mk2-cover ${error ? 'is-empty' : ''}`} aria-label={label}>
    {resolved ? <img src={resolved} alt="Markup chart" loading="lazy"/> : <span><ImageIcon size={18}/>{error ? 'No chart saved' : 'Loading chart…'}</span>}
  </div>;
  return <button type="button" className={`tj-mk2-chart ${error ? 'is-empty' : ''}`} disabled={!resolved} onClick={() => resolved && onView(resolved)} aria-label={resolved ? `View ${label}` : `${label} unavailable`}>
    {resolved ? <img src={resolved} alt={label} loading="lazy"/> : <span><ImageIcon size={18}/>{error ? 'No chart' : 'Loading…'}</span>}
    <small>{label}</small>
  </button>;
}

function PlanRows({markup}) {
  const rows = [['Market structure', markup.structure], ['Key levels & liquidity', markup.levels], ['Expectations', markup.notes]];
  return <div className="tj-mk2-plan">{rows.map(([label, value], index) => <div key={label} className="tj-mk2-plan-row"><i>{String(index + 1).padStart(2, '0')}</i><div><strong>{label}</strong><p>{String(value || '').trim() || 'Not recorded'}</p></div></div>)}</div>;
}

export default function MobileMarkupsV2({markups = [], trades = [], currency = 'USD', onNew, onEdit, onDelete, onTrade, onViewImage}) {
  const [query, setQuery] = usePageState('markups-mobile-v2', 'query', '');
  const [filter, setFilter] = usePageState('markups-mobile-v2', 'filter', 'All');
  const [descending, setDescending] = usePageState('markups-mobile-v2', 'descending', true);
  const [selectedId, setSelectedId] = usePageState('markups-mobile-v2', 'selectedId', null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const linkedFor = markup => trades.filter(trade => String(trade.premarketMarkupId || '') === String(markup.id));
  const statusFor = markup => linkedFor(markup).length ? 'Executed' : markupStatus(markup.status);
  const pnlFor = markup => linkedFor(markup).reduce((total, trade) => total + Number(trade.pnl || 0), 0);
  const chartsFor = markup => [...PRE_SLOTS, ...POST_SLOTS].flatMap(slot => (markup.screenshots?.[slot] || []).map(imageSource).filter(Boolean));
  const selected = markups.find(markup => String(markup.id) === String(selectedId));
  useStepMotion(selected ? 1 : 0);

  const filtered = useMemo(() => {
    const needle = String(query || '').trim().toLowerCase();
    return markups.filter(markup => {
      const linked = linkedFor(markup);
      const status = statusFor(markup);
      const matchesText = !needle || [markup.instrument, markup.market, markup.bias, status, markup.date].filter(Boolean).join(' ').toLowerCase().includes(needle);
      const matchesFilter = filter === 'All' || (filter === 'Linked' ? linked.length > 0 : status === filter);
      return matchesText && matchesFilter;
    }).sort((left, right) => {
      const comparison = `${left.date || ''} ${left.time || ''}`.localeCompare(`${right.date || ''} ${right.time || ''}`);
      return descending ? -comparison : comparison;
    });
  }, [markups, trades, query, filter, descending]);

  const groups = useMemo(() => {
    const result = [];
    let current = null;
    filtered.forEach(markup => {
      const key = String(markup.date || '').slice(0, 7) || 'undated';
      if (key !== current) { current = key; result.push({key, label:monthLabel(markup.date), rows:[]}); }
      result[result.length - 1].rows.push(markup);
    });
    return result;
  }, [filtered]);

  const linked = markups.filter(markup => linkedFor(markup).length > 0);
  const executed = markups.filter(markup => statusFor(markup) === 'Executed').length;
  const linkedTradeCount = linked.reduce((total, markup) => total + linkedFor(markup).length, 0);
  const linkedPnl = linked.reduce((total, markup) => total + pnlFor(markup), 0);
  const openDetail = id => { setSelectedId(id); window.requestAnimationFrame(() => scrollPhoneTo(document.querySelector('.tj-content'),{top:0,behavior:'smooth'})); };
  const closeDetail = () => { setSelectedId(null); window.requestAnimationFrame(() => scrollPhoneTo(document.querySelector('.tj-content'),{top:0,behavior:'smooth'})); };
  useNavStep('markup-detail', !!selectedId, closeDetail);

  if (selected) {
    const linkedTrades = linkedFor(selected);
    const pre = PRE_SLOTS.flatMap(slot => (selected.screenshots?.[slot] || []).map(imageSource).filter(Boolean).map(source => ({source, label:SLOT_LABELS[slot]})));
    const post = POST_SLOTS.flatMap(slot => (selected.screenshots?.[slot] || []).map(imageSource).filter(Boolean).map(source => ({source, label:SLOT_LABELS[slot]})));
    const review = selected.sessionReview || {};
    const status = statusFor(selected);
    const pnl = pnlFor(selected);
    return <main className="tj-mk2 tj-mk2-detail" aria-label="Markup details">
      <header className="tj-mk2-detail-hero">
        <div className="tj-mk2-detail-nav"><span/><small>Markup / session record</small><button type="button" className="tj-mk2-icon" onClick={() => onEdit(selected)} aria-label="Edit markup"><Edit3 size={18}/></button></div>
        <h1>{selected.instrument || 'Untitled markup'}</h1>
        <p>{dateLabel(selected.date)} · {selected.time || '—'} · {selected.market || 'No session'}</p>
        <div className="tj-mk2-detail-metrics"><div><small>Direction</small><strong className={`is-${biasClass(selected.bias)}`}>{selected.bias || 'No bias'}</strong></div><div><small>Plan status</small><strong>{status}</strong></div><div><small>Linked P&amp;L</small><strong className={pnl < 0 ? 'is-loss' : 'is-profit'}>{linkedTrades.length ? money(pnl, currency) : '—'}</strong></div></div>
      </header>
      <div className="tj-mk2-detail-body">
        <section><p className="tj-mk2-eyebrow">01 / Pre-session intent</p><article className="tj-mk2-panel"><PlanRows markup={selected}/></article></section>
        <section><p className="tj-mk2-eyebrow">02 / Pre-session charts</p>{pre.length ? <div className="tj-mk2-gallery">{pre.map(({source,label}, index) => <MarkupImage key={`${source}-${index}`} source={source} label={label} onView={onViewImage}/>)}</div> : <article className="tj-mk2-empty">No pre-session charts saved.</article>}</section>
        <section><p className="tj-mk2-eyebrow">03 / Execution</p><article className="tj-mk2-panel tj-mk2-trades">{linkedTrades.length ? linkedTrades.map(trade => <div key={trade.id}><span><strong>{trade.asset || selected.instrument || 'Trade'} · {trade.direction || '—'}</strong><small>{dateLabel(trade.date)} · {trade.time || '—'}{trade.rr != null ? ` · ${Number(trade.rr).toFixed(2)}R` : ''}</small></span><b className={Number(trade.pnl || 0) < 0 ? 'is-loss' : 'is-profit'}>{money(trade.pnl, currency)}</b></div>) : <span className="tj-mk2-muted">No trades linked yet.</span>}</article></section>
        <section><p className="tj-mk2-eyebrow">04 / Post-session review</p><article className="tj-mk2-panel tj-mk2-review">{[['Did the market play out as expected?', review.marketOutcome], ['Did you wait for key conditions?', review.waitedForConditions], ['If you traded outside the plan, why?', review.outsidePlanReason]].map(([label, value]) => <div key={label}><strong>{label}</strong><p>{String(value || '').trim() || 'Not reviewed yet'}</p></div>)}</article>{post.length ? <div className="tj-mk2-gallery">{post.map(({source,label}, index) => <MarkupImage key={`${source}-${index}`} source={source} label={label} onView={onViewImage}/>)}</div> : null}</section>
        <div className="tj-mk2-detail-actions"><button type="button" className="tj-mk2-secondary" onClick={() => onTrade(selected)}><Plus size={17}/>Trade</button><button type="button" className="tj-mk2-primary" onClick={() => onEdit(selected)}><Edit3 size={17}/>Edit markup</button><ConfirmDeleteButton className="tj-mk2-danger" title="Delete markup" onClick={() => onDelete(selected.id)}><Trash2 size={17}/>Delete</ConfirmDeleteButton></div>
      </div>
    </main>;
  }

  return <main className="tj-mk2" aria-label="Markups">
    <header className="tj-mk2-heading"><small className="tj-mk2-eyebrow">The trading journal</small><h1>Markups<span>.</span></h1><p>Every plan tells a story.</p></header>
    <section className="tj-mk2-hero" aria-label="Your planning edge"><div><small>Your planning edge</small><strong>{String(markups.length).padStart(2, '0')}<em> markups</em></strong><p>Turn your analysis into repeatable execution.</p></div><div className="tj-mk2-hero-stats"><span><b>{String(executed).padStart(2, '0')}</b><small>Executed</small></span><span><b>{String(linkedTradeCount).padStart(2, '0')}</b><small>Linked trades</small></span><span><b className={linkedPnl < 0 ? 'is-loss' : 'is-profit'}>{linkedTradeCount ? money(linkedPnl, currency) : '—'}</b><small>Linked P&amp;L</small></span></div></section>
    <section className="tj-mk2-library" aria-labelledby="markups-library-heading"><header><h2 id="markups-library-heading">Session archive</h2><small>{filtered.length} record{filtered.length === 1 ? '' : 's'}</small></header><div className="tj-mk2-tools"><label className="tj-mk2-search"><Search size={17}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search instrument or session" aria-label="Search markups"/></label><button type="button" className={`tj-mk2-filter ${filtersOpen ? 'is-open' : ''}`} aria-expanded={filtersOpen} onClick={() => setFiltersOpen(open => !open)}><SlidersHorizontal size={16}/><span>{filter}</span><ChevronDown size={14}/></button><button type="button" className="tj-mk2-filter tj-mk2-sort" aria-label={descending ? 'Sort newest first' : 'Sort oldest first'} onClick={() => setDescending(value => !value)}>{descending ? '↓' : '↑'}</button></div>
      {filtersOpen && <div className="tj-mk2-filter-menu" role="group" aria-label="Markup filter">{FILTERS.map(value => <button type="button" key={value} aria-pressed={filter === value} onClick={() => { setFilter(value); setFiltersOpen(false); }}>{value}{filter === value && <span>✓</span>}</button>)}</div>}
      <div className="tj-mk2-create-wrap"><button type="button" className="tj-mk2-create" onClick={onNew} aria-label="New Markup"><Plus size={20}/></button></div>
      {groups.length ? groups.map(group => <section className="tj-mk2-month" key={group.key}><h3>{group.label}</h3>{group.rows.map(markup => { const linkedTrades = linkedFor(markup); const pnl = pnlFor(markup); const status = statusFor(markup); const cover = chartsFor(markup)[0]; const planCount = [markup.structure, markup.levels, markup.notes].filter(value => String(value || '').trim()).length; return <button type="button" key={markup.id} className="tj-mk2-card" onClick={() => openDetail(markup.id)} aria-label={`Open ${markup.instrument || 'markup'} details`}><div className="tj-mk2-card-body"><div><strong>{markup.instrument || 'Untitled markup'}</strong><small>{markup.market || 'No session'} · {dateLabel(markup.date)} · {markup.time || '—'}</small></div><span className={`tj-mk2-bias is-${biasClass(markup.bias)}`}>{/bullish/i.test(markup.bias || '') ? '↗' : /bearish/i.test(markup.bias || '') ? '↘' : '—'} {markup.bias || 'No bias'}</span></div><MarkupImage source={cover} label="Markup chart" cover/><div className="tj-mk2-card-foot"><span><b>{status}</b><small>{linkedTrades.length} linked trade{linkedTrades.length === 1 ? '' : 's'} · Plan {Math.round(planCount / 3 * 100)}%</small></span><span><b className={pnl < 0 ? 'is-loss' : linkedTrades.length ? 'is-profit' : ''}>{linkedTrades.length ? money(pnl, currency) : '—'}</b><small>Linked P&amp;L</small></span></div></button>; })}</section>) : <div className="tj-mk2-empty">No markups match this search or filter.</div>}
    </section>
  </main>;
}
