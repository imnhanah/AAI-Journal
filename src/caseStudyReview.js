const textIsMeaningful = (value, minimum = 12) => {
  const cleaned = String(value || '').trim().replace(/\s+/g, ' ');
  if (cleaned.length < minimum) return false;
  return !/^(?:n\/?a|none|tbd|todo|test|placeholder)[.! ]*$/i.test(cleaned);
};

export const REVIEW_STEPS = [
  { id:'hypothesis', title:'Hypothesis', description:'Assess the idea', heading:'Assess your hypothesis', helper:'What does your research suggest about the original idea?' },
  { id:'evidence', title:'Evidence', description:'Weigh the charts', heading:'Review your evidence', helper:'Distinguish supporting and contradicting observations.' },
  { id:'limitations', title:'Limitations', description:'What remains uncertain', heading:'Identify limitations', helper:'Record uncertainty and what you still need to test.' },
  { id:'conclusion', title:'Conclusion', description:'Final research verdict', heading:'Write your conclusion', helper:'Summarize your research in a clear, defensible verdict.' },
];

export const normaliseCaseStudyReview = (value) => {
  const review = value && typeof value === 'object' ? value : {};
  return {
    assessment:['Supported','Not Supported','Inconclusive'].includes(review.assessment) ? review.assessment : '',
    explanation:typeof review.explanation === 'string' ? review.explanation : '',
    evidence:review.evidence && typeof review.evidence === 'object' ? review.evidence : {},
    limitations:typeof review.limitations === 'string' ? review.limitations : '',
    lessons:typeof review.lessons === 'string' ? review.lessons : '',
    nextSteps:typeof review.nextSteps === 'string' ? review.nextSteps : '',
    conclusion:typeof review.conclusion === 'string' ? review.conclusion : '',
    updatedAt:typeof review.updatedAt === 'string' ? review.updatedAt : null,
  };
};

export const reviewReadiness = (review) => {
  const value = normaliseCaseStudyReview(review);
  const checks = [
    { id:'assessment', step:0, label:'Hypothesis assessed', detail:'Choose Supported, Not Supported, or Inconclusive.', complete:!!value.assessment },
    { id:'reasoning', step:0, label:'Hypothesis reasoning provided', detail:'Explain why the evidence led to this assessment.', complete:textIsMeaningful(value.explanation) },
    { id:'conclusion', step:3, label:'Conclusion recorded', detail:'Record a substantive final research conclusion.', complete:textIsMeaningful(value.conclusion, 20) },
  ];
  const complete = checks.filter((check) => check.complete).length;
  return { checks, complete, total:checks.length, percentage:Math.round((complete / checks.length) * 100), ready:complete === checks.length };
};

export const patchStudyReview = (study, patch, timestamp = new Date().toISOString()) => ({
  ...study,
  review:{ ...normaliseCaseStudyReview(study.review), ...patch, updatedAt:timestamp },
});
