import React, {useEffect, useRef, useState} from 'react';
import {scrollEdges, SIDEBAR_SCROLL_OPTIONS} from './sidebarScroll';
import './sidebarV2.css?sidebar-divider=1';

export default function SidebarShell({open,page,children}) {
  const ref=useRef(null);
  const [edges,setEdges]=useState({top:false,bottom:false});
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
  return <aside ref={ref} className={`tj-sidebar tj-sidebar-v2 ${open?'tj-sidebar-shown':'tj-sidebar-collapsed'}`}
    data-scroll-top={edges.top} data-scroll-bottom={edges.bottom}>
    {children}
  </aside>;
}
