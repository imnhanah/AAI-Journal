export const CASE_STUDY_BACKUP_VERSION = 1;
export const EVIDENCE_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
export const EVIDENCE_IMAGE_MAX_BYTES = 3 * 1024 * 1024;

export const validateEvidenceImage = (file) => {
  if (!file) return 'Choose a chart image first.';
  if (!EVIDENCE_IMAGE_TYPES.includes(file.type)) return 'Use a PNG, JPEG, or WebP chart image.';
  if (file.size > EVIDENCE_IMAGE_MAX_BYTES) return 'Chart images must be 3 MB or smaller.';
  return null;
};

export const readEvidenceImage = (file) => new Promise((resolve, reject) => {
  const error = validateEvidenceImage(file); if (error) { reject(new Error(error)); return; }
  const reader = new FileReader(); reader.onerror = () => reject(new Error('The chart image could not be read.'));
  reader.onload = () => resolve(String(reader.result)); reader.readAsDataURL(file);
});

export const normaliseCaseStudyWorkspace = (raw) => {
  const source = raw && typeof raw === 'object' ? raw : {};
  const notebooks = Array.isArray(source.notebooks) ? source.notebooks : [];
  return {
    ...source,
    notebooks,
    studies: Array.isArray(source.studies) ? source.studies.map((study) => ({
      ...study,
      evidenceIds: Array.isArray(study.evidenceIds) ? study.evidenceIds : [],
      evidencePlacements: study.evidencePlacements && typeof study.evidencePlacements === 'object' ? study.evidencePlacements : {},
      tradeIds: Array.isArray(study.tradeIds) ? study.tradeIds : [],
      markupIds: Array.isArray(study.markupIds) ? study.markupIds : [],
      relatedStudyIds: Array.isArray(study.relatedStudyIds) ? study.relatedStudyIds : [],
      validation: study.validation && typeof study.validation === 'object' ? study.validation : null,
    })) : [],
    evidence: Array.isArray(source.evidence) ? source.evidence.map((item) => ({ ...item, tags:Array.isArray(item.tags) ? item.tags : [], archived:!!item.archived })) : [],
    personalTemplates: Array.isArray(source.personalTemplates) ? source.personalTemplates.map((template) => ({ ...template, sections:Array.isArray(template.sections) ? template.sections : [] })) : [],
    settings: { view:'grid', query:'', status:'All', notebook:'All', ...(source.settings || {}) },
  };
};

export const unlinkEvidence = (workspace, evidenceId) => ({
  ...workspace,
  evidence: workspace.evidence.filter((item) => item.id !== evidenceId),
  studies: workspace.studies.map((study) => {
    const placements = { ...(study.evidencePlacements || {}) };
    delete placements[evidenceId];
    return { ...study, evidenceIds:(study.evidenceIds || []).filter((id) => id !== evidenceId), evidencePlacements:placements };
  }),
});

export const linkEvidence = (study, evidenceId) => ({
  ...study,
  evidenceIds: study.evidenceIds?.includes(evidenceId) ? study.evidenceIds : [...(study.evidenceIds || []), evidenceId],
  evidencePlacements: { ...(study.evidencePlacements || {}), [evidenceId]: study.evidencePlacements?.[evidenceId] || { caption:'', observation:'', annotations:[] } },
});

export const linkRelatedStudy = (study, relatedStudyId) => ({
  ...study,
  relatedStudyIds: study.relatedStudyIds?.includes(relatedStudyId) ? study.relatedStudyIds : [...(study.relatedStudyIds || []), relatedStudyId],
});

export const caseStudyBackup = (workspace) => ({ version:CASE_STUDY_BACKUP_VERSION, kind:'aaicorefx-case-study-library', exportedAt:new Date().toISOString(), workspace:normaliseCaseStudyWorkspace(workspace) });

export const mergeCaseStudyWorkspace = (current, incoming, { conflict = 'copy' } = {}) => {
  const base = normaliseCaseStudyWorkspace(current);
  const next = normaliseCaseStudyWorkspace(incoming);
  const unique = (existing, items, prefix) => items.reduce((all, item) => {
    if (!all.some((saved) => saved.id === item.id)) return [...all, item];
    if (conflict === 'replace') return all.map((saved) => saved.id === item.id ? item : saved);
    return [...all, { ...item, id:`${prefix}-${item.id}-${Date.now()}`, title:item.title ? `${item.title} (imported)` : item.title, name:item.name ? `${item.name} (imported)` : item.name }];
  }, existing);
  return { ...base, notebooks:unique(base.notebooks, next.notebooks, 'notebook'), evidence:unique(base.evidence, next.evidence, 'evidence'), personalTemplates:unique(base.personalTemplates, next.personalTemplates, 'template'), studies:unique(base.studies, next.studies, 'study') };
};
