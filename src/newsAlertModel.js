export const NEWS_ALERT_SETTINGS_KEY = "tj:news-alert-settings:v1";
export const NEWS_ALERT_DELIVERED_KEY = "tj:news-alert-delivered:v1";
export const NEWS_ALERT_DEFAULTS = {enabled:false,sound:true,minutes:[15,5]};
export const NEWS_ALERT_MINUTES = [1,5,10,15,30];
export function readAlertSettings(storage) {
  try {
    const value = JSON.parse(storage.getItem(NEWS_ALERT_SETTINGS_KEY));
    return {enabled:value?.enabled === true,sound:value?.sound !== false,minutes:Array.isArray(value?.minutes) ? NEWS_ALERT_MINUTES.filter((minute)=>value.minutes.includes(minute)) : [15,5]};
  } catch { return {...NEWS_ALERT_DEFAULTS,minutes:[15,5]}; }
}
export function eventAlertKey(event,minute) { return [event.isoDate,event.currency,event.title,minute].join("|"); }
export function dueNewsAlerts(events, now, lastCheck, delivered, minutes = [15,5]) {
  const alerts = [];
  for (const event of events) {
    const release = Date.parse(event.isoDate);
    if (event.impact === "holiday" || !Number.isFinite(release) || release <= now) continue;
    const due = minutes.filter((minute) => {
      const threshold = release-minute*60000;
      return threshold > lastCheck && threshold <= now && !delivered.has(eventAlertKey(event,minute));
    });
    if (due.length) alerts.push({event,minute:Math.min(...due),keys:due.map((minute)=>eventAlertKey(event,minute))});
  }
  return alerts;
}
export function nextNewsRelease(events, now) {
  return events.filter((event)=>event.impact !== "holiday" && Date.parse(event.isoDate) > now).sort((a,b)=>Date.parse(a.isoDate)-Date.parse(b.isoDate))[0] || null;
}
export function dueNewsReleases(events,now,lastCheck,delivered){
  return events.filter(event=>{
    const release=Date.parse(event.isoDate);
    return event.impact!=="holiday" && Number.isFinite(release) && release>lastCheck && release<=now && now-release<60000 && !delivered.has(eventAlertKey(event,0));
  }).map(event=>({event,minute:0,keys:[eventAlertKey(event,0)]}));
}
export function countdownLabel(milliseconds) {
  const total = Math.max(0,Math.ceil(milliseconds/1000));
  const hours = Math.floor(total/3600);
  return [hours,String(Math.floor(total%3600/60)).padStart(2,"0"),String(total%60).padStart(2,"0")].join(":");
}
