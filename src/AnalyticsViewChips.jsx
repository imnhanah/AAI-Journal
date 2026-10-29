import React,{useEffect,useRef,useState} from 'react';

// The overlay belongs to the chip rail, never to an ancestor of readable text.
export default function AnalyticsViewChips({views,value,onChange}) {
  const rail=useRef(null);
  const [edges,setEdges]=useState({before:false,after:false});
  useEffect(()=>{
    const element=rail.current;
    const check=()=>setEdges({before:element.scrollLeft>1,after:element.scrollLeft+element.clientWidth<element.scrollWidth-1});
    check();
    const observer=new ResizeObserver(check);observer.observe(element);
    element.addEventListener('scroll',check,{passive:true});
    return()=>{observer.disconnect();element.removeEventListener('scroll',check);};
  },[views]);
  return <div className="tj-analytics-chip-rail"><nav ref={rail} data-scroll-row="true">{views.map(([id,label])=><button type="button" key={id} aria-pressed={value===id} className={value===id?'tj-performance-view-active':''} onClick={()=>onChange(id)}>{label}</button>)}</nav>{edges.before&&<i className="tj-analytics-chip-fade before" aria-hidden="true"/>}{edges.after&&<i className="tj-analytics-chip-fade after" aria-hidden="true"/>}</div>;
}
