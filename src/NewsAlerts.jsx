import React,{createContext,useContext,useEffect,useRef,useState} from "react";
import {getCalendarWindow} from "./forexFactory";
import {archivedNewsEvents} from "./newsArchive";
import {NEWS_FILTER_KEY,readNewsFilters,matchesNewsFilters} from "./newsPreferences";
import {NEWS_ALERT_SETTINGS_KEY,NEWS_ALERT_DELIVERED_KEY,readAlertSettings,dueNewsAlerts,dueNewsReleases,nextNewsRelease,countdownLabel} from "./newsAlertModel";
import {unlockAlertSounds,playAlertSound} from './alertSounds';
import PhoneNewsAlertSheet from './PhoneNewsAlertSheet.jsx';
import {MOBILE_MEDIA} from './mobileNavigation.js';

const NewsAlertContext = createContext(null);
export function NewsAlertsProvider({children,activePage}) {
  const [settings,setSettings] = useState(()=>{try{return readAlertSettings(window.localStorage);}catch{return readAlertSettings({getItem:()=>null});}});
  const [filters,setFilters] = useState(()=>{try{return readNewsFilters(window.localStorage);}catch{return readNewsFilters({getItem:()=>null});}});
  const [calendar,setCalendar] = useState({archive:{},results:[],loading:true});
  const [now,setNow] = useState(Date.now);
  const [banner,setBanner] = useState(null);
  const [soundReady,setSoundReady] = useState(false);
  const [message,setMessage] = useState("");
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
    const refresh=(event)=>{if(event.type==="storage" && event.key!==NEWS_FILTER_KEY)return;try{setFilters(readNewsFilters(window.localStorage));}catch{} lastCheck.current=Date.now();};
    window.addEventListener("tj-news-filters-changed",refresh);
    window.addEventListener("storage",refresh);
    return ()=>{window.removeEventListener("tj-news-filters-changed",refresh);window.removeEventListener("storage",refresh);};
  },[]);
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
  const publish=async(alerts,test=false)=>{
    const sound=settingsRef.current.sound;
    const played=sound ? await playAlertSound('news') : false;
    if(mounted.current)setBanner({alerts,test,played,sound,id:Date.now()});
  };
  useEffect(()=>{
    if(!banner)return;
    const timeout=setTimeout(()=>setBanner(null),17000);
    return()=>clearTimeout(timeout);
  },[banner?.id]);
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
  return <NewsAlertContext.Provider value={{settings,setSettings,enable,testAlert,unlockSound,soundReady,message,now,next:nextNewsRelease(eligible,now),loading:calendar.loading,available:calendar.results.filter(result=>Array.isArray(result.events)).length}}>
    {children}
    {banner && <aside className="tj-news-notifications" aria-label="News notifications">{banner.alerts.map(({event,minute},index)=><article key={`${banner.id}-${index}`} role="alert" className={`tj-news-notification ${minute===0?'is-release':minute<=5?'is-five':'is-fifteen'}`}><span className="tj-news-notification-bell" aria-hidden="true">🔔</span><div className="tj-news-notification-content"><small>{banner.test?'ALERT PREVIEW':minute===0?'RELEASING NOW':`RELEASE IN ${minute} MIN`}</small><strong>{event.title}</strong><p><b>{event.currency}</b><span>{event.isoDate?new Date(event.isoDate).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'}):'—'} · {event.impact?event.impact[0].toUpperCase()+event.impact.slice(1):'News'}</span></p></div><button type="button" aria-label={`Dismiss news alert: ${event.title}`} onClick={()=>setBanner(current=>{if(!current)return null;const alerts=current.alerts.filter((_,item)=>item!==index);return alerts.length?{...current,alerts}:null;})}>×</button><i key={banner.id} className="tj-news-notification-lifetime" aria-hidden="true"/></article>)}</aside>}
  </NewsAlertContext.Provider>;
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
    {open && !phone && <div className="tj-news-alert-menu" id="news-alert-settings" role="region" aria-label="Alert settings">
      <header><small>ALERT ME BEFORE</small><button type="button" aria-label="Close alert settings" onClick={()=>setOpen(false)}>×</button></header>
      {[15,5].map(minute=><button type="button" key={minute} className="tj-news-alert-option" role="switch" aria-checked={settings.minutes.includes(minute)} onClick={()=>setSettings(current=>({...current,minutes:current.minutes.includes(minute)?current.minutes.filter(value=>value!==minute):[...current.minutes,minute]}))}><span>{minute} minutes before</span><i className="tj-news-alert-switch"><span/></i></button>)}
      <p>Alerts follow the impact and currency filters you picked.</p>
      <div className="tj-news-alert-actions"><button type="button" className="tj-chip" aria-pressed={settings.sound} onClick={async()=>{if(!settings.sound)await alert.unlockSound();setSettings(current=>({...current,sound:!current.sound}));}}>Sound {settings.sound?"on":"off"}</button>{settings.sound && !alert.soundReady && <button type="button" className="tj-chip" onClick={alert.unlockSound}>Enable sound</button>}<button type="button" className="tj-btn-outline" onClick={()=>alert.testAlert()}>Test alert</button></div>
      {(settings.enabled && !settings.minutes.length || alert.message) && <p role="status">{settings.enabled && !settings.minutes.length?"Select at least one reminder time. ":""}{alert.message}</p>}
    </div>}
  </section>;
}
