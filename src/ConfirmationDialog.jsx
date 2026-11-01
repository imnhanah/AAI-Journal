import React,{createContext,useCallback,useContext,useEffect,useRef,useState}from 'react';
import {createPortal}from 'react-dom';
import {AlertTriangle}from 'lucide-react';
const C=createContext(async()=>false);
export const useConfirmation=()=>useContext(C);
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
      setO({title:'Confirm action',description:'',confirmLabel:'Confirm',cancelLabel:'Cancel',variant:'destructive',...options,resolve,settled:false});
    });
    active.current=promise;
    return promise;
  },[]);
  useEffect(()=>{if(!o)return;const k=e=>{if(e.key==='Escape'){e.preventDefault();ok(false)}};document.addEventListener('keydown',k);return()=>document.removeEventListener('keydown',k)},[o,ok]);
  useEffect(()=>{if(!o)last.current?.focus?.()},[o]);
  return <C.Provider value={ask}>{children}{o&&createPortal(<div className="tj-confirm-overlay" role="presentation"><section className="tj-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="tj-confirm-title" aria-describedby="tj-confirm-description"><header><AlertTriangle aria-hidden="true"/><div><h2 id="tj-confirm-title">{o.title}</h2><p id="tj-confirm-description">{o.description}</p></div></header><footer><button type="button" autoFocus onClick={()=>ok(false)}>{o.cancelLabel}</button><button type="button" className={o.variant==='destructive'?'tj-confirm-danger':''} onClick={()=>ok(true)}>{o.confirmLabel}</button></footer></section></div>,document.body)}</C.Provider>}
