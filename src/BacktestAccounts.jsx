import React,{useState,useEffect,useRef,useContext,useLayoutEffect} from 'react';
import {BacktestViewContext} from './BacktestViewSession.jsx';
import {reconcileBacktestView} from './backtestViewState.js';
import {Plus,FlaskConical,Settings,Trash2,CheckCircle2,X,ArrowLeft,ChevronDown,ChevronUp} from 'lucide-react';
import {useDisclosureScroll} from './useDisclosureScroll';
import {ResponsiveContainer,AreaChart,Area,XAxis,YAxis,CartesianGrid,Tooltip,ReferenceLine} from 'recharts';
import {ThemeSelect,ThemeInstrument,ConfirmDeleteButton} from './JournalControls';
import {getChartAnimation} from './chartMotion';
import {backtestStats,orderTestTrades,isClosedTest,legacyTestId,testType,testTypeLabel} from './backtestModel';
import * as cloud from './backtestCloud';
import {privateCache} from './privateCacheRuntime';
import './backtest.css';
import JournalSignalHeader from './JournalSignalHeader';
import {eurusdSample,sampleRandom} from './backtestSample';
import {followAnalyticsPointer} from './analyticsTooltip.js';
import {compactBacktestMoney} from './mobileBacktest.js';
import {MOBILE_MEDIA} from './mobileNavigation.js';
function usePhoneBacktest() {
 const [phone,setPhone]=useState(()=>window.matchMedia(MOBILE_MEDIA).matches);
 useEffect(()=>{const media=window.matchMedia(MOBILE_MEDIA),change=()=>setPhone(media.matches);media.addEventListener('change',change);return()=>media.removeEventListener('change',change);},[]);
 return phone;
}
const money=(n,c='USD')=>new Intl.NumberFormat(undefined,{style:'currency',currency:c}).format(Number(n)||0);
const pct=n=>n==null?'—':`${n.toFixed(0)}%`;
const r=n=>n==null?'—':`${n.toFixed(2)}R`;
function Metric({label,value,note,color=''}) {return <div className="bt-metric"><span>{label}</span><strong className={color}>{value}</strong>{note&&<small>{note}</small>}</div>;}
function TestTypeChooser({onChoose,onClose}) {
 return <div className="tj-modal-overlay" onMouseDown={event=>event.target===event.currentTarget&&onClose()}><section className="tj-modal bt-test-type-picker" role="dialog" aria-modal="true" aria-labelledby="test-type-title"><div className="tj-modal-head"><strong id="test-type-title">Create a strategy test</strong><button type="button" className="tj-btn-outline" onClick={onClose}>Cancel</button></div><div className="tj-modal-body"><p>Choose how you are testing this strategy. Both stay separate from your live journal and keep their own results.</p><div className="bt-test-type-options"><button type="button" className="bt-test-type-option" onClick={()=>onChoose('backtest')}><FlaskConical size={22}/><span><strong>Backtest</strong><small>Review historical market trades and past sessions.</small></span></button><button type="button" className="bt-test-type-option" onClick={()=>onChoose('forward')}><CheckCircle2 size={22}/><span><strong>Forward Test</strong><small>Track a live, ongoing strategy test in the current market.</small></span></button></div></div></section></div>;
}
function PhoneOverviewResults({run,s}) {
 return <section className="bt-phone-overview-results"><div><Metric label="NET PROFIT" value={money(s.net,run.currency)} color={s.net>=0?'tj-green':'tj-red'}/><Metric label="WIN RATE" value={pct(s.winRate)}/><Metric label="AVG R:R" value={r(s.averageR)}/></div><div className="bt-reference-balance"><span>Balance</span><strong>{money(run.startingBalance,run.currency)} → {money(s.balance,run.currency)}</strong></div><div className="bt-track"><i style={{width:'100%'}}/></div></section>;
}
function RunDisclosure({open,id,children}) {
 const [visited,setVisited]=useState(open);
 useEffect(()=>{if(open)setVisited(true);},[open]);
 return <div id={id} className={`bt-run-disclosure ${open?'bt-run-disclosure-open':''}`} aria-hidden={!open} inert={!open?'':undefined}><div className="bt-run-disclosure-inner">{(open||visited)&&<div className="bt-run-disclosure-content">{children}</div>}</div></div>;
}
function ChartTooltip({active,payload,label,currency,kind}) {
 if(!active||!payload?.length)return null;
 const value=Number(payload[0].value);
 return <div className="bt-chart-tooltip"><span>{label}</span><div><span>{kind==='rate'?'Win rate':kind==='balance'?'Balance':'Net P&L'}</span><strong className={kind==='pnl'&&value<0?'tj-red':kind==='rate'?'tj-purple-txt':'tj-green'}>{kind==='rate'?`${value.toFixed(0)}%`:money(value,currency)}</strong></div></div>;
}
function Outcomes({s,currency}) {
 const win=s.total?s.wins/s.total*100:0,loss=s.total?s.losses/s.total*100:0;
 return <section className="bt-breakdown"><h4>TRADE OUTCOMES</h4><p>{s.wins} wins · {s.losses} losses · {s.flat} break-even</p><div className="bt-outcome-summary"><div className="bt-donut" style={{'--bt-outcomes':`conic-gradient(var(--accent) 0% ${win}%,var(--tj-red) ${win}% ${win+loss}%,var(--tj-border) ${win+loss}% 100%)`}}><strong>{pct(s.winRate)}</strong></div><div><p>{s.wins} wins</p><p>{s.losses} losses</p><p>{s.flat} break-even</p></div></div><div className="bt-grid bt-two bt-outcome-averages"><Metric label="AVERAGE WIN" value={s.averageWin==null?"—":money(s.averageWin,currency)} color="tj-green"/><Metric label="AVERAGE LOSS" value={s.averageLoss==null?"—":money(s.averageLoss,currency)} color="tj-red"/></div><small>{s.profitFactor==null?"—":s.profitFactor===Infinity?"∞":s.profitFactor.toFixed(2)} profit factor</small></section>;
}
function Equity({stats,currency,preview=false}) {const phone=usePhoneBacktest();const equityDot=({cx,cy,index})=>index===stats.equity.length-1?<g key={`bt-equity-dot-${index}`}><circle cx={cx} cy={cy} r={3} fill="var(--accent)"/><rect x={cx-106} y={cy-30} width={106} height={24} rx={5} fill="var(--accent)"/><text x={cx-53} y={cy-14} textAnchor="middle" fill="var(--on-accent)" fontSize={12} fontWeight={700}>{money(stats.balance,currency)}</text></g>:stats.total<15?<circle key={`bt-equity-dot-${index}`} cx={cx} cy={cy} r={3} fill="var(--tj-panel)" stroke="var(--accent)"/>:<g key={`bt-equity-dot-${index}`}/>;const baselineLabel=({viewBox})=><text x={viewBox.x+viewBox.width-6} y={viewBox.y-8} textAnchor="end" fill="var(--tj-muted)" fontSize={12}>{money(stats.equity[0]?.balance,currency)}</text>;return <div className={preview?'bt-equity bt-preview':'bt-equity'}><header><div><span>SIMULATED EQUITY</span><h3>How the run has compounded</h3></div><strong className="tj-green">{money(stats.balance,currency)}</strong></header><ResponsiveContainer width="100%" height={phone?220:preview?240:280} debounce={180}><AreaChart data={stats.equity} margin={{top:12,right:12,bottom:4,left:8}}><CartesianGrid stroke="var(--tj-border)" strokeOpacity={.25} strokeDasharray="3 5" vertical={false}/><XAxis dataKey="label" hide tick={{fill:'var(--tj-muted)',fontSize:"var(--text-min)"}} minTickGap={40}/><YAxis domain={['auto','auto']} hide={phone} width={phone?0:88} tickFormatter={v=>money(v,currency)} tick={{fill:'var(--tj-muted)',fontSize:"var(--text-min)"}}/><Tooltip cursor={{stroke:'var(--tj-accent)',strokeOpacity:.3,strokeDasharray:'3 5'}} content={<ChartTooltip currency={currency} kind="balance"/>}/><ReferenceLine y={stats.equity[0]?.balance} stroke="var(--tj-muted)" strokeDasharray="4 4" label={baselineLabel}/><Area {...getChartAnimation('line')} type="stepAfter" dataKey="balance" stroke="var(--tj-green)" fill="var(--tj-green)" fillOpacity={.12} dot={phone?false:equityDot} strokeWidth={2}/></AreaChart></ResponsiveContainer></div>;}
function Analysis({run,s,onSettings}) {
 const m=n=>money(n,run.currency);
 return <section className="bt-analysis">
 <div className="bt-edge-row"><section className="bt-edge-card"><header><span>SIMULATION ANALYSIS</span><h3>Quick edge read</h3><small>Only this backtest’s simulated trades.</small></header><div className="bt-contexts"><Metric label="BEST INSTRUMENT" value={s.total?run.instrument:"—"}/><Metric label="BEST SESSION" value={s.sessions[0]?.label||"—"}/><Metric label="BEST ENTRY MODEL" value={s.models[0]?.label||"—"}/><Metric label="BEST CONFLUENCE" value={s.confluences[0]?.label||"—"}/></div></section>
 <section className="bt-breakdown bt-momentum"><h4>RECENT MOMENTUM</h4><h3>{s.streak} {s.streakType} streak</h3><small>Newest first</small><div className="bt-recent">{s.recent.map(t=><div key={t.id} className={Number(t.pnl)>0?'bt-win':Number(t.pnl)<0?'bt-red':'bt-flat'}><strong>{Number(t.pnl)>0?'W':Number(t.pnl)<0?'L':'B/E'}</strong><small className="bt-desktop-amount">{m(t.pnl)}</small><small className="bt-phone-amount">{compactBacktestMoney(t.pnl,run.currency)}</small></div>)}</div></section></div>
 <div className="bt-grid bt-three"><section className="bt-breakdown"><h4>INSTRUMENT OUTCOME</h4><h3>Net P&L by instrument</h3><div className="bt-mini-bar"><div><strong>{run.instrument}</strong><small>{s.total} trades</small></div><div className="bt-track"><i data-chart-fill="horizontal" style={{width:'100%',background:s.net>=0?'var(--accent)':'var(--tj-red)'}}/></div><strong className={s.net>=0?'tj-green':'tj-red'}>{m(s.net)}</strong></div></section>
 <section className="bt-breakdown"><h4>SESSION WIN RATE</h4><h3>Which sessions pay</h3>{s.sessions.map(item=><div className="bt-mini-bar" key={item.label}><div><strong>{item.label}</strong><small>{item.wins} of {item.total}</small></div><div className="bt-track"><i data-chart-fill="horizontal" style={{width:item.rate+'%',background:'var(--tj-purple)'}}/></div><strong>{pct(item.rate)}</strong></div>)}</section>
 <section className="bt-breakdown"><h4>RULE ADHERENCE</h4><h3>Rules followed</h3>{s.ruleRate==null?<><strong>No rules evaluated yet</strong><p>Link your trading rules to this test to see how often you followed them.</p><button className="tj-btn-outline" onClick={onSettings}>Link rules</button></>:<><strong className="bt-large tj-green">{pct(s.ruleRate)}</strong><p>From logged rule evaluations</p></>}</section></div>
 </section>;
}
function Setup({run,hasTrades,onClose,onSave,busy,instruments,defaultRules=[]}) {
 const [form,setForm]=useState(run);const set=(k,v)=>setForm(x=>({...x,[k]:v}));
 const valid=form.name?.trim()&&form.instrument&&Number.isFinite(Number(form.startingBalance))&&Number(form.startingBalance)>0&&Number.isInteger(Number(form.tradeTarget))&&Number(form.tradeTarget)>0&&Number(form.riskPct)>=0&&Number(form.riskPct)<=100;
 const availableRules=[...new Map([...defaultRules,...(form.rules||[])].map(rule=>[rule.id,rule])).values()];
 if(form.__chooseTestType)return <TestTypeChooser onClose={onClose} onChoose={type=>setForm(current=>({...current,__chooseTestType:false,testType:type,name:`${type==='forward'?'Forward Test':'Backtest'} ${current.sequence}`}))}/>;
 const typeLabel=testTypeLabel(form);
 const save=()=>{const {sequence,__chooseTestType,...runToSave}=form;onSave({...runToSave,startingBalance:Number(form.startingBalance),tradeTarget:Number(form.tradeTarget)});};
 return <div className="tj-modal-overlay" onMouseDown={e=>e.target===e.currentTarget&&!busy&&onClose()}><div className="tj-modal bt-setup"><div className="tj-modal-head"><strong>{typeLabel} settings</strong><div className="tj-modal-head-actions"><button className="tj-btn-primary" disabled={!valid||busy} onClick={save}>Save test</button><button className="tj-btn-outline" disabled={busy} onClick={onClose}>Cancel</button></div></div><div className="tj-modal-body"><p>These settings only affect this {typeLabel.toLowerCase()} and never change your live journal.</p><div className="bt-grid bt-two"><label>Test type<input className="tj-input" readOnly value={typeLabel}/></label><label>Account name<input className="tj-input" value={form.name} onChange={e=>set('name',e.target.value)}/></label><label>Strategy / idea<input className="tj-input" value={form.strategy} onChange={e=>set('strategy',e.target.value)}/></label><label>Instrument{hasTrades?<input className="tj-input" readOnly value={form.instrument}/>:<ThemeInstrument value={form.instrument} onChange={v=>set('instrument',v)} options={instruments}/>}</label><label>Timeframe<ThemeSelect label="Timeframe" value={form.timeframe} onChange={e=>set('timeframe',e.target.value)}>{['M1','M5','M15','M30','H1','H4','D1','W1'].map(value=><option key={value} value={value}>{value}</option>)}</ThemeSelect></label><label>Starting balance<input className="tj-input" type="number" min="0.01" step="0.01" value={form.startingBalance} onChange={e=>set('startingBalance',e.target.value)}/></label><label>Currency<ThemeSelect label="Currency" value={form.currency} onChange={e=>set('currency',e.target.value)}>{['USD','EUR','GBP','JPY','AUD','CAD','CHF','NZD','GHS'].map(value=><option key={value} value={value}>{value}</option>)}</ThemeSelect></label><label>Trade target<input className="tj-input" type="number" min="1" step="1" value={form.tradeTarget} onChange={e=>set('tradeTarget',e.target.value)}/></label><label>Default risk %<input className="tj-input" type="number" min="0" max="100" step="0.1" value={form.riskPct} onChange={e=>set('riskPct',e.target.value)}/></label></div>{availableRules.length>0&&<fieldset className="bt-linked-rules"><legend>Trading rules</legend>{availableRules.map(rule=><label key={rule.id}><input type="checkbox" checked={(form.rules||[]).some(item=>item.id===rule.id)} onChange={event=>set("rules",event.target.checked?[...(form.rules||[]),{...rule}]:(form.rules||[]).filter(item=>item.id!==rule.id))}/><span>{rule.text||rule.name}</span></label>)}</fieldset>}<label>Pre-run plan<textarea className="tj-input" value={form.plan||''} onChange={e=>set('plan',e.target.value)}/></label><label>Run conclusion<textarea className="tj-input" value={form.conclusion||''} onChange={e=>set('conclusion',e.target.value)}/></label>{hasTrades&&<small>The instrument is locked because this test already has trades.</small>}</div></div></div>;
}
import {workspaceImportKey} from './backtestWorkspace.js';
export default function BacktestAccounts({user,initialData=null,legacyTrades=[],onClearLegacy=null,defaultRules=[],instruments=['EUR/USD','GBP/USD','XAU/USD','USD/JPY','AUD/USD','NZD/USD','USD/CAD','USD/CHF','EUR/GBP','EUR/JPY','GBP/JPY'],renderTradeForm,renderLog,api=cloud}) {
 const readBacktestCache=owner=>api.readBacktestCache(owner);
 const syncBacktests=owner=>api.syncBacktests(owner);
 const refreshTestCache=owner=>api.refreshTestCache(owner);
 const saveTestRun=(run,remove=false)=>api.saveTestRun(run,remove);
 const saveTestTrade=(run,trade,remove=false)=>api.saveTestTrade(run,trade,remove);
 const loadTestMedia=(owner,trade)=>api.loadTestMedia(owner,trade);
 const views=useContext(BacktestViewContext);
 const profileScope='profile'; const retained=useRef(views?.read(user.id,profileScope));
 const initial=retained.current;
 const [data,setData]=useState(()=>initial?.data || initialData || {runs:[],trades:[]}),[loaded,setLoaded]=useState(!!initial?.loaded || !!initialData),[error,setError]=useState(''),[busy,setBusy]=useState(false),[setup,setSetup]=useState(null),[active,setActive]=useState(initial?.active || null),[expanded,setExpanded]=useState(initial?.expanded || {}),[editor,setEditor]=useState(null),[media,setMedia]=useState({});
 const sequence=useRef(0),mounted=useRef(true),busyRef=useRef(false);
 const library=useRef(null);
 const [phoneLog,setPhoneLog]=useState(!!initial?.phoneLog);
 const previousActive=useRef(active),previousScreen=useRef({active,phoneLog});
 useEffect(()=>{if(previousActive.current!==active){previousActive.current=active;setPhoneLog(false);}},[active]);
 useEffect(()=>{const previous=previousScreen.current;previousScreen.current={active,phoneLog};if((previous.active!==active || previous.phoneLog!==phoneLog)&&window.matchMedia(MOBILE_MEDIA).matches)library.current?.closest('.tj-content')?.scrollTo({top:0});},[active,phoneLog]);
 const latestView=useRef(null);
 latestView.current={data,loaded,active,expanded,phoneLog};
 useLayoutEffect(()=>{
   const scroller=library.current?.closest('.tj-content');
   if(!scroller)return;
   scroller.scrollTop=initial?.scrollTop || 0;
   let scrollTop=scroller.scrollTop;
   const rememberScroll=()=>{scrollTop=scroller.scrollTop;};
   scroller.addEventListener('scroll',rememberScroll,{passive:true});
   return()=>{scroller.removeEventListener('scroll',rememberScroll);views?.write(user.id,profileScope,{...latestView.current,scrollTop});};
 },[views,user.id]);
 const preserveRunScroll=useDisclosureScroll(expanded,{waitForTransition:true});
 useEffect(()=>()=>{mounted.current=false;sequence.current++;},[]);
 const refresh=async()=>{const n=++sequence.current;try{const next=await syncBacktests(user.id);if(mounted.current&&n===sequence.current){const view=reconcileBacktestView(next,latestView.current);setData(next);setActive(view.active);setExpanded(view.expanded);setPhoneLog(view.phoneLog);setError('');setLoaded(true);}}catch(e){if(mounted.current&&n===sequence.current){setError(e.message);setLoaded(true);}}};
 useEffect(()=>{mounted.current=true;let cancel=false;const load=async()=>{if(!retained.current?.loaded){try{const cached=initialData || await readBacktestCache(user.id);if(!cancel&&cached){setData(cached);setLoaded(true);return;}}catch(e){if(!cancel)setError(e.message);}if(!cancel)await refresh();}};void load();const focus=()=>{if(!document.hidden&&!busyRef.current)void refresh();};const storage=e=>{if(e.key==='tj:journal-change'){try{const m=JSON.parse(e.newValue);if(m?.user===user.id&&m.table==='backtest')void refresh();}catch{}}};window.addEventListener('focus',focus);document.addEventListener('visibilitychange',focus);window.addEventListener('storage',storage);return()=>{cancel=true;sequence.current++;window.removeEventListener('focus',focus);document.removeEventListener('visibilitychange',focus);window.removeEventListener('storage',storage);};},[user.id,initialData]);
 const mutate=async(action,done)=>{if(busyRef.current)return;busyRef.current=true;setBusy(true);setError('');const ticket=privateCache.token();sequence.current++;try{await action();if(!mounted.current||privateCache.token().owner!==ticket.owner)return;const next=await refreshTestCache(user.id);if(privateCache.token().owner!==ticket.owner)return;if(mounted.current){setData(next);setMedia({});done?.();}}catch(e){if(mounted.current)setError(e.message);}finally{busyRef.current=false;if(mounted.current)setBusy(false);}};
 const create=()=>setSetup({__chooseTestType:true,sequence:data.runs.length+1,id:crypto.randomUUID(),strategy:'',instrument:'EUR/USD',timeframe:'M15',startingBalance:10000,currency:'USD',tradeTarget:20,riskPct:1,rules:defaultRules.map(r=>({...r})),plan:'',conclusion:''});
 const requestedSample=useRef(null);
 const replaceLegacy=()=>{
   mutate(async()=>{
     const ticket=privateCache.token(),id=await legacyTestId(user.id,'requested-sample',workspaceImportKey('profile','EURUSD-40pct-3R'));
     const run={id,name:'EUR/USD · 40% win rate · 3R sample',instrument:'EUR/USD',strategy:'Generated sample',timeframe:'M15',startingBalance:10000,currency:'USD',tradeTarget:10,riskPct:1,rules:[],plan:'Illustrative sample: 4 wins at +3R and 6 losses at −1R. Fixed $100 risk, no costs.',conclusion:'Sample only — not historical performance.'};
     const current=await syncBacktests(user.id);
     if(!current.runs.some(r=>r.id===id))await saveTestRun(run);
     if(!requestedSample.current){requestedSample.current=eurusdSample(id,sampleRandom(id));for(let i=0;i<10;i++)requestedSample.current[i].id=await legacyTestId(user.id,'sample-trade',`${id}:${i}`);}
     // Retry resumes the same sample. Never duplicate an already-saved sequence.
     const existing=current.trades.filter(t=>t.runId===id);
     for(const trade of requestedSample.current){if(existing.some(t=>t.id===trade.id))continue;if(privateCache.token().owner!==ticket.owner||!mounted.current)throw new Error('Session changed during sample creation.');await saveTestTrade(run,trade);}
     const saved=(await syncBacktests(user.id)).trades.filter(t=>t.runId===id);
     if(saved.length!==10||saved.filter(t=>t.rr===3&&t.pnl===300).length!==4||saved.filter(t=>t.rr===-1&&t.pnl===-100).length!==6)throw new Error('The sample was changed or did not finish saving. Old local trades have not been deleted.');
     if(privateCache.token().owner!==ticket.owner||!mounted.current)throw new Error('Session changed before clearing old trades.');
     // Keep the old local trades if ANY cloud save fails.
     onClearLegacy?.();
     setActive(id);
   });
 };
 const importLegacy=()=>mutate(async()=>{for(const instrument of [...new Set(legacyTrades.map(t=>t.asset||'EUR/USD'))]){const id=await legacyTestId(user.id,'run',['profile',instrument].join(':')),run={id,name:`Imported ${instrument}`,instrument,strategy:'Legacy backtest',timeframe:'M15',startingBalance:10000,currency:'USD',tradeTarget:20,riskPct:1};if(!data.runs.some(x=>x.id===id))await saveTestRun(run);for(const t of legacyTrades.filter(t=>(t.asset||'EUR/USD')===instrument)){const tradeId=await legacyTestId(user.id,'trade',['profile',t.id].join(':'));if(!data.trades.some(x=>x.id===tradeId))await saveTestTrade(run,{...t,id:tradeId,updatedAt:null,asset:instrument,_mediaLoaded:true,mediaEdited:true});}}});
 const tradesFor=id=>data.trades.filter(t=>t.runId===id).map(t=>media[t.id]?.version===t.updatedAt?{...t,screenshots:media[t.id].screenshots,_mediaLoaded:true}:t);
 const openTrade=async(run,t=null)=>{try{if(t){const screenshots=await loadTestMedia(user.id,t);if(!mounted.current)return;setEditor({run,trade:{...t,screenshots,_mediaLoaded:true}});}else setEditor({run,trade:null});}catch(e){setError(e.message);}};
 const openMedia=async t=>{const screenshots=await loadTestMedia(user.id,t);if(mounted.current)setMedia(x=>({...x,[t.id]:{version:t.updatedAt,screenshots}}));};
 const activeRun=data.runs.find(x=>x.id===active);
 const runLog=run=>renderLog({
   currency:run.currency,
   startingBalance:run.startingBalance,
   trades:orderTestTrades(tradesFor(run.id)).reverse(),
   onAddTrade:()=>openTrade(run),
   onEditTrade:trade=>openTrade(run,trade),
   onDeleteTrade:id=>{const trade=data.trades.find(item=>item.id===id);return mutate(()=>saveTestTrade(run,trade,true));},
   onOpenMedia:openMedia
 });
 const libraryRun=run=>{
   const stats=backtestStats(run,tradesFor(run.id)),open=!!expanded[run.id];
   const contentId=`backtest-details-${run.id}`;
   const toggle=event=>{
     if(open)preserveRunScroll(event.currentTarget.closest('.bt-run'));
     setExpanded(current=>({...current,[run.id]:!open}));
   };
   return <section className={`bt-run ${open?'bt-run-expanded':''}`} key={run.id}>
     <div className="bt-reference-run-head">{actions(run)}
       <button className="bt-run-header" aria-label={`${open?'Collapse':'Expand'} ${run.name}`} aria-expanded={open} aria-controls={contentId} onClick={toggle}>
         <div><div className="bt-reference-run-title"><strong>{run.instrument} · {run.timeframe}</strong><span>{run.strategy||run.name}</span><small className={`bt-test-type bt-test-type-${testType(run)}`}>{testTypeLabel(run)}</small><em>{stats.status}</em></div><span className="bt-header-count">{stats.total} closed · {tradesFor(run.id).length-stats.total} running</span></div>
         <span className="bt-run-toggle" aria-hidden="true">{open?<ChevronUp size={16}/>:<ChevronDown size={16}/>}</span>
       </button>
     </div>
     {summary(run,stats)}
     <PhoneOverviewResults run={run} s={stats}/>
     <RunDisclosure open={open} id={contentId}>
       <div className="bt-grid bt-two bt-plans"><Metric label="PRE-RUN PLAN" value={run.plan||'Add your hypothesis in test settings'}/><Metric label="RUN CONCLUSION" value={run.conclusion||'Record what this test proved or disproved'}/></div>
       <div className="bt-grid bt-two bt-reference-charts"><Equity stats={stats} currency={run.currency} preview/><Outcomes s={stats} currency={run.currency}/></div>
       <Analysis run={run} s={stats} onSettings={()=>setSetup(run)}/>
       <div className="bt-log">{runLog(run)}</div>
     </RunDisclosure>
   </section>;
 };
 const actions=run=><div className="bt-actions"><button className="tj-btn-outline" disabled={busy} onClick={()=>setSetup(run)}><Settings size={14}/> Edit setup</button><button className="tj-btn-primary" onClick={()=>{setActive(run.id);}}>Open test</button><ConfirmDeleteButton className="tj-btn-danger-outline" disabled={busy} aria-label={`Delete ${run.name}`} title={`Delete ${run.name} and all its ${testTypeLabel(run).toLowerCase()} trades. Your live journal is not affected.`} onClick={()=>mutate(()=>saveTestRun(run,true),()=>{if(active===run.id)setActive(null);})}>Delete</ConfirmDeleteButton></div>;
 const summary=(run,s)=><div className="bt-reference-summary">
 <section className="bt-reference-results"><Metric label="NET PROFIT" value={money(s.net,run.currency)} color={s.net>=0?'tj-green':'tj-red'}/><div className="bt-reference-balance"><span>Balance</span><strong>{money(run.startingBalance,run.currency)} → {money(s.balance,run.currency)}</strong></div><div className="bt-track"><i style={{width:'100%'}}/></div></section>
 <section className="bt-six-stats"><Metric label="WIN RATE" value={pct(s.winRate)}/><Metric label="AVG R:R" value={r(s.averageR)}/><Metric label="EXPECTANCY" value={s.expectancy==null?'—':money(s.expectancy,run.currency)} color={s.expectancy>=0?'tj-green':'tj-red'} note="Per closed trade"/><Metric label="PROFIT FACTOR" value={s.profitFactor==null?'—':s.profitFactor===Infinity?'∞':s.profitFactor.toFixed(2)}/><Metric label="MAX DRAWDOWN" value={money(-s.drawdown,run.currency)} color="tj-red" note="Peak to trough"/><Metric label="BEST DAY" value={s.bestDay?money(s.bestDay[1],run.currency):'—'} note={s.bestDay?.[0]}/></section>
 <section className="bt-reference-replay"><div className="bt-replay-ring" style={{background:`conic-gradient(var(--accent) ${Math.min(100,s.total/Math.max(1,Number(run.tradeTarget))*100)}%,var(--tj-border) 0)`}}><div><strong>{s.total}/{run.tradeTarget}</strong><small>TRADES</small></div></div><strong className={s.status==='Completed'?'tj-green':'tj-amber-txt'}>{s.status}</strong></section>
 <section className="bt-reference-setup"><dl><div><dt>Test type</dt><dd>{testTypeLabel(run)}</dd></div><div><dt>Instrument</dt><dd>{run.instrument} · {run.timeframe}</dd></div><div><dt>Strategy</dt><dd>{run.strategy||'Not set'}</dd></div><div><dt>Starting balance</dt><dd>{money(run.startingBalance,run.currency)}</dd></div><div><dt>Risk per trade</dt><dd>{Number(run.riskPct).toFixed(1)}%</dd></div><div><dt>Balance source</dt><dd>Uses this test’s balance</dd></div></dl></section></div>;
 return <div className={`bt-library bt-reference-library ${phoneLog?"bt-phone-log-view":""} ${activeRun?"bt-phone-active-run":"bt-phone-library"}`} ref={library} onPointerMoveCapture={followAnalyticsPointer}><JournalSignalHeader page="backtest" trades={activeRun ? tradesFor(activeRun.id) : data.trades}/><header className="bt-title bt-title-actions"><div className="bt-actions">{activeRun&&<button className="tj-btn-outline" onClick={()=>setActive(null)}><ArrowLeft size={16}/> Test library</button>}<button className="tj-btn-primary" disabled={busy} onClick={activeRun?()=>openTrade(activeRun):create}><Plus size={16}/>{activeRun?'Log test trade':'New test'}</button></div></header>{error&&<div role="alert" className="bt-error">{error}<button className="tj-btn-outline" onClick={refresh}>Retry</button></div>}{!loaded&&<p>Loading tests…</p>}{!activeRun&&<><h3>{data.runs.length} saved test account{data.runs.length===1?'':'s'}</h3>{data.runs.map(libraryRun)}{!data.runs.length&&loaded&&<section className="bt-empty"><FlaskConical size={32}/><h3>Your testing library starts here</h3><p>Create a Backtest or Forward Test, then log trades for that strategy only.</p></section>}<button className="bt-add" disabled={busy} onClick={create}><Plus size={20}/> Add another test</button>{legacyTrades.length>0&&<section className="bt-breakdown"><h4>EXISTING LOCAL BACKTEST TRADES</h4>{onClearLegacy&&<ConfirmDeleteButton className="tj-btn-primary" disabled={busy||!!error} title="Replace old trades with EUR/USD sample" onClick={replaceLegacy}>Replace old trades with EUR/USD sample</ConfirmDeleteButton>}<p>Your {legacyTrades.length} old trades are untouched. Import copies into separate test accounts, grouped by instrument.</p><ConfirmDeleteButton className="tj-btn-outline" disabled={busy||!!error} title="Import legacy trades" onClick={importLegacy}>Import legacy trades</ConfirmDeleteButton></section>}</>}{activeRun&&(()=>{const s=backtestStats(activeRun,tradesFor(activeRun.id));return <><section className="bt-run bt-run-expanded"><div className="bt-reference-run-head"><strong>{activeRun.instrument} · {activeRun.timeframe}</strong><button className="tj-btn-outline" onClick={()=>setSetup(activeRun)}><Settings size={14}/> Edit setup</button></div>{summary(activeRun,s)}<div className="bt-grid bt-two bt-plans"><Metric label="PRE-RUN PLAN" value={activeRun.plan||'Add your hypothesis in test settings'}/><Metric label="RUN CONCLUSION" value={activeRun.conclusion||'Record what this test proved or disproved'}/></div><div className="bt-grid bt-two bt-reference-charts"><Equity stats={s} currency={activeRun.currency}/><Outcomes s={s} currency={activeRun.currency}/></div><Analysis run={activeRun} s={s} onSettings={()=>setSetup(activeRun)}/><button type="button" className="tj-btn-outline bt-phone-log-open" onClick={()=>setPhoneLog(true)}>Test log</button></section><div className="bt-log"><button type="button" className="tj-btn-outline bt-phone-log-back" onClick={()=>setPhoneLog(false)}><ArrowLeft size={16}/>Open test</button>{runLog(activeRun)}</div></>;})()}{setup&&<Setup key={setup.id} defaultRules={defaultRules} instruments={instruments} run={setup} hasTrades={data.trades.some(t=>t.runId===setup.id)} busy={busy} onClose={()=>setSetup(null)} onSave={run=>mutate(()=>saveTestRun(run),()=>setSetup(null))}/ >}{editor&&renderTradeForm({run:editor.run,trade:editor.trade,trades:tradesFor(editor.run.id).filter(isClosedTest),onClose:()=>!busy&&setEditor(null),onSave:trade=>mutate(()=>saveTestTrade(editor.run,{...trade,id:editor.trade?.id||crypto.randomUUID(),updatedAt:editor.trade?.updatedAt,_mediaLoaded:!!editor.trade?._mediaLoaded,mediaEdited:trade.mediaEdited||!editor.trade}),()=>setEditor(null)),busy})}</div>;
}
