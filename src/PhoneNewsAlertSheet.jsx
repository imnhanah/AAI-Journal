import React,{useEffect,useRef} from 'react';
import {createPortal} from 'react-dom';
import {Bell,Monitor,X,Zap} from 'lucide-react';
import {NEWS_ALERT_DESKTOP_MINUTES,NEWS_ALERT_TONES} from './newsAlertModel.js';

const TONE_LABELS={app:'App',soft:'Soft',chime:'Chime',pulse:'Pulse'};
const IMPACT_LABELS={high:'High',medium:'Medium',low:'Low'};
function Switch({on,label,onClick}){return <button type="button" className={`tj-pns-sw${on?' is-on':''}`} role="switch" aria-checked={on} aria-label={label} onClick={onClick}><i aria-hidden="true"/></button>;}

// Phone alert settings sheet: lead times, what is followed, delivery, sound and a test alert.
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
 const {settings,setSettings,filters}=alert;
 const delivery=settings.delivery||{inApp:true,browser:false};
 const impacts=filters?Object.entries(filters.impact||{}).filter(([,on])=>on).map(([level])=>IMPACT_LABELS[level]).filter(Boolean):[];
 const currencies=filters?.currencies?.length?filters.currencies.join(' · '):'All currencies';
 const toggleMinute=minute=>setSettings(current=>({...current,minutes:current.minutes.includes(minute)?current.minutes.filter(value=>value!==minute):[...current.minutes,minute]}));
 return createPortal(<div className="tj-root tj-phone-news-alert-overlay"><div className="tj-phone-news-alert-blur" aria-hidden="true"/><button type="button" className="tj-phone-news-alert-dismiss" aria-label="Close menu" onClick={onClose}/>
  <section id="news-alert-settings" className="tj-pns" ref={sheet} role="dialog" aria-modal="true" aria-label="News alerts" onPointerDown={e=>{if(e.target.closest('.tj-pns-grab'))start.current=e.clientY;}} onPointerUp={e=>{if(start.current!=null&&e.clientY-start.current>80)onClose();start.current=null;}}>
   <div className="tj-pns-grab" aria-hidden="true"><i/></div>
   <header><span className="tj-pns-ico" aria-hidden="true"><Bell size={18}/></span><div><h2>News alerts</h2><small>Get a heads-up before market-moving releases</small></div><Switch on={settings.enabled} label="News alerts" onClick={alert.enable}/></header>
   <div className={`tj-pns-body${settings.enabled?'':' is-off'}`} aria-disabled={!settings.enabled}>
    <section><small>Alert me before</small><div className="tj-pns-lead">{NEWS_ALERT_DESKTOP_MINUTES.map(minute=><button type="button" key={minute} aria-pressed={settings.minutes.includes(minute)} onClick={()=>toggleMinute(minute)}><b>{minute}</b><span>min</span></button>)}</div>{settings.enabled&&!settings.minutes.length&&<p className="is-warn" role="status">Select at least one reminder time.</p>}</section>
    <section><small>Following</small><div className="tj-pns-fol"><span><i/>{impacts.length?impacts.join(', '):'No impact levels'}</span><span>{currencies}</span></div><p>Alerts follow the impact and currency filters you set. Change them in Filters.</p></section>
    <section><small>Delivery</small><div className="tj-pns-rows">
     <div><span aria-hidden="true"><Monitor size={16}/></span><div><b>In-app banner</b><em>Slides in at the top of the screen</em></div><Switch on={delivery.inApp!==false} label="In-app banner" onClick={()=>setSettings(current=>({...current,delivery:{...(current.delivery||{}),inApp:!(current.delivery?.inApp!==false)}}))}/></div>
     <div><span aria-hidden="true"><Bell size={16}/></span><div><b>Phone notification</b><em>Shows even when the app is closed</em></div><Switch on={!!delivery.browser} label="Phone notification" onClick={()=>alert.setBrowserDelivery(!delivery.browser)}/></div>
    </div>{delivery.inApp===false&&!delivery.browser&&<p className="is-warn" role="status">Turn on at least one delivery to receive alerts.</p>}</section>
    <section><div className="tj-pns-rows"><div className="tj-pns-snd"><div><b>Sound</b><em>Plays with every alert</em></div><Switch on={settings.sound} label="Alert sound" onClick={async()=>{if(!settings.sound)await alert.unlockSound();setSettings(current=>({...current,sound:!current.sound}));}}/></div></div>
     <div className={`tj-pns-tone${settings.sound?'':' is-off'}`} role="radiogroup" aria-label="Alert tone">{NEWS_ALERT_TONES.map(tone=><button type="button" key={tone} role="radio" aria-checked={settings.tone===tone} disabled={!settings.sound} onClick={()=>{setSettings(current=>({...current,tone}));alert.previewTone(tone);}}>{TONE_LABELS[tone]||tone}</button>)}</div></section>
    {alert.message&&<p className="is-warn" role="status">{alert.message}</p>}
   </div>
   <footer><button type="button" className="tj-pns-test" onClick={()=>alert.testAlert()}><Zap size={15} aria-hidden="true"/>Test alert</button><button type="button" className="tj-pns-done" onClick={onClose}>Done</button></footer>
  </section></div>,document.body);
}
