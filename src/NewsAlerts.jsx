import React,{createContext,useContext,useEffect,useRef,useState} from "react";
import {getCalendarWindow} from "./forexFactory";
import {archivedNewsEvents} from "./newsArchive";
import {newsFilterKey,readNewsFilters,matchesNewsFilters} from "./newsPreferences";
import {NEWS_ALERT_SETTINGS_KEY,NEWS_ALERT_DELIVERED_KEY,NEWS_ALERT_DESKTOP_MINUTES,NEWS_ALERT_TONES,readAlertSettings,dueNewsAlerts,dueNewsReleases,nextNewsRelease,countdownLabel} from "./newsAlertModel";
import {unlockAlertSounds,playAlertTone} from './alertSounds';
import {Bell,ChevronRight,Monitor,X,Zap} from 'lucide-react';
import './newsAlertPanel.css';
import PhoneNewsAlertSheet from './PhoneNewsAlertSheet.jsx';
import {MOBILE_MEDIA} from './mobileNavigation.js';

const NewsAlertContext = createContext(null);
export const NEWS_FOCUS_EVENT_KEY = "tj:news-focus-event";
export function NewsAlertsProvider({children,activePage,onViewEvent,userId}) {
  const [settings,setSettings] = useState(()=>{try{return readAlertSettings(window.localStorage);}catch{return readAlertSettings({getItem:()=>null});}});
  const [filters,setFilters] = useState(()=>{try{return readNewsFilters(window.localStorage,userId);}catch{return readNewsFilters({getItem:()=>null},userId);}});
  const [calendar,setCalendar] = useState({archive:{},results:[],loading:true});
  const [now,setNow] = useState(Date.now);
  const [banner,setBanner] = useState(null);
  const [soundReady,setSoundReady] = useState(false);
  const [message,setMessage] = useState("");
  const [phone,setPhone] = useState(()=>window.matchMedia(MOBILE_MEDIA).matches);
  useEffect(()=>{const media=window.matchMedia(MOBILE_MEDIA),change=()=>setPhone(media.matches);media.addEventListener('change',change);return()=>media.removeEventListener('change',change);},[]);
  const [held,setHeld] = useState(false);
  const snoozeTimers = useRef([]);
  const lastCheck = useRef(Date.now());
  const delivered = useRef(new Set());
  const mounted = useRef(true);
  useEffect(()=>{
    mounted.current=true;
    try { const saved=JSON.parse(window.sessionStorage.getItem(NEWS_ALERT_DELIVERED_KEY)); if(Array.isArray(saved)) delivered.current=new Set(saved); } catch {}
    const unlock=()=>{unlockAlertSounds().then(ready=>{if(mounted.current)setSoundReady(ready);});};
    window.addEventListener('pointerdown',unlock,{once:true});
    window.addEventListener('keydown',unlock,{once:true});
    return ()=>{mounted.current=false;window.removeEventListener('pointerdown',unlock);window.removeEventListener('keydown',unlock);};
  },[]);
  useEffect(()=>{
    try {window.localStorage.setItem(NEWS_ALERT_SETTINGS_KEY,JSON.stringify(settings));} catch {setMessage("Settings cannot be saved in this browser.");}
    lastCheck.current=Date.now();
  },[settings]);
  useEffect(()=>{
    const refresh=(event)=>{if(event.type==="storage" && event.key!==newsFilterKey(userId))return;try{setFilters(readNewsFilters(window.localStorage,userId));}catch{} lastCheck.current=Date.now();};
    window.addEventListener("tj-news-filters-changed",refresh);
    window.addEventListener("storage",refresh);
    return ()=>{window.removeEventListener("tj-news-filters-changed",refresh);window.removeEventListener("storage",refresh);};
  },[userId]);
  const fetchEnabled=settings.enabled || activePage==="news";
  useEffect(()=>{
    if(!fetchEnabled)return;
    let cancelled=false;
    const refresh=()=>getCalendarWindow((progress)=>{if(!cancelled)setCalendar({...progress,loading:true});}).then((result)=>{if(!cancelled)setCalendar({...result,loading:false});}).catch(()=>{if(!cancelled)setCalendar(current=>({...current,loading:false}));});
    refresh();
    const timer=setInterval(refresh,5*60000);
    return ()=>{cancelled=true;clearInterval(timer);};
  },[fetchEnabled]);
  const eligible=archivedNewsEvents(calendar.archive).filter(event=>matchesNewsFilters(event,filters));
  const eligibleRef=useRef(eligible);
  eligibleRef.current=eligible;
  const settingsRef=useRef(settings);
  settingsRef.current=settings;
  const unlockSound=async()=>{
    try {
      const ready=await unlockAlertSounds();
      if(mounted.current)setSoundReady(ready);
      if(!ready)throw new Error("blocked");
      return true;
    } catch {if(mounted.current)setMessage("Sound is blocked or unavailable. Visual alerts still work.");return false;}
  };
  // Delivery: the in-app banner and/or a browser notification. Sound plays with either.
  const browserNotify=(alerts,test)=>{
    try{
      if(!settingsRef.current.delivery?.browser || !("Notification" in window) || Notification.permission!=="granted")return;
      alerts.forEach(({event,minute})=>new Notification(test?"News alert preview":minute===0?`Releasing now: ${event.title}`:`${event.title} in ${minute} min`,{body:`${event.currency} · ${event.impact?event.impact[0].toUpperCase()+event.impact.slice(1):"News"} impact`,tag:`tj-news-${event.isoDate||"preview"}-${minute}`}));
    }catch{}
  };
  const publish=async(alerts,test=false)=>{
    const {sound,tone,delivery}=settingsRef.current;
    const inApp=delivery?.inApp!==false, browser=!!delivery?.browser;
    if(!inApp && !browser)return;
    const played=sound ? await playAlertTone(tone) : false;
    browserNotify(alerts,test);
    if(inApp && mounted.current)setBanner({alerts,test,played,sound,id:Date.now()});
  };
  const previewTone=async(tone)=>{await unlockSound();return playAlertTone(tone);};
  const setBrowserDelivery=async(on)=>{
    if(!on){setSettings(current=>({...current,delivery:{...current.delivery,browser:false}}));return;}
    if(!("Notification" in window)){setMessage("This browser does not support notifications.");return;}
    let permission=Notification.permission;
    if(permission==="default"){try{permission=await Notification.requestPermission();}catch{permission="denied";}}
    if(permission!=="granted"){setMessage("Browser notifications are blocked. Allow them in your browser's site settings to use this.");return;}
    setMessage("");
    setSettings(current=>({...current,delivery:{...current.delivery,browser:true}}));
  };
  // Banner lifetime: 17s, paused while hovered, then 4s after the pointer leaves.
  useEffect(()=>{
    if(!banner || held)return;
    const timeout=setTimeout(()=>setBanner(null),banner.resumed?4000:17000);
    return()=>clearTimeout(timeout);
  },[banner?.id,held]);
  useEffect(()=>()=>snoozeTimers.current.forEach(clearTimeout),[]);
  const dismissAlert=(index)=>setBanner(current=>{if(!current)return null;const alerts=current.alerts.filter((_,item)=>item!==index);return alerts.length?{...current,alerts}:null;});
  const minutesUntil=(event)=>Math.max(0,Math.round((Date.parse(event.isoDate)-Date.now())/60000));
  const snoozeAlert=(index)=>{
    const item=banner?.alerts[index];dismissAlert(index);
    if(!item)return;
    snoozeTimers.current.push(setTimeout(()=>{if(mounted.current)publishRef.current([{event:item.event,minute:Number.isFinite(Date.parse(item.event.isoDate))?minutesUntil(item.event):item.minute,keys:[]}],banner?.test);},5*60000));
  };
  const viewEvent=(index)=>{
    const item=banner?.alerts[index];dismissAlert(index);
    if(!item?.event?.isoDate)return;
    try{window.sessionStorage.setItem(NEWS_FOCUS_EVENT_KEY,JSON.stringify({isoDate:item.event.isoDate,title:item.event.title,currency:item.event.currency}));}catch{}
    onViewEvent?.();
    window.dispatchEvent(new Event("tj-news-focus-event"));
  };
  const publishRef=useRef(publish);publishRef.current=publish;
  useEffect(()=>{
    const tick=()=>{
      const timestamp=Date.now();setNow(timestamp);
      if(settingsRef.current.enabled){
        const alerts=[...dueNewsAlerts(eligibleRef.current,timestamp,lastCheck.current,delivered.current,settingsRef.current.minutes),...(settingsRef.current.minutes.length?dueNewsReleases(eligibleRef.current,timestamp,lastCheck.current,delivered.current):[])];
        if(alerts.length){
          alerts.forEach(alert=>alert.keys.forEach(key=>delivered.current.add(key)));
          try {window.sessionStorage.setItem(NEWS_ALERT_DELIVERED_KEY,JSON.stringify([...delivered.current].slice(-2000)));}catch{}
          publishRef.current(alerts);
        }
      }
      lastCheck.current=timestamp;
    };
    const timer=setInterval(tick,1000);
    window.addEventListener("focus",tick);document.addEventListener("visibilitychange",tick);
    return ()=>{clearInterval(timer);window.removeEventListener("focus",tick);document.removeEventListener("visibilitychange",tick);};
  },[]);
  const testAlert=async()=>{
    if(settingsRef.current.sound)await unlockSound();
    const event=nextNewsRelease(eligibleRef.current,Date.now()) || {title:"News alert preview",currency:"—",impact:"medium"};
    await publishRef.current([{event,minute:15,keys:[]}],true);
  };
  const enable=async()=>{
    if(!settings.enabled && settings.sound)await unlockSound();
    setSettings(current=>({...current,enabled:!current.enabled}));
  };
  return <NewsAlertContext.Provider value={{settings,setSettings,enable,testAlert,unlockSound,previewTone,setBrowserDelivery,filters,soundReady,message,now,next:nextNewsRelease(eligible,now),loading:calendar.loading,available:calendar.results.filter(result=>Array.isArray(result.events)).length}}>
    {children}
    {banner && phone && <aside className="tj-news-notifications" aria-label="News notifications">{banner.alerts.map(({event,minute},index)=><article key={`${banner.id}-${index}`} role="alert" className={`tj-news-notification ${minute===0?'is-release':minute<=5?'is-five':'is-fifteen'}`}><span className="tj-news-notification-bell" aria-hidden="true">🔔</span><div className="tj-news-notification-content"><small>{banner.test?'ALERT PREVIEW':minute===0?'RELEASING NOW':`RELEASE IN ${minute} MIN`}</small><strong>{event.title}</strong><p><b>{event.currency}</b><span>{event.isoDate?new Date(event.isoDate).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'}):'—'} · {event.impact?event.impact[0].toUpperCase()+event.impact.slice(1):'News'}</span></p></div><button type="button" aria-label={`Dismiss news alert: ${event.title}`} onClick={()=>setBanner(current=>{if(!current)return null;const alerts=current.alerts.filter((_,item)=>item!==index);return alerts.length?{...current,alerts}:null;})}>×</button><i key={banner.id} className="tj-news-notification-lifetime" aria-hidden="true"/></article>)}</aside>}
    {banner && !phone && <aside className="na2-toasts" aria-label="News notifications">{banner.alerts.slice(0,3).map(({event,minute},index)=>{
      const impact=["high","medium","low"].includes(event.impact)?event.impact:"medium";
      const impactLabel=impact[0].toUpperCase()+impact.slice(1);
      const value=(field)=>field===undefined||field===null||field===""?"—":field;
      return <article key={`${banner.id}-${index}`} role="alert" className={`na2-toast is-${impact} ${held?"is-held":""}`} style={{"--na2-life":`${banner.resumed?4:17}s`}} onMouseEnter={()=>setHeld(true)} onMouseLeave={()=>{setHeld(false);setBanner(current=>current?{...current,resumed:true}:current);}} onFocus={()=>setHeld(true)} onBlur={(event)=>{if(!event.currentTarget.contains(event.relatedTarget)){setHeld(false);setBanner(current=>current?{...current,resumed:true}:current);}}}>
        <i className="na2-tbar" aria-hidden="true"/>
        <div className="na2-tr" aria-hidden="true"><svg viewBox="0 0 44 44"><circle cx="22" cy="22" r="19" className="na2-tr-track"/><circle key={`${banner.id}-${banner.resumed?1:0}`} cx="22" cy="22" r="19" className="na2-tc" transform="rotate(-90 22 22)"/></svg><b>{minute===0?"Now":minute}</b>{minute!==0 && <span>min</span>}</div>
        <div className="na2-tb">
          <div className="na2-tt"><em>{banner.test?"Test alert":minute===0?"Releasing now":"Upcoming release"}</em><u className={`is-${impact}`}>{impactLabel} impact</u></div>
          <b>{event.title}</b>
          <span>{event.currency} · {minute===0?"releasing now":`starts in ${minute} minute${minute===1?"":"s"}`}</span>
          <div className="na2-tv"><div><small>Forecast</small><b>{value(event.forecast)}</b></div><div><small>Previous</small><b>{value(event.previous)}</b></div></div>
          <div className="na2-ta"><button type="button" onClick={()=>viewEvent(index)} disabled={!event.isoDate}>View event</button><button type="button" onClick={()=>snoozeAlert(index)}>Snooze 5 min</button></div>
        </div>
        <button type="button" className="na2-tx" aria-label={`Dismiss news alert: ${event.title}`} onClick={()=>dismissAlert(index)}><X size={14}/></button>
        <i key={`p-${banner.id}-${banner.resumed?1:0}`} className="na2-tp" aria-hidden="true"/>
      </article>;})}</aside>}
  </NewsAlertContext.Provider>;
}
// Phone News card: the same alert state as the desktop controls, in the phone layout.
export function NewsReleaseHero(){
  const alert=useContext(NewsAlertContext);
  const [open,setOpen]=useState(false);
  if(!alert)return null;
  const {settings,next,now}=alert;
  return <section className={`tj-nx-hero ${settings.enabled?"is-enabled":"is-disabled"}`} aria-label="News release timer">
    <div className="tj-nx-hero-top"><small>Next release</small><button type="button" className="tj-nx-switch" role="switch" aria-label="News alerts" aria-checked={settings.enabled} onClick={alert.enable}><i/></button></div>
    <strong role="timer" aria-live="off">{next?countdownLabel(Date.parse(next.isoDate)-now):"—"}</strong>
    <h2>{next?`${next.currency} · ${next.title}`:alert.loading?"Loading…":"No upcoming release"}</h2>
    <button type="button" className="tj-nx-alert-row" aria-label="Alert settings" aria-expanded={open} aria-controls="news-alert-settings" onClick={()=>setOpen(true)}><Bell size={16}/><span>{settings.enabled?(settings.minutes.length?`Alert on · ${[...settings.minutes].sort((a,b)=>b-a).join(" and ")} minutes before`:"Choose when to be reminded"):"Turn on to get an alert before it lands"}</span><ChevronRight size={16}/></button>
    {alert.message && <p className="tj-nx-alert-message" role="status">{alert.message}</p>}
    {open && <PhoneNewsAlertSheet alert={alert} onClose={()=>setOpen(false)}/>}
  </section>;
}

export function NewsAlertControls(){
  const alert=useContext(NewsAlertContext);
  const [phone,setPhone]=useState(()=>window.matchMedia(MOBILE_MEDIA).matches);
  useEffect(()=>{const media=window.matchMedia(MOBILE_MEDIA),change=()=>setPhone(media.matches);media.addEventListener('change',change);return()=>media.removeEventListener('change',change);},[]);
  const [open,setOpen]=useState(false);
  const menuRef=useRef(null);
  useEffect(()=>{
    if(!open||phone)return;
    const closeOutside=(event)=>{if(!menuRef.current?.contains(event.target))setOpen(false);};
    const escape=(event)=>{if(event.key==="Escape")setOpen(false);};
    document.addEventListener("pointerdown",closeOutside);document.addEventListener("keydown",escape);
    return()=>{document.removeEventListener("pointerdown",closeOutside);document.removeEventListener("keydown",escape);};
  },[open,phone]);
  if(!alert)return null;
  const {settings,setSettings,next,now}=alert;
  const urgent=settings.enabled && next && Date.parse(next.isoDate)-now<=15*60000;
  return <section ref={menuRef} className={`tj-news-alert-controls ${settings.enabled?"is-enabled":"is-disabled"} ${urgent?"is-urgent":""}`} aria-label="News release timer">
    <button type="button" className="tj-news-alert-switch" role="switch" aria-label="News alerts" aria-checked={settings.enabled} onClick={alert.enable}><span/></button>
    <div className="tj-news-alert-countdown" title={next?`${next.currency} · ${next.title} · ${new Date(next.isoDate).toLocaleString()}`:"No upcoming release available"}><small>NEXT RELEASE</small><span>{next?`${next.currency} · ${next.title}`:alert.loading?"Loading…":"No upcoming release"}</span></div>
    <strong className="tj-news-alert-time">{next?countdownLabel(Date.parse(next.isoDate)-now):"—"}</strong>
    <button type="button" className="tj-news-alert-menu-trigger" aria-label="Alert settings" aria-expanded={open} aria-controls="news-alert-settings" onClick={()=>setOpen(value=>!value)}>🔔</button>
    {open && phone && <PhoneNewsAlertSheet alert={alert} onClose={()=>setOpen(false)}/>}
    {open && !phone && <NewsAlertPanel alert={alert} onClose={()=>setOpen(false)}/>}
  </section>;
}

// Desktop alert settings (aaicorefx-desktop-news.html): lead times, what is followed, delivery and sound.
const TONE_LABELS={app:"App",soft:"Soft",chime:"Chime",pulse:"Pulse"};
const IMPACT_LABELS={high:"High",medium:"Medium",low:"Low"};
function AlertSwitch({on,label,onClick}){return <button type="button" className={`na2-sw ${on?"is-on":""}`} role="switch" aria-checked={on} aria-label={label} onClick={onClick}><i/></button>;}
function NewsAlertPanel({alert,onClose}){
  const {settings,setSettings,filters}=alert;
  const impacts=filters?Object.entries(filters.impact||{}).filter(([,on])=>on).map(([level])=>IMPACT_LABELS[level]).filter(Boolean):[];
  const currencies=filters?.currencies?.length?filters.currencies.join(" · "):"All currencies";
  const toggleMinute=(minute)=>setSettings(current=>({...current,minutes:current.minutes.includes(minute)?current.minutes.filter(value=>value!==minute):[...current.minutes,minute]}));
  const delivery=settings.delivery||{inApp:true,browser:false};
  return <div className="tj-news-alert-menu na2" id="news-alert-settings" role="dialog" aria-label="Alert settings">
    <div className="na2-h"><span className="na2-hi" aria-hidden="true"><Bell size={18}/></span><div><b>News alerts</b><small>Get a heads-up before market-moving releases</small></div><AlertSwitch on={settings.enabled} label="News alerts" onClick={alert.enable}/><button type="button" className="na2-x" aria-label="Close alert settings" onClick={onClose}><X size={15}/></button></div>
    <div className={`na2-b ${settings.enabled?"":"is-off"}`} aria-disabled={!settings.enabled}>
      <section className="na2-s"><small>Alert me before</small><div className="na2-lead">{NEWS_ALERT_DESKTOP_MINUTES.map(minute=><button type="button" key={minute} aria-pressed={settings.minutes.includes(minute)} className={settings.minutes.includes(minute)?"is-on":""} onClick={()=>toggleMinute(minute)}><b>{minute}</b><span>min</span></button>)}</div>{settings.enabled && !settings.minutes.length && <p className="na2-warn" role="status">Select at least one reminder time.</p>}</section>
      <section className="na2-s"><small>Following</small><div className="na2-fol"><span><i className="na2-dot"/>{impacts.length?impacts.join(", "):"No impact levels"}</span><span>{currencies}</span></div><p>Alerts follow the impact and currency filters you picked.</p></section>
      <section className="na2-s"><small>Delivery</small><div className="na2-dl">
        <div><span aria-hidden="true"><Monitor size={16}/></span><div><b>In-app banner</b><small>Slides in at the top right</small></div><AlertSwitch on={delivery.inApp} label="In-app banner" onClick={()=>setSettings(current=>({...current,delivery:{...(current.delivery||{}),inApp:!(current.delivery?.inApp!==false)}}))}/></div>
        <div><span aria-hidden="true"><Bell size={16}/></span><div><b>Browser notification</b><small>Shows even when the tab is hidden</small></div><AlertSwitch on={delivery.browser} label="Browser notification" onClick={()=>alert.setBrowserDelivery(!delivery.browser)}/></div>
      </div>{!delivery.inApp && !delivery.browser && <p className="na2-warn" role="status">Turn on at least one delivery to receive alerts.</p>}</section>
      <section className="na2-s"><div className="na2-snd"><div><b>Sound</b><small>Plays with every alert</small></div><AlertSwitch on={settings.sound} label="Alert sound" onClick={async()=>{if(!settings.sound)await alert.unlockSound();setSettings(current=>({...current,sound:!current.sound}));}}/></div>
        <div className={`na2-tone ${settings.sound?"":"is-off"}`} role="radiogroup" aria-label="Alert tone">{NEWS_ALERT_TONES.map(tone=><button type="button" key={tone} role="radio" aria-checked={settings.tone===tone} className={settings.tone===tone?"is-on":""} disabled={!settings.sound} onClick={()=>{setSettings(current=>({...current,tone}));alert.previewTone(tone);}}>{TONE_LABELS[tone]}</button>)}</div></section>
      {alert.message && <p className="na2-msg" role="status">{alert.message}</p>}
    </div>
    <div className="na2-f"><button type="button" className="na2-test" onClick={()=>alert.testAlert()}><Zap size={15} aria-hidden="true"/>Send test alert</button><button type="button" className="na2-done" onClick={onClose}>Done</button></div>
  </div>;
}
