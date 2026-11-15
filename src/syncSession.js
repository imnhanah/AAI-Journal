export class SyncSafetyError extends Error {
  constructor(code, message = code) { super(message); this.name='SyncSafetyError'; this.code=code; }
}
export function requiredString(value, name) {
  if (typeof value !== 'string' || !value.trim() || value.length > 512) throw new SyncSafetyError('INVALID_ARGUMENT', `${name} must be a nonempty bounded string.`);
  return value;
}
// This fences local work only. It grants no Supabase authorization or entitlement.
export function createSyncSession() {
  let current=null, generation=0;
  const listeners=new Set();
  const session={
    activate(scope) {
      const next=scope ? {projectId:requiredString(scope.projectId,'projectId'),ownerId:requiredString(scope.ownerId,'ownerId')} : null;
      if (next?.projectId === current?.projectId && next?.ownerId === current?.ownerId) return current;
      generation++;
      current=next ? Object.freeze({...next,generation}) : null;
      for(const listener of listeners) listener();
      return current;
    },
    capture() { if(!current) throw new SyncSafetyError('SIGNED_OUT'); return current; },
    valid(token) { return !!current && token === current; },
    assert(token) { if(!session.valid(token)) throw new SyncSafetyError('SESSION_CHANGED'); },
    subscribe(listener) { listeners.add(listener); return ()=>listeners.delete(listener); },
  };
  return Object.freeze(session);
}
