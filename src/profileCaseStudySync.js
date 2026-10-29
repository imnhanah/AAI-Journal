import { normaliseCaseStudyWorkspace } from './caseStudyWorkspace.js';

const stable = value => JSON.stringify(normaliseCaseStudyWorkspace(value));
export const sameProfileCaseStudyLibrary = (left, right) => stable(left) === stable(right);

// This decides only; it never writes or merges either library.
export const planTemporaryLibraryUpload = ({ temporaryLibrary, cloudLibrary, cloudRevision }) => {
  if (!temporaryLibrary) return { kind:'nothing-to-upload' };
  if (cloudLibrary == null) return { kind:'initial-upload', expectedRevision:cloudRevision ?? null };
  if (sameProfileCaseStudyLibrary(temporaryLibrary, cloudLibrary)) return { kind:'already-synced', expectedRevision:cloudRevision ?? null };
  return { kind:'reconciliation-required', expectedRevision:cloudRevision ?? null, local:temporaryLibrary, cloud:cloudLibrary };
};

export const cloudSyncState = ({ temporary, syncing=false, error=null, conflict=false, synced=false }) => {
  if (conflict) return 'Sync conflict';
  if (syncing) return 'Syncing';
  if (error) return 'Sync failed';
  if (synced) return 'Synced';
  if (temporary) return 'Saved locally';
  return 'Saved locally';
};
