import { templateSectionNames } from './caseStudyTemplates.js';

const text = (value) => String(value || '').trim();

export function initialCaseStudyDraft({ notebooks = [], templates = [] } = {}) {
  return {
    title: '',
    notebookId: notebooks.find((notebook) => notebook.id === 'notes')?.id || notebooks[0]?.id || '',
    templateId: templates[0]?.id || '',
    instrument: '',
    context: '',
  };
}

export function hasCaseStudyDraftChanges(draft, initial) {
  return ['title', 'notebookId', 'templateId', 'instrument', 'context'].some((key) => text(draft?.[key]) !== text(initial?.[key]));
}

export function caseStudyDraftError(draft) {
  return text(draft?.title) ? '' : 'Enter a study title before creating the draft.';
}

export function createCaseStudyDraft({ draft, template, id, createdAt, richDocument }) {
  const context = text(draft.context);
  const sections=templateSectionNames(template);
  const firstSection = sections[0] || 'Overview';
  return {
    id,
    title: text(draft.title),
    notebookId: draft.notebookId,
    templateId: template.id,
    instrument: text(draft.instrument),
    sections,
    body: context,
    sectionNotes: context ? { [firstSection]: context } : {},
    richDocument,
    status: 'Draft',
    evidenceIds: [],
    tradeIds: [],
    markupIds: [],
    relatedStudyIds: [],
    favorite: false,
    pinned: false,
    archived: false,
    createdAt,
    updatedAt: createdAt,
    revisionCount: 1,
  };
}
