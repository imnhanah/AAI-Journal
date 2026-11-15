import { normaliseCaseStudyWorkspace } from './caseStudyWorkspace.js';

const clone = value => typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value));
const stable = value => {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (!value || typeof value !== 'object') return JSON.stringify(value);
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
};
const same = (left, right) => stable(left) === stable(right);

export const CASE_STUDY_RECONCILIATION_COLLECTIONS = Object.freeze([
  ['notebooks', 'Notebook'],
  ['studies', 'Study'],
  ['evidence', 'Evidence'],
  ['personalTemplates', 'Template'],
  ['connections', 'Connection'],
]);

export const caseStudyReconciliationCounts = workspace => {
  const value = normaliseCaseStudyWorkspace(workspace);
  const placements=value.studies.reduce((total, study) => total + Object.keys(study.evidencePlacements || {}).length, 0);
  const annotations=value.studies.reduce((total, study) => total + Object.values(study.evidencePlacements || {}).reduce((count, placement) => count + (Array.isArray(placement?.annotations) ? placement.annotations.length : 0), 0), 0);
  return {
    notebooks:value.notebooks.length,
    studies:value.studies.length,
    evidence:value.evidence.length,
    templates:value.personalTemplates.length,
    connections:value.connections.length,
    placements,
    annotations,
    cloudRefs:value.evidence.filter(item => typeof item?.cloudRef === 'string' && item.cloudRef.trim()).length,
  };
};

const countPlacementMap = workspace => {
  const value=normaliseCaseStudyWorkspace(workspace);
  return new Map(value.studies.flatMap(study => Object.entries(study.evidencePlacements || {}).map(([evidenceId, placement]) => [`${study.id}:${evidenceId}`, { studyId:study.id, evidenceId, placement:clone(placement) }])));
};

const countEvidenceLinkMap = workspace => {
  const value=normaliseCaseStudyWorkspace(workspace);
  return new Map(value.studies.flatMap(study => (study.evidenceIds || []).map(evidenceId => [`${study.id}:${evidenceId}`, { studyId:study.id, evidenceId }])));
};

const relationshipSetReport = (localMap, cloudMap, mergedMap, pendingKeys = new Set()) => {
  const keys=[...new Set([...localMap.keys(), ...cloudMap.keys()])];
  const localOnly=keys.filter(key => localMap.has(key) && !cloudMap.has(key));
  const cloudOnly=keys.filter(key => !localMap.has(key) && cloudMap.has(key));
  const changed=keys.filter(key => localMap.has(key) && cloudMap.has(key) && !same(localMap.get(key), cloudMap.get(key)));
  // A pending choice is deliberately not placed in the save candidate. It is
  // protected in both snapshots, so it must not be presented as deleted.
  const pending=keys.filter(key => pendingKeys.has(key));
  const omitted=keys.filter(key => !mergedMap.has(key) && !pendingKeys.has(key));
  return { local:localMap.size, cloud:cloudMap.size, sourceDistinct:keys.length, proposed:mergedMap.size, localOnly, cloudOnly, changed, pending, omitted };
};

const annotationMap = workspace => {
  const placements=countPlacementMap(workspace);
  return new Map([...placements.entries()].flatMap(([placementKey, entry]) => (entry.placement?.annotations || []).filter(Boolean).map((annotation, index) => [`${placementKey}:${annotation.id || index}`, clone(annotation)])));
};

const relevantConnections = (workspace, studyId) => normaliseCaseStudyWorkspace(workspace).connections.filter(connection => connection.source?.id === studyId || connection.target?.id === studyId);

const STUDY_RELATIONSHIP_KEYS=new Set(['id','evidenceIds','evidencePlacements']);
const STUDY_FIELD_GROUPS=[
  ['title','Study title',['title']],
  ['status','Status',['status']],
  ['updatedAt','Last updated',['updatedAt']],
  ['objective','Research objective',['objective','researchObjective','body']],
  ['sections','Study sections and content',['sections','sectionNotes','sectionDocuments']],
  ['notes','Research notes',['notes']],
  ['notebookId','Notebook',['notebookId']],
  ['tags','Tags',['tags']],
  ['pinned','Pinned',['pinned']],
  ['archived','Archived',['archived']],
  ['favorite','Favorite',['favorite']],
  ['tradeIds','Linked trades',['tradeIds']],
  ['markupIds','Linked markups',['markupIds']],
  ['relatedStudyIds','Related studies',['relatedStudyIds']],
];
const studyFieldChoiceKey=(studyId, fieldId) => `study:${studyId}:field:${fieldId}`;
const placementChoiceKey=(studyId, evidenceId) => `study:${studyId}:placement:${evidenceId}`;
const fieldSnapshot=(record, keys) => Object.fromEntries(keys.map(key => [key, record?.[key]]));
const applyFieldSnapshot=(target, source, keys) => keys.forEach(key => {
  if (source && Object.prototype.hasOwnProperty.call(source,key)) target[key]=clone(source[key]);
  else delete target[key];
});

const studyFieldGroups = (local, cloud) => {
  const known=new Set(STUDY_FIELD_GROUPS.flatMap(([, , keys]) => keys));
  const groups=STUDY_FIELD_GROUPS.map(([id,label,keys]) => ({id,label,keys}));
  const extras=[...new Set([...Object.keys(local || {}),...Object.keys(cloud || {})])]
    .filter(key => !STUDY_RELATIONSHIP_KEYS.has(key) && !known.has(key))
    .sort();
  extras.forEach(key => groups.push({id:`metadata:${key}`,label:`Additional metadata: ${key}`,keys:[key]}));
  return groups.map(group => ({
    ...group,
    device:fieldSnapshot(local,group.keys),
    cloud:fieldSnapshot(cloud,group.keys),
  })).map(group => ({...group,state:same(group.device,group.cloud) ? 'identical' : 'different'}));
};

const orderedEvidenceIds = (local, cloud) => {
  const ids=[];
  [local,cloud].forEach(study => {
    [...(study?.evidenceIds || []),...Object.keys(study?.evidencePlacements || {})].forEach(id => {
      if (id && !ids.includes(id)) ids.push(id);
    });
  });
  return ids;
};

const resolveStudyConflict = (record, selections = {}) => {
  const local=record.local || {}, cloud=record.cloud || {};
  const fields=studyFieldGroups(local,cloud);
  const study=clone(cloud);
  const unresolved=[];
  fields.forEach(field => {
    const choice=selections[studyFieldChoiceKey(record.id,field.id)];
    if (field.state === 'different' && choice !== 'local' && choice !== 'cloud') {
      unresolved.push({type:'study-field',studyId:record.id,fieldId:field.id,label:field.label,key:studyFieldChoiceKey(record.id,field.id)});
      return;
    }
    applyFieldSnapshot(study, choice === 'local' ? local : cloud, field.keys);
  });
  const evidenceIds=[];
  const evidencePlacements={};
  const pendingPlacementKeys=[];
  const placements=[];
  orderedEvidenceIds(local,cloud).forEach(evidenceId => {
    const localPlacement=local.evidencePlacements?.[evidenceId];
    const cloudPlacement=cloud.evidencePlacements?.[evidenceId];
    const choice=selections[placementChoiceKey(record.id,evidenceId)];
    const conflictingPlacement=localPlacement !== undefined && cloudPlacement !== undefined && !same(localPlacement,cloudPlacement);
    const link={
      evidenceId,
      deviceLinked:(local.evidenceIds || []).includes(evidenceId),
      cloudLinked:(cloud.evidenceIds || []).includes(evidenceId),
      devicePlacement:localPlacement === undefined ? null : clone(localPlacement),
      cloudPlacement:cloudPlacement === undefined ? null : clone(cloudPlacement),
      state:conflictingPlacement ? 'conflict' : localPlacement === undefined ? 'cloud-only' : cloudPlacement === undefined ? 'device-only' : 'identical',
      key:placementChoiceKey(record.id,evidenceId),
      choice:choice === 'local' || choice === 'cloud' ? choice : null,
    };
    // Linking is additive: absence is not a deletion tombstone. Preserve every
    // source association unless the actual placement content conflicts.
    if (link.deviceLinked || link.cloudLinked || localPlacement !== undefined || cloudPlacement !== undefined) evidenceIds.push(evidenceId);
    if (conflictingPlacement && choice !== 'local' && choice !== 'cloud') {
      unresolved.push({type:'placement',studyId:record.id,evidenceId,key:link.key,label:`Evidence placement: ${evidenceId}`});
      pendingPlacementKeys.push(`${record.id}:${evidenceId}`);
    } else {
      const placement=choice === 'local' ? localPlacement : choice === 'cloud' ? cloudPlacement : localPlacement ?? cloudPlacement;
      if (placement !== undefined) evidencePlacements[evidenceId]=clone(placement);
    }
    placements.push(link);
  });
  study.evidenceIds=evidenceIds;
  study.evidencePlacements=evidencePlacements;
  return {study,fields,placements,unresolved,pendingPlacementKeys};
};

const sectionContent = study => (study?.sections || []).map((name, index) => ({
  name,
  notes: study?.sectionNotes?.[name] ?? study?.sectionNotes?.[index] ?? '',
  document: study?.sectionDocuments?.[name] ?? study?.sectionDocuments?.[index] ?? '',
}));

const fieldState = (local, cloud) => {
  const localMissing=local === undefined || local === null || local === '';
  const cloudMissing=cloud === undefined || cloud === null || cloud === '';
  if (localMissing && cloudMissing) return 'identical';
  if (localMissing) return 'missing-device';
  if (cloudMissing) return 'missing-cloud';
  return same(local, cloud) ? 'identical' : 'different';
};

export const describeStudyConflict = ({ local, cloud, localWorkspace, cloudWorkspace }) => {
  const localNotebooks=byId(normaliseCaseStudyWorkspace(localWorkspace).notebooks);
  const cloudNotebooks=byId(normaliseCaseStudyWorkspace(cloudWorkspace).notebooks);
  const fields=[
    ['title', 'Study title', local?.title || '', cloud?.title || ''],
    ['status', 'Status', local?.status || '', cloud?.status || ''],
    ['updatedAt', 'Last updated', local?.updatedAt || '', cloud?.updatedAt || ''],
    ['objective', 'Research objective', local?.objective ?? local?.researchObjective ?? local?.body ?? '', cloud?.objective ?? cloud?.researchObjective ?? cloud?.body ?? ''],
    ['sections', 'Study sections and content', sectionContent(local), sectionContent(cloud)],
    ['notes', 'Research notes', local?.notes || '', cloud?.notes || ''],
    ['evidenceIds', 'Linked evidence', local?.evidenceIds || [], cloud?.evidenceIds || []],
    ['evidencePlacements', 'Evidence placements', local?.evidencePlacements || {}, cloud?.evidencePlacements || {}],
    ['annotations', 'Annotations', Object.values(local?.evidencePlacements || {}).flatMap(placement => placement?.annotations || []), Object.values(cloud?.evidencePlacements || {}).flatMap(placement => placement?.annotations || [])],
    ['connections', 'Connections', relevantConnections(localWorkspace, local?.id), relevantConnections(cloudWorkspace, cloud?.id)],
    ['notebook', 'Notebook', localNotebooks.get(local?.notebookId)?.name || local?.notebookId || '', cloudNotebooks.get(cloud?.notebookId)?.name || cloud?.notebookId || ''],
    ['tags', 'Tags', local?.tags || [], cloud?.tags || []],
    ['pinned', 'Pinned', !!local?.pinned, !!cloud?.pinned],
    ['archived', 'Archived', !!local?.archived, !!cloud?.archived],
    ['favorite', 'Favorite', !!local?.favorite, !!cloud?.favorite],
  ];
  return fields.map(([key, label, device, cloudValue]) => ({ key, label, device:clone(device), cloud:clone(cloudValue), state:fieldState(device, cloudValue) }));
};

const byId = values => new Map(values.filter(item => item?.id).map(item => [item.id, item]));

export const compareCaseStudyLibraries = ({ local, cloud }) => {
  const left=normaliseCaseStudyWorkspace(local);
  const right=normaliseCaseStudyWorkspace(cloud);
  const collections=CASE_STUDY_RECONCILIATION_COLLECTIONS.map(([key, label]) => {
    const localRecords=byId(left[key] || []), cloudRecords=byId(right[key] || []);
    const ids=[...new Set([...localRecords.keys(), ...cloudRecords.keys()])].sort();
    const records=ids.map(id => {
      const localRecord=localRecords.get(id), cloudRecord=cloudRecords.get(id);
      const state=!localRecord ? 'cloud-only' : !cloudRecord ? 'local-only' : same(localRecord, cloudRecord) ? 'same' : 'conflict';
      return { key:`${key}:${id}`, id, collection:key, label, state, local:localRecord ? clone(localRecord) : null, cloud:cloudRecord ? clone(cloudRecord) : null };
    });
    return { key, label, records, counts:records.reduce((all, record) => ({ ...all, [record.state]:(all[record.state] || 0) + 1 }), {}) };
  });
  const records=collections.flatMap(collection => collection.records);
  return {
    local:left,
    cloud:right,
    collections,
    records,
    conflicts:records.filter(record => record.state === 'conflict'),
    localCounts:caseStudyReconciliationCounts(left),
    cloudCounts:caseStudyReconciliationCounts(right),
  };
};

const unresolvedReferences = workspace => {
  const studies=new Set(workspace.studies.map(item => item.id));
  const evidence=new Set(workspace.evidence.map(item => item.id));
  const issues=[];
  workspace.studies.forEach(study => {
    (study.evidenceIds || []).forEach(id => { if (!evidence.has(id)) issues.push({ type:'missing-evidence', studyId:study.id, evidenceId:id }); });
    Object.keys(study.evidencePlacements || {}).forEach(id => { if (!evidence.has(id)) issues.push({ type:'missing-placement-evidence', studyId:study.id, evidenceId:id }); });
    (study.relatedStudyIds || []).forEach(id => { if (!studies.has(id)) issues.push({ type:'missing-related-study', studyId:study.id, relatedStudyId:id }); });
  });
  workspace.connections.forEach(connection => {
    if (!studies.has(connection.source?.id) || !studies.has(connection.target?.id)) issues.push({ type:'unresolved-connection', connectionId:connection.id });
  });
  return issues;
};

export const caseStudyRelationshipIntegrity = ({ local, cloud, workspace, comparison, selections = {}, pendingPlacementKeys = [] }) => {
  const localPlacements=countPlacementMap(local);
  const cloudPlacements=countPlacementMap(cloud);
  const mergedPlacements=countPlacementMap(workspace);
  const localLinks=countEvidenceLinkMap(local);
  const cloudLinks=countEvidenceLinkMap(cloud);
  const mergedLinks=countEvidenceLinkMap(workspace);
  const localAnnotations=annotationMap(local);
  const cloudAnnotations=annotationMap(cloud);
  const mergedAnnotations=annotationMap(workspace);
  const pendingPlacementSet=new Set(pendingPlacementKeys);
  const pendingAnnotations=new Set([...pendingPlacementSet].flatMap(placementKey => [...localAnnotations.keys(),...cloudAnnotations.keys()].filter(key => key.startsWith(`${placementKey}:`))));
  return {
    placements:relationshipSetReport(localPlacements, cloudPlacements, mergedPlacements,pendingPlacementSet),
    evidenceLinks:relationshipSetReport(localLinks, cloudLinks, mergedLinks),
    annotations:relationshipSetReport(localAnnotations, cloudAnnotations, mergedAnnotations,pendingAnnotations),
    pendingPlacements:[...pendingPlacementSet].map(key => {
      const [studyId,evidenceId]=key.split(':');
      return {studyId,evidenceId,local:localPlacements.get(key)?.placement || null,cloud:cloudPlacements.get(key)?.placement || null};
    }),
    orphaned:unresolvedReferences(workspace),
  };
};

// A merge never generates replacement IDs. Same-ID records require a conscious
// choice, so dependent study/evidence/connection relationships keep their
// original IDs exactly. This intentionally favours preserving an orphaned
// record for review over silently rewriting or dropping a relationship.
export const createCaseStudyReconciliationProposal = ({ local, cloud, selections = {} }) => {
  const comparison=compareCaseStudyLibraries({ local, cloud });
  const selected={};
  const merged={ ...comparison.cloud };
  const unresolved=[];
  const studyResolutions={};
  const pendingPlacementKeys=[];
  comparison.collections.forEach(({ key, records }) => {
    merged[key]=records.flatMap(record => {
      if (record.state === 'same') return [clone(record.cloud)];
      if (record.state === 'local-only') return [clone(record.local)];
      if (record.state === 'cloud-only') return [clone(record.cloud)];
      if (key === 'studies') {
        const resolution=resolveStudyConflict(record,selections);
        studyResolutions[record.id]=resolution;
        unresolved.push(...resolution.unresolved);
        pendingPlacementKeys.push(...resolution.pendingPlacementKeys);
        return [resolution.study];
      }
      const choice=selections[record.key];
      if (choice !== 'local' && choice !== 'cloud') {
        unresolved.push({type:'record',collection:key,id:record.id,key:record.key,label:`${record.label}: ${record.local?.title || record.local?.name || record.id}`});
        return [];
      }
      selected[record.key]=choice;
      return [clone(choice === 'local' ? record.local : record.cloud)];
    });
  });
  const workspace=normaliseCaseStudyWorkspace(merged);
  const relationshipIntegrity=caseStudyRelationshipIntegrity({ local:comparison.local, cloud:comparison.cloud, workspace, comparison, selections:selected, pendingPlacementKeys });
  const unionCount=collection => comparison.collections.find(item => item.key === collection)?.records.length || 0;
  // Pending choices deliberately stay out of the save candidate, while safe
  // same-study fields and associations remain in it. The preview still shows
  // the source union so unresolved placement details are never mislabelled as
  // deletions.
  const possibleCounts={
    ...caseStudyReconciliationCounts(workspace),
    notebooks:unionCount('notebooks'),
    studies:unionCount('studies'),
    evidence:unionCount('evidence'),
    templates:unionCount('personalTemplates'),
    connections:unionCount('connections'),
    placements:Math.max(caseStudyReconciliationCounts(workspace).placements, relationshipIntegrity.placements.sourceDistinct),
    annotations:Math.max(caseStudyReconciliationCounts(workspace).annotations, relationshipIntegrity.annotations.sourceDistinct),
  };
  return {
    comparison,
    selections:selected,
    unresolved,
    workspace,
    studyResolutions,
    unresolvedReferences:relationshipIntegrity.orphaned,
    mergedCounts:caseStudyReconciliationCounts(workspace),
    possibleCounts,
    relationshipIntegrity,
    canSave:unresolved.length === 0 && relationshipIntegrity.orphaned.length === 0,
  };
};
