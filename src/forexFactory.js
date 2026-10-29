// Economic calendar data is retrieved through the Supabase Edge Function.
// That keeps the ForexFactory export and its cache on the server rather than
// relying on an in-browser CORS proxy. The browser cache is only an offline
// convenience layer; the server cache is the shared source of truth.
import { NEWS_ARCHIVE_KEY, newsWeekKey, readNewsArchive, mergeNewsWeek } from "./newsArchive.js";
const FEED_URLS = {
  "-1": "https://nfs.faireconomy.media/ff_calendar_lastweek.json",
  "0": "https://nfs.faireconomy.media/ff_calendar_thisweek.json",
  "1": "https://nfs.faireconomy.media/ff_calendar_nextweek.json",
};

const CLIENT_CACHE_TTL_MS = 5 * 60 * 1000;
async function calendarFetch(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try { return await fetch(url, {...options,signal:controller.signal}); }
  finally { clearTimeout(timeout); }
}

export function normalizeEvents(raw) {
  return raw.map((e) => {
    const d = new Date(e.date);
    return {
      dateKey: d.toDateString(),
      isoDate: d.toISOString(),
      time: d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
      currency: e.country,
      impact: (e.impact || "").toLowerCase(), // 'high' | 'medium' | 'low' | 'holiday'
      title: e.title,
      forecast: e.forecast || "—",
      previous: e.previous || "—",
      actual: e.actual ?? "—",
      description: typeof e.description === "string" ? e.description : "",
    };
  });
}

async function fetchLive(url) {
  const res = await calendarFetch(url, { mode: "cors" });
  if (!res.ok) throw new Error("bad status " + res.status);
  return normalizeEvents(await res.json());
}

async function fetchFromCalendarFunction(offset, { force = false } = {}) {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/economic-calendar?weekOffset=${encodeURIComponent(offset)}${force ? "&refresh=1" : ""}`;
  const response = await calendarFetch(url, {
    headers: {
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.events) throw new Error(data?.error || "Calendar function returned no events.");
  return { events: normalizeEvents(data.events), source: data.source || "live", fetchedAt: data.fetchedAt || Date.now() };
}

/**
 * Get calendar events for a given week offset (-1 = last week, 0 = this
 * week, 1 = next week — those are the only three the feed provides).
 * Returns { events, source, fetchedAt } where source is one of
 * 'live' | 'cache' | 'stale-cache' | 'unavailable'. No mock calendar data is
 * returned here: an unavailable source stays visibly unavailable in the UI.
 */
async function loadCalendarWeek(offset, { force = false } = {}) {
  const weekKey = newsWeekKey(offset);
  const key = `ff-cache:${weekKey}`;
  let cache = null;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw) cache = JSON.parse(raw);
    if (!cache) cache = readNewsArchive(window.localStorage)[weekKey] || null;
    if (!cache) {
      const legacy = JSON.parse(window.localStorage.getItem(`ff-cache:${offset}`) || "null");
      if (legacy && newsWeekKey(offset,new Date(legacy.fetchedAt)) === weekKey) cache = legacy;
    }
  } catch (e) { /* no cache yet */ }

  const now = Date.now();
  const save = (result) => {
    let archiveSaved = true;
    try {
      window.localStorage.setItem(key, JSON.stringify(result));
      window.localStorage.setItem(NEWS_ARCHIVE_KEY, JSON.stringify(mergeNewsWeek(readNewsArchive(window.localStorage),weekKey,result)));
    } catch { archiveSaved = false; }
    return {...result,weekKey,archiveSaved};
  };
  const cachedAt = typeof cache?.fetchedAt === "number" ? cache.fetchedAt : Date.parse(cache?.fetchedAt) || 0;
  if (!force && cache && now - cachedAt < CLIENT_CACHE_TTL_MS) {
    return save({ events: cache.events, source: "cache", fetchedAt: cache.fetchedAt });
  }

  // Once a release time has passed, prefer a direct fresh export when the
  // browser permits it. This avoids showing a stale placeholder while a
  // deployed service cache is still within its normal retention window.
  if (force) {
    try {
      const events = await fetchLive(FEED_URLS[String(offset)]);
      return save({ events, source: "live", fetchedAt: now });
    } catch { /* Fall through to the service, which may still be fresher. */ }
  }

  try {
    const result = await fetchFromCalendarFunction(offset, { force });
    // A server offset cache from an earlier calendar week must not be
    // relabelled as this week's snapshot after rollover.
    if (result.fetchedAt && newsWeekKey(offset,new Date(result.fetchedAt)) !== weekKey) throw new Error("Calendar snapshot belongs to an earlier week.");
    const events = result.events;
    return save({ events, source: result.source, fetchedAt: result.fetchedAt });
  } catch (e) {
    // The direct export is a development-only rescue path until the function
    // is deployed. It has no proxy and is never treated as the primary source.
    const url = FEED_URLS[String(offset)];
    try {
      if (!url) throw new Error("Unknown calendar week.");
      const events = await fetchLive(url);
      return save({ events, source: "live", fetchedAt: now });
    } catch (directError) {
      if (cache) return save({ events: cache.events, source: "stale-cache", fetchedAt: cache.fetchedAt });
      return { events: null, source: "unavailable", fetchedAt: null, weekKey };
    }
  }
}

const pendingCalendarWeeks = new Map();
export function getCalendarWeek(offset, { force = false } = {}) {
  const key = newsWeekKey(offset);
  if (force) return loadCalendarWeek(offset, { force: true });
  if (pendingCalendarWeeks.has(key)) return pendingCalendarWeeks.get(key);
  const pending = loadCalendarWeek(offset).finally(()=>pendingCalendarWeeks.delete(key));
  pendingCalendarWeeks.set(key,pending);
  return pending;
}

export async function getCalendarWindow(onProgress, { force = false } = {}) {
  // Import previous relative snapshots using their original retrieval date.
  try {
    let archive = readNewsArchive(window.localStorage);
    for (const offset of [-1,0,1]) {
      const legacy = JSON.parse(window.localStorage.getItem(`ff-cache:${offset}`) || "null");
      if (legacy?.fetchedAt && Array.isArray(legacy.events)) archive = mergeNewsWeek(archive,newsWeekKey(offset,new Date(legacy.fetchedAt)),{...legacy,source:"cache"});
    }
    window.localStorage.setItem(NEWS_ARCHIVE_KEY,JSON.stringify(archive));
  } catch { /* Loaded weeks remain available for this session. */ }
  const completed = [];
  const results = await Promise.all([-1,0,1].map(async (offset) => {
    const result = await getCalendarWeek(offset, { force });
    completed.push(result);
    let available = {};
    try { available = readNewsArchive(window.localStorage); } catch {}
    completed.forEach((week) => {available = mergeNewsWeek(available,week.weekKey,week);});
    onProgress?.({archive:available,results:[...completed],archiveSaved:completed.every((week) => week.archiveSaved !== false)});
    return result;
  }));
  let archive = {};
  try { archive = readNewsArchive(window.localStorage); } catch {}
  results.forEach((result) => {archive = mergeNewsWeek(archive,result.weekKey,result);});
  return {archive,results,archiveSaved:results.every((result) => result.archiveSaved !== false)};
}
