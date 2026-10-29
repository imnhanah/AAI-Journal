import { imageReference } from './journalDelta.js';

export const THIN_COLUMNS = {
  accounts: 'id,user_id,name,icon,balance,breakeven_cap,rating_style,theme,default_commission,monthly_goal_pct,yearly_goal_pct,daily_loss_limit_pct,monthly_loss_limit_pct,created_at,updated_at',
  trades: 'id,account_id,created_at,updated_at,trade_date,trade_time,close_date,close_time,asset,direction,entry_price,exit_price,risk_method,risk_preset,stop_loss_pips,take_profit_pips,exit_pips,stop_loss_price,take_profit_price,planned_rr,realized_rr,gross_pnl,commission,swap,net_pnl,pnl,rr,session,entry_session,entry_type,rating,types,mistakes,mood_before,mood_after,context,confluence_session,premarket_markup_id,rule_evaluations',
  premarket_markups: 'id,account_id,updated_at,markup_date,markup_time,market,instrument,bias,status,levels,market_structure,notes',
  trade_reviews: 'id,account_id,trade_id,updated_at,review_date,review_time,done_well,went_wrong,execution_review,rule_adherence,psychology,lessons,action_items,notes',
};
const canonical = value => JSON.stringify(value && typeof value === 'object' && !Array.isArray(value) ? Object.fromEntries(Object.keys(value).sort().map(key => [key, JSON.parse(canonical(value[key]) ?? 'null')])) : Array.isArray(value) ? value.map(item => JSON.parse(canonical(item) ?? 'null')) : value);
export const hasMedia = value => typeof value === 'string' ? value.startsWith('data:image/') || value.startsWith('tj-image:') || /^https?:/.test(value) : Array.isArray(value) ? value.some(hasMedia) : value && typeof value === 'object' ? Object.values(value).some(hasMedia) : false;
export function normalizeMedia(table, value) {
  if (table === 'trades') {
    if (Array.isArray(value)) return { entry: value.slice(0,2), exit: value.slice(2,4) };
    return { entry: value?.entry || [], exit: value?.exit || [] };
  }
  if (table === 'premarket_markups') return { preHTF:value?.preHTF || value?.postD1 || [], preM15:value?.preM15 || value?.pre || (Array.isArray(value) ? value : []), preH4:value?.preH4 || [], postH4:value?.postH4 || [], postM15:value?.postM15 || [], sessionReview:value?.sessionReview || {marketOutcome:'',waitedForConditions:'',outsidePlanReason:''} };
  return value || [];
}
export function planMediaMutation({table, id, incoming, previous, edited = false, creating = false}) {
  if (!creating && incoming === undefined) return { write: false };
  const refs = [];
  const inspect = value => { if (typeof value === 'string') { const ref = imageReference(value); if (ref) refs.push(ref); } else if (Array.isArray(value)) value.forEach(inspect); else if (value && typeof value === 'object') Object.values(value).forEach(inspect); };
  inspect(incoming);
  if (refs.some(ref => ref.table !== table || ref.id !== id)) throw new Error('Screenshot belongs to a different record. Reopen the editor.');
  if (!creating && !edited && previous === undefined) {
    // A text-only form with no authoritative media metadata cannot clear it.
    if (!hasMedia(incoming)) return { write: false };
    if (refs.length) return { write: false };
    throw new Error('Load this record before replacing its screenshots.');
  }
  if (!creating && !edited && canonical(normalizeMedia(table,incoming)) === canonical(normalizeMedia(table,previous))) return { write:false };
  if (!creating && !edited && hasMedia(previous) && !hasMedia(incoming)) throw new Error('Screenshots were not explicitly removed. Reopen the editor before saving.');
  if (!creating && !edited && refs.length) throw new Error('Screenshot metadata changed. Reopen the editor before saving.');
  return { write:true };
}

export const MAX_SCREENSHOT_BYTES = 10 * 1024 * 1024;
export function validateImageFile(file) {
  if (!file?.type?.startsWith('image/')) return 'Choose an image file.';
  if (file.size > MAX_SCREENSHOT_BYTES) return 'Image is larger than 10 MB. Choose a smaller image; the original has not been changed.';
  return '';
}
export function shouldHandleImagePaste(event, root) {
  return !event.defaultPrevented && !!root?.contains(event.target) && !event.target?.closest?.('input,textarea') && event.target?.closest?.('[data-image-uploader]') === root;
}
