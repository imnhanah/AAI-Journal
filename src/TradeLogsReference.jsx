import { useState } from 'react';
import './trade-logs.css';

/* ---------- Icons ---------- */
const paths = {
  up: 'M7 17 17 7M9 7h8v8',
  down: 'M7 7l10 10M17 9v8H9',
  pen: 'M4 20h4L19 9l-4-4L4 16z',
  dots: 'M6 12h.01M12 12h.01M18 12h.01',
};

function Icon({ name, size = 18 }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={paths[name]} />
    </svg>
  );
}

function Stars({ value, max = 5 }) {
  return (
    <span className="tl-stars" role="img" aria-label={`Rating ${value} of ${max}`}>
      {Array.from({ length: max }, (_, i) => (
        <svg key={i} width="16" height="16" viewBox="0 0 24 24" className={`tl-star ${i < value ? 'tl-star--on' : ''}`} aria-hidden="true">
          <path d="m12 3 2.7 5.8 6.3.7-4.7 4.3 1.3 6.2L12 17l-5.6 3 1.3-6.2L3 9.5l6.3-.7z" />
        </svg>
      ))}
    </span>
  );
}

/* ---------- List ---------- */
function TradeRow({ trade, selected, onSelect }) {
  const isBuy = trade.side === 'BUY';
  return (
    <button
      type="button"
      className="tl-row"
      aria-current={selected ? 'true' : undefined}
      onClick={() => onSelect(trade.id)}
    >
      <span className={`tl-icon ${trade.loss ? 'tl-icon--loss' : 'tl-icon--win'}`}>
        <Icon name={isBuy ? 'up' : 'down'} size={16} />
      </span>
      <span className="tl-trade-copy">
        <span className="tl-pair">{trade.pair}</span>
        <span className="tl-meta" style={{ display: 'block' }}>
          {trade.when}
          <br />
          {trade.session}
        </span>
      </span>
      <span className="tl-direction-column">
        <span className={`tl-badge ${isBuy ? 'tl-badge--buy' : 'tl-badge--sell'}`}>{trade.side}</span>
      </span>
      <span className="tl-result">
        {trade.result}
        <small>RR</small>
      </span>
    </button>
  );
}

function TradeList({ selectedId, onSelect, rows = [] }) {
  return (
    <nav className="tl-list" aria-label="Trades">
      {rows.map((m) => (
        <section key={m.label}>
          <div className="tl-month">
            {m.label}
            <strong>{m.total}</strong>
          </div>
          {m.trades.map((t) => (
            <TradeRow key={t.id} trade={t} selected={t.id === selectedId} onSelect={onSelect} />
          ))}
        </section>
      ))}
    </nav>
  );
}

/* ---------- Detail ---------- */
function markupLabel(markup) {
  return [markup.date, markup.instrument || markup.market || markup.name || 'Untitled markup', markup.bias].filter(Boolean).join(' · ');
}

function TradeDetail({ d, markups = [], renderScreenshot, onWriteReview, onEditTrade, onDeleteTrade, onLinkMarkup }) {
  const [linkDrafts, setLinkDrafts] = useState({});
  if (!d) {
    return <section className="tl-detail"><p className="tl-count">No details saved for this trade.</p></section>;
  }
  const isBuy = d.side === 'BUY';
  const tradeId = d.trade?.id;
  const linkedMarkupId = d.linkedMarkup?.id || d.trade?.premarketMarkupId || '';
  const linkValue = linkDrafts[tradeId] ?? linkedMarkupId;

  return (
    <section className="tl-detail" aria-label={`${d.pair} trade detail`}>
      <header className={`tl-head ${d.isLoss ? 'tl-head--loss' : 'tl-head--win'}`}>
        <div className="tl-head__top">
          <div className="tl-row-flex">
            <span className="tl-title">{d.pair}</span>
            <span className={`tl-badge ${isBuy ? 'tl-badge--buy' : 'tl-badge--sell'}`}>{d.side}</span>
          </div>
          <div className="tl-row-flex">
            <button type="button" className="tl-btn-primary" onClick={() => onWriteReview?.(d.trade)}>Write review</button>
            <button type="button" className="tl-btn-icon" aria-label="Edit trade" onClick={() => onEditTrade?.(d.trade)}><Icon name="pen" size={16} /></button>
            <details className="tl-actions-menu">
              <summary className="tl-btn-icon" aria-label="More actions"><Icon name="dots" /></summary>
              <button type="button" onClick={() => { if (window.confirm('Delete this trade?')) onDeleteTrade?.(d.trade); }}>Delete trade</button>
            </details>
          </div>
        </div>

        <div className="tl-head__bottom">
          <div>
            <div className={`tl-pnl ${d.isLoss ? '' : 'tl-pnl--win'}`}>{d.pnl}</div>
            <span className={`tl-pill tl-net-return ${d.isLoss ? 'tl-net-return--loss' : 'tl-net-return--win'}`}>{d.netReturn}</span>
          </div>
          <div className="tl-range">
            <div className="tl-range__labels"><span>Entry</span><span>Exit</span></div>
            <div className="tl-range__prices"><span>{d.entry}</span><span>{d.exit}</span></div>
            <div className="tl-range__line">
              <i className="tl-range__dot tl-range__dot--start" />
              <i className="tl-range__dot tl-range__dot--end" />
              <span className="tl-pill tl-range__held">Held {d.held}</span>
            </div>
            <div className="tl-meta" style={{ marginTop: 4 }}>{d.closed}</div>
          </div>
        </div>
      </header>

      <div className="tl-stats">
        {d.stats.map((s) => (
          <div className="tl-stat" key={s.label}>
            <span>{s.label}</span>
            <strong style={s.tone === 'loss' ? { color: 'var(--rd)' } : s.tone === 'profit' ? { color: 'var(--gr)' } : undefined}>{s.value}</strong>
            {s.sub && <span style={s.tone === 'loss' ? { color: 'var(--rd)' } : s.tone === 'profit' ? { color: 'var(--gr)' } : undefined}>{s.sub}</span>}
          </div>
        ))}
      </div>

      <div className="tl-two">
        <div className="tl-card">
          <h3>Execution</h3>
          {d.execution.slice(0, 2).map(([k, v]) => (
            <div className="tl-kv" key={k}><span>{k}</span><b>{v}</b></div>
          ))}
          <div className="tl-kv"><span>Rating</span><Stars value={d.rating} /></div>
          {d.execution.slice(2).map(([k, v]) => (
            <div className="tl-kv" key={k}><span>{k}</span><b>{v}</b></div>
          ))}
        </div>

        <div className="tl-card">
          <h3>By account</h3>
          {d.accounts.map((a) => (
            <div key={a.name}>
              <div className="tl-account"><span>{a.name}</span><b>{a.pnl}</b></div>
              <div className="tl-bar"><i style={{ width: `${a.share}%` }} /></div>
            </div>
          ))}
        </div>
      </div>

      <div className="tl-two tl-context-row">
        <div className="tl-card">
          <div className="tl-card__head"><h3>Confluences</h3><span className="tl-count">{d.confluences.length} logged</span></div>
          <div className="tl-chips">{d.confluences.map((c) => <span className="tl-chip" key={c}>{c}</span>)}</div>
        </div>
        <div className="tl-card">
          <div className="tl-card__head"><h3>Linked markup</h3><span className="tl-tag">{d.linkedMarkup ? 'Linked' : 'Not linked'}</span></div>
          {d.linkedMarkup && <p className="tl-linked-markup-name">{markupLabel(d.linkedMarkup)}</p>}
          <div className="tl-link"><select aria-label="Linked markup" value={linkValue} onChange={(event) => setLinkDrafts((current) => ({ ...current, [tradeId]: event.target.value }))}><option value="">No linked markup</option>{markups.map((m) => <option key={m.id} value={m.id}>{markupLabel(m)}</option>)}</select><button type="button" disabled={String(linkValue || '') === String(linkedMarkupId || '')} onClick={() => onLinkMarkup?.(d.trade, linkValue || null)}>Save link</button></div>
        </div>
      </div>

      <div className="tl-shots">
        <div className="tl-card tl-screenshot-card">
          <div className="tl-card__head">
            <h3>Screenshots</h3>
            <span className="tl-count">{d.screenshots.length} saved</span>
          </div>
          <div className={`tl-shot-grid tl-shot-grid--${Math.min(d.screenshots.length, 4)}`}>
            {d.screenshots.map((s, index) => (
              <div className="tl-shot" key={`${s.alt}-${index}`}>
                {s.src && (renderScreenshot ? renderScreenshot(s) : <img src={s.src} alt={s.alt} />)}
                <span className="tl-shot__tag">{s.tag}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="tl-card">
          <h3>Note</h3>
          <p className="tl-note">{d.note}</p>
        </div>
      </div>

    </section>
  );
}

/* ---------- Page ---------- */
export default function TradeLogs({ theme = 'light', trades = [], markups = [], renderScreenshot, onWriteReview, onEditTrade, onDeleteTrade, onLinkMarkup }) {
  const source = trades;
  const rows = Array.from(source.reduce((groups, trade) => {
        const date = String(trade.date || '');
        const monthKey = date.slice(0, 7) || 'unknown';
        if (!groups.has(monthKey)) groups.set(monthKey, []);
        groups.get(monthKey).push(trade);
        return groups;
      }, new Map()).entries()).map(([monthKey, monthTrades]) => {
        const total = monthTrades.reduce((sum, trade) => sum + Number(trade.pnl || 0), 0);
        const label = monthKey === 'unknown'
          ? 'Undated trades'
          : new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(new Date(`${monthKey}-01T00:00:00`));
        return {
          label,
          total: `${total < 0 ? '-' : '+'}$${Math.abs(total).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          trades: monthTrades.map(trade => ({ id: trade.id, pair: trade.asset || trade.pair, side: trade.direction || trade.side, when: trade.date ? `${trade.date} · ${trade.time || ''}` : trade.when, session: trade.entrySession || trade.session || '—', result: trade.rr ? `${Number(trade.rr).toFixed(2)}R` : '—', loss: Number(trade.pnl) < 0 }))
        };
      });
  const liveDetails = Object.fromEntries(source.map((trade) => {
    const pnl = Number(trade.pnl || 0);
    const results = trade.balanceResults || [];
    const grossPnl = results.length
      ? results.reduce((total, result) => total + Number(result.grossPnl ?? result.netPnl ?? 0), 0)
      : Number(trade.grossPnl ?? pnl);
    const costs = (Number(trade.commission) || 0) + (Number(trade.swap) || 0);
    const returnPct = Number(trade._return || 0);
    const signedMoney = (amount) => `${amount < 0 ? '-' : '+'}$${Math.abs(amount).toFixed(2)}`;
    const linkedMarkup = markups.find((markup) => String(markup.id) === String(trade.premarketMarkupId || '')) || null;
    return [trade.id, {
      pair: trade.asset || trade.pair,
      trade,
      side: trade.direction || trade.side,
      pnl: trade.pnl == null ? '—' : signedMoney(pnl),
      isLoss: pnl < 0,
      netReturn: `${returnPct.toFixed(2)}% net return`,
      entry: trade.entryPrice || '—', exit: trade.exitPrice || '—', held: trade.heldFor || '—',
      closed: trade.closeDate ? `Closed ${trade.closeDate} · ${trade.closeTime || ''}` : 'No closing time',
      stats: [
        { label: 'Gross P&L', value: signedMoney(grossPnl), sub: `${returnPct.toFixed(2)}%`, tone: grossPnl < 0 ? 'loss' : 'profit' },
        { label: 'Costs', value: `-$${costs.toFixed(2)}` },
        { label: 'Rules checked', value: `${(trade.ruleEvaluations || []).filter(item => item.checked).length}/${(trade.ruleEvaluations || []).length}` },
        { label: 'Held for', value: trade.heldFor || '—' }
      ],
      execution: [['Entry model', trade.entryType || '—'], ['Mood shift', `${trade.moodBefore || '—'} → ${trade.moodAfter || '—'}`], ['Mistakes', trade.mistakes?.length ? trade.mistakes.join(', ') : 'No mistakes logged']],
      rating: trade.rating || 0,
      accounts: results.map(item => ({ name: item.accountName || 'Account', pnl: signedMoney(Number(item.netPnl ?? item.grossPnl ?? 0)), share: 50 })),
      confluences: trade.confluence || trade.types || [], screenshots: trade.screenshots || [], note: trade.context || 'No trade note added.', linkedMarkup
    }];
  }));
  const [selectedId, setSelectedId] = useState(source[0]?.id || '');
  return (
    <div className="trade-logs" data-theme={theme}>
      <TradeList selectedId={selectedId} onSelect={setSelectedId} rows={rows} />
      <TradeDetail d={liveDetails[selectedId]} markups={markups} renderScreenshot={renderScreenshot} onWriteReview={onWriteReview} onEditTrade={onEditTrade} onDeleteTrade={onDeleteTrade} onLinkMarkup={onLinkMarkup} />
    </div>
  );
}
