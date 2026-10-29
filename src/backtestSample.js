// Explicit demo data only; never mixed into live trading history.
export function sampleRandom(seed) {
 let state=[...seed].reduce((s,c)=>Math.imul(s^c.charCodeAt(0),16777619),2166136261)|0;
 return ()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return (state>>>0)/4294967296;};
}
export function eurusdSample(runId, random=Math.random) {
 const results=[3,3,3,3,-1,-1,-1,-1,-1,-1];
 for(let i=results.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[results[i],results[j]]=[results[j],results[i]];}
 return results.map((rr,i)=>({
   id:crypto.randomUUID(),runId,backtest:true,asset:'EUR/USD',direction:random()<.5?'BUY':'SELL',
   date:`2026-09-${String(i+14).padStart(2,'0')}`,time:'08:30',closeDate:`2026-09-${String(i+14).padStart(2,'0')}`,closeTime:'10:00',
   riskPct:1,riskAmount:100,grossPnl:rr*100,pnl:rr*100,commission:0,swap:0,rr,
   timeframe:'M15',entryType:'Sample setup',strategy:'Sample setup',session:'London',entrySession:'London',
   confluence:[],types:[],mistakes:[],ruleEvaluations:[],moodBefore:'Neutral',moodAfter:'Neutral',
   context:'Generated sample trade — not an actual historical execution. Fixed $100 risk; wins +3R and losses −1R.',
   screenshots:{entry:[],exit:[]},mediaEdited:true,_mediaLoaded:true,premarketMarkupId:null,
 }));
}
