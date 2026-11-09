import { useEffect, useMemo, useState } from "react";
import "./review.css";
import "./desktopReview.css";
import {useNavStep} from "./useBackNavigation.js";
import {useStepMotion} from "./MobilePageStage.jsx";
import {MOBILE_MEDIA} from "./mobileNavigation.js";
import MobilePeriodReviews from "./MobilePeriodReviews.jsx";

/* =====================================================================
   DATA CONTRACT. This component shows what you pass in; it never invents numbers.
   Any metric that is null or missing shows an empty state.

   reviews: array of
   {
     id, kind: "month" | "quarter" | "year", title, year,
     label: "Sep" | "Q3" | "2026",          // short name for cards
     name: "September",                     // month full name (month reviews)
     metrics: {
       // common
       netPnl: number | null,               // net of costs, from your journal
       returnPct: number, trades: number, reviewed: number, winRate: number,  // winRate is a percent
       profitFactor: string | null, avgR: string | null, process: string | null,
       activeDays: string | null,
       bestContext: { label, note } | null,

       // month
       wins, losses, grossProfit, costs, mistakes: number | null, moodShifts: string | null,
       bestTrade: { label, pnl } | null, worstTrade: { label, pnl } | null,
       entryModels: [{ name, trades, pnl }] | null,

       // quarter (also used by year for months)
       months: [{ id, name, returnPct, winRate, trades }],   // 3 for a quarter, 12 for a year
       rating: number | null, equity: [{ label, value }] | null, drawdown: string | null,

       // year
       wins, losses, startBalance, endBalance, maxDrawdown, grossProfit, costs,
       quarters: [{ id, label, returnPct, netPnl, winRate, trades, reviewed, rating }],
       bestEntryModels: [{ name, pnl }] | null, worstEntryModels: [{ name, pnl }] | null,
       commonMistakes: [string] | null
     }
   }

   answers: { [reviewId]: { [questionKey]: "saved text" } }    // your existing saved answers
   questions: see DEFAULT_QUESTIONS. Pass your real stored questions and keys here.
   onSave(reviewId, changedAnswers): Promise | void  // changedAnswers only has the edited keys.
   After it resolves, pass the updated `answers` back in.
   ===================================================================== */

export const DEFAULT_QUESTIONS = {
  glance: [
    { key: "glance0", label: "My performance" },
    { key: "glance1", label: "Invalid" },
    { key: "glance2", label: "Missed trades" },
    { key: "glance3", label: "Strategy performance" },
  ],
  technical: [
    { key: "technical0", label: "Winning trades", prompt: "Technical: What commonalities were present in my winning trades?" },
    { key: "technical1", label: "Losing trades", prompt: "Technical: What commonalities were present in my losing trades?" },
    { key: "technical2", label: "Rules to change", prompt: "Technical: Are there any strategy rules I need to tweak, add, or remove?" },
  ],
  sections: [
    { key: "mistakes", label: "Mistakes", prompt: "Mistakes: write your reflection…" },
    { key: "habits", label: "Habits", prompt: "Habits: write your reflection…" },
    { key: "markups", label: "Markups", prompt: "Markups: write your reflection…" },
    { key: "goals", label: "Goals", prompt: "Goals: write your reflection…" },
    { key: "overall", label: "Overall performance", prompt: "Overall performance: write your reflection…" },
  ],
};

/* ---------- formatting ---------- */
const has = (v) => v !== null && v !== undefined && v !== "";
const money = (n, signed) =>
  `${n < 0 ? "−" : signed ? "+" : ""}$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (v, signed = true) =>
  `${v < 0 ? "−" : signed ? "+" : ""}${Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
// Rates are a quick-scan metric. Keep them whole rather than exposing a
// floating-point calculation such as 56.28382938% in the review workspace.
const rate = (v) => `${Math.round(Number(v) || 0)}%`;
const short = (v) => {
  const a = Math.abs(v);
  return v === 0 ? "—" : `${v > 0 ? "+" : "−"}${a >= 1000 ? `${(a / 1000).toFixed(1)}k` : a.toFixed(a < 10 ? 1 : 0)}%`;
};
const sign = (v) => (v < 0 ? "rv-neg" : "rv-pos");
const statusOf = (m) => (!m.trades ? "none" : m.reviewed >= m.trades ? "done" : "need");
// An annual reflection should only be finalised once its year is effectively
// complete. Historical years stay editable, the current year opens in Q4, and
// future annual reports remain read-only until their own final quarter.
export const canSaveAnnualReview = (year, now = new Date()) => {
  const reviewYear = Number(year);
  const currentYear = now.getFullYear();
  if (!Number.isFinite(reviewYear)) return false;
  if (reviewYear < currentYear) return true;
  if (reviewYear > currentYear) return false;
  return now.getMonth() >= 9;
};
const winLoss = (m) => {
  const w = m.wins ?? Math.round(((m.winRate || 0) / 100) * m.trades);
  return [w, m.losses ?? Math.max(0, m.trades - w)];
};
const Icon = ({ d }) => <svg viewBox="0 0 24 24" aria-hidden="true"><path d={d} /></svg>;
const CHECK = "M5 12.5l4.5 4.5L19 7.5";
const BACK = "M15 6l-6 6 6 6";

function Pill({ metrics }) {
  const s = statusOf(metrics);
  return (
    <span className={`rv-pill rv-pill--${s}`}>
      {s === "done" && <Icon d={CHECK} />}
      {s === "done" ? "Done" : s === "need" ? "Needs review" : "No trades"}
    </span>
  );
}

function Ring({ value, size, stroke, children }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <span className="rv-ring" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--raised)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--accent)" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${c * value} ${c}`} />
      </svg>
      <span className="rv-ring-label">{children}</span>
    </span>
  );
}

function Empty({ children }) {
  return <div className="rv-empty">{children}</div>;
}
function KV({ k, v }) {
  return (
    <div className="rv-kv">
      <dt>{k}</dt>
      <dd className={has(v) ? undefined : "rv-mut"}>{has(v) ? v : "—"}</dd>
    </div>
  );
}
function WinLossBar({ wins, losses }) {
  return (
    <div className="rv-wlb" aria-hidden="true">
      <i style={{ flex: wins || 0 }} />
      <i style={{ flex: losses || 0 }} />
    </div>
  );
}
function EquityChart({ points }) {
  const w = 560, h = 220, left = 46, right = 16, top = 18, bottom = 30;
  const vals = points.map((p) => Number(p.value)).filter(Number.isFinite);
  const rawMin = Math.min(...vals);
  const rawMax = Math.max(...vals);
  const spread = Math.max(1, rawMax - rawMin);
  // The equity chart starts at the account's actual opening balance, not zero.
  // If equity later falls below that balance, retain the lower value so no
  // drawdown is clipped from the picture.
  const min = Math.min(rawMin, Number(points[0].value));
  const max = rawMax + spread * 0.08;
  const plotW = w - left - right;
  const plotH = h - top - bottom;
  const pointAt = (value, index) => ({
    x: left + (index / Math.max(1, points.length - 1)) * plotW,
    y: top + (1 - (Number(value) - min) / (max - min || 1)) * plotH,
  });
  const curve = points.map((p, i) => {
    const point = pointAt(p.value, i);
    return `${point.x.toFixed(1)},${point.y.toFixed(1)}`;
  }).join(" ");
  const first = pointAt(points[0].value, 0);
  const last = pointAt(points.at(-1).value, points.length - 1);
  const guideValues = [0, 1 / 3, 2 / 3, 1].map((fraction) => min + (max - min) * fraction);
  const compactMoney = (value) => Math.abs(value) >= 1000
    ? `$${Math.round(value / 1000)}K`
    : `$${Math.round(value)}`;
  const labelWidth = Math.max(82, money(points.at(-1).value).length * 7.4);
  const labelX = Math.max(left, Math.min(w - right - labelWidth, last.x - labelWidth - 8));
  const labelY = Math.max(4, Math.min(h - bottom - 24, last.y - 24));
  return (
    <svg className="rv-equity-chart" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img" aria-label="Equity curve">
      <defs>
        <linearGradient id="rv-equity-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="var(--focus)" stopOpacity="0.26" />
          <stop offset="1" stopColor="var(--focus)" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {guideValues.map((value) => {
        const y = pointAt(value, 0).y;
        return <g key={value}>
          <line className="rv-equity-grid" x1={left} x2={w - right} y1={y} y2={y} />
          <text className="rv-equity-axis" x={0} y={y + 4}>{compactMoney(value)}</text>
        </g>;
      })}
      <path d={`M ${first.x},${h - bottom} L ${curve.replace(/ /g, " L ")} L ${last.x},${h - bottom} Z`} fill="url(#rv-equity-fill)" />
      <polyline points={curve} className="rv-equity-line" fill="none" />
      <line className="rv-equity-last-guide" x1={last.x} x2={last.x} y1={last.y} y2={h - bottom} />
      <circle className="rv-equity-last-dot" cx={last.x} cy={last.y} r="5" />
      <g transform={`translate(${labelX}, ${labelY})`}>
        <rect className="rv-equity-label" width={labelWidth} height="24" rx="12" />
        <text className="rv-equity-label-text" x={labelWidth / 2} y="16" textAnchor="middle">{money(points.at(-1).value)}</text>
      </g>
      <text className="rv-equity-index" x={left} y={h - 6}>1</text>
      <text className="rv-equity-index" x={last.x} y={h - 6} textAnchor="end">{points.length}</text>
    </svg>
  );
}

// A condensed version of the equity graphic for a three-month review.  It is
// intentionally label-light: this panel is for the direction of the quarter,
// while the annual report keeps the full balance scale and endpoint value.
function QuarterTrendChart({ points }) {
  if (!points || points.length < 2) return <Empty>The equity curve needs closed trades or cash movements in this quarter.</Empty>;
  const w = 520, h = 168, padX = 26, top = 22, bottom = 28;
  const values = points.map((point) => Number(point.value)).filter(Number.isFinite);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const spread = Math.max(1, high - low);
  const min = low - spread * 0.1;
  const max = high + spread * 0.1;
  const pointAt = (value, index) => ({
    x: padX + (index / Math.max(1, points.length - 1)) * (w - padX * 2),
    y: top + (1 - (Number(value) - min) / (max - min || 1)) * (h - top - bottom),
  });
  const coords = points.map((point, index) => pointAt(point.value, index));
  const line = coords.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
  const first = coords[0];
  const last = coords.at(-1);
  return (
    <div className="rv-quarter-curve">
      <div className="rv-quarter-curve-label">Equity curve</div>
      <svg className="rv-quarter-curve-svg" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img" aria-label="Quarterly equity curve">
        {[.2, .5, .8].map((fraction) => <line key={fraction} className="rv-quarter-grid" x1={padX} x2={w - padX} y1={top + fraction * (h - top - bottom)} y2={top + fraction * (h - top - bottom)} />)}
        <path className="rv-quarter-area" d={`M ${first.x},${h - bottom} L ${line.replace(/ /g, " L ")} L ${last.x},${h - bottom} Z`} />
        <polyline className="rv-quarter-line" points={line} />
        <circle className="rv-quarter-dot" cx={last.x} cy={last.y} r="5" />
      </svg>
      <div className="rv-quarter-curve-ends"><span>Start</span><span>Now</span></div>
    </div>
  );
}

/* ---------- three card designs ---------- */
function YearCard({ review, selected, onSelect }) {
  const m = review.metrics;
  const frac = m.trades ? m.reviewed / m.trades : 0;
  return (
    <button type="button" className="rv-card rv-card--year" aria-pressed={selected} onClick={onSelect}>
      <Ring value={frac} size={92} stroke={8}>{Math.round(frac * 100)}%<small>reviewed</small></Ring>
      <span>
        <div className="rv-y-eyebrow">{review.year} ANNUAL</div>
        <div className={`rv-y-ret rv-num ${sign(m.returnPct)}`}>{pct(m.returnPct)}</div>
        <div className="rv-y-net rv-num">{has(m.netPnl) ? `${money(m.netPnl, true)} net` : "Net P&L —"}</div>
        <div className="rv-chips">
          <span className="rv-pill rv-pill--none">{m.trades} trades</span>
          <span className="rv-pill rv-pill--none">{rate(m.winRate)} win</span>
          <span className={`rv-pill rv-pill--${m.reviewed >= m.trades ? "done" : "need"}`}>{m.reviewed}/{m.trades} reviewed</span>
        </div>
      </span>
    </button>
  );
}

function QuarterCard({ review, selected, onSelect }) {
  const m = review.metrics;
  const months = m.months || [];
  const max = Math.max(1, ...months.map((x) => Math.abs(x.returnPct)));
  return (
    <button type="button" className="rv-card rv-card--quarter" aria-pressed={selected} onClick={onSelect}>
      <span className="rv-q-left">
        <span className="rv-q-head"><b>{review.label}</b><span className="rv-mut" style={{ fontSize: 12 }}>{review.year}</span><Pill metrics={m} /></span>
        <span className={`rv-q-ret rv-num ${sign(m.returnPct)}`}>{pct(m.returnPct)}</span>
        <span className="rv-q-foot">{has(m.netPnl) ? `${money(m.netPnl, true)} net · ` : ""}{rate(m.winRate)} win</span>
        <span className="rv-q-foot">{m.trades} trades · {m.reviewed}/{m.trades} reviewed</span>
      </span>
      <span className="rv-tri" aria-hidden="true">
        {months.map((x) => (
          <div key={x.id}>
            <i className={x.returnPct < 0 ? "rv-down" : undefined} style={{ height: `${Math.max(6, Math.sqrt(Math.abs(x.returnPct) / max) * 100)}%` }} />
            <span>{x.name.slice(0, 1)}</span>
          </div>
        ))}
      </span>
    </button>
  );
}

function MonthCard({ review, selected, onSelect }) {
  const m = review.metrics;
  const [w, l] = winLoss(m);
  return (
    <button type="button" className="rv-card rv-card--month" aria-pressed={selected} onClick={onSelect} disabled={!m.trades}>
      <span className="rv-mc-head">
        <b>{review.label}<small>{review.year}</small></b>
        {m.trades > 0 && <Pill metrics={m} />}
      </span>
      {m.trades ? (
        <>
          <span className={`rv-mc-ret rv-num ${sign(m.returnPct)}`}>{pct(m.returnPct)}</span>
          <span className="rv-mc-net rv-num">{has(m.netPnl) ? money(m.netPnl, true) : "net —"}</span>
          <span className="rv-wl" aria-hidden="true"><i style={{ flex: w }} /><i style={{ flex: l }} /></span>
          <span className="rv-mc-foot"><span>{rate(m.winRate)} win</span><span>{m.trades} trades</span></span>
        </>
      ) : (
        <span className="rv-mc-net">No trades</span>
      )}
    </button>
  );
}

/* ---------- desktop navigator tiles (aaicorefx-desktop-review.html) ---------- */
const STATUS_LABEL = { done: "Done", need: "Needs review", none: "No trades" };
function QuarterTile({ review, selected, related, onSelect }) {
  const m = review.metrics;
  const months = m.months || [];
  const max = Math.max(1, ...months.map((x) => Math.abs(x.returnPct)));
  const s = statusOf(m);
  return (
    <button type="button" className={`rv2-qt${related ? " is-related" : ""}`} aria-pressed={selected} onClick={onSelect}>
      <span className="rv2-qt-head"><b>{review.label}</b><span className={`rv2-st is-${s}`}>{STATUS_LABEL[s]}</span></span>
      <span className={`rv2-qt-ret rv-num ${m.trades ? sign(m.returnPct) : "rv-mut"}`}>{m.trades ? pct(m.returnPct) : "—"}</span>
      <span className="rv2-qt-sub rv-num">{m.trades ? `${m.trades} trades · ${m.reviewed}/${m.trades} reviewed` : "Nothing to review"}</span>
      <span className="rv2-mini" aria-hidden="true">{months.map((x) => (
        <span key={x.id}><i className={!x.trades ? "is-empty" : x.returnPct < 0 ? "is-neg" : "is-pos"} style={{ height: `${x.trades ? Math.max(8, Math.abs(x.returnPct) / max * 100) : 8}%` }} />{x.name.slice(0, 1)}</span>
      ))}</span>
    </button>
  );
}
function MonthTile({ review, selected, related, onSelect }) {
  const m = review.metrics;
  const s = statusOf(m);
  return (
    <button type="button" className={`rv2-mt ${!m.trades ? "is-empty" : m.returnPct < 0 ? "is-neg" : "is-pos"}${related ? " is-related" : ""}`} aria-pressed={selected} onClick={onSelect} disabled={!m.trades} title={`${review.name} ${review.year} · ${STATUS_LABEL[s]}`}>
      {m.trades > 0 && <i className={`rv2-dot is-${s}`} aria-hidden="true" />}
      <span>{review.label}</span>
      <b className="rv-num">{m.trades ? pct(m.returnPct) : "—"}</b>
    </button>
  );
}

/* ---------- field helpers shared by the three layouts ---------- */
function makeCtx(questions, val, set) {
  const used = new Set();
  const sectionKeys = new Set(questions.sections.map((section) => section.key));
  const field = (key, label, prompt, rows = 3) => (
    <div className="rv-field" key={key}>
      <label className="rv-label" htmlFor={`rv-${key}`}>{label}</label>
      <textarea id={`rv-${key}`} className="rv-ta" rows={rows} placeholder={prompt} aria-label={prompt || label} value={val(key)} onChange={(e) => set(key, e.target.value)} />
    </div>
  );
  const editorialLong = (key, label, prompt, rows = 4) => {
    if (sectionKeys.has(key)) used.add(key);
    return <div className="rv-editorial-field" key={key}>
      <label htmlFor={`rv-${key}`}>{label}</label>
      <textarea id={`rv-${key}`} rows={rows} placeholder={prompt || "Start writing…"} aria-label={prompt || label} value={val(key)} onChange={(e) => set(key, e.target.value)} />
    </div>;
  };
  return {
    val,
    use: (...keys) => keys.forEach((k) => used.add(k)),
    glance: () => questions.glance.map((g) => (
      <div className="rv-field" key={g.key}>
        <label className="rv-label" htmlFor={`rv-${g.key}`}>{g.label}</label>
        <input id={`rv-${g.key}`} className="rv-line" placeholder="Add a short read…" value={val(g.key)} onChange={(e) => set(g.key, e.target.value)} />
      </div>
    )),
    editorialShort: (key, label, prompt = "Add a short read…") => (
      <div className="rv-editorial-field rv-editorial-field--short" key={key}>
        <label htmlFor={`rv-${key}`}>{label}</label>
        <input id={`rv-${key}`} placeholder={prompt} value={val(key)} onChange={(e) => set(key, e.target.value)} />
      </div>
    ),
    editorialLong,
    technical: (rows = 3, useLabels = false) => questions.technical.map((t) => field(t.key, useLabels ? t.label : t.prompt, t.prompt, rows)),
    sec: (key, label, rows = 3) => {
      const q = questions.sections.find((s) => s.key === key);
      if (!q) return null;
      used.add(key);
      return field(q.key, label || q.label, q.prompt, rows);
    },
    leftover: () => {
      const rest = questions.sections.filter((s) => !used.has(s.key));
      return rest.length ? (
        <div className="rv-editorial rv-editorial--workbench" style={{ marginTop: 14 }}>
          <div className="rv-editorial-head">
            <h3><em>More</em>Questions</h3>
          </div>
          <div className="rv-editorial-columns rv-editorial-columns--two">
            {rest.map((s) => editorialLong(s.key, s.label, s.prompt || "Start writing…", 4))}
          </div>
        </div>
      ) : null;
    },
  };
}

/* ---------- weeks inside a month (Monday to Sunday, by trade date) ---------- */
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const WEEK_QUESTIONS = [
  ["wentWell", "What went well this week?"],
  ["fix", "What do I need to fix?"],
  ["focus", "What is my focus for next week?"],
];
export const weekKey = (number, field) => `week${number}_${field}`;
export function monthWeeks(year, monthIndex, rows = [], reviewedIds = [], returnBase = 0) {
  const last = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const reviewed = new Set(reviewedIds);
  const weeks = [];
  for (let start = 1; start <= last;) {
    const weekday = (new Date(Date.UTC(year, monthIndex, start)).getUTCDay() + 6) % 7;
    const end = Math.min(last, start + 6 - weekday);
    const trades = rows.filter((trade) => { const [y, m, d] = String(trade.date || "").split("-").map(Number); return y === year && m === monthIndex + 1 && d >= start && d <= end; });
    const net = trades.reduce((sum, trade) => sum + Number(trade.pnl || 0), 0);
    const wins = trades.filter((trade) => Number(trade.pnl) > 0).length;
    const losses = trades.filter((trade) => Number(trade.pnl) < 0).length;
    weeks.push({
      number: weeks.length + 1, start, end, weekday, trades, net, wins, losses,
      returnPct: returnBase ? net / returnBase * 100 : null,
      winRate: trades.length ? wins / trades.length * 100 : 0,
      avgR: trades.length ? trades.reduce((sum, trade) => sum + (Number(trade.rr) || 0), 0) / trades.length : null,
      reviewed: trades.filter((trade) => reviewed.has(trade.id)).length,
    });
    start = end + 1;
  }
  return weeks;
}
const signedR = (value) => `${value < 0 ? "−" : ""}${Math.abs(value).toFixed(2)}R`;
const weekTone = (week) => !week.trades.length ? "none" : week.net < 0 ? "neg" : "pos";

function WeekDetail({ review, week, ctx }) {
  const label = review.name.slice(0, 3);
  const range = week.start === week.end ? `${week.start} ${label}` : `${week.start} – ${week.end} ${label}`;
  if (!week.trades.length) return <div className="rv-pad"><div className="rv2-week-empty"><b>No trades in {range}</b>Nothing to review for this week. Pick a week with a coloured dot.</div></div>;
  const s = week.reviewed >= week.trades.length ? "done" : "need";
  const best = [...week.trades].sort((a, b) => Number(b.pnl) - Number(a.pnl))[0];
  const worst = [...week.trades].sort((a, b) => Number(a.pnl) - Number(b.pnl))[0];
  const activeDays = new Set(week.trades.map((trade) => trade.date)).size;
  const mistakes = week.trades.reduce((count, trade) => count + (trade.mistakes?.length || 0), 0);
  const moods = week.trades.filter((trade) => trade.moodBefore || trade.moodAfter);
  const moodShift = moods.length ? `${moods.filter((trade) => trade.moodBefore && trade.moodAfter && trade.moodBefore !== trade.moodAfter).length} of ${moods.length} changed` : null;
  const tradeLabel = (trade) => `${trade.asset || "Trade"} ${trade.direction || ""}`.trim();
  const written = WEEK_QUESTIONS.filter(([field]) => String(ctx.val(weekKey(week.number, field)) || "").trim()).length;
  const days = Array.from({ length: 7 }, (_, index) => {
    const day = week.start - week.weekday + index;
    const outside = day < week.start || day > week.end;
    const trades = outside ? [] : week.trades.filter((trade) => Number(String(trade.date).slice(8, 10)) === day);
    const net = trades.reduce((sum, trade) => sum + Number(trade.pnl || 0), 0);
    return { index, day, outside, trades, net };
  });
  const sorted = [...week.trades].sort((a, b) => `${a.date} ${a.time || ""}`.localeCompare(`${b.date} ${b.time || ""}`));
  return (
    <div className="rv-pad">
      <div className="rv-mh">
        <div><div className="rv-k">Weekly review · execution and discipline</div><h2>Week {week.number} · {range} {review.year}</h2></div>
        <span className={`rv-pill rv-pill--${s}`}>{s === "done" ? "Review complete" : `${week.trades.length - week.reviewed} trade${week.trades.length - week.reviewed === 1 ? "" : "s"} still need review`}</span>
      </div>
      <div className="rv-stats">
        <div className="rv-stat"><div className="rv-k">Net P&amp;L</div><div className={`rv-v ${sign(week.net)}`}>{money(week.net, true)}</div></div>
        <div className="rv-stat"><div className="rv-k">Return</div><div className={`rv-v ${has(week.returnPct) ? sign(week.returnPct) : "rv-mut"}`}>{has(week.returnPct) ? pct(week.returnPct) : "—"}</div></div>
        <div className="rv-stat"><div className="rv-k">Win rate</div><div className="rv-v">{rate(week.winRate)}</div></div>
        <div className="rv-stat"><div className="rv-k">Trades</div><div className="rv-v">{week.trades.length}</div></div>
        <div className="rv-stat"><div className="rv-k">Reviewed</div><div className="rv-v">{week.reviewed}/{week.trades.length}</div></div>
      </div>
      <div className="rv2-wgrid">
        <div className="rv-panel rv2-wdays">
          <h3>Days and trades<span>Mon – Sun · by trade date</span></h3>
          <div className="rv2-days">{days.map((day) => <div key={day.index} className={`rv2-day${day.outside ? " is-out" : day.trades.length ? (day.net < 0 ? " is-neg" : " is-pos") : ""}`}>
            <span className="rv2-day-n"><span>{WEEKDAYS[day.index]}</span><span>{day.outside ? "" : day.day}</span></span>
            {day.trades.length ? <span><b className="rv-num">{money(day.net, true)}</b><small>{day.trades.length} trade{day.trades.length === 1 ? "" : "s"}</small></span> : <span className="rv2-day-none">{day.outside ? "" : "—"}</span>}
          </div>)}</div>
          <div className="rv2-trades">{sorted.map((trade) => <div className="rv2-trade" key={trade.id}><span><i className={Number(trade.pnl) < 0 ? "is-neg" : "is-pos"} aria-hidden="true" />{tradeLabel(trade)} · {Number(String(trade.date).slice(8, 10))} {label}{trade.time ? ` ${trade.time}` : ""}{Number.isFinite(Number(trade.rr)) && trade.rr !== null && trade.rr !== "" ? ` · ${signedR(Number(trade.rr))}` : ""}</span><b className={`rv-num ${sign(Number(trade.pnl))}`}>{money(Number(trade.pnl), true)}</b></div>)}</div>
        </div>
        <div className="rv-panel rv2-wperf">
          <h3>Performance breakdown<span>{week.wins}W · {week.losses}L</span></h3>
          <WinLossBar wins={week.wins} losses={week.losses} />
          <dl className="rv-dl">
            <KV k="Average R" v={has(week.avgR) ? signedR(week.avgR) : null} />
            <KV k="Win rate" v={rate(week.winRate)} />
            <KV k="Net P&L" v={money(week.net, true)} />
            <KV k="Best trade" v={best && Number(best.pnl) > 0 ? `${tradeLabel(best)} · ${money(Number(best.pnl), true)}` : null} />
            <KV k="Worst trade" v={worst && Number(worst.pnl) < 0 ? `${tradeLabel(worst)} · ${money(Number(worst.pnl), true)}` : null} />
          </dl>
        </div>
        <div className="rv-panel rv2-wexec">
          <h3>Execution quality</h3>
          <dl className="rv-dl">
            <KV k="Process score" v={`${Math.round(week.reviewed / week.trades.length * 5)}/5`} />
            <KV k="Active days" v={`${activeDays} active day${activeDays === 1 ? "" : "s"}`} />
            <KV k="Mistakes logged" v={String(mistakes)} />
            <KV k="Mood shifts" v={moodShift} />
          </dl>
        </div>
        <div className="rv-editorial rv-editorial--workbench rv2-wform">
          <div className="rv-editorial-head">
            <h3><em>Reflection</em>Weekly improvement<small>{written} of {WEEK_QUESTIONS.length} sections written</small></h3>
            <span className="rv-editorial-steps" aria-label={`${written} of ${WEEK_QUESTIONS.length} weekly sections written`}>{WEEK_QUESTIONS.map((_, index) => <i key={index} className={index < written ? "is-done" : ""} />)}</span>
          </div>
          <div className="rv-editorial-columns rv2-wform-fields">
            {WEEK_QUESTIONS.map(([field, label]) => ctx.editorialLong(weekKey(week.number, field), label, "Start writing…", 4))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- monthly detail: overview, weeks, reflection ---------- */
function MonthDetail({ review, ctx, written, sectionCount }) {
  const m = review.metrics;
  const [w, l] = winLoss(m);
  const s = statusOf(m);
  const [tab, setTab] = useState("overview");
  const [year, month] = String(review.id.split(":")[1] || "").split("-").map(Number);
  const monthIndex = (month || 1) - 1;
  const weeks = useMemo(() => monthWeeks(year || review.year, monthIndex, m.tradeRows || [], m.reviewedIds || [], m.returnBase || 0), [year, review.year, monthIndex, m.tradeRows, m.reviewedIds, m.returnBase]);
  const label = review.name.slice(0, 3);
  const range = (week) => week.start === week.end ? `${week.start} ${label}` : `${week.start} – ${week.end} ${label}`;
  const openWeek = weeks.find((week) => `week${week.number}` === tab);
  const tabs = <div className="rv2-tabs" role="tablist" aria-label={`${review.name} review sections`}>
    {[["overview", "Overview"], ...weeks.map((week) => [`week${week.number}`, `Week ${week.number}`, week]), ["reflection", "Reflection"]].map(([id, text, week]) => <button type="button" role="tab" key={id} aria-selected={tab === id} className={tab === id ? "is-on" : ""} onClick={() => setTab(id)}>{week && <i className={`rv2-wdot is-${weekTone(week)}`} aria-hidden="true" />}{text}</button>)}
  </div>;
  if (openWeek) return <>{tabs}<WeekDetail review={review} week={openWeek} ctx={ctx} /></>;
  if (tab === "reflection") return <>{tabs}<div className="rv-pad">
    <div className="rv-editorial rv-editorial--workbench">
      <div className="rv-editorial-head">
        <h3><em>Reflection</em>Monthly improvement<small>{written} of {sectionCount} sections written</small></h3>
        <span className="rv-editorial-steps" aria-label={`${written} of ${sectionCount} reflection sections written`}>
          {Array.from({ length: 5 }, (_, index) => <i key={index} className={index < written ? "is-done" : ""} />)}
        </span>
      </div>
      <div className="rv-editorial-glance">
        {ctx.glance()}
      </div>
      <div className="rv-editorial-group">
        <span className="rv-editorial-kicker">Technical</span>
        <div className="rv-editorial-columns rv-editorial-columns--three">
          {ctx.editorialLong("technical0", "What commonalities were present in my winning trades?", "Start writing…", 4)}
          {ctx.editorialLong("technical1", "What commonalities were present in my losing trades?", "Start writing…", 4)}
          {ctx.editorialLong("technical2", "Are there any strategy rules I need to tweak, add, or remove?", "Start writing…", 4)}
        </div>
      </div>
      <div className="rv-editorial-group">
        <span className="rv-editorial-kicker">Mistakes · habits · markups</span>
        <div className="rv-editorial-columns rv-editorial-columns--three">
          {ctx.editorialLong("mistakes", "What mistakes did I make this month and what caused them?", "Start writing…", 4)}
          {ctx.editorialLong("habits", "How consistently did I follow my trading routine this month?", "Start writing…", 4)}
          {ctx.editorialLong("markups", "How accurate was my overall directional bias?", "Start writing…", 4)}
        </div>
      </div>
      <div className="rv-editorial-group">
        <span className="rv-editorial-kicker">Next month</span>
        <div className="rv-editorial-columns rv-editorial-columns--two">
          {ctx.editorialLong("goals", "What are my goals for next month?", "Start writing…", 4)}
          {ctx.editorialLong("overall", "What did I do well this month?", "Start writing…", 4)}
        </div>
      </div>
    </div>
    {ctx.leftover()}
  </div></>;
  return (
    <>{tabs}<div className="rv-pad">
      <div className="rv-mh">
        <div><div className="rv-k">Monthly review · execution and discipline</div><h2>{review.name} {review.year}</h2></div>
        <span className={`rv-pill rv-pill--${s}`}>{s === "done" ? "Review complete" : s === "need" ? `${m.trades - m.reviewed} trades still need review` : "No trades"}</span>
      </div>
      <div className="rv-stats">
        <div className="rv-stat"><div className="rv-k">Net P&amp;L</div><div className={`rv-v ${has(m.netPnl) ? sign(m.netPnl) : "rv-mut"}`}>{has(m.netPnl) ? money(m.netPnl, true) : "—"}</div></div>
        <div className="rv-stat"><div className="rv-k">Return</div><div className={`rv-v ${sign(m.returnPct)}`}>{pct(m.returnPct)}</div></div>
        <div className="rv-stat"><div className="rv-k">Win rate</div><div className="rv-v">{rate(m.winRate)}</div></div>
        <div className="rv-stat"><div className="rv-k">Trades</div><div className="rv-v">{m.trades}</div></div>
        <div className="rv-stat"><div className="rv-k">Reviewed</div><div className="rv-v">{m.reviewed}/{m.trades}</div></div>
      </div>

      <div className="rv-mwork">
        <div className="rv-col">
          <div className="rv-panel">
            <h3>Performance breakdown<span>{w}W · {l}L</span></h3>
            <WinLossBar wins={w} losses={l} />
            <dl className="rv-dl">
              <KV k="Average R" v={m.avgR} />
              <KV k="Profit factor" v={m.profitFactor} />
              <KV k="Gross profit" v={has(m.grossProfit) ? money(m.grossProfit, true) : null} />
              <KV k="Costs" v={has(m.costs) ? money(m.costs) : null} />
              <KV k="Best trade" v={m.bestTrade ? `${m.bestTrade.label} · ${money(m.bestTrade.pnl, true)}` : null} />
              <KV k="Worst trade" v={m.worstTrade ? `${m.worstTrade.label} · ${money(m.worstTrade.pnl, true)}` : null} />
            </dl>
          </div>
          <div className="rv-panel">
            <h3>Execution quality</h3>
            <dl className="rv-dl">
              <KV k="Process score" v={m.process} />
              <KV k="Active days" v={m.activeDays} />
              <KV k="Mistakes logged" v={has(m.mistakes) ? String(m.mistakes) : null} />
              <KV k="Mood shifts" v={m.moodShifts} />
            </dl>
            <div className="rv-k" style={{ margin: "12px 0 8px" }}>Entry-model performance</div>
            {m.entryModels && m.entryModels.length ? (
              <div className="rv-em">
                {m.entryModels.map((e) => (
                  <div key={e.name}>
                    <span>{e.name}<span className="rv-mut"> · {e.trades} trade{e.trades === 1 ? "" : "s"}</span></span>
                    <b className={sign(e.pnl)}>{money(e.pnl, true)}</b>
                  </div>
                ))}
              </div>
            ) : (
              <Empty>Entry-model results aren't available for this month yet.</Empty>
            )}
          </div>
        </div>

        <div className="rv-panel rv2-weeks">
          <h3>Weeks in {review.name}<span>Monday – Sunday · open a week</span></h3>
          {weeks.map((week) => <button type="button" key={week.number} className="rv2-wrow" onClick={() => setTab(`week${week.number}`)}>
            <span><b>Week {week.number}</b><small>{range(week)}</small></span>
            <span className="rv2-wrow-mid"><i className={`rv2-wdot is-${weekTone(week)}`} aria-hidden="true" />{week.trades.length ? `${week.trades.length} trade${week.trades.length === 1 ? "" : "s"} · ${rate(week.winRate)} win` : "No trades"}</span>
            <span className="rv2-wrow-end"><b className={`rv-num ${week.trades.length ? sign(week.net) : "rv-mut"}`}>{week.trades.length ? money(week.net, true) : "—"}</b>{week.trades.length > 0 && has(week.returnPct) && <small className="rv-num">{pct(week.returnPct)}</small>}</span>
          </button>)}
        </div>
      </div>
    </div></>
  );
}

/* ---------- quarterly detail: trend dashboard ---------- */
function QuarterDetail({ review, ctx, written, sectionCount }) {
  const m = review.metrics;
  const months = m.months || [];
  const live = months.filter((x) => x.trades > 0);
  const best = [...live].sort((a, b) => b.returnPct - a.returnPct)[0];
  const worst = [...live].sort((a, b) => a.returnPct - b.returnPct)[0];
  const max = Math.max(1, ...months.map((x) => Math.abs(x.returnPct)));
  const processScore = Number.parseInt(m.process, 10) || 0;
  return (
    <div className="rv-pad">
      <div className="rv-k" style={{ marginBottom: 8 }}>Quarterly review · trends and progress</div>
      <div className="rv-qband">
        <div><div className="rv-big">{review.label} {review.year}</div><div style={{ marginTop: 8 }}><Pill metrics={m} /></div></div>
        <div><div className="rv-k">Net P&amp;L</div><div className={`rv-v ${has(m.netPnl) ? sign(m.netPnl) : "rv-mut"}`}>{has(m.netPnl) ? money(m.netPnl, true) : "—"}</div></div>
        <div><div className="rv-k">Return</div><div className={`rv-v ${sign(m.returnPct)}`}>{pct(m.returnPct)}</div></div>
        <div><div className="rv-k">Win rate · trades</div><div className="rv-v">{rate(m.winRate)} · {m.trades}</div></div>
      </div>

      <div className="rv-panel" style={{ marginTop: 14 }}>
        <h3>Three-month comparison<span>Return, win rate and frequency by month</span></h3>
        <div className="rv-cmp">
          {months.map((x, i) => {
            const prev = i ? months[i - 1] : null;
            const up = prev ? x.returnPct >= prev.returnPct : null;
            const dw = prev ? Math.round(x.winRate - prev.winRate) : null;
            return (
              <div className="rv-cmp-col" key={x.id}>
                <h4>{x.name}{x === best && <span className="rv-badge rv-badge--good">Best</span>}{x === worst && x !== best && <span className="rv-badge rv-badge--bad">Weakest</span>}</h4>
                <div className="rv-cmp-bars" aria-hidden="true"><i className={x.returnPct < 0 ? "rv-down" : undefined} style={{ height: `${Math.max(5, Math.sqrt(Math.abs(x.returnPct) / max) * 100)}%` }} /></div>
                <div className={`rv-cmp-ret rv-num ${sign(x.returnPct)}`}>{pct(x.returnPct)}</div>
                <div className="rv-k">{rate(x.winRate)} win · {x.trades} trades</div>
                <div className={`rv-delta ${prev ? (up ? "rv-pos" : "rv-neg") : "rv-mut"}`}>
                  {prev ? `${up ? "▲ Improved" : "▼ Declined"} vs ${prev.name.slice(0, 3)}${dw ? ` · win ${dw > 0 ? "+" : ""}${dw} pts` : ""}` : "Quarter opener"}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rv-q2">
        <div className="rv-panel rv-quarter-trends">
          <h3>Quarterly performance trends</h3>
          <QuarterTrendChart points={m.equity} />
          <div className="rv-quarter-stat-row">
            <div><span>Payoff quality</span><strong>{m.profitFactor || "—"}</strong></div>
            <div><span>Average R</span><strong>{m.avgR || "—"}</strong></div>
            <div><span>Process score</span><strong>{m.process || "—"}</strong><i className="rv-process-dots" aria-label={`${processScore} of 5`}>
              {[1, 2, 3, 4, 5].map((value) => <b key={value} className={value <= processScore ? "is-on" : ""} />)}
            </i></div>
          </div>
          <div className="rv-quarter-stat-row rv-quarter-stat-row--bottom">
            <div><span>Drawdown</span><strong className={has(m.drawdown) ? "rv-neg" : "rv-mut"}>{has(m.drawdown) ? `−${Number(m.drawdown).toFixed(2)}%` : "—"}</strong><small>{has(m.drawdown) ? "Largest fall from a quarter high" : "Needs balance history"}</small></div>
            <div><span>Mistake frequency</span><strong>{has(m.mistakes) ? m.mistakes : "—"}<em>{has(m.mistakes) ? " logged" : ""}</em></strong></div>
          </div>
        </div>
        <div className="rv-panel">
          <h3>Quarterly evaluation</h3>
          <dl className="rv-dl">
            <KV k="Best month" v={best ? `${best.name} · ${pct(best.returnPct)}` : null} />
            <KV k="Weakest month" v={worst ? `${worst.name} · ${pct(worst.returnPct)}` : null} />
            <KV k="Best context" v={m.bestContext ? m.bestContext.label : null} />
            <KV k="Review depth" v={`${m.reviewed}/${m.trades}${has(m.rating) ? ` · avg rating ${m.rating}/5` : ""}`} />
          </dl>
          <div style={{ marginTop: 12 }}>{ctx.glance()}</div>
        </div>
      </div>

      <div className="rv-editorial rv-editorial--workbench" style={{ marginTop: 14 }}>
        <div className="rv-editorial-head">
          <h3><em>Reflection</em>Quarterly action plan<small>{written} of {sectionCount} sections written</small></h3>
          <span className="rv-editorial-steps" aria-label={`${written} of ${sectionCount} reflection sections written`}>
            {Array.from({ length: 5 }, (_, index) => <i key={index} className={index < written ? "is-done" : ""} />)}
          </span>
        </div>
        <div className="rv-editorial-group">
          <span className="rv-editorial-kicker">Action plan</span>
          <div className="rv-editorial-columns rv-editorial-columns--three">
            {ctx.editorialLong("goals", "What are my goals for next quarter?", "Start writing…", 4)}
            {ctx.editorialLong("habits", "Which habits will I keep or strengthen next quarter?", "Start writing…", 4)}
            {ctx.editorialLong("mistakes", "Which recurring mistakes will I address?", "Start writing…", 4)}
          </div>
        </div>
        <div className="rv-editorial-group">
          <span className="rv-editorial-kicker">Technical</span>
          <div className="rv-editorial-columns rv-editorial-columns--three">
            {ctx.editorialLong("technical0", "What commonalities were present in my winning trades?", "Start writing…", 4)}
            {ctx.editorialLong("technical1", "What commonalities were present in my losing trades?", "Start writing…", 4)}
            {ctx.editorialLong("technical2", "Are there any strategy rules I need to tweak, add, or remove?", "Start writing…", 4)}
          </div>
        </div>
        <div className="rv-editorial-group">
          <span className="rv-editorial-kicker">Markups · overall performance</span>
          <div className="rv-editorial-columns rv-editorial-columns--two">
            {ctx.editorialLong("markups", "How accurate were my markups and directional bias?", "Start writing…", 4)}
            {ctx.editorialLong("overall", "What did I do well across this quarter?", "Start writing…", 4)}
          </div>
        </div>
      </div>
      {ctx.leftover()}
    </div>
  );
}

/* ---------- annual detail: yearly performance report ---------- */
function YearDetail({ review, ctx, questions, written, sectionCount, onJump }) {
  const m = review.metrics;
  const months = m.months || [];
  const quarters = m.quarters || [];
  const frac = m.trades ? m.reviewed / m.trades : 0;
  const maxM = Math.max(1, ...months.map((x) => Math.abs(x.returnPct)));
  const live = [...quarters].filter((q) => q.trades > 0);
  const bq = [...live].sort((a, b) => b.returnPct - a.returnPct)[0];
  const wq = [...live].sort((a, b) => a.returnPct - b.returnPct)[0];
  const go = (id) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  const list = (arr) => (arr && arr.length ? arr.map((x) => `${x.name} ${money(x.pnl, true)}`).join(" · ") : null);
  return (
    <div>
      <div className="rv-ahero">
        <div>
          <div className="rv-aeyebrow">ANNUAL TRADING PERFORMANCE REPORT</div>
          <div className="rv-ayear">{review.year}</div>
          <div className="rv-ametrics">
            <div><div className="rv-k">Net P&amp;L</div><div className={`rv-v rv-xl rv-num ${has(m.netPnl) ? sign(m.netPnl) : "rv-mut"}`}>{has(m.netPnl) ? money(m.netPnl, true) : "—"}</div></div>
            <div><div className="rv-k">Return</div><div className={`rv-v rv-xl rv-num ${sign(m.returnPct)}`}>{pct(m.returnPct)}</div></div>
          </div>
          <div className="rv-ametrics">
            <div><div className="rv-k">Total trades</div><div className="rv-v">{m.trades}</div></div>
            <div><div className="rv-k">Win rate</div><div className="rv-v">{rate(m.winRate)}</div></div>
            <div><div className="rv-k">Starting balance</div><div className={`rv-v ${has(m.startBalance) ? "" : "rv-mut"}`}>{has(m.startBalance) ? money(m.startBalance) : "—"}</div></div>
            <div><div className="rv-k">Ending balance</div><div className={`rv-v ${has(m.endBalance) ? "" : "rv-mut"}`}>{has(m.endBalance) ? money(m.endBalance) : "—"}</div></div>
          </div>
        </div>
        <Ring value={frac} size={110} stroke={10}>{Math.round(frac * 100)}%<small>reviewed</small></Ring>
      </div>

      <nav className="rv-toc" aria-label="Report sections">
        {[["a1", "Performance"], ["a2", "Months"], ["a3", "Quarters"], ["a4", "Execution"], ["a5", "Reflection"], ["a6", "Next year"]].map(([id, label], i) => (
          <button key={id} type="button" onClick={() => go(`rv-${id}`)}>0{i + 1} {label}</button>
        ))}
      </nav>

      <section className="rv-sec" id="rv-a1" style={{ scrollMarginTop: 110 }}>
        <h3><em>01</em>Equity and performance</h3>
        <div className="rv-eq">
          <div className="rv-panel"><h3>Equity growth</h3>{m.equity && m.equity.length > 1 ? <EquityChart points={m.equity} /> : <Empty>The equity curve needs your account balance history.</Empty>}</div>
          <div className="rv-panel">
            <h3>Key figures</h3>
            <dl className="rv-dl">
              <KV k="Net profit" v={has(m.netPnl) ? money(m.netPnl, true) : null} />
              <KV k="Profit factor" v={m.profitFactor} />
              <KV k="Average R" v={m.avgR} />
              <KV k="Maximum drawdown" v={has(m.maxDrawdown) ? `${Number(m.maxDrawdown) > 0 ? "−" : ""}${Math.abs(Number(m.maxDrawdown)).toFixed(2)}%` : null} />
              <KV k="Gross profit" v={has(m.grossProfit) ? money(m.grossProfit, true) : null} />
              <KV k="Total trading costs" v={has(m.costs) ? money(m.costs) : null} />
            </dl>
          </div>
        </div>
      </section>

      <section className="rv-sec" id="rv-a2" style={{ scrollMarginTop: 110 }}>
        <h3><em>02</em>Twelve months<small>Click a month to open its review</small></h3>
        <div className="rv-heat">
          {months.map((x) => {
            const a = x.trades ? 0.15 + 0.85 * Math.sqrt(Math.abs(x.returnPct) / maxM) : 0;
            const bg = x.trades ? `color-mix(in srgb, ${x.returnPct < 0 ? "var(--loss)" : "var(--profit)"} ${Math.round(a * 100)}%, var(--surface))` : "var(--raised)";
            return (
              <button key={x.id} type="button" style={{ background: bg, color: "var(--text)" }} disabled={!x.trades} aria-label={`${x.name} ${pct(x.returnPct)}`} onClick={() => onJump(x.id)}>
                <b>{x.name.slice(0, 3)}</b><span>{x.trades ? short(x.returnPct) : "—"}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="rv-sec" id="rv-a3" style={{ scrollMarginTop: 110 }}>
        <h3><em>03</em>Quarterly breakdown</h3>
        <div className="rv-q4">
          {quarters.map((q) => (
            <div key={q.id}>
              <div className="rv-k">{q.label}{q === bq && <span className="rv-badge rv-badge--good">Best</span>}{q === wq && q !== bq && <span className="rv-badge rv-badge--bad">Weakest</span>}</div>
              <div className={`rv-v rv-num ${sign(q.returnPct)}`}>{pct(q.returnPct)}</div>
              {has(q.netPnl) && <div className={`rv-num ${sign(q.netPnl)}`} style={{ fontSize: 12 }}>{money(q.netPnl, true)}</div>}
              <div className="rv-mut" style={{ fontSize: 12 }}>{rate(q.winRate)} win · {q.trades} trades</div>
              <div className="rv-mut" style={{ fontSize: 12 }}>{q.reviewed}/{q.trades} reviewed{has(q.rating) ? ` · ${q.rating}/5` : ""}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="rv-sec" id="rv-a4" style={{ scrollMarginTop: 110 }}>
        <h3><em>04</em>Strategy and execution</h3>
        <div className="rv-eq rv-eq--even">
          <div className="rv-panel">
            <h3>Strategy</h3>
            <dl className="rv-dl">
              <KV k="Best context" v={m.bestContext ? `${m.bestContext.label} · ${m.bestContext.note}` : null} />
              <KV k="Best entry models" v={list(m.bestEntryModels)} />
              <KV k="Worst entry models" v={list(m.worstEntryModels)} />
            </dl>
          </div>
          <div className="rv-panel">
            <h3>Discipline</h3>
            <dl className="rv-dl">
              <KV k="Process score" v={m.process} />
              <KV k="Active days" v={m.activeDays} />
              <KV k="Review depth" v={`${m.reviewed}/${m.trades}`} />
              <KV k="Common mistakes" v={m.commonMistakes && m.commonMistakes.length ? m.commonMistakes.join(", ") : null} />
              <KV k="Mood-shift patterns" v={m.moodShifts} />
            </dl>
          </div>
        </div>
      </section>

      <section className="rv-sec" id="rv-a5" style={{ scrollMarginTop: 110 }}>
        <div className="rv-editorial">
          <div className="rv-editorial-head">
            <h3><em>05</em>Annual reflection<small>{written} of {sectionCount} sections written</small></h3>
            <span className="rv-editorial-steps" aria-label={`${written} of ${sectionCount} reflection sections written`}>
              {Array.from({ length: 5 }, (_, index) => <i key={index} className={index < written ? "is-done" : ""} />)}
            </span>
          </div>
          <div className="rv-editorial-glance">
            {questions.glance.map((question) => ctx.editorialShort(question.key, question.label))}
          </div>
          <div className="rv-editorial-group">
            <span className="rv-editorial-kicker">Technical</span>
            <div className="rv-editorial-columns rv-editorial-columns--three">
              {questions.technical.map((question) => ctx.editorialLong(question.key, question.prompt, "Start writing…", 4))}
            </div>
          </div>
          <div className="rv-editorial-group">
            <span className="rv-editorial-kicker">Mistakes · habits · markups</span>
            <div className="rv-editorial-columns rv-editorial-columns--three">
              {ctx.editorialLong("mistakes", "What mistakes did I make this period and what caused them?", "Start writing…", 4)}
              {ctx.editorialLong("habits", "How consistently did I follow my trading routine this period?", "Start writing…", 4)}
              {ctx.editorialLong("markups", "How accurate was my overall directional bias?", "Start writing…", 4)}
            </div>
          </div>
        </div>
      </section>

      <section className="rv-sec" id="rv-a6" style={{ scrollMarginTop: 110 }}>
        <div className="rv-editorial rv-editorial--planning">
          <h3><em>06</em>Next-year planning</h3>
          <div className="rv-editorial-columns rv-editorial-columns--two">
            {ctx.editorialLong("goals", "Did I complete the goals I set for this period? Why or why not?", "Start writing…", 4)}
            {ctx.editorialLong("overall", "What did I do well this period?", "Start writing…", 4)}
          </div>
        </div>
      </section>
    </div>
  );
}

/* ---------- page ---------- */
export default function ReviewPage({ reviews, answers = {}, questions = DEFAULT_QUESTIONS, onSave, defaultSelectedId, phoneControls, onPhoneTitle, onReviewTrades }) {
  const [phone, setPhone] = useState(() => window.matchMedia(MOBILE_MEDIA).matches);
  useEffect(() => { const media = window.matchMedia(MOBILE_MEDIA), change = () => setPhone(media.matches); media.addEventListener("change", change); return () => media.removeEventListener("change", change); }, []);
  const years = reviews.filter((r) => r.kind === "year");
  const quarters = reviews.filter((r) => r.kind === "quarter");
  const months = reviews.filter((r) => r.kind === "month");
  const byId = useMemo(() => Object.fromEntries(reviews.map((r) => [r.id, r])), [reviews]);

  const [selId, setSelId] = useState(defaultSelectedId ?? (years[0] || quarters[0] || months.find((m) => m.metrics.trades) || reviews[0])?.id);
  const [drafts, setDrafts] = useState({});
  const [pending, setPending] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  useNavStep('review-detail', showDetail, () => setShowDetail(false));
  useStepMotion(showDetail ? 1 : 0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const review = byId[selId];
  const annualSaveLocked = review?.kind === "year" && !canSaveAnnualReview(review.year);

  // The parent changes the available review IDs when the user changes year or
  // account scope. Never leave the detail pane pointing to the prior scope.
  useEffect(() => {
    if (!byId[selId]) setSelId(defaultSelectedId ?? reviews[0]?.id);
  }, [byId, defaultSelectedId, reviews, selId]);
  const dirty = Object.keys(drafts).length > 0;
  const saved = (key) => answers[selId]?.[key] ?? "";
  const val = (key) => (drafts[key] !== undefined ? drafts[key] : saved(key));
  const set = (key, text) =>
    setDrafts((d) => {
      const next = { ...d };
      if (text === saved(key)) delete next[key];
      else next[key] = text;
      return next;
    });

  const sectionKeys = [questions.technical.map((t) => t.key), ...questions.sections.map((s) => [s.key])];
  const written = sectionKeys.filter((keys) => keys.some((k) => val(k).trim())).length;
  const ctx = makeCtx(questions, val, set);

  const goTo = (id) => { setSelId(id); setDrafts({}); setPending(null); setShowDetail(true); setError(""); window.scrollTo?.({ top: 0 }); };
  const select = (id) => {
    if (id === selId) { setShowDetail(true); return; }
    if (dirty) { setPending(id); return; }
    goTo(id);
  };
  const doSave = async () => {
    if (annualSaveLocked) return false;
    setSaving(true); setError("");
    try { await onSave?.(selId, drafts); setDrafts({}); return true; }
    catch (e) { setError("Could not save. Your edits are still here."); return false; }
    finally { setSaving(false); }
  };

  const Card = { year: YearCard, quarter: QuarterCard, month: MonthCard };
  const renderCard = (r) => {
    const C = Card[r.kind];
    return <C key={r.id} review={r} selected={r.id === selId} onSelect={() => select(r.id)} />;
  };
  // Keep a quarter and its calendar months together in the navigator. The
  // quarter model owns the three constituent month IDs, which avoids relying
  // on display labels or the order records happened to arrive in.
  const quarterGroups = quarters.map((quarter) => ({
    quarter,
    months: (quarter.metrics?.months || []).map((month) => byId[month.id]).filter(Boolean),
  }));
  const groupedMonthIds = new Set(quarterGroups.flatMap((group) => group.months.map((month) => month.id)));
  const ungroupedMonths = months.filter((month) => !groupedMonthIds.has(month.id));

  if (!review) return <div className="rv"><Empty>No reviews yet.</Empty></div>;

  const switchNotice = pending && (
    <div className="rv-guard" role="alert">
      <span>You have unsaved changes in {review.title}. Switch to {byId[pending].title}?</span>
      <span className="rv-bar-group">
        <button type="button" className="rv-btn rv-btn--primary" onClick={async () => { if (await doSave()) goTo(pending); }}>Save and switch</button>
        <button type="button" className="rv-btn" onClick={() => goTo(pending)}>Discard and switch</button>
        <button type="button" className="rv-btn" onClick={() => setPending(null)}>Keep editing</button>
      </span>
    </div>
  );
  if (phone) return <MobilePeriodReviews showDetail={showDetail} review={review} years={years} quarterGroups={quarterGroups} questions={questions} val={val} set={set} written={written} sectionCount={sectionKeys.length} onOpen={select} onReviewTrades={onReviewTrades} onCancel={() => setDrafts({})} onSave={doSave} dirty={dirty} saving={saving} saveLocked={annualSaveLocked} error={error} pendingNotice={switchNotice} controls={phoneControls} onPhoneTitle={onPhoneTitle} h={{money, pct, has, rate, short, winLoss, statusOf, tone:sign, EquityChart, QuarterTrendChart}}/>;

  return (
    <div className="rv">
      <div className={`rv-md${showDetail ? " rv-md--detail" : ""}`}>
        <nav className="rv-list rv2-nav" aria-label="Reviews">
          {years.length > 0 && <div><div className="rv2-nl">Annual</div>{years.map(renderCard)}</div>}
          {quarters.length > 0 && <div><div className="rv2-nl">Quarters</div><div className="rv2-qg">{quarterGroups.map(({ quarter, months: quarterMonths }) => <QuarterTile key={quarter.id} review={quarter} selected={quarter.id === selId} related={review.kind === "month" && quarterMonths.some((month) => month.id === selId)} onSelect={() => select(quarter.id)} />)}</div></div>}
          {months.length > 0 && <div><div className="rv2-nl">Months<em>Click a month to open its review</em></div><div className="rv2-mg">{months.map((month) => { const group = quarterGroups.find((item) => item.months.some((entry) => entry.id === month.id)); const related = month.id !== selId && !!group && (group.quarter.id === selId || (review.kind === "month" && group.months.some((entry) => entry.id === selId))); return <MonthTile key={month.id} review={month} selected={month.id === selId} related={related} onSelect={() => select(month.id)} />; })}</div></div>}
        </nav>

        <section className="rv-detail" key={selId} aria-live="polite">
          <div className="rv-bar">
            <div className="rv-bar-group">
              <button type="button" className="rv-btn rv-back" onClick={() => setShowDetail(false)}><Icon d={BACK} /> Reviews</button>
              <b>{review.title}</b>
            </div>
            <div className="rv-bar-group">
              <span className={`rv-save-state${dirty ? " rv-save-state--dirty" : ""}`}>{error || (annualSaveLocked ? "Annual review unlocks in Q4" : dirty ? "Unsaved changes" : "All changes saved")}</span>
              <button type="button" className="rv-btn" disabled={!dirty || saving} onClick={() => setDrafts({})}>Cancel</button>
              <button type="button" className="rv-btn rv-btn--primary" disabled={!dirty || saving || annualSaveLocked} onClick={doSave}>{saving ? "Saving…" : "Save review"}</button>
            </div>
          </div>

          {switchNotice}

          {review.kind === "month" && <MonthDetail review={review} ctx={ctx} written={written} sectionCount={sectionKeys.length} />}
          {review.kind === "quarter" && <QuarterDetail review={review} ctx={ctx} written={written} sectionCount={sectionKeys.length} />}
          {review.kind === "year" && <YearDetail review={review} ctx={ctx} questions={questions} written={written} sectionCount={sectionKeys.length} onJump={select} />}
        </section>
      </div>
    </div>
  );
}
