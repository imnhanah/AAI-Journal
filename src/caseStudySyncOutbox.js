import { normaliseCaseStudyWorkspace } from './caseStudyWorkspace.js';

const keyFor = userId => `aaicorefx-case-study-sync-outbox:${userId}`;
const clone = value => typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value));
const revision = value => Number.isSafeInteger(value) && value >= 0 ? value : null;
const workspace = value => value && typeof value === 'object' && !Array.isArray(value) ? normaliseCaseStudyWorkspace(value) : null;

const normalise = value => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const pendingWorkspace=workspace(value.pending?.workspace);
  const conflictLocal=workspace(value.conflict?.local);
  const conflictCloud=workspace(value.conflict?.cloud);
  const pending=pendingWorkspace ? { workspace:pendingWorkspace, baseRevision:revision(value.pending.baseRevision), savedAt:String(value.pending.savedAt || '') } : null;
  const conflict=conflictLocal && conflictCloud ? {
    local:conflictLocal,
    cloud:conflictCloud,
    cloudRevision:revision(value.conflict.cloudRevision),
    savedAt:String(value.conflict.savedAt || ''),
  } : null;
  const history=Array.isArray(value.history) ? value.history.map(entry => {
    const local=workspace(entry?.local), cloud=workspace(entry?.cloud);
    if (!local || !cloud) return null;
    return {
      local,
      cloud,
      cloudRevision:revision(entry.cloudRevision),
      savedAt:String(entry.savedAt || ''),
      resolvedAt:String(entry.resolvedAt || ''),
      outcome:entry.outcome === 'merged' ? 'merged' : 'preserved',
    };
  }).filter(Boolean) : [];
  return pending || conflict || history.length ? { version:1, pending, conflict, history } : null;
};

export const readCaseStudySyncOutbox = (userId, storage = globalThis.localStorage) => {
  try {
    const raw=storage?.getItem(keyFor(userId));
    if (!raw) return { data:null };
    const data=normalise(JSON.parse(raw));
    return { data };
  } catch { return { error:'Pending Case Study changes could not be read from this device.' }; }
};

export const saveCaseStudySyncOutbox = (userId, value, storage = globalThis.localStorage) => {
  try {
    const data=normalise(value);
    if (!data) throw new Error('Missing pending Case Study changes.');
    storage?.setItem(keyFor(userId), JSON.stringify(data));
    return { data:clone(data) };
  } catch { return { error:'Pending Case Study changes could not be saved on this device.' }; }
};

export const clearCaseStudySyncOutbox = (userId, storage = globalThis.localStorage) => {
  try { storage?.removeItem(keyFor(userId)); return {}; }
  catch { return { error:'Cloud sync was confirmed, but the device recovery copy could not be cleared.' }; }
};

// A confirmed merge no longer needs an active conflict, but its two source
// copies are still valuable recovery evidence. Archive them under the same
// authenticated user instead of silently deleting them with the outbox.
export const confirmCaseStudySyncOutbox = (userId, storage = globalThis.localStorage) => {
  const current=readCaseStudySyncOutbox(userId,storage);
  if (current.error) return current;
  const active=current.data;
  if (!active?.conflict) return clearCaseStudySyncOutbox(userId,storage);
  const entry={...active.conflict,resolvedAt:new Date().toISOString(),outcome:'merged'};
  return saveCaseStudySyncOutbox(userId,{version:1,pending:null,conflict:null,history:[...(active.history || []),entry]},storage);
};

export const pendingCaseStudySnapshot = (workspace, baseRevision) => ({
  version:1,
  pending:{ workspace:normaliseCaseStudyWorkspace(workspace), baseRevision:revision(baseRevision), savedAt:new Date().toISOString() },
  conflict:null,
});

export const conflictCaseStudySnapshot = (local, cloud, cloudRevision) => ({
  version:1,
  pending:{ workspace:normaliseCaseStudyWorkspace(local), baseRevision:revision(cloudRevision), savedAt:new Date().toISOString() },
  conflict:{ local:normaliseCaseStudyWorkspace(local), cloud:normaliseCaseStudyWorkspace(cloud), cloudRevision:revision(cloudRevision), savedAt:new Date().toISOString() },
});
