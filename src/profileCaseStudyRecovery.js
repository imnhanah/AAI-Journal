import { normaliseCaseStudyWorkspace } from './caseStudyWorkspace.js';

const clone = value => typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value));
const content = workspace => {
  const value = normaliseCaseStudyWorkspace(workspace);
  const meaningfulSettings = Object.entries(value.settings || {}).some(([key, setting]) => !(
    (key === 'view' && setting === 'grid') ||
    (key === 'query' && setting === '') ||
    (key === 'status' && setting === 'All') ||
    (key === 'notebook' && setting === 'All')
  ));
  return value.studies.length + value.evidence.length + value.notebooks.length + value.personalTemplates.length > 0 || meaningfulSettings;
};
const same = (left, right) => JSON.stringify(normaliseCaseStudyWorkspace(left)) === JSON.stringify(normaliseCaseStudyWorkspace(right));

// A Cloud Sync-off transition copies the authoritative profile library into
// device storage.  A divergent existing device library is never overwritten
// automatically: it may contain newer offline work and needs explicit user
// recovery rather than a guess about which version wins.
export function prepareProfileLibraryDeviceCopy({ cloudLibrary, localLibrary, visibleLibrary }) {
  if (cloudLibrary == null && content(visibleLibrary)) {
    return { error:'Your Case Study Library could not be confirmed from Cloud Sync. Keep Cloud Sync enabled and retry before switching this device to local storage.' };
  }
  const library = normaliseCaseStudyWorkspace(cloudLibrary);
  if (content(localLibrary) && !same(localLibrary, library)) {
    return { error:'This device has a different saved Case Study Library. Keep Cloud Sync enabled and export or reconcile that local copy before switching modes.' };
  }
  return { data:clone(library) };
}
