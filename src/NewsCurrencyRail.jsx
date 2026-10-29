import React,{useEffect,useRef,useState} from 'react';
export default function NewsCurrencyRail({children}) {
 const ref=useRef(null),[edges,setEdges]=useState({before:false,after:false});
 useEffect(()=>{const node=ref.current;const check=()=>setEdges({before:node.scrollLeft>1,after:node.scrollLeft+node.clientWidth<node.scrollWidth-1});const observer=new ResizeObserver(check);observer.observe(node);check();node.addEventListener('scroll',check,{passive:true});return()=>{observer.disconnect();node.removeEventListener('scroll',check);};},[]);
 return <div className="tj-news-currency-rail"><div ref={ref} data-scroll-row="true" className="tj-news-currencies">{children}</div>{edges.before&&<i className="tj-news-currency-fade before" aria-hidden="true"/>}{edges.after&&<i className="tj-news-currency-fade after" aria-hidden="true"/>}</div>;
}
