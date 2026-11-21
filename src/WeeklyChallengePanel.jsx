import React, { useState } from 'react';
import { ChevronDown, Trophy } from 'lucide-react';
import './weeklyChallenge.css';

const word = count => `${Math.abs(count)} ${Math.abs(count) === 1 ? 'level' : 'levels'}`;
const place = (value, low, span) => Math.round((value - low) / span * 100);

// One challenge, one track: last week's starting level, this week's starting level, and where it stands now.
function WeekTrack({ row }) {
  const known = [row.last, row.start, row.now].filter(value => value != null);
  const low = Math.min(...known) - 1, span = Math.max(...known) + 1 - low;
  const lastAt = row.last == null ? null : place(row.last, low, span), startAt = place(row.start, low, span), nowAt = place(row.now, low, span);
  const tone = row.delta > 0 ? 'is-up' : row.delta < 0 ? 'is-down' : 'is-flat';
  const near = Math.abs(nowAt - startAt) < 16, right = nowAt >= startAt;
  const change = row.delta > 0 ? `+${word(row.delta)}` : row.delta < 0 ? `-${word(row.delta)}` : 'Holding';
  return <article className={`tj-wk-card ${tone}`}>
    <header>
      <span className="tj-wk-icon" aria-hidden="true"><Trophy size={15}/></span>
      <span className="tj-wk-name"><strong>{row.name}</strong><small>{row.mode}</small></span>
      <b className="tj-wk-change">{change}</b>
    </header>
    <div className="tj-wk-track" role="img" aria-label={`${row.name}: ${row.last != null ? `level ${row.last} a week ago, ` : ''}level ${row.start} at the start of the week, level ${row.now} now`}>
      <i className="tj-wk-rail"/>
      {lastAt != null && <i className="tj-wk-past" style={{ left: `${lastAt}%`, width: `${Math.max(0, startAt - lastAt)}%` }}/>}
      <i className="tj-wk-fill" style={{ left: `${Math.min(startAt, nowAt)}%`, width: `${Math.abs(nowAt - startAt)}%` }}/>
      {lastAt != null && <><i className="tj-wk-dot is-last" style={{ left: `${lastAt}%` }}/><span className="tj-wk-tag is-last" style={{ left: `${lastAt}%` }}>L{row.last}</span></>}
      <i className="tj-wk-dot is-start" style={{ left: `${startAt}%` }}/>
      <span className="tj-wk-tag is-start" style={{ left: `${startAt}%`, transform: `translateX(${near ? (right ? '-100%' : '0%') : '-50%'})` }}>L{row.start}</span>
      <i className={`tj-wk-dot is-now ${row.delta === 0 ? '' : 'is-live'}`} style={{ left: `${nowAt}%` }}/>
      <span className="tj-wk-tag is-now" style={{ left: `${nowAt}%`, transform: `translateX(${near ? (right ? '0%' : '-100%') : '-50%'})` }}>Now L{row.now}</span>
    </div>
    <footer>
      <span>{row.last == null ? (row.startedThisWeek ? 'Started this week' : 'Last week: not started') : `Last week ${row.last} → ${row.start}`}</span>
      <span>This week {row.start} → {row.now}</span>
    </footer>
  </article>;
}

// weekly = { rows, label, firstOfWeek, lastTotal }. Two challenges show; the rest scroll inside the panel.
export default function WeeklyChallengePanel({ weekly }) {
  const [more, setMore] = useState(false);
  const rows = weekly?.rows || [];
  if (!rows.length) return null;
  const shown = more ? rows : rows.slice(0, 2);
  const known = rows.some(row => row.lastDelta != null);
  const total = weekly.lastTotal;
  const lookBack = !known ? 'Here is where each challenge begins today.'
    : total > 0 ? `Last week you moved up ${word(total)} across your challenges. Here is where each one begins today.`
    : total < 0 ? `Last week stepped back ${word(total)}. A new week is a clean slate.`
    : 'Last week held steady. Here is where each challenge begins today.';
  return <aside className="tj-wk" aria-label="Weekly challenge progress">
    <header className="tj-wk-head"><small>Your week</small><span>{weekly.label}</span></header>
    {weekly.firstOfWeek && <div className="tj-wk-new"><strong>New week. Fresh start.</strong><p>{lookBack}</p></div>}
    <div className="tj-wk-list">
      {shown.map(row => <WeekTrack key={row.id} row={row}/>)}
      {rows.length > 2 && <button type="button" className="tj-wk-more" aria-expanded={more} onClick={() => setMore(value => !value)}>{more ? 'Show fewer' : `Show ${rows.length - 2} more`}<ChevronDown size={15} className={more ? 'is-open' : ''} aria-hidden="true"/></button>}
    </div>
  </aside>;
}
