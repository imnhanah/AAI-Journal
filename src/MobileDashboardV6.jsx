import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Activity, Check, ChevronDown, Gauge, Scale, Target, TrendingDown, TrendingUp, Trophy} from 'lucide-react';
import useBalanceChallenge from './useBalanceChallenge.js';
import {activeBalances} from './balanceModel.js';
import {challengeStartingBalance} from './challengeLifecycle.js';
import {buildChallengePlan, isChallengeEnabled} from './challengeModel.js';
import {mobileChallengeJourney, mobileChartLine, mobileCoreScoreAxes, mobileDashboardCumulative, mobileDashboardEquity, mobileDashboardMomentum, mobileDashboardRecent, mobileSmoothPath} from './mobileDashboardV6.js';
import './mobileDashboardV6.css';

const money = (value, currency = 'USD') => new Intl.NumberFormat(undefined, {style:'currency',currency,minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(value) || 0);
const signedMoney = (value, currency) => `${Number(value) > 0 ? '+' : ''}${money(value, currency)}`;
const tone = value => value > 0 ? 'is-profit' : value < 0 ? 'is-loss' : '';
const profitFactorStatus = value => !Number.isFinite(value) ? 'No losses yet' : value >= 1.5 ? 'Healthy' : value >= 1 ? 'Needs work' : 'Losing';
function Meter({parts}) {
  return <div className="tj-md6-meter" aria-hidden="true">{parts.map((part,index)=><i key={index} className={part.loss?'is-loss':''} style={parts.length>1?{flex:`${Math.max(0,Number(part.value)||0)} 1 0`}:{width:`${part.value}%`}}/>)}</div>;
}

function AccountPicker({balances, value, onChange}) {
  const [open,setOpen] = useState(false), ref = useRef(null);
  const selected = balances.find(balance => balance.id === value);
  useEffect(()=>{
    if(!open)return undefined;
    const dismiss = event => { if(!ref.current?.contains(event.target))setOpen(false); };
    const escape = event => { if(event.key === 'Escape')setOpen(false); };
    document.addEventListener('pointerdown',dismiss);document.addEventListener('keydown',escape);
    return()=>{document.removeEventListener('pointerdown',dismiss);document.removeEventListener('keydown',escape);};
  },[open]);
  if(!balances.length)return null;
  return <div className="tj-md6-account-picker" ref={ref}>
    <button type="button" aria-haspopup="listbox" aria-expanded={open} onClick={()=>setOpen(current=>!current)}><span>{selected?.name || 'All balances'}<ChevronDown size={14}/></span></button>
    {open&&<div role="listbox" aria-label="Dashboard balance" className="tj-md6-account-menu"><button type="button" role="option" aria-selected={!value} onClick={()=>{onChange('');setOpen(false);}}>All balances</button>{balances.map(balance=><button key={balance.id} type="button" role="option" aria-selected={balance.id===value} onClick={()=>{onChange(balance.id);setOpen(false);}}>{balance.name}</button>)}</div>}
  </div>;
}

function ChallengeDots({plan,journey}) {
  const {activeLevel,complete}=journey;
  const levels=complete?[{level:plan.length,done:true}]:activeLevel>1
    ?[{level:activeLevel-1,done:true},{level:activeLevel,current:true},{level:activeLevel+1}]
    :[{level:1,current:true},{level:2},{level:3}];
  const shown=levels.filter(item=>item.level<=plan.length);
  const more=(shown.at(-1)?.level||0)<plan.length;
  return <div className="tj-md6-dots" aria-label={complete?'Challenge complete':`Level ${activeLevel} of ${plan.length}`}>{shown.map((item,index)=><React.Fragment key={item.level}>{index>0&&<span/>}<i className={item.done?'is-done':item.current?'is-current':''}>{item.done?<Check size={13}/>:item.level}</i></React.Fragment>)}{more&&<><span/><i>…</i></>}</div>;
}

function ChallengeJourney({workspace,selectedBalanceId,userId,fallbackChallenge,onOpen}) {
  const onBalances = activeBalances(workspace).filter(balance=>balance.challengeEnabled);
  // A Single account keeps its challenge on the account itself, not on a balance.
  const onAccount = !onBalances.length && isChallengeEnabled(workspace);
  const enabled = onAccount ? [{id:workspace.id,name:workspace.name,baseCurrency:workspace.baseCurrency,challengeMode:workspace.challengeMode,challengeReward:workspace.challengeReward}] : onBalances;
  const [chosenId,setChosenId] = useState(null);
  const target = enabled.find(balance=>balance.id===chosenId) || enabled.find(balance=>balance.id===selectedBalanceId) || enabled[0];
  const targetAccount = useMemo(()=>target && !onAccount ? {...target,trades:workspace.trades,financeMovements:workspace.financeMovements,balances:workspace.balances} : null,[onAccount,target,workspace]);
  const targetChallenge = useBalanceChallenge(targetAccount,userId);
  const state = target && !onAccount ? targetChallenge.state : fallbackChallenge?.state;
  const loading = target && !onAccount ? targetChallenge.loading : fallbackChallenge?.loading;
  const mode = state?.automation?.mode || target?.challengeMode || 'risk';
  const plan = !target ? [] : onAccount
    ? buildChallengePlan(challengeStartingBalance(state,workspace),mode,state?.automation?.levelCount || workspace.challengeLevelCount,state?.automation?.rewardRatio ?? target.challengeReward,state?.automation)
    : buildChallengePlan(target.startingBalance,mode,state?.automation?.levelCount,state?.automation?.rewardRatio ?? target.challengeReward,state?.automation);
  const journey = mobileChallengeJourney(state,plan);
  const head = <div className="tj-md6-section-head"><h2>Challenge journey</h2>{target&&journey.enabled&&<button type="button" onClick={onOpen}>View challenge</button>}</div>;
  if(!target || !journey.enabled)return <section className="tj-md6-section">{head}<div className="tj-md6-empty-challenge"><Trophy size={20}/><span>No active challenge for this balance.</span></div></section>;
  const currency = target.baseCurrency || workspace.baseCurrency || 'USD';
  const current = plan[journey.activeLevel-1], next = plan[Math.min(plan.length-1,journey.activeLevel)];
  return <section className="tj-md6-section">{head}<article className="tj-md6-card">
    <div className="tj-md6-challenge-head"><div className="tj-md6-chips">{enabled.map(balance=><button key={balance.id} type="button" className={balance.id===target.id?'is-on':''} aria-pressed={balance.id===target.id} onClick={()=>setChosenId(balance.id)}><span>{balance.name}</span></button>)}</div><div className="tj-md6-challenge-amount"><span>This level</span><b>{loading?'—':journey.complete?'Complete':`${money(Math.max(0,Number(state?.levelPnl)||0),currency)} / ${money(current?.profit,currency)}`}</b></div></div>
    <ChallengeDots plan={plan} journey={journey}/>
    <div className="tj-md6-challenge-foot"><span>{journey.complete?`All ${plan.length} levels complete`:journey.nextLevel===journey.activeLevel?`Final level · Level ${journey.activeLevel}`:`Level ${journey.activeLevel} → Level ${journey.nextLevel}`}</span>{!journey.complete&&<span>{Number.isFinite(next?.risk)?`Next risk +${money(next.risk,currency)} · `:''}{money(next?.profit,currency)} target</span>}</div>
  </article></section>;
}

function Segment({options,value,onChange,label}) {
  return <div className="tj-md6-segment" role="group" aria-label={label}>{options.map(([id,text])=><button key={id} type="button" className={id===value?'is-on':''} aria-pressed={id===value} onClick={()=>onChange(id)}><span>{text}</span></button>)}</div>;
}

function PerformanceFlow({stats,currency,monthKey,openingBalance,onViewTrades}) {
  const [view,setView]=useState('recent');
  const sorted=stats.sorted || [];
  const recent=useMemo(()=>mobileDashboardRecent(sorted).slice(0,3),[sorted]);
  const momentum=useMemo(()=>mobileDashboardMomentum(sorted,monthKey,openingBalance),[sorted,monthKey,openingBalance]);
  const streak=(Number(stats.streak)||0)*(stats.streakType==='loss'?-1:1);
  const tiles=[
    ['Last 6 closes',momentum.percent==null?'—':`${momentum.percent>0?'+':''}${momentum.percent.toFixed(2)}%`,momentum.closes?signedMoney(momentum.net,currency):'No closes yet',momentum.net],
    ['Best session',momentum.bestSession?.name||'—',momentum.bestSession?signedMoney(momentum.bestSession.pnl,currency):'None this month',momentum.bestSession?.pnl],
    ['Hot pair',momentum.hotPair?.name||'—',momentum.hotPair?signedMoney(momentum.hotPair.pnl,currency):'None this month',momentum.hotPair?.pnl],
    ['Current streak',`${streak>0?'+':''}${streak}`,`${momentum.green}/${momentum.closes} recent closes green`,streak],
  ];
  return <section className="tj-md6-section"><div className="tj-md6-section-head"><h2>Performance flow</h2></div><article className="tj-md6-card">
    <Segment label="Performance flow view" value={view} onChange={setView} options={[['recent','Recent trades'],['momentum','Momentum']]}/>
    {view==='recent'?<div className="tj-md6-recent">{recent.length?<>{recent.map(trade=><div key={trade.id} className="tj-md6-trade"><span className={Number(trade.pnl)>=0?'is-gain':'is-drop'}>{Number(trade.pnl)>=0?<TrendingUp size={18}/>:<TrendingDown size={18}/>}</span><div><strong>{trade.asset} <em>{trade.direction==='SELL'?'Sell':'Buy'}</em></strong><small>{trade.closeDate || trade.date} · {trade.entrySession || trade.session || '—'}</small></div><b className={tone(trade.pnl)}>{signedMoney(trade.pnl,currency)}<small>{Number(trade.pnl)>0?'WIN':Number(trade.pnl)<0?'LOSS':'B/E'}</small></b></div>)}<div className="tj-md6-recent-foot"><span>Showing {recent.length} of {sorted.length} trades</span><button type="button" onClick={onViewTrades}>View all trades</button></div></>:<div className="tj-md6-no-trades">No closed trades for this balance yet.</div>}</div>
    :<div className="tj-md6-momentum">{tiles.map(([label,value,caption,sign])=><div key={label}><small>{label}</small><b className={tone(Number(sign)||0)}>{value}</b><span>{caption}</span></div>)}</div>}
  </article></section>;
}

function CoreRadar({axes}) {
  const cx=150,cy=98,radius=62,angle=index=>(-90+360/axes.length*index)*Math.PI/180;
  const point=(index,value)=>`${(cx+radius*value*Math.cos(angle(index))).toFixed(1)},${(cy+radius*value*Math.sin(angle(index))).toFixed(1)}`;
  const ring=value=>axes.map((_,index)=>point(index,value)).join(' ');
  return <svg className="tj-md6-radar" viewBox="0 0 300 190" width="100%" role="img" aria-label={`Core score chart: ${axes.map(axis=>`${axis.label} ${axis.display}`).join(', ')}`}>
    <g fill="none" stroke="var(--phone-track)"><polygon points={ring(1)}/><polygon points={ring(.66)}/><polygon points={ring(.33)}/></g>
    <polygon points={axes.map((axis,index)=>point(index,Math.max(.02,axis.value/100))).join(' ')} fill="var(--phone-gain-bg)" fillOpacity=".8" stroke="var(--phone-gain)" strokeWidth="1.5"/>
    {axes.map((axis,index)=>{const cos=Math.cos(angle(index)),sin=Math.sin(angle(index));return <text key={axis.label} x={(cx+(radius+14)*cos).toFixed(1)} y={(cy+(radius+14)*sin+(sin>.5?8:sin<-.5?-2:4)).toFixed(1)} textAnchor={cos>.3?'start':cos<-.3?'end':'middle'}>{axis.label}</text>;})}
  </svg>;
}

function EquityChart({equity}) {
  if(equity.length<2)return <div className="tj-md6-no-trades">Needs at least two trading days.</div>;
  const line=mobileChartLine(equity.map(point=>point.value),324,104,14,10),count=equity.length;
  const marks=[...new Set([0,Math.floor(count/3),Math.floor(2*count/3),count-1])];
  return <svg className="tj-md6-svg" viewBox="0 0 324 130" width="100%" role="img" aria-label={`Cumulative profit and loss across ${count} trading days, ending at ${equity.at(-1).value}`}><line x1="0" y1={line.zero.toFixed(1)} x2="324" y2={line.zero.toFixed(1)} stroke="var(--phone-track)" strokeDasharray="3 4"/><path d={mobileSmoothPath(line.points)} fill="none" stroke="var(--phone-gain)" strokeWidth="2.4"/>{marks.map(index=><text key={index} x={line.points[index][0].toFixed(1)} y="124" textAnchor={index===0?'start':index===count-1?'end':'middle'}>{equity[index].label}</text>)}</svg>;
}

const DAILY_BAR_LIMIT = 30;
function DailyBars({days}) {
  if(!days.length)return <div className="tj-md6-no-trades">No trading days yet.</div>;
  const shown=days.slice(-DAILY_BAR_LIMIT),count=shown.length,top=Math.max(0,...shown.map(day=>day.pnl)),bottom=Math.max(0,...shown.map(day=>-day.pnl));
  const scale=88/((top+bottom)||1),zero=12+top*scale,step=324/count,width=Math.min(28,step*.6),labelEvery=Math.max(1,Math.ceil(count/5));
  return <svg className="tj-md6-svg" viewBox="0 0 324 130" width="100%" role="img" aria-label={`Net daily profit and loss for the last ${count} trading days`}><line x1="0" y1={zero.toFixed(1)} x2="324" y2={zero.toFixed(1)} stroke="var(--phone-track)"/>{shown.map((day,index)=>{const height=Math.max(3,Math.abs(day.pnl)*scale),x=step*index+(step-width)/2;return <React.Fragment key={day.date}><rect x={x.toFixed(1)} y={(day.pnl>=0?zero-height:zero).toFixed(1)} width={width.toFixed(1)} height={height.toFixed(1)} rx={Math.min(5,width/2)} fill={day.pnl>=0?'var(--phone-gain)':'var(--phone-drop)'}/>{index%labelEvery===0&&<text x={(index===0?x:x+width/2).toFixed(1)} y="124" textAnchor={index===0?'start':'middle'}>{String(day.date).slice(5)}</text>}</React.Fragment>;})}</svg>;
}

export default function MobileDashboardV6({account,workspace,stats,balances,selectedBalanceId,onSelectBalance,monthCursor,userId,challenge,onViewChallenge,onViewTrades,liveBalance}) {
  const currency=account.baseCurrency || 'USD';
  const cumulative=useMemo(()=>mobileDashboardCumulative(stats.sorted || []),[stats.sorted]);
  const heroLine=useMemo(()=>cumulative.length>1?mobileSmoothPath(mobileChartLine(cumulative.map(point=>point.cumulative),320,70,6,6).points):'',[cumulative]);
  const monthKey=`${monthCursor.getFullYear()}-${String(monthCursor.getMonth()+1).padStart(2,'0')}`;
  const allTimeReturn=account.balance ? stats.netPnl / account.balance * 100 : 0;
  const days=stats.dayClasses || [];
  const recentDays=days.slice(-7);
  const equity=useMemo(()=>mobileDashboardEquity(days),[days]);
  const axes=useMemo(()=>mobileCoreScoreAxes(stats),[stats]);
  const winCount=stats.wins ?? 0, lossCount=stats.losses ?? 0, profitFactor=Number.isFinite(stats.profitFactor)?stats.profitFactor:null;
  const returnBadge=<span className={`tj-md6-badge ${allTimeReturn<0?'is-loss':'is-gain'}`}>{allTimeReturn>0?'+':''}{allTimeReturn.toFixed(2)}%{' overall'}</span>;
  return <main className="tj-mobile-dashboard-v6" aria-label="Dashboard">
    <section className="tj-md6-hero"><div className="tj-md6-hero-head"><span>All-time net P&amp;L</span><AccountPicker balances={balances} value={selectedBalanceId} onChange={onSelectBalance}/></div><strong className={tone(stats.netPnl)}>{signedMoney(stats.netPnl,currency)}</strong>{returnBadge}{heroLine&&<svg className="tj-md6-spark" viewBox="0 0 320 70" width="100%" height="70" preserveAspectRatio="none" role="img" aria-label="All-time cumulative profit and loss"><path d={`${heroLine} L314,70 L6,70 Z`} fill="var(--phone-chart-fill)"/><path d={heroLine} fill="none" stroke="var(--phone-chart)" strokeWidth="2.2" vectorEffect="non-scaling-stroke"/></svg>}<footer><div><small>Live balance</small><b>{money(liveBalance,currency)}</b></div><div><small>Realized P&amp;L</small><b className={tone(stats.netPnl)}>{signedMoney(stats.netPnl,currency)}</b></div></footer></section>
    <section className="tj-md6-section"><div className="tj-md6-section-head"><h2>Performance snapshot</h2></div><div className="tj-md6-insights"><article className="tj-md6-insight"><header><small>Profit factor</small><Gauge size={16}/></header><strong>{profitFactor==null?'—':profitFactor.toFixed(2)}<em>×</em></strong><Meter parts={[{value:Math.min(100,(profitFactor||0)/3*100)}]}/><p>{profitFactorStatus(stats.profitFactor)} · Recovery {Math.round(Number(stats.recovery)||0)}%</p></article><article className="tj-md6-insight"><header><small>Win rate</small><Target size={16}/></header><strong>{stats.winRate.toFixed(1)}%</strong><Meter parts={[{value:winCount},{value:lossCount,loss:true}]}/><p>{winCount} wins · {lossCount} losses</p></article><article className="tj-md6-insight"><header><small>Day win</small><Activity size={16}/></header><strong>{stats.dayWinRate.toFixed(1)}%</strong><div className="tj-md6-meter is-days" aria-hidden="true">{recentDays.map(day=><i key={day.date} className={day.pnl>0?'':day.pnl<0?'is-loss':'is-flat'}/>)}</div><p>{days.length} trading day{days.length===1?'':'s'}</p></article><article className="tj-md6-insight"><header><small>Avg win / loss</small><Scale size={16}/></header><strong className="is-compact"><b className="is-profit">{money(stats.avgWin,currency)}</b><em>/</em><b className="is-loss">{money(-stats.avgLoss,currency)}</b></strong><Meter parts={[{value:stats.avgWin},{value:stats.avgLoss,loss:true}]}/><p>Best run {stats.bestWinStreak||0}W · Max loss {stats.bestLossStreak||0}L</p></article></div></section>
    <ChallengeJourney workspace={workspace} selectedBalanceId={selectedBalanceId} userId={userId} fallbackChallenge={challenge} onOpen={onViewChallenge}/>
    <PerformanceFlow stats={stats} currency={currency} monthKey={monthKey} openingBalance={account.balance} onViewTrades={onViewTrades}/>
    <section className="tj-md6-section"><div className="tj-md6-section-head"><h2>Core score</h2></div><article className="tj-md6-card"><div className="tj-md6-card-head"><span>Consistency, recovery and payoff quality.</span><b className="tj-md6-score">{stats.thunderScore ?? 0}</b></div><CoreRadar axes={axes}/><div className="tj-md6-score-tiles">{axes.map(axis=><div key={axis.label}><b>{axis.display}</b><small>{axis.label}</small></div>)}</div></article></section>
    <section className="tj-md6-section"><div className="tj-md6-section-head"><h2>Equity curve</h2></div><article className="tj-md6-card"><div className="tj-md6-card-head"><span>Daily net cumulative P&amp;L</span><span className={`tj-md6-badge ${allTimeReturn<0?'is-loss':'is-gain'}`}>{allTimeReturn>0?'+':''}{allTimeReturn.toFixed(2)}%</span></div><EquityChart equity={equity}/></article></section>
    <section className="tj-md6-section"><div className="tj-md6-section-head"><h2>Daily results</h2></div><article className="tj-md6-card"><div className="tj-md6-card-head"><span>Green and red daily closes</span><span>{days.length>DAILY_BAR_LIMIT?`Last ${DAILY_BAR_LIMIT} of ${days.length} days`:`${days.length} trading day${days.length===1?'':'s'}`}</span></div><DailyBars days={days}/></article></section>
  </main>;
}
