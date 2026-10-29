// Dev-only entry. Tests use synthetic local data, never a signed-in user's journal.
import React from 'react';
import {createRoot} from 'react-dom/client';
import {TradingJournalApp,FinanceReminderModal} from '../src/TradingJournal.jsx';
import {createPortal} from 'react-dom';
import ChallengeCompletionCelebration from '../src/ChallengeCelebration.jsx';
import * as local from '../src/localJournalDb.js';
import {supabase} from '../src/supabaseClient.js';
import {loadAccent} from '../src/siteTheme.js';
import {activatePrivateUser} from '../src/privateCacheRuntime.js';
import {eurusdSample,sampleRandom} from '../src/backtestSample.js';
import {normalizeEvents} from '../src/forexFactory.js';
import {newsWeekKey} from '../src/newsArchive.js';
import {TRADING_QUOTES} from '../src/loginQuote.js';
import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import '../src/themeTokens.css';
import '../src/typographyTokens.css';
import '../src/analyticsLayout.css';
import '../src/shellAlignment.css';
import '../src/financeRedesign.css';
import '../src/backtestRedesign.css';
import '../src/calendarDayPopup.css';
import '../src/reviewLibraryRedesign.css';
import '../src/mobileFrame.css';
import '../src/mobileCalendar.css';
import '../src/mobileReview.css';
import '../src/mobileProfile.css';
import '../src/mobileLogTrade.css';
import '../src/mobileMarkups.css';
import '../src/mobileDashboard.css';
import '../src/mobileAnalytics.css';
import '../src/mobileBacktest.css';
import '../src/mobilePsychology.css';
import '../src/mobileNews.css';
import '../src/mobileChallenge.css';
import '../src/mobileManagement.css';
import '../src/mobileAccountSettings.css';
import '../src/mobilePopups.css';
const params=new URLSearchParams(location.search);
if(params.get('desktopBaseline')!=='1')await import('../src/mobileRules.css');
const nativeFetch=window.fetch.bind(window);
// Stable quote selection makes before/after desktop screenshots comparable.
Math.random=()=>0.5;
TRADING_QUOTES.fill(TRADING_QUOTES[0]);
window.fetch=(input,init)=>{const url=new URL(typeof input==='string'?input:input.url,location.href);if(url.pathname.startsWith('/mock'))return Promise.resolve(new Response(JSON.stringify({cloud_sync_enabled:false}),{headers:{'Content-Type':'application/json'}}));if(url.origin!==location.origin)return Promise.reject(new Error('External requests are disabled in the layout fixture.'));return nativeFetch(input,init);};
const NativeDate=window.Date,fixed=NativeDate.parse('2026-10-12T09:00:00Z');
window.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:[fixed]));}static now(){return fixed;}};
// Synthetic cached events exercise cards and alert controls without a live feed.
for(const offset of [-1,0,1]){
  const week=new Date(newsWeekKey(offset));
  const events=normalizeEvents(['Central bank policy statement','Consumer inflation expectations','Employment change','Unemployment claims'].map((title,index)=>{
    const date=new Date(week);date.setDate(date.getDate()+index+1);date.setHours(12,15,0,0);
    return {title,date:date.toISOString(),country:index===1?'GBP':'USD',impact:index%2?'Medium':'High',previous:'197K',forecast:'200K'};
  }));
  localStorage.setItem(`ff-cache:${newsWeekKey(offset)}`,JSON.stringify({events,source:'cache',fetchedAt:fixed}));
}
const theme=params.get('theme')||'dark',accent=params.get('accent')||'default';
const user={id:params.get('longFigures')==='1'?'00000000-0000-4000-8000-000000000002':'00000000-0000-4000-8000-000000000001',email:'fixture@example.invalid',created_at:'2026-01-01',email_confirmed_at:'2026-01-01',user_metadata:{display_name:'Nana',theme_preference:theme,accent_color:accent,demo_history_version:6,dailyRoutine:{customItems:[{id:'affirmations',label:'Read my affirmations',group:'before',enabled:true}]}}};
supabase.auth.getUser=async()=>({data:{user},error:null});
supabase.auth.updateUser=async({data})=>{Object.assign(user.user_metadata,data);return {data:{user},error:null};};
const testRun={id:'fixture-run',name:'EUR/USD · M15',instrument:'EUR/USD',timeframe:'M15',strategy:'Generated sample',startingBalance:10000,riskPct:1,tradeTarget:20,currency:'USD',plan:'Illustrative sample: 4 wins at +3R and 6 losses at -1R. Fixed $100 risk, no costs.',conclusion:'Sample only — not historical performance.',sample:true,rules:[],updatedAt:'2026-10-12T09:00:00Z'};
const testTrades=eurusdSample(testRun.id,sampleRandom('mobile-fixture')).map((t,index)=>({...t,id:`fixture-test-trade-${index}`,updatedAt:testRun.updatedAt}));
// Exercise the legacy migration in synthetic memory; all unrelated writes remain blocked.
const backtestFixtureAudit={};window.__backtestFixtureAudit=backtestFixtureAudit;
supabase.rpc=(function createBacktestFixtureRpc(run,trades,demoId='fixture-workspace',audit={}){
  let stored=structuredClone(run);const savedTrades=structuredClone(trades);
  audit.initiallyUnassigned=!stored.workspaceId;audit.migrations=0;
  return async(name,args={})=>{
    if(name==='tj_sync_backtests')return {data:{runs:[structuredClone(stored)],trades:structuredClone(savedTrades),runVersions:[{id:stored.id,updatedAt:stored.updatedAt}],tradeVersions:savedTrades.map(t=>({id:t.id,updatedAt:t.updatedAt}))},error:null};
    if(name==='tj_save_backtest_run'){
      const desired=args.settings;
      const original={...stored},incoming={...desired};delete original.workspaceId;delete incoming.workspaceId;
      if(args.remove_row!==false||args.row_id!==stored.id||args.expected_version!==stored.updatedAt||stored.workspaceId||desired?.workspaceId!==demoId||JSON.stringify(original)!==JSON.stringify(incoming))return {data:null,error:{message:'Fixture rejects an invalid legacy ownership migration.'}};
      stored={...stored,workspaceId:demoId,updatedAt:'2026-10-12T09:00:01Z'};
      audit.migrations++;audit.workspaceId=demoId;audit.runId=stored.id;
      return {data:structuredClone(stored),error:null};
    }
    return {data:null,error:{message:'Mutations are disabled in the layout fixture.'}};
  };
})(testRun,testTrades,"fixture-workspace",backtestFixtureAudit);
local.configureLocalJournal(user.id,true);
await activatePrivateUser(user.id);
const loaded=await local.fetchAllUserData(user.id),data=loaded.data,account=data.accounts[0];
account.id='fixture-workspace';account.name='Demo';account.financeEnabled=true;account.finance={enabled:true,tradingTarget:50000};account.challengeEnabled=true;account.challengeStartingBalance=1000;account.challengeLevelCount=10;
account.workspaceType='multi_balance';
account.balances=[1000,40000,12310].map((balance,index)=>({...account.balances[0],id:`fixture-balance-${index}`,workspaceId:account.id,name:`Account ${index+1}`,startingBalance:balance,challengeEnabled:true,challengeStartingBalance:balance,challengeLevelCount:10}));
account.trades=account.trades.map((t,index)=>({...t,date:index<260?'2026'+t.date.slice(4):`2026-10-${['02','06','08','10'][index%4]}`,time:'09:53',id:`fixture-trade-${index}`,accountId:account.id,moodBefore:'Focused',moodAfter:index%4?'Disciplined':'Calm',mistakes:index%10?[]:['Early Exit'],entryType:'Breakout Retest',confluence:['Liquidity'],rr:t.pnl>0?3:-1,rating:4}));
account.savingsAccounts=[{id:'fixture-savings-1',name:'Demo Savings',target:50000,allocationPct:20,ownerBalanceId:account.balances[0].id,interval:'weekly',intervalValue:30},{id:'fixture-savings-2',name:'Testing',target:100000,allocationPct:20,ownerBalanceId:account.balances[0].id,interval:'weekly',intervalValue:30}];
account.financeMovements=[{id:'fixture-cash-1',type:'withdrawal',source:'trading',amount:8917.26,date:'2026-10-08',balanceId:account.balances[0].id,note:'Withdrawal from trading'},{id:'fixture-cash-2',type:'transfer',source:'trading',amount:13145.37,date:'2026-10-02',balanceId:account.balances[0].id,savingsAccountId:account.savingsAccounts[0].id,note:'10% of profit since last cash movement'}];
if(params.get('longFigures')==='1'){
  const assigned=new Set(),primary=account.balances[0];
  const shot='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 100"><path d="M4 80 L25 58 L44 68 L68 26 L93 53 L114 36 L137 44 L156 12" fill="none" stroke="#758b91" stroke-width="2"/></svg>');
  account.trades=account.trades.map(trade=>{
    let pnl=Number(trade.pnl)||0;
    if(['2026-10-02','2026-10-06'].includes(trade.date)){
      pnl=assigned.has(trade.date)?0:trade.date==='2026-10-02'?1222184.60:-26350;
      assigned.add(trade.date);
    }
    return {...trade,pnl,grossPnl:pnl,netPnl:pnl,commission:0,swap:0,screenshots:trade.date==='2026-10-02'?{entry:Array.from({length:5},()=>shot),exit:[]}:trade.screenshots,balanceResults:[{balanceId:primary.id,grossPnl:pnl,netPnl:pnl,commission:0,swap:0}]};
  });
  const total=account.trades.reduce((sum,trade)=>sum+trade.pnl,0);
  primary.startingBalance=12340601.40-total+8917.26+13145.37;
  account.balances.slice(1).forEach(balance=>{balance.startingBalance=0;});
  account.balance=primary.startingBalance;
}
data.typeTags=['Liquidity','Session confirmation'];data.mistakeTags=['Early Exit','Overtrading'];data.confluenceSessions=['Breakout Retest'];
data.markups=[{id:'fixture-markup',accountId:account.id,date:'2026-10-02',time:'08:15',instrument:'EUR/USD',session:'London',bias:'Bullish',status:'Executed',structure:'Synthetic planned structure',keyLevels:'Range · liquidity · zone',expectations:'Wait for the planned retest',screenshots:{}}];
// Regression preview for legacy end-of-day records; never modifies real journals.
if(params.get('markupStatus')==='Passed')data.markups[0].status='Passed';
// Test-only: preview live same-day statuses without end-of-day expiry.
const visualStatus=params.get('visualStatus');
if(['Planned','Watching','Executed','Not Executed'].includes(visualStatus)){
  data.markups[0].status=visualStatus;data.markups[0].date='2026-10-12';
}
// Test-only: opt-in large savings and outstanding partial transfers.
if(params.get('financeLong')==='1')(function configureFinanceLong(account) {
  const owner=account.balances[0].id;
  account.savingsAccounts=account.savingsAccounts.map((saving,index)=>({...saving,
    target:index===0?50000000:100000000,allocationPct:index===0?20:30,
  }));
  account.trades=[{id:'fixture-large-profit',accountId:account.id,instrument:'EUR/USD',
    date:'2026-10-09',time:'09:00',closeDate:'2026-10-09',closeTime:'10:00',status:'closed',
    pnl:123456789.10,grossPnl:123456789.10,netPnl:123456789.10,commission:0,swap:0,
    balanceResults:[{balanceId:owner,grossPnl:123456789.10,netPnl:123456789.10,commission:0,swap:0}],
  }];
  account.financeMovements=account.savingsAccounts.map((saving,index)=>({
    id:`fixture-large-transfer-${index}`,type:'transfer',source:'trading',
    amount:index===0?12345678.90:23456789.01,date:'2026-10-10',balanceId:owner,
    savingsAccountId:saving.id,note:'Synthetic partial savings transfer',
  }));
})(account);
await local.importLocalJournal(user.id,{version:1,data});
localStorage.setItem('tj:site-theme',theme);localStorage.setItem('tj:profile-accent',accent);
localStorage.setItem('tj-savings-alert-sound','off');
loadAccent();
function FixturePopup(){
  const [host,setHost]=React.useState(null),[open,setOpen]=React.useState(true);
  React.useEffect(()=>{const find=()=>{const root=document.querySelector('.tj-root');if(root){setHost(root);observer.disconnect();}};const observer=new MutationObserver(find);observer.observe(document.body,{childList:true,subtree:true});find();return()=>observer.disconnect();},[]);
  if(!host||!open||!params.get('popup'))return null;
  return createPortal(params.get('popup')==='challenge'?<ChallengeCompletionCelebration accountName="Account 3" totalLevels={10} startingBalance={500} finalBalance={64205000.5} soundEnabled={false} onClose={()=>setOpen(false)}/>:<FinanceReminderModal account={account} savingsPlans={account.savingsAccounts} onClose={()=>setOpen(false)} onOpenFinance={()=>setOpen(false)}/>,host);
}
await Promise.all(['Inter Variable','JetBrains Mono Variable'].map(font=>document.fonts.load(`14px "${font}"`)));
createRoot(document.getElementById('root')).render(<React.Suspense fallback={<p>Loading fixture…</p>}><style>{`*,*::before,*::after{animation:none!important;transition:none!important;}`}</style><TradingJournalApp user={user} onLogout={()=>{}}/><FixturePopup/></React.Suspense>);
