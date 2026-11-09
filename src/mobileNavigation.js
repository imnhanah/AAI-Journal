import {routineProgress} from './dailyRoutine.js';
export const MOBILE_BREAKPOINT = 768;
export const MOBILE_MEDIA = '(max-width:767px)';
export const MOBILE_MORE_PAGES = ['case-studies','psychology','news','finance','backtest','management'];
export function mobileRoutineStatus(value, now = new Date()) {
  const progress=routineProgress(value,now);
  return {total:progress.total,ticked:progress.ticked,completed:progress.completed,started:progress.started,unfinished:progress.unfinished,skipped:progress.skipped};
}
