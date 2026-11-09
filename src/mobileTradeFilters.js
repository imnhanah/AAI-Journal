export const emptyPhoneTradeFilters = () => ({result:'All',direction:'All',sessions:[],review:'All',from:'',to:'',instrument:'',year:'',month:'',week:'',model:''});
export const PHONE_LOG_TITLE='phone-log-sheet-title';
export const PHONE_REVIEW_NEEDED='needs';
export const phoneTradeId=id=>`phone-trade-${id}`;
export function matchesPhoneTrade(trade, filters, reviewed, result) {
  if(filters.result!=='All' && filters.result!==result)return false;
  if(filters.direction!=='All' && trade.direction!==filters.direction)return false;
  const session=trade.entrySession||trade.session;
  const group=['Sydney','Tokyo','Asia'].includes(session)?'Asia':session==='NYC AM'?'NY AM':session==='NYC PM'?'NY PM':session;
  if(filters.sessions.length&&!filters.sessions.includes(group))return false;
  if(filters.review==='needs'&&(reviewed||result==='running'))return false;
  if(filters.review==='reviewed'&&!reviewed)return false;
  if(filters.from&&(!trade.date||trade.date<filters.from))return false;
  if(filters.to&&(!trade.date||trade.date>filters.to))return false;
  const day=trade.date||trade.closeDate||'';
  if(filters.instrument&&trade.asset!==filters.instrument)return false;
  if(filters.year&&day.slice(0,4)!==filters.year)return false;
  if(filters.month&&day.slice(5,7)!==filters.month)return false;
  if(filters.week&&String(Math.ceil(Number(day.slice(8,10))/7))!==filters.week)return false;
  if(filters.model&&(trade.entryType||trade.confluenceSession)!==filters.model)return false;
  return true;
}
