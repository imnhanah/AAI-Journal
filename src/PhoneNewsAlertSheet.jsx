import React,{useEffect,useRef} from 'react';
import {createPortal} from 'react-dom';
import {NEWS_ALERT_MINUTES} from './newsAlertModel.js';

export default function PhoneNewsAlertSheet({alert,onClose}) {
 const sheet=useRef(null),start=useRef(null),close=useRef(onClose);close.current=onClose;
 useEffect(()=>{
  const node=sheet.current,prior=document.activeElement;
  const targets=[...document.querySelectorAll('.tj-content,.tj-topbar,.tj-mobile-bottom')].map(e=>[e,e.inert]);targets.forEach(([e])=>{e.inert=true;});
  node.querySelector('button')?.focus();
  const key=e=>{
   if(e.key==='Escape'){e.preventDefault();close.current();}
   if(e.key==='Tab'){const buttons=[...node.querySelectorAll('button')].filter(b=>!b.disabled),first=buttons[0],last=buttons.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
  };
  node.addEventListener('keydown',key);
  return()=>{node.removeEventListener('keydown',key);targets.forEach(([e,inert])=>{e.inert=inert;});prior?.isConnected&&prior.focus();};
 },[]);
 const {settings,setSettings}=alert;
 return createPortal(<div className="tj-root tj-phone-news-alert-overlay"><div className="tj-phone-news-alert-blur" aria-hidden="true"/><button type="button" className="tj-phone-news-alert-dismiss" aria-label="Close menu" onClick={onClose}/><section id="news-alert-settings" className="tj-phone-news-alert-sheet" ref={sheet} role="dialog" aria-modal="true" aria-label="Release alert" onPointerDown={e=>{start.current=e.clientY;}} onPointerUp={e=>{if(start.current!=null&&e.clientY-start.current>80)onClose();start.current=null;}}><i className="tj-phone-news-alert-handle" aria-hidden="true"/><header><h2>Release alert</h2><button type="button" aria-label="Close alert settings" onClick={onClose}>×</button></header><p>Alerts follow the impact and currency filters you picked.</p><button type="button" className="tj-phone-news-alert-toggle" role="switch" aria-label="News alerts" aria-checked={settings.enabled} onClick={alert.enable}><i aria-hidden="true"/><span>ALERT <strong>{settings.enabled?'On':'Off'}</strong></span></button><div className="tj-phone-news-alert-options">{NEWS_ALERT_MINUTES.map(minute=><button type="button" key={minute} aria-pressed={settings.minutes.includes(minute)} onClick={()=>setSettings(current=>({...current,minutes:[minute]}))}><span>{minute} min before</span>{settings.minutes.includes(minute)&&<b aria-hidden="true">✓</b>}</button>)}</div><button type="button" className="tj-phone-news-alert-done" onClick={onClose}>Done</button></section></div>,document.body);
}
