export const isClosedTest = t => !!t && t.pnl !== null && t.pnl !== '' && Number.isFinite(Number(t.pnl)) && !String(t.context || '').includes('[aaicorefx-running-trade]');
// Older saved runs predate test types. Treating them as backtests keeps their
// history intact while allowing new forward tests to use the same isolated data model.
export const testType = run => run?.testType === 'forward' ? 'forward' : 'backtest';
export const testTypeLabel = run => testType(run) === 'forward' ? 'Forward Test' : 'Backtest';
export const orderTestTrades = trades => [...trades].sort((a,b) => `${a.closeDate || a.date || ''} ${a.closeTime || a.time || ''}`.localeCompare(`${b.closeDate || b.date || ''} ${b.closeTime || b.time || ''}`) || String(a.id).localeCompare(String(b.id)));
export function backtestStats(run, trades = []) {
  const closed = orderTestTrades(trades.filter(isClosedTest));
  const wins = closed.filter(t=>Number(t.pnl)>0), losses=closed.filter(t=>Number(t.pnl)<0);
  const net=closed.reduce((s,t)=>s+Number(t.pnl||0),0), gain=wins.reduce((s,t)=>s+Number(t.pnl),0), loss=-losses.reduce((s,t)=>s+Number(t.pnl),0);
  const rr=closed.filter(t=>t.rr!=='' && t.rr!=null && Number.isFinite(Number(t.rr)));
  let balance=Number(run.startingBalance), peak=balance, drawdown=0;
  const equity=[{label:'Start',balance,id:'start'}];
  for(const t of closed) { balance+=Number(t.pnl||0); peak=Math.max(peak,balance); drawdown=Math.max(drawdown,peak-balance); equity.push({label:t.closeDate||t.date,balance,id:t.id}); }
  const recent=[...closed].reverse().slice(0,5);
  const sign=Math.sign(Number(recent[0]?.pnl||0)); let streak=0;
  for(const t of [...closed].reverse()) { if(Math.sign(Number(t.pnl||0))!==sign || !sign)break; streak++; }
  const groups = field => {
    const grouped=new Map();
    for(const t of closed) for(const label of new Set(Array.isArray(t[field]) ? t[field] : [t[field]||'Not tagged'])) { const x=grouped.get(label)||{label,total:0,wins:0,pnl:0}; x.total++;x.wins+=Number(Number(t.pnl)>0);x.pnl+=Number(t.pnl||0);grouped.set(label,x); }
    return [...grouped.values()].map(x=>({...x,rate:100*x.wins/x.total})).sort((a,b)=>b.pnl-a.pnl||a.label.localeCompare(b.label));
  };
  const rules=closed.flatMap(t=>t.ruleEvaluations||[]);
  const days=new Map();for(const t of closed) {const date=t.closeDate||t.date;days.set(date,(days.get(date)||0)+Number(t.pnl||0));}
  return {closed,total:closed.length,wins:wins.length,losses:losses.length,flat:closed.length-wins.length-losses.length,net,balance,equity,drawdown,winRate:closed.length?100*wins.length/closed.length:null,averageR:rr.length?rr.reduce((s,t)=>s+Number(t.rr),0)/rr.length:null,profitFactor:loss?gain/loss:gain?Infinity:null,expectancy:closed.length?net/closed.length:null,averageWin:wins.length?gain/wins.length:null,averageLoss:losses.length?-loss/losses.length:null,recent,streak,streakType:sign>0?'win':sign<0?'loss':'flat',sessions:groups('session'),models:groups('entryType'),confluences:groups('confluence'),ruleRate:rules.length?100*rules.filter(r=>r.checked).length/rules.length:null,bestDay:[...days].sort((a,b)=>b[1]-a[1])[0],status:closed.length>=Number(run.tradeTarget)?'Completed':closed.length?'In progress':'Ready'};
}
export function mergeBacktestDelta(previous, delta) {
  if(!Array.isArray(delta.runVersions)||!Array.isArray(delta.tradeVersions)||!Array.isArray(delta.runs)||!Array.isArray(delta.trades))throw new Error('Incomplete backtest sync. Cached data is unchanged.');
  const merge=(old=[], manifest=[], changed=[])=>{
    const existing=new Map(old.map(r=>[r.id,r])),fresh=new Map(changed.map(r=>[r.id,r]));
    return manifest.map(v=>{const record=fresh.get(v.id)||existing.get(v.id);if(!record||record.updatedAt!==v.updatedAt)throw new Error('Incomplete backtest sync. Cached data is unchanged.');return record;});
  };
  return {runs:merge(previous.runs,delta.runVersions,delta.runs),trades:merge(previous.trades,delta.tradeVersions,delta.trades)};
}
export function protectTestTrade(run, trade) {
  if(trade.asset!==run.instrument)throw new Error('This backtest is limited to '+run.instrument+'.');
  const {screenshots,mediaEdited,_mediaLoaded,...metadata}=trade;
  if(mediaEdited&&!_mediaLoaded&&trade.updatedAt)throw new Error('Open screenshots before replacing existing media.');
  return {metadata,screenshots:(!trade.id||mediaEdited)?screenshots:undefined};
}
// Stable import keys make retries safe without deleting original local trades.
export async function legacyTestId(user,kind,key) {
  const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([user,kind,key]))));
  bytes[6]=(bytes[6]&15)|80;bytes[8]=(bytes[8]&63)|128;
  const hex=[...bytes.slice(0,16)].map(x=>x.toString(16).padStart(2,'0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
