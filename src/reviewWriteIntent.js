const baseKey='__aaiReviewBase';
export function editReviewIntent(current,key,text,answers,revision) {
 const next={...current};
 if(!Object.hasOwn(next,baseKey))next[baseKey]=Object.keys(current).length ? {verified:false} : {verified:revision===null||typeof revision==='string',revision};
 if(text===(answers[key]??''))delete next[key];else next[key]=text;
 return next;
}
export function readReviewIntent(value) {
 const {[baseKey]:base,...changed}=value;
 if(!base?.verified || !Object.hasOwn(base,'revision'))throw new Error('This recovered review needs comparison with the saved version before syncing. Your original draft is kept.');
 return {changed,baseRevision:base.revision};
}
export const reviewIntentAnswers = value => Object.fromEntries(Object.entries(value).filter(([key])=>key!==baseKey));
