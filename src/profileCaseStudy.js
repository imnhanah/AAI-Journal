import { normaliseCaseStudyWorkspace } from './caseStudyWorkspace.js';

const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const legacyId = (accountId, kind, id) => `legacy-${accountId}-${kind}-${id}`;

const sourceId = source => {
  const value = source?.accountId;
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const id = String(value).trim();
  return id || null;
};
const sourceWorkspace = source => source?.workspace && typeof source.workspace === 'object' && !Array.isArray(source.workspace) ? source.workspace : null;
const normaliseSources = (saved, accounts) => {
  const manifest = Array.isArray(saved?.legacyAccountLibraries) ? saved.legacyAccountLibraries : [];
  const accountSources = Array.isArray(accounts) ? accounts.map(account => ({ accountId:account?.id, workspace:account?.caseStudyWorkspace })) : [];
  const seen = new Set();
  return [...manifest, ...accountSources].flatMap(source => {
    const accountId = sourceId(source), workspace = sourceWorkspace(source);
    if (!accountId || !workspace || seen.has(accountId)) return [];
    seen.add(accountId);
    return [{ accountId, workspace }];
  }).sort((left, right) => left.accountId.localeCompare(right.accountId));
};
const completedSourceIds = saved => new Set(Array.isArray(saved?.migrationState?.legacyProfileConsolidation?.sourceAccountIds) ? saved.migrationState.legacyProfileConsolidation.sourceAccountIds.map(String) : []);
const uniqueId = (items, preferred) => {
  if (!items.some(item => item.id === preferred)) return preferred;
  let suffix = 2; while (items.some(item => item.id === `${preferred}-${suffix}`)) suffix += 1;
  return `${preferred}-${suffix}`;
};

// The saved profile library is always the preferred base. Raw source payloads
// remain intact for recovery; only source IDs successfully included in the
// persistence candidate are marked consolidated.
export function migrateProfileCaseStudyLibrary(saved, accounts = []) {
  const base = normaliseCaseStudyWorkspace(saved);
  const sources = normaliseSources(saved, accounts);
  const completed = completedSourceIds(saved);
  const pending = sources.filter(source => !completed.has(source.accountId));
  if (!pending.length) return { workspace:base, migrated:false, sourceIds:[] };
  const result = {
    ...base,
    notebooks:[...base.notebooks], studies:[...base.studies], evidence:[...base.evidence], personalTemplates:[...base.personalTemplates],
    legacyAccountLibraries:sources.map(source => ({ accountId:source.accountId, workspace:source.workspace })),
  };
  for (const source of pending) {
    const workspace = normaliseCaseStudyWorkspace(source.workspace);
    const maps = { notebook:new Map(), evidence:new Map(), study:new Map(), template:new Map() };
    const add = (items, item, kind) => {
      const original = String(item?.id || `${kind}-${items.length}`), existing = items.find(value => value.id === original);
      if (!existing) { items.push({ ...item, id:original }); maps[kind].set(original, original); return; }
      if (same(existing, item)) { maps[kind].set(original, original); return; }
      const id = uniqueId(items, legacyId(source.accountId, kind, original)); items.push({ ...item, id }); maps[kind].set(original, id);
    };
    workspace.notebooks.forEach(item => add(result.notebooks, item, 'notebook'));
    workspace.evidence.forEach(item => add(result.evidence, item, 'evidence'));
    workspace.personalTemplates.forEach(item => add(result.personalTemplates, item, 'template'));
    workspace.studies.forEach(item => add(result.studies, item, 'study'));
    result.studies = result.studies.map(study => {
      if (!workspace.studies.some(item => maps.study.get(String(item.id)) === study.id)) return study;
      const placements = Object.fromEntries(Object.entries(study.evidencePlacements || {}).map(([id, value]) => [maps.evidence.get(id) || id, value]));
      return { ...study, notebookId:maps.notebook.get(study.notebookId) || study.notebookId, evidenceIds:(study.evidenceIds || []).map(id => maps.evidence.get(id) || id), evidencePlacements:placements, relatedStudyIds:(study.relatedStudyIds || []).map(id => maps.study.get(id) || id) };
    });
  }
  const sourceIds = [...completed, ...pending.map(source => source.accountId)].sort();
  return {
    // The caller must not publish this candidate (and therefore its marker)
    // until the single persistence write has succeeded.
    workspace:normaliseCaseStudyWorkspace({ ...result, version:1, migrationState:{ ...(base.migrationState && typeof base.migrationState === 'object' ? base.migrationState : {}), legacyProfileConsolidation:{ version:1, sourceAccountIds:sourceIds } } }),
    migrated:true,
    sourceIds:pending.map(source => source.accountId),
  };
}
