export const REQUIRE_ALL = false;
export const APP_ROUTINE_ITEMS = [
  ['slept_enough', 'Slept enough', 'before', '7–8 hours keeps your decisions sharp', true],
  ['ate_water', 'Ate and had water', 'before', 'Fuel before focus', true],
  ['moved', 'Moved or stretched', 'before', 'Wake the body up before the screen does', true],
  ['quiet_minute', 'A quiet minute', 'before', 'Breathe, pray or meditate', true],
  ['phone_desk', 'Phone silenced, desk clear', 'before', 'Nothing left to pull you away', true],
  ['review_plan_goals', 'Review plan and set goals for the session', 'pretrade', '', true],
  ['looked_chart', 'Looked at the chart', 'pretrade', 'Know where price is before you mark it', true],
  ['read_news', 'Read the news', 'pretrade', '', true],
  ['checked_accounts', 'Checked my accounts', 'pretrade', '', true],
  ['reviewed_rules', 'Reviewed my trading rules', 'pretrade', '', true],
  ['accepted_risk', 'Accepted the risk before starting', 'pretrade', '', true],
].map(([id,label,group,description,enabled])=>({id,label,group,description,enabled}));
// The journal day begins with the Tokyo open. The session model currently
// places that open at 00:00 UTC, so this remains correct even if the display
// timezone differs from UTC.
export const TOKYO_OPEN_UTC_HOUR = 0;
const tokyoOpenDayStart = (now = new Date()) => new Date(now.getTime() - TOKYO_OPEN_UTC_HOUR * 60 * 60 * 1000);
export const routineDayKey = (now = new Date()) => tokyoOpenDayStart(now).toISOString().slice(0,10);
export const isRoutineTradingDay = (now = new Date()) => ![0, 6].includes(new Date(`${routineDayKey(now)}T00:00:00Z`).getUTCDay());
export function normalizeRoutine(value = {}) {
  value=value && typeof value==='object' && !Array.isArray(value) ? value : {};
  // Existing profiles retain their configured completion requirements. The
  // V1 defaults become enabled for a new profile, while already configured
  // profiles retain the old eight-check default unless they explicitly opted
  // into an item. That includes the new plan-and-goals check. No completion
  // row is rewritten during this upgrade.
  const hasExistingConfiguration = Object.keys(value).some(key => ['enabled','appItems','customItems','order','completions'].includes(key));
  const customItems = []; const used = new Set(APP_ROUTINE_ITEMS.map(item=>item.id));
  for (const item of Array.isArray(value.customItems) ? value.customItems : []) {
    if (!item?.id || used.has(item.id) || !String(item.label || '').trim()) continue;
    used.add(item.id); customItems.push({id:item.id,label:String(item.label).trim().slice(0,160),group:item.group==='pretrade'?'pretrade':'before',order:customItems.length,enabled:item.enabled !== false});
  }
  const ids = [...APP_ROUTINE_ITEMS.map(item=>item.id), ...customItems.map(item=>item.id)];
  const order = [...new Set([...(Array.isArray(value.order)?value.order:[]),...ids])].filter(id=>ids.includes(id));
  const appItems=Object.fromEntries(APP_ROUTINE_ITEMS.map(item=>{
    const saved=value.appItems?.[item.id] || {};
    const legacyOptionalIds = ['review_plan_goals','reviewed_rules','accepted_risk'];
    const enabled = saved.enabled ?? (hasExistingConfiguration && legacyOptionalIds.includes(item.id) ? false : item.enabled);
    return [item.id,{enabled,deleted:saved.deleted===true,label:String(saved.label || item.label).trim().slice(0,160),group:(saved.group||item.group)==='pretrade'?'pretrade':'before'}];
  }));
  return { enabled:value.enabled !== false, appItems,customItems,order,
    // Legacy rows only had completedAt. New rows may be an unfinished saved
    // checklist, identified by savedAt without completedAt.
    completions:Object.fromEntries(Object.entries(value.completions || {}).filter(([key,row])=>/^\d{4}-\d{2}-\d{2}$/.test(key)&&Array.isArray(row?.tickedIds)&&(row?.savedAt||row?.completedAt)).map(([key,row])=>[key,{tickedIds:row.tickedIds,total:Number(row.total)||0,savedAt:row.savedAt||row.completedAt,completedAt:row.completedAt||null}])) };
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
// Before resumable progress existed, every save was stamped with completedAt.
// The saved total lets us distinguish those old partial saves from genuinely
// completed checklists without altering their checked items or history rows.
const savedRoutineTotal=row=>Number(row?.total)||new Set(row?.tickedIds||[]).size;
const savedRoutineComplete=row=>Boolean(row?.completedAt)&&new Set(row?.tickedIds||[]).size>=savedRoutineTotal(row);
export function routineProgress(value, now=new Date()) {
  const r=normalizeRoutine(value), items=activeRoutineItems(r), row=r.completions[routineDayKey(now)];
  const valid=new Set(items.map(item=>item.id)), tickedIds=[...new Set(row?.tickedIds||[])].filter(id=>valid.has(id));
  const completed=savedRoutineComplete(row);
  return {key:routineDayKey(now),started:!!row,tickedIds,total:items.length,ticked:tickedIds.length,completed,unfinished:!!row&&isRoutineTradingDay(now)&&r.enabled&&items.length>0&&!completed,skipped:!r.enabled||items.length===0};
}
export const routineRequired = (value,now=new Date()) => { const r=normalizeRoutine(value); return isRoutineTradingDay(now) && r.enabled && activeRoutineItems(r).length>0 && !routineProgress(r,now).started; };
export function completeRoutine(value,tickedIds,now=new Date()) {
  const r=normalizeRoutine(value), active=activeRoutineItems(r), ids=new Set(active.map(item=>item.id));
  const ticked=[...new Set(tickedIds)].filter(id=>ids.has(id));
  if (REQUIRE_ALL && ticked.length!==active.length) throw new Error('Complete all active routine items first.');
  const key=routineDayKey(now), previous=r.completions[key], completed=active.length>0&&ticked.length===active.length;
  return {...r,completions:{...r.completions,[key]:{tickedIds:ticked,total:active.length,savedAt:now.toISOString(),completedAt:completed?(savedRoutineComplete(previous)?previous.completedAt:now.toISOString()):null}}};
}
export const updateRoutineItem=(r,item,change)=>item.default?{...r,appItems:{...r.appItems,[item.id]:{...r.appItems[item.id],...change}}}:{...r,customItems:r.customItems.map(row=>row.id===item.id?{...row,...change}:row)};
export const deleteRoutineItem=(r,item)=>item.default?{...r,appItems:{...r.appItems,[item.id]:{...r.appItems[item.id],deleted:true,enabled:false}}}:{...r,customItems:r.customItems.filter(row=>row.id!==item.id),order:r.order.filter(id=>id!==item.id)};
export const restoreRoutineItems=r=>({...r,appItems:Object.fromEntries(APP_ROUTINE_ITEMS.map(item=>[item.id,{enabled:item.enabled,label:item.label,group:item.group,deleted:false}]))});
export function addRoutineItem(r,{label,group}) {
  const item={id:`custom-${crypto.randomUUID()}`,label,group,order:routineItems(r).length,enabled:true};
  return {...r,customItems:[...r.customItems,item],order:[...r.order,item.id]};
}
// Today, streak and this-week figures shared by the routine manager and the phone Setup home.
export function routineWeekStats(routine,now=new Date()) {
  const activeItems=routineItems(routine).filter(item=>item.enabled!==false);
  const todayKey=routineDayKey(now), history=routineHistory(routine,now);
  const todayCompletion=routine.completions?.[todayKey];
  const todayDone=(todayCompletion?.tickedIds || []).filter(id=>activeItems.some(item=>item.id===id)).length;
  const todayTotal=todayCompletion?.total || activeItems.length;
  const midnight=Date.parse(`${todayKey}T00:00:00Z`), weekday=new Date(midnight).getUTCDay(), mondayOffset=weekday===0?-6:1-weekday;
  const tradingWeek=Array.from({length:5},(_,index)=>({key:routineDayKey(new Date(midnight+(mondayOffset+index)*86400000)),today:routineDayKey(new Date(midnight+(mondayOffset+index)*86400000))===todayKey}));
  const recentTradingDays=tradingWeek.filter(day=>day.key<=todayKey);
  const completionState=key=>{if(key>todayKey)return 'upcoming';const row=routine.completions?.[key];if(!row)return 'missed';const total=row.total||activeItems.length||1;return row.tickedIds.length>=total?'full':'partial';};
  const completedThisWeek=recentTradingDays.filter(day=>completionState(day.key)==='full').length;
  const historicalRows=Object.values(routine.completions||{});
  const mostMissed=activeItems.map(item=>({label:item.label,missed:historicalRows.filter(row=>!row.tickedIds.includes(item.id)).length})).sort((a,b)=>b.missed-a.missed)[0];
  return {activeItems,history,todayKey,todayCompletion,todayDone,todayTotal,tradingWeek,recentTradingDays,completionState,completedThisWeek,historicalRows,mostMissed};
}

export function routineHistory(value,now=new Date()) {
  const r=normalizeRoutine(value), today=routineDayKey(now), midnight=Date.parse(`${today}T00:00:00Z`);
  const dayAt = offset=>routineDayKey(new Date(midnight+offset*86400000));
  const isCompleted=key=>savedRoutineComplete(r.completions[key]);
  let offset=isCompleted(today)?0:-1, streak=0;
  while(isCompleted(dayAt(offset))) {streak++;offset--;}
  return {streak,days:Array.from({length:7},(_,i)=>({key:dayAt(i-6),today:i===6,completed:isCompleted(dayAt(i-6))}))};
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
