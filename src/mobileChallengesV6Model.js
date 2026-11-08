export const mobileChallengeLevelState = (state, level, currentLevel, failed) => {
  const status = state?.statuses?.[level] || '';
  if (status === 'Pass') return 'passed';
  if (status === 'Jumped') return 'jumped';
  if (failed && level === currentLevel) return 'failed';
  if (level === currentLevel) return 'current';
  return 'pending';
};

export const mobileChallengeCounts = (state = {}) => ({
  passed: Object.values(state.statuses || {}).filter(status => status === 'Pass').length,
  jumped: Object.values(state.statuses || {}).filter(status => status === 'Jumped').length,
});

// One label and colour for each level row, keeping manual statuses visible.
export const mobileChallengeRowStatus = (state, level, currentLevel, failed) => {
  const status = state?.statuses?.[level] || '';
  const derived = mobileChallengeLevelState(state, level, currentLevel, failed);
  if (derived === 'passed') return {tone:'passed', label:'Passed', value:'Pass'};
  if (derived === 'jumped') return {tone:'funded', label:'Funded', value:'Jumped'};
  if (derived === 'failed') return {tone:'stepback', label:'Paused', value:status};
  if (status === 'Step back') return {tone:'stepback', label:'Step back', value:'Step back'};
  if (derived === 'current' || status === 'In progress') return {tone:'progress', label:'In progress', value:'In progress'};
  return {tone:'pending', label:'Not started', value:''};
};

export const mobileChallengeRanges = (count = 0, size = 10) => {
  const ranges = [];
  for (let from = 1; from <= count; from += size) {
    const to = Math.min(count, from + size - 1);
    ranges.push({from, to, label:`Levels ${from}–${to}`});
  }
  return ranges.length ? ranges : [{from:1, to:count, label:`Levels 1–${count}`}];
};
