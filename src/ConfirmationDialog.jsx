import React,{createContext,useCallback,useContext,useEffect,useRef,useState}from 'react';
import {createPortal}from 'react-dom';
import {AlertTriangle,BookOpen,Link2,X}from 'lucide-react';
export const ConfirmationContext=createContext(async()=>false);
export const PromptContext=createContext(async()=>null);
export const AlertContext=createContext(async()=>false);
const C=ConfirmationContext;
export const useConfirmation=()=>useContext(C);
export const usePrompt=()=>useContext(PromptContext);
export const useAlert=()=>useContext(AlertContext);

function PromptForm({options,onCancel,onSubmit}){
  const [value,setValue]=useState(options.value||'');
  const [error,setError]=useState('');
  const submit=event=>{
    event.preventDefault();
    const next=value.trim();
    if(options.required!==false&&!next){setError(options.requiredMessage||`${options.label} is required.`);return;}
    onSubmit(next);
  };
  return <form onSubmit={submit}>
    <label className="tj-confirm-field">{options.label}<input autoFocus value={value} placeholder={options.placeholder} onChange={event=>{setValue(event.target.value);setError('');}} aria-describedby={options.hint?'tj-confirm-prompt-hint':undefined}/></label>
    {options.hint&&<p id="tj-confirm-prompt-hint" className="tj-confirm-hint">{options.hint}</p>}
    {error&&<p className="tj-confirm-field-error" role="alert">{error}</p>}
    <footer><button type="button" onClick={onCancel}>{options.cancelLabel}</button><button type="submit" className="tj-confirm-primary">{options.confirmLabel}</button></footer>
  </form>;
}
export function ConfirmationProvider({children}){
  const [o,setO]=useState(null),last=useRef(null),active=useRef(null);
  const ok=useCallback(value=>{
    if(!o||o.settled)return;
    o.settled=true;
    active.current=null;
    setO(null);
    o.resolve(value);
  },[o]);
  const ask=useCallback(options=>{
    // A second click while a dialog is already open must be a no-op: sharing
    // the pending promise would allow two callers to perform the same action.
    if(active.current)return Promise.resolve(false);
    const promise=new Promise(resolve=>{
      last.current=document.activeElement;
      setO({kind:'confirm',title:'Confirm action',description:'',confirmLabel:'Confirm',cancelLabel:'Cancel',variant:'destructive',...options,resolve,settled:false});
    });
    active.current=promise;
    return promise;
  },[]);
  const askPrompt=useCallback(options=>{
    if(active.current)return Promise.resolve(null);
    const promise=new Promise(resolve=>{
      last.current=document.activeElement;
      setO({kind:'prompt',title:'Add details',description:'',label:'Name',placeholder:'',value:'',confirmLabel:'Save',cancelLabel:'Cancel',icon:'link',...options,resolve,settled:false});
    });
    active.current=promise;
    return promise;
  },[]);
  const showAlert=useCallback(options=>{
    if(active.current)return Promise.resolve(false);
    const promise=new Promise(resolve=>{
      last.current=document.activeElement;
      setO({kind:'alert',title:'Please check this',description:'',confirmLabel:'Close',icon:'warning',...options,resolve,settled:false});
    });
    active.current=promise;
    return promise;
  },[]);
  useEffect(()=>{if(!o)return;const k=e=>{if(e.key==='Escape'){e.preventDefault();ok(o.kind==='prompt'?null:false)}};document.addEventListener('keydown',k);return()=>document.removeEventListener('keydown',k)},[o,ok]);
  useEffect(()=>{if(!o)last.current?.focus?.()},[o]);
  const icon=o?.kind==='prompt'?(o.promptType==='notebook'?<BookOpen/>:<Link2/>):<AlertTriangle/>;
  return <C.Provider value={ask}><PromptContext.Provider value={askPrompt}><AlertContext.Provider value={showAlert}>{children}{o&&createPortal(<div className="tj-confirm-overlay" role="presentation"><section className={`tj-confirm-dialog${o.kind==='prompt'?' tj-confirm-prompt':''}${o.kind==='alert'?' tj-confirm-alert':''}`} role={o.kind==='alert'?'alertdialog':'dialog'} aria-modal="true" aria-labelledby="tj-confirm-title" aria-describedby="tj-confirm-description"><header><span className={`tj-confirm-icon${o.kind==='alert'?' tj-confirm-icon-warning':''}`} aria-hidden="true">{icon}</span><div className="tj-confirm-copy"><h2 id="tj-confirm-title">{o.title}</h2><p id="tj-confirm-description">{o.description}</p></div><button type="button" className="tj-confirm-close" aria-label={o.kind==='prompt'?o.cancelLabel:'Close'} title={o.kind==='prompt'?o.cancelLabel:'Close'} onClick={()=>ok(o.kind==='prompt'?null:false)}><X size={19}/></button></header>{o.kind==='prompt'&&<PromptForm options={o} onCancel={()=>ok(null)} onSubmit={value=>ok(value)}/>} {o.kind!=='prompt'&&<footer>{o.kind!=='alert'&&<button type="button" autoFocus onClick={()=>ok(false)}>{o.cancelLabel}</button>}<button type="button" autoFocus={o.kind==='alert'} className={o.variant==='destructive'?'tj-confirm-danger':o.kind==='alert'?'tj-confirm-primary':''} onClick={()=>ok(true)}>{o.confirmLabel}</button></footer>}</section></div>,document.body)}</AlertContext.Provider></PromptContext.Provider></C.Provider>}
