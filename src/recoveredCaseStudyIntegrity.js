import { caseStudyBackup, normaliseCaseStudyWorkspace } from './caseStudyWorkspace.js';

const BUILT_IN_TEMPLATE_IDS = new Set(['blank', 'learning', 'research', 'playbook', 'lesson', 'week']);
const asItems = value => Array.isArray(value) ? value : [];
const asObject = value => value && typeof value === 'object' && !Array.isArray(value) ? value : null;
const idProblems = (items, kind) => {
  const seen=new Set(), duplicateIds=[], missingIds=[];
  asItems(items).forEach((item, index) => {
    const id=typeof item?.id === 'string' || typeof item?.id === 'number' ? String(item.id).trim() : '';
    if (!id) { missingIds.push({kind,index}); return; }
    if (seen.has(id)) duplicateIds.push({kind,id}); else seen.add(id);
  });
  return { ids:seen, duplicateIds, missingIds };
};

// Pure inspection only: this must stay free of storage, network, and mutation.
export const auditRecoveredCaseStudyWorkspace = raw => {
  const workspace=normaliseCaseStudyWorkspace(raw);
  const collections={ notebooks:workspace.notebooks, studies:workspace.studies, evidence:workspace.evidence, templates:workspace.personalTemplates };
  const idAudits=Object.fromEntries(Object.entries(collections).map(([kind, items]) => [kind,idProblems(items,kind)]));
  const problems=[...Object.values(idAudits).flatMap(result => [...result.duplicateIds, ...result.missingIds])];
  const evidenceIds=idAudits.evidence.ids, notebookIds=idAudits.notebooks.ids, studyIds=idAudits.studies.ids;
  const templateIds=new Set([...BUILT_IN_TEMPLATE_IDS, ...idAudits.templates.ids]);
  const counts={ studies:workspace.studies.length, notebooks:workspace.notebooks.length, evidence:workspace.evidence.length, templates:workspace.personalTemplates.length, placements:0, annotations:0, boardObjects:0, boardDrawings:0, textObjects:0, sectionNotes:0, richDocuments:0, captions:0, observations:0 };

  workspace.studies.forEach(study => {
    const studyId=String(study?.id || 'unknown');
    if (study?.notebookId && !notebookIds.has(String(study.notebookId))) problems.push({kind:'missing-notebook',studyId,id:String(study.notebookId)});
    if (study?.templateId && !templateIds.has(String(study.templateId))) problems.push({kind:'missing-template',studyId,id:String(study.templateId)});
    asItems(study?.relatedStudyIds).forEach(id => { if (!studyIds.has(String(id))) problems.push({kind:'missing-related-study',studyId,id:String(id)}); });
    asItems(study?.evidenceIds).forEach(id => { if (!evidenceIds.has(String(id))) problems.push({kind:'missing-evidence',studyId,id:String(id)}); });
    if (asObject(study?.sectionNotes)) counts.sectionNotes += 1;
    if (asObject(study?.richDocument)) counts.richDocuments += 1;
    const placements=asObject(study?.evidencePlacements);
    if (study?.evidencePlacements && !placements) { problems.push({kind:'malformed-placements',studyId}); return; }
    Object.entries(placements || {}).forEach(([evidenceId, placement]) => {
      counts.placements += 1;
      if (!evidenceIds.has(String(evidenceId))) problems.push({kind:'placement-missing-evidence',studyId,id:evidenceId});
      if (!asItems(study?.evidenceIds).map(String).includes(String(evidenceId))) problems.push({kind:'placement-not-linked-to-study',studyId,id:evidenceId});
      const value=asObject(placement);
      if (!value) { problems.push({kind:'malformed-placement',studyId,id:evidenceId}); return; }
      if (Object.prototype.hasOwnProperty.call(value,'caption')) counts.captions += 1;
      if (Object.prototype.hasOwnProperty.call(value,'observation')) counts.observations += 1;
      if (value.annotations != null && !Array.isArray(value.annotations)) problems.push({kind:'malformed-annotations',studyId,id:evidenceId});
      counts.annotations += asItems(value.annotations).length;
      if (value.board != null && !asObject(value.board)) { problems.push({kind:'malformed-board',studyId,id:evidenceId}); return; }
      const objects=asItems(value.board?.objects);
      counts.boardObjects += objects.length;
      objects.forEach(object => {
        if (!asObject(object)) { problems.push({kind:'malformed-board-object',studyId,id:evidenceId}); return; }
        if (object.tool === 'text') counts.textObjects += 1;
        else counts.boardDrawings += 1;
      });
    });
  });
  return { counts, problems, valid:problems.length === 0 };
};

export const auditRecoveredCaseStudyBackup = (workspace, backup = caseStudyBackup(workspace)) => {
  const candidate=backup?.workspace || backup?.data?.profileCaseStudyLibrary;
  const expected=normaliseCaseStudyWorkspace(workspace);
  const actual=normaliseCaseStudyWorkspace(candidate);
  const descriptorCount=asItems(actual.legacyAccountLibraries).length;
  return {
    valid:!!candidate
      && actual.studies.length === expected.studies.length
      && actual.notebooks.length === expected.notebooks.length
      && actual.evidence.length === expected.evidence.length
      && actual.personalTemplates.length === expected.personalTemplates.length
      && descriptorCount === asItems(expected.legacyAccountLibraries).length,
    descriptorCount,
    counts:{ studies:actual.studies.length, notebooks:actual.notebooks.length, evidence:actual.evidence.length, templates:actual.personalTemplates.length },
  };
};
