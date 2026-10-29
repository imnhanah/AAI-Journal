import React,{useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {ChevronDown,X} from 'lucide-react';
import {instrumentGroup} from './instrumentCatalog';

export default function MobileInstrumentPicker({value,onChange,options}) {
  const [open,setOpen]=useState(false),[query,setQuery]=useState('');
  const trigger=useRef(null),sheet=useRef(null),dragStart=useRef(null);
  const compact=text=>String(text||'').replace(/[^a-z0-9]/gi,'').toUpperCase();
  const group=instrumentGroup;
  const choices=[...new Set([...options,...(value?[value]:[])])].filter(item=>compact(item).includes(compact(query)));
  const close=()=>{setOpen(false);setQuery('');};
  useEffect(()=>{
    if(!open)return;
    // A nested sheet owns only its parent dialog's inert state. The dialog
    // already owns the page state; restoring it here would race on resize.
    const parent=trigger.current.closest('.tj-modal');
    const nodes=(parent?[parent]:[...document.querySelectorAll('.tj-topbar,.tj-content,.tj-mobile-bottom')]).map(node=>[node,node.inert]);
    nodes.forEach(([node])=>{node.inert=true;});sheet.current.querySelector('input')?.focus();
    const key=event=>{
      if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();}
      if(event.key==='Tab'){
        const targets=[...sheet.current.querySelectorAll('button,input')].filter(node=>!node.disabled),first=targets[0],last=targets.at(-1);
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
      }
    };
    const panel=sheet.current;panel.addEventListener('keydown',key);
    return()=>{panel.removeEventListener('keydown',key);nodes.forEach(([node,inert])=>{node.inert=inert;});requestAnimationFrame(()=>trigger.current?.focus());};
  },[open]);
  return <><button ref={trigger} type="button" className="tj-input tj-picker-trigger tj-phone-instrument-trigger" aria-label="Instrument" aria-expanded={open} onClick={()=>setOpen(true)}>{value||'Select'}<ChevronDown size={18}/></button>
    {open&&createPortal(<div className="tj-phone-instrument-overlay"><div className="tj-phone-instrument-backdrop" aria-hidden="true" onClick={close}/><section ref={sheet} className="tj-phone-instrument-sheet" role="dialog" aria-modal="true" aria-label="Instrument">
      <button type="button" className="tj-phone-picker-handle" aria-label="Close menu" onClick={close}
        onPointerDown={event=>{dragStart.current=event.clientY;event.currentTarget.setPointerCapture(event.pointerId);}}
        onPointerUp={event=>{if(dragStart.current!==null&&event.clientY-dragStart.current>60)close();dragStart.current=null;}}
        onPointerCancel={()=>{dragStart.current=null;}}><span aria-hidden="true"/></button>
      <header><h3>Choose instrument</h3><button type="button" className="tj-icon-btn" aria-label="Cancel" onClick={close}><X size={20}/></button></header><input className="tj-input" aria-label="Search instruments" placeholder="Search instruments" value={query} onChange={event=>setQuery(event.target.value)}/><div className="tj-phone-instrument-options" role="radiogroup" aria-label="Instruments">{choices.map(item=><button type="button" key={item} role="radio" aria-checked={value===item} onClick={()=>{onChange(item);close();}}><strong>{item}</strong>{group(item)&&<small>{group(item)}</small>}</button>)}{!choices.length&&<p>No matching instruments.</p>}</div></section></div>,trigger.current?.closest('.tj-root')||document.body)}
  </>;
}
