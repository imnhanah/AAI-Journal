export const REQUIRE_ALL = false;
export const APP_ROUTINE_ITEMS = [
  ['slept_enough', 'Slept enough', 'before', '7–8 hours keeps your decisions sharp'],
  ['ate_water', 'Ate and had water', 'before', 'Fuel before focus'],
  ['moved', 'Moved or stretched', 'before', 'Wake the body up before the screen does'],
  ['quiet_minute', 'A quiet minute', 'before', 'Breathe, pray or meditate'],
  ['phone_desk', 'Phone silenced, desk clear', 'before', 'Nothing left to pull you away'],
  ['looked_chart', 'Looked at the chart', 'pretrade', 'Know where price is before you mark it'],
  ['read_news', 'Read the news', 'pretrade', ''],
  ['checked_accounts', 'Checked my accounts', 'pretrade', ''],
  ['reviewed_rules', 'Reviewed my trading rules', 'pretrade', ''],
  ['accepted_risk', 'Accepted the risk before starting', 'pretrade', ''],
].map(([id,label,group,description],index)=>({id,label,group,description,enabled:index<8}));
// The journal day begins with the Tokyo open. The session model currently
// places that open at 00:00 UTC, so this remains correct even if the display
// timezone differs from UTC.
export const TOKYO_OPEN_UTC_HOUR = 0;
const tokyoOpenDayStart = (now = new Date()) => new Date(now.getTime() - TOKYO_OPEN_UTC_HOUR * 60 * 60 * 1000);
export const routineDayKey = (now = new Date()) => tokyoOpenDayStart(now).toISOString().slice(0,10);
export const isRoutineTradingDay = (now = new Date()) => ![0, 6].includes(new Date(`${routineDayKey(now)}T00:00:00Z`).getUTCDay());
export function normalizeRoutine(value = {}) {
  value=value && typeof value==='object' && !Array.isArray(value) ? value : {};
  const customItems = []; const used = new Set(APP_ROUTINE_ITEMS.map(item=>item.id));
  for (const item of Array.isArray(value.customItems) ? value.customItems : []) {
    if (!item?.id || used.has(item.id) || !String(item.label || '').trim()) continue;
    used.add(item.id); customItems.push({id:item.id,label:String(item.label).trim().slice(0,160),group:item.group==='pretrade'?'pretrade':'before',order:customItems.length,enabled:item.enabled !== false});
  }
  const ids = [...APP_ROUTINE_ITEMS.map(item=>item.id), ...customItems.map(item=>item.id)];
  const order = [...new Set([...(Array.isArray(value.order)?value.order:[]),...ids])].filter(id=>ids.includes(id));
  const appItems=Object.fromEntries(APP_ROUTINE_ITEMS.map(item=>{
    const saved=value.appItems?.[item.id] || {};
    return [item.id,{enabled:saved.enabled ?? item.enabled,deleted:saved.deleted===true,label:String(saved.label || item.label).trim().slice(0,160),group:saved.group==='pretrade'?'pretrade':'before'}];
  }));
  return { enabled:value.enabled !== false, appItems,customItems,order,
    completions:Object.fromEntries(Object.entries(value.completions || {}).filter(([key,row])=>/^\d{4}-\d{2}-\d{2}$/.test(key)&&row?.completedAt&&Array.isArray(row.tickedIds))) };
}
export function routineItems(value) {
  const routine=normalizeRoutine(value);
  const app=APP_ROUTINE_ITEMS.map(item=>({...item,...routine.appItems[item.id],default:true})).filter(item=>!item.deleted);
  return routine.order.map(id=>app.find(item=>item.id===id)||routine.customItems.find(item=>item.id===id)).filter(Boolean);
}
export function activeRoutineItems(value) {
  const routine=normalizeRoutine(value);
  return routineItems(routine).filter(item=>item.enabled!==false);
}
export const routineRequired = (value,now=new Date()) => { const r=normalizeRoutine(value); return isRoutineTradingDay(now) && r.enabled && activeRoutineItems(r).length>0 && !r.completions[routineDayKey(now)]; };
export function completeRoutine(value,tickedIds,now=new Date()) {
  const r=normalizeRoutine(value), active=activeRoutineItems(r), ids=new Set(active.map(item=>item.id));
  const ticked=[...new Set(tickedIds)].filter(id=>ids.has(id));
  if (REQUIRE_ALL && ticked.length!==active.length) throw new Error('Complete all active routine items first.');
  return {...r,completions:{...r.completions,[routineDayKey(now)]:{completedAt:now.toISOString(),tickedIds:ticked,total:active.length}}};
}
export function routineHistory(value,now=new Date()) {
  const r=normalizeRoutine(value), today=routineDayKey(now), midnight=Date.parse(`${today}T00:00:00Z`);
  const dayAt = offset=>routineDayKey(new Date(midnight+offset*86400000));
  let offset=r.completions[today]?0:-1, streak=0;
  while(r.completions[dayAt(offset)]) {streak++;offset--;}
  return {streak,days:Array.from({length:7},(_,i)=>({key:dayAt(i-6),today:i===6,completed:!!r.completions[dayAt(i-6)]}))};
}
export function resetCountdown(now=new Date()) {
  const minutes=Math.ceil((Date.parse(`${routineDayKey(now)}T${String(TOKYO_OPEN_UTC_HOUR).padStart(2,'0')}:00:00Z`)+86400000-now.getTime())/60000);
  return `${Math.floor(minutes/60)}h ${minutes%60}m`;
}
export function reorderRoutine(value,id,targetId) {
  const r=normalizeRoutine(value), order=r.order.filter(key=>key!==id), index=order.indexOf(targetId);
  if (!r.order.includes(id)||index<0) return r;
  order.splice(index,0,id);return {...r,order};
}

export async function loadRoutineProfile(auth,userId) {
  const {data,error}=await auth.getUser();
  if(error||data.user?.id!==userId) throw new Error(error?.message || 'Sign in again to load your routine.');
  return normalizeRoutine(data.user.user_metadata?.dailyRoutine);
}
export async function saveRoutineProfile(auth,userId,mutate) {
  const current=await loadRoutineProfile(auth,userId), next=normalizeRoutine(mutate(current));
  const {data,error}=await auth.updateUser({data:{dailyRoutine:next}});
  if(error||data.user?.id!==userId) throw new Error(error?.message || 'Routine could not be saved.');
  return normalizeRoutine(data.user.user_metadata.dailyRoutine);
}
