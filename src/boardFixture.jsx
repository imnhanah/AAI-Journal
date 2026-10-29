import { StrictMode, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import ChartViewer from './ChartViewer.jsx';
import './themeTokens.css?theme-tokens=4';
import './boardFixture.css';

if (import.meta.env.PROD) throw new Error('The Freeform board fixture is development-only.');

const fixtureKey='aai:freeform-board-fixture:v1';
const chart=(label,accent)=>`data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540"><rect width="960" height="540" fill="#111827"/><path d="M0 420 L80 360 150 390 230 270 310 330 390 190 470 280 560 150 650 240 750 110 860 190 960 90" fill="none" stroke="${accent}" stroke-width="7"/><g stroke="#334155">${Array.from({length:12},(_,i)=>`<path d="M${i*80} 0V540"/>`).join('')}${Array.from({length:7},(_,i)=>`<path d="M0 ${i*90}H960"/>`).join('')}</g><text x="34" y="54" fill="white" font-family="sans-serif" font-size="30">${label}</text></svg>`)}`;
const makeWorkspace=()=>({
  accounts:[
    {id:'fixture-a',name:'Fixture Alpha',studies:[
      {id:'alpha-one',title:'Alpha study',body:'Synthetic Overview',richDocument:{version:1},evidenceIds:['chart-a','chart-b'],evidencePlacements:{'chart-a':{caption:'Alpha A',observation:'Keep',annotations:[{id:'legacy-a',tool:'line',start:{x:.15,y:.2},end:{x:.65,y:.7}}]},'chart-b':{caption:'Alpha B',annotations:[]}}},
      {id:'alpha-two',title:'Alpha second study',body:'Separate overview',evidenceIds:['chart-a'],evidencePlacements:{'chart-a':{caption:'Second placement',annotations:[]}}},
    ]},
    {id:'fixture-b',name:'Fixture Beta',studies:[{id:'beta-one',title:'Beta study',body:'Other account',evidenceIds:['chart-a'],evidencePlacements:{'chart-a':{caption:'Beta placement',annotations:[]}}}]},
  ],
  evidence:[{id:'chart-a',title:'Synthetic EURUSD',url:chart('Synthetic EURUSD','#8b5cf6')},{id:'chart-b',title:'Synthetic GBPUSD',url:chart('Synthetic GBPUSD','#22c55e')}],
});
const load=()=>{try{return JSON.parse(localStorage.getItem(fixtureKey)||'null')||makeWorkspace();}catch{return makeWorkspace();}};
function Fixture(){
  const [workspace,setWorkspace]=useState(load),[accountId,setAccountId]=useState('fixture-a'),[studyId,setStudyId]=useState('alpha-one'),[evidenceId,setEvidenceId]=useState('chart-a'),[saveState,setSaveState]=useState('Saved'),[delay,setDelay]=useState(false),[outOfOrder,setOutOfOrder]=useState(false);
  const version=useRef(0),failed=useRef(null),failNext=useRef(false),request=useRef(0); const account=workspace.accounts.find(item=>item.id===accountId)||workspace.accounts[0]; const study=account.studies.find(item=>item.id===studyId)||account.studies[0];
  const evidence=useMemo(()=>workspace.evidence.filter(item=>study.evidenceIds.includes(item.id)),[workspace.evidence,study]);
  const persist=(next,immediate=false)=>{const revision=++version.current,requestNumber=++request.current;setWorkspace(next);setSaveState('Saving…');const shouldFail=failNext.current;failNext.current=false;const wait=outOfOrder?(requestNumber%2?500:25):(delay?350:0);const commit=()=>new Promise((resolve,reject)=>setTimeout(()=>shouldFail?reject(new Error('Fixture failure')):resolve(),wait)).then(()=>{if(version.current===revision){localStorage.setItem(fixtureKey,JSON.stringify(next));failed.current=null;setSaveState('Saved');}}).catch(()=>{if(version.current===revision){failed.current=next;setSaveState('Save failed');}});if(immediate)void commit();else void commit();};
  const onUpdate=partial=>{const next={...workspace,accounts:workspace.accounts.map(item=>item.id!==account.id?item:{...item,studies:item.studies.map(entry=>entry.id!==study.id?entry:{...entry,...partial})})};persist(next);};
  const retry=()=>{if(failed.current)persist(failed.current,true);};
  const switchAccount=id=>{const next=workspace.accounts.find(item=>item.id===id);setAccountId(id);setStudyId(next.studies[0].id);setEvidenceId(next.studies[0].evidenceIds[0]);};
  const switchStudy=id=>{const next=account.studies.find(item=>item.id===id);setStudyId(id);setEvidenceId(next.evidenceIds[0]);};
  return <main className="fixture"><section className="fixture-controls"><strong>Development-only Freeform fixture</strong><label>Account<select value={account.id} onChange={event=>switchAccount(event.target.value)}>{workspace.accounts.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Study<select value={study.id} onChange={event=>switchStudy(event.target.value)}>{account.studies.map(item=><option key={item.id} value={item.id}>{item.title}</option>)}</select></label><label>Evidence<select value={evidenceId} onChange={event=>setEvidenceId(event.target.value)}>{evidence.map(item=><option key={item.id} value={item.id}>{item.title}</option>)}</select></label><label><input type="checkbox" checked={delay} onChange={event=>setDelay(event.target.checked)}/> Delay save</label><label><input type="checkbox" checked={outOfOrder} onChange={event=>setOutOfOrder(event.target.checked)}/> Out-of-order saves</label><button onClick={()=>{failNext.current=true;}}>Fail next save</button><button onClick={()=>{localStorage.removeItem(fixtureKey);setWorkspace(makeWorkspace());setAccountId('fixture-a');setStudyId('alpha-one');setEvidenceId('chart-a');setSaveState('Saved');}}>Reset fixture</button><span aria-live="polite">Fixture persistence: {saveState}</span></section><ChartViewer study={study} evidence={evidence} activeId={evidenceId} accountId={account.id} saveState={saveState} onRetrySave={retry} onBack={()=>{}} onUpdate={onUpdate}/></main>;
}
createRoot(document.getElementById('root')).render(<StrictMode><Fixture/></StrictMode>);
