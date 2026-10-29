export const NEWS_ARCHIVE_KEY = "tj:news-week-archive:v1";
export function newsWeekKey(offset = 0, now = new Date()) {
  const date = new Date(now);
  date.setHours(0,0,0,0);
  date.setDate(date.getDate() - date.getDay() + offset * 7);
  return [date.getFullYear(),String(date.getMonth()+1).padStart(2,"0"),String(date.getDate()).padStart(2,"0")].join("-");
}
export function readNewsArchive(storage) {
  try {
    const raw = JSON.parse(storage.getItem(NEWS_ARCHIVE_KEY)) || {};
    return Object.fromEntries(Object.entries(raw).filter(([key,value]) => /^\d{4}-\d{2}-\d{2}$/.test(key) && Array.isArray(value?.events)));
  } catch { return {}; }
}
export function mergeNewsWeek(archive, key, result) {
  if (!Array.isArray(result?.events)) return archive;
  const stamp = (value) => typeof value === "number" ? value : Date.parse(value) || 0;
  if (archive[key] && stamp(archive[key].fetchedAt) > stamp(result.fetchedAt)) return archive;
  return {...archive,[key]:{events:result.events,fetchedAt:result.fetchedAt,source:result.source}};
}
export function archivedNewsEvents(archive) {
  const events = new Map();
  Object.values(archive).sort((a,b) => new Date(a.fetchedAt) - new Date(b.fetchedAt)).forEach((week) => week.events.forEach((event) => {
    const date = new Date(event.isoDate || event.dateKey);
    if (!Number.isFinite(date.getTime())) return;
    events.set([event.isoDate || event.dateKey,event.currency,event.title].join("|"), {...event,calendarSource:week.source,calendarFetchedAt:week.fetchedAt,dateKey:date.toDateString(),time:event.isoDate ? date.toLocaleTimeString(undefined,{hour:"numeric",minute:"2-digit"}) : event.time});
  }));
  return [...events.values()].sort((a,b) => new Date(a.isoDate || a.dateKey) - new Date(b.isoDate || b.dateKey));
}
