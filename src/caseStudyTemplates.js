const clean=value=>String(value||'').trim().replace(/\s+/g,' ');
const key=value=>clean(value).toLocaleLowerCase();
const section=value=>typeof value==='string'?{id:key(value).replace(/[^a-z0-9]+/g,'-'),title:clean(value),guidance:''}:{id:clean(value?.id)||key(value?.title).replace(/[^a-z0-9]+/g,'-'),title:clean(value?.title),guidance:clean(value?.guidance)};

export const BUILT_IN_CASE_STUDY_TEMPLATES=[
  {id:'trading-setup-research',name:'Trading Setup Research',description:'Research a repeatable trade setup from context through conclusion.',sections:['Research Objective','Market Context','Trading Hypothesis','Entry Conditions','Evidence & Observations','Limitations','Conclusion'],guidance:{'Research Objective':'Define the specific trading behavior, setup, or market condition being investigated.','Market Context':'Describe higher-timeframe structure, market environment, and relevant liquidity conditions.','Trading Hypothesis':'State the expected relationship between context, execution, and outcome.','Entry Conditions':'Record the objective conditions that must be present before entry.','Evidence & Observations':'Capture charts, examples, counterexamples, and notable observations.','Limitations':'Document sample limits, uncertainty, and conditions that could weaken the finding.','Conclusion':'Summarize what was learned and what should be tested next.'}},
  {id:'strategy-validation',name:'Strategy Validation',description:'Test a strategy with clear rules, methodology, and observations.',sections:['Strategy Overview','Research Hypothesis','Entry and Exit Rules','Testing Methodology','Results & Observations','Limitations','Conclusion'],guidance:{'Strategy Overview':'Describe the setup, market, and intended trader decision.','Research Hypothesis':'Write the claim this research will test.','Entry and Exit Rules':'List objective execution and invalidation rules.','Testing Methodology':'Describe the sample, sessions, and review method.','Results & Observations':'Record the evidence without changing the original rules.','Limitations':'State what the current sample cannot prove.','Conclusion':'Decide what the results mean for future testing.'}},
  {id:'market-structure-study',name:'Market Structure Study',description:'Document structure, liquidity, and high-timeframe context.',sections:['Research Objective','Higher-Timeframe Context','Market Structure Observations','Liquidity Analysis','Evidence & Examples','Limitations','Conclusion'],guidance:{'Research Objective':'Define the structure or liquidity behavior to examine.','Higher-Timeframe Context':'Set the broader trend, range, and key higher-timeframe levels.','Market Structure Observations':'Record swings, breaks, shifts, and consolidation behavior.','Liquidity Analysis':'Identify resting liquidity, sweeps, and reaction areas.','Evidence & Examples':'Attach representative charts and counterexamples.','Limitations':'Record timing, sample, and context constraints.','Conclusion':'Summarize the usable structure insight.'}},
  {id:'blank',name:'Blank study',description:'A clean page for documenting a focused idea.',sections:['Overview','Notes','Conclusion']},
  {id:'learning',name:'Learning note',description:'Capture a lesson while it is still fresh.',sections:['What I learned','Evidence','Practice']},
  {id:'research',name:'Research study',description:'A complete research workflow for testing a trading idea.',sections:['Research question','Hypothesis','Market context','Liquidity and structure','Chart evidence','Examples and counterexamples','Findings','Limitations','Conclusion','Next actions']},
  {id:'playbook',name:'Playbook',description:'Turn validated evidence into a repeatable setup.',sections:['Setup','Conditions','Risk','Execution','Review']},
];

export const templateSections=template=>{ const unique=new Map(); for (const item of (template?.sections||[]).map(section)) if (item.title&&!unique.has(key(item.title))) unique.set(key(item.title),item); return [...unique.values()]; };
export const templateSectionNames=template=>templateSections(template).map(item=>item.title);

export const normalisePersonalTemplate=template=>({...template,name:clean(template?.name),description:clean(template?.description),sections:templateSections(template)});

// The study keeps plain section names for compatibility with existing rich
// documents. Exact normalized-name matching is deliberately conservative: a
// renamed legacy section is never overwritten or guessed at.
export const applyTemplateToStudy=(study,template)=>{
  const existing=Array.isArray(study?.sections)?study.sections:[];
  const existingKeys=new Set(existing.map(key));
  const addedSections=templateSectionNames(template).filter(name=>!existingKeys.has(key(name)));
  return {study:{...study,sections:[...existing,...addedSections]},addedSections};
};
