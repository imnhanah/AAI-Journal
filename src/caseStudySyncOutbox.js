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
  return pending || conflict ? { version:1, pending, conflict } : null;
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
