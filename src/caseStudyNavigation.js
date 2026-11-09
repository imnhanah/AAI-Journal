const keyFor = owner => `aai:case-study-navigation:${owner}`;
const modes = new Set(['Write','Split','Analyze','Review']);

export const normaliseCaseStudyNavigation = value => {
  if (!value || typeof value !== 'object' || typeof value.studyId !== 'string' || !value.studyId) return null;
  return {
    studyId:value.studyId,
    mode:modes.has(value.mode) ? value.mode : 'Write',
    reviewStep:Number.isInteger(value.reviewStep) && value.reviewStep >= 0 && value.reviewStep <= 3 ? value.reviewStep : 0,
  };
};

export const readCaseStudyNavigation = owner => {
  if (!owner) return null;
  try { return normaliseCaseStudyNavigation(JSON.parse(sessionStorage.getItem(keyFor(owner)) || 'null')); }
  catch { return null; }
};

export const writeCaseStudyNavigation = (owner, value) => {
  const navigation=normaliseCaseStudyNavigation(value); if (!owner || !navigation) return;
  try { sessionStorage.setItem(keyFor(owner),JSON.stringify(navigation)); } catch {}
};

export const clearCaseStudyNavigation = owner => { if (!owner) return; try { sessionStorage.removeItem(keyFor(owner)); } catch {} };
