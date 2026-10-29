import { normaliseCaseStudyWorkspace } from './caseStudyWorkspace.js';

const keyFor = userId => `aaicorefx-temporary-case-study-library:${userId}`;

export const readTemporaryCaseStudyLibrary = (userId, storage = globalThis.localStorage) => {
  try {
    const raw=storage?.getItem(keyFor(userId));
    if (!raw) return { data:null };
    const parsed=JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? { data:normaliseCaseStudyWorkspace(parsed) } : { data:null };
  } catch { return { error:'The device-only Case Study workspace could not be read.' }; }
};

// Deliberately separate from both Cloud Sync and the guarded device profile
// library. It can never replace a recovered legacy source or cloud row.
export const saveTemporaryCaseStudyLibrary = (userId, workspace, storage = globalThis.localStorage) => {
  try {
    const data=normaliseCaseStudyWorkspace(workspace);
    storage?.setItem(keyFor(userId), JSON.stringify(data));
    return { data };
  } catch { return { error:'The device-only Case Study workspace could not be saved.' }; }
};
