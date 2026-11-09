import React, {useEffect, useRef, useState} from 'react';
import {scrollEdges, SIDEBAR_SCROLL_OPTIONS} from './sidebarScroll';
import './sidebarV2.css?sidebar-divider=1';

// v2 (desktop shell, after aaicorefx-desktop-shell.html) adds a highlight that slides to the
// current page, names beside the icons while the rail is collapsed, and a light sweep on toggle.
export default function SidebarShell({open,page,children,v2=false}) {
  const ref=useRef(null);
  const [edges,setEdges]=useState({top:false,bottom:false});
  const [tip,setTip]=useState(null);
  useEffect(()=>{if(open)setTip(null);},[open]);
  useEffect(()=>{
    const sidebar=ref.current;
    const list=sidebar?.querySelector('.tj-sidebar-scroll');
    if(!list)return;
    const update=()=>{
      if(ref.current!==sidebar)return;
      setEdges(scrollEdges(list));
    };
    const observer=new ResizeObserver(update);
    observer.observe(list);
    Array.from(list.children).forEach(child=>observer.observe(child));
    list.addEventListener('scroll',update,{passive:true});
    const frame=requestAnimationFrame(()=>{
      list.querySelector('[aria-current="page"]')?.scrollIntoView(SIDEBAR_SCROLL_OPTIONS);
      update();
    });
    return ()=>{cancelAnimationFrame(frame);observer.disconnect();list.removeEventListener('scroll',update);};
  },[page,open]);
  const showTip=event=>{
    if(!v2||open)return;
    const control=event.target.closest?.('.tj-nav-item');
    if(!control||!ref.current?.contains(control))return;
    const label=control.getAttribute('aria-label');
    if(!label)return;
    const bounds=control.getBoundingClientRect();
    setTip(current=>current?.label===label?current:{label,top:bounds.top+bounds.height/2,left:bounds.right+12});
  };
  return <aside ref={ref} className={`tj-sidebar tj-sidebar-v2 ${open?'tj-sidebar-shown':'tj-sidebar-collapsed'}`}
    data-scroll-top={edges.top} data-scroll-bottom={edges.bottom} onPointerOverCapture={showTip} onPointerLeave={()=>setTip(null)} onFocusCapture={showTip} onBlurCapture={event=>{if(!event.currentTarget.contains(event.relatedTarget))setTip(null);}}>
    {children}
    {tip&&<span className="tj-sidebar-tooltip" role="tooltip" style={{top:tip.top,left:tip.left}}>{tip.label}</span>}
  </aside>;
}
