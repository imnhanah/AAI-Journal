const text = value => String(value || '').trim();

export function studyInstruments(study, trades = [], markups = []) {
  const tradeIds = new Set(study?.tradeIds || []);
  const markupIds = new Set(study?.markupIds || []);
  return [...new Set([
    study?.instrument,
    ...trades.filter(item => tradeIds.has(item.id)).map(item => item.asset || item.instrument),
    ...markups.filter(item => markupIds.has(item.id)).map(item => item.instrument || item.market),
  ].map(text).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

export function studyTags(study, evidence = []) {
  const evidenceIds = new Set(study?.evidenceIds || []);
  return [...new Set([
    ...(Array.isArray(study?.tags) ? study.tags : []),
    ...evidence.filter(item => evidenceIds.has(item.id)).flatMap(item => item.tags || []),
  ].map(text).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

export function filterCaseStudies(studies, filters, { trades = [], markups = [], evidence = [] } = {}) {
  const query = text(filters.query).toLowerCase();
  return studies.filter(study => {
    const instruments = studyInstruments(study, trades, markups);
    const tags = studyTags(study, evidence);
    return (filters.status === 'All' || study.status === filters.status)
      && (filters.notebook === 'All' || study.notebookId === filters.notebook)
      && (filters.instrument === 'All' || instruments.includes(filters.instrument))
      && (filters.tag === 'All' || tags.includes(filters.tag))
      && (!query || [study.title, study.body, study.status, ...instruments, ...tags].join(' ').toLowerCase().includes(query));
  });
}

export function sortCaseStudies(studies, sort) {
  return [...studies].sort((a, b) => {
    if (sort === 'title') return String(a.title || '').localeCompare(String(b.title || ''));
    if (sort === 'created') return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
    return Number(b.pinned) - Number(a.pinned) || Number(b.favorite) - Number(a.favorite) || new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
  });
}

const newestFirst = (left, right) => new Date(right.updatedAt || 0) - new Date(left.updatedAt || 0);

export function continuingCaseStudies(studies, limit = 4) {
  return studies
    .filter(study => ['Researching', 'Needs validation', 'Draft'].includes(study.status))
    .sort(newestFirst)
    .slice(0, limit);
}

export function pinnedCaseStudies(studies, limit = 2) {
  return studies
    .filter(study => study.pinned === true)
    .sort(newestFirst)
    .slice(0, limit);
}
