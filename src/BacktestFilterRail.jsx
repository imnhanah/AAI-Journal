import React,{useEffect,useRef,useState} from 'react';
export default function BacktestFilterRail({children}) {
  const ref=useRef(null),[edges,setEdges]=useState({before:false,after:false});
  useEffect(()=>{
    const node=ref.current;
    const check=()=>setEdges({before:node.scrollLeft>1,after:node.scrollLeft+node.clientWidth<node.scrollWidth-1});
    const observer=new ResizeObserver(check);observer.observe(node);check();
    node.addEventListener('scroll',check,{passive:true});
    return()=>{observer.disconnect();node.removeEventListener('scroll',check);};
  },[]);
  return <div className="bt-filter-rail"><div className="tj-backtest-filters" ref={ref} data-scroll-row="true">{children}</div>{edges.before&&<i className="bt-filter-fade before" aria-hidden="true"/>}{edges.after&&<i className="bt-filter-fade after" aria-hidden="true"/>}</div>;
}
