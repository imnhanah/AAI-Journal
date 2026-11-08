import {useEffect,useRef,useState} from 'react';
import {MOBILE_MEDIA} from './mobileNavigation.js';
import {getBackNavigation} from './useBackNavigation.js';
// The trade and markup forms stay mounted together, so several dialogs can hold
// the page inert at once. Only the last one to close may restore it.
const inertHolds=new WeakMap();
function holdInert(node){
  const hold=inertHolds.get(node)||{count:0,original:node.inert};
  hold.count+=1;inertHolds.set(node,hold);node.inert=true;
}
function releaseInert(node){
  const hold=inertHolds.get(node);
  if(!hold)return;
  hold.count-=1;
  if(hold.count>0)return;
  node.inert=hold.original;inertHolds.delete(node);
}
export function usePhoneTradeDialog(onClose, active = true, {keepBottomBar = false} = {}) {
  const [phone,setPhone]=useState(()=>window.matchMedia(MOBILE_MEDIA).matches);
  const summary=useRef(null),close=useRef(onClose);close.current=onClose;
  useEffect(()=>{const media=window.matchMedia(MOBILE_MEDIA),change=()=>setPhone(media.matches);media.addEventListener('change',change);return()=>media.removeEventListener('change',change);},[]);
  useEffect(()=>{
    if(!phone||!active)return;
    const anchor=summary.current;
    const modal=anchor?.closest('.tj-modal');
    if(!modal)return;
    const prior=document.activeElement;
    modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-label',modal.querySelector('.tj-modal-title').textContent);
    const background=[...document.querySelectorAll(keepBottomBar?'.tj-topbar,.tj-content':'.tj-topbar,.tj-content,.tj-mobile-bottom')].filter(node=>!node.contains(modal));
    background.forEach(holdInert);modal.querySelector('.tj-modal-close')?.focus();
    const key=event=>{
      if(event.key==='Escape'){event.stopPropagation();const nav=getBackNavigation();if(nav.enabled)nav.back();else close.current();}
      if(event.key==='Tab'){
        const nodes=[...modal.querySelectorAll('button,input,textarea,[tabindex="0"]')].filter(node=>!node.disabled&&node.getClientRects().length),first=nodes[0],last=nodes.at(-1);
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
      }
    };
    modal.addEventListener('keydown',key);
    return()=>{modal.removeEventListener('keydown',key);for(const attr of ['role','aria-modal','aria-label'])modal.removeAttribute(attr);background.forEach(releaseInert);requestAnimationFrame(()=>prior?.isConnected&&prior.focus());};
  },[phone,active]);
  return {phone,summary};
}
