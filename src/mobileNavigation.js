import {activeRoutineItems, normalizeRoutine, routineDayKey} from './dailyRoutine.js';
export const MOBILE_BREAKPOINT = 768;
export const MOBILE_MEDIA = '(max-width:767px)';
export const MOBILE_MORE_PAGES = ['markups','reviews','case-studies','analytics','psychology','news','challenge','finance','backtest','management'];
export function mobileRoutineStatus(value, now = new Date()) {
  const routine = normalizeRoutine(value);
  const items = activeRoutineItems(routine);
  const completion = routine.completions[routineDayKey(now)];
  return {total:completion?.total ?? items.length, ticked:completion?.tickedIds.length || 0, completed:!!completion, skipped:!routine.enabled || items.length === 0};
}
