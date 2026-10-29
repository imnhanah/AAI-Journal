import {routineRequired} from './dailyRoutine.js';

export const ROUTINE_ENTRY_STALE = 'Your account changed. Please open the entry again.';
export function routineEntryMatches(entry, context) {
  return !!entry && entry.userId === context.userId && entry.workspaceId === context.workspaceId;
}

// One shared gate for live markup/trade creation; never used by edits or backtests.
export function createRoutineEntryGate(getActions) {
  let pending = null, checking = false, saving = false, sequence = 0;
  const now = () => getActions().now?.() || new Date();
  const locked = entry => entry.kind === 'trade' && getActions().context().tradeLocked;
  return {
    async request(kind, draft = null) {
      if (checking || saving || pending) return 'busy';
      const actions = getActions();
      const entry = {...actions.context(), kind, draft};
      if (locked(entry)) { actions.onLocked(); return 'locked'; }
      const ticket = ++sequence;
      checking = true; actions.onBusy(true);
      try {
        const routine = await actions.loadRoutine();
        if (ticket !== sequence || !routineEntryMatches(entry,getActions().context())) return 'stale';
        if (locked(entry)) { getActions().onLocked(); return 'locked'; }
        if (routineRequired(routine,now())) {
          pending = entry;
          getActions().onPrompt(kind);
          return 'routine';
        }
        getActions().onOpen(entry);
        return 'open';
      } catch (error) {
        if (ticket === sequence) getActions().onError(error);
        return 'error';
      } finally {
        checking = false; getActions().onBusy(false);
      }
    },
    async complete(tickedIds) {
      const entry = pending;
      if (saving) throw new Error('Routine is already saving.');
      if (!routineEntryMatches(entry,getActions().context())) throw new Error(ROUTINE_ENTRY_STALE);
      saving = true;
      const ticket = sequence;
      try {
        const saved = await getActions().saveRoutine(tickedIds);
        if (ticket !== sequence || !routineEntryMatches(entry,getActions().context())) return false;
        if (routineRequired(saved,now())) throw new Error('A new routine day has started. Please save the checklist again.');
        pending = null;
        getActions().onDismiss();
        if (locked(entry)) { getActions().onLocked(); return false; }
        getActions().onOpen(entry);
        return true;
      } finally { saving = false; }
    },
    cancel() { pending = null; sequence++; getActions()?.onDismiss(); },
  };
}
