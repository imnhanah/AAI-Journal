import { normaliseCaseStudyWorkspace } from './caseStudyWorkspace.js';
import { migrateProfileCaseStudyLibrary } from './profileCaseStudy.js';

const hasLibraryContent = workspace => {
  if (!workspace || typeof workspace !== 'object') return false;
  return ['studies', 'evidence', 'notebooks', 'personalTemplates'].some(key => Array.isArray(workspace[key]) && workspace[key].length > 0);
};

export const legacyRecoveryPreview = accounts => {
  const candidate=migrateProfileCaseStudyLibrary(null, accounts);
  return candidate.migrated && candidate.sourceIds.length && hasLibraryContent(candidate.workspace)
    ? { workspace:candidate.workspace, sourceIds:candidate.sourceIds }
    : null;
};

// This is deliberately a read-only resolver. It never publishes a migration
// candidate as a saved library and never signals that it is safe to write.
export const resolveProfileCaseStudyVisibility = ({ loaded, accounts, lastValidWorkspace }) => {
  if (loaded?.error) {
    if (loaded.failure?.kind === 'unavailable') {
      const preview=legacyRecoveryPreview(accounts);
      if (preview) return { status:'recovery', workspace:preview.workspace, sourceIds:preview.sourceIds, message:'Recovered legacy Case Study data preview. It is read-only and has not been saved to your profile library.' };
    }
    if (lastValidWorkspace) return { status:'error', workspace:lastValidWorkspace, message:`${loaded.error} Showing your last confirmed library; saving is disabled until Retry Load succeeds.` };
    return { status:'error', workspace:null, message:loaded.error || 'The Case Study Library could not be loaded. No empty library will be created.' };
  }

  if (loaded?.data !== null && loaded?.data !== undefined) return { status:'ready', workspace:normaliseCaseStudyWorkspace(loaded.data), message:'' };

  const preview=legacyRecoveryPreview(accounts);
  if (preview) return { status:'recovery', workspace:preview.workspace, sourceIds:preview.sourceIds, message:'Legacy Case Study data is available as a read-only preview until profile storage is safely available.' };
  return { status:'ready', workspace:normaliseCaseStudyWorkspace(null), message:'' };
};
