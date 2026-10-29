import {useEffect,useRef,useState} from 'react';
import {MOBILE_MEDIA} from './mobileNavigation.js';
export function usePhoneTradeDialog(onClose) {
  const [phone,setPhone]=useState(()=>window.matchMedia(MOBILE_MEDIA).matches);
  const summary=useRef(null),close=useRef(onClose);close.current=onClose;
  useEffect(()=>{const media=window.matchMedia(MOBILE_MEDIA),change=()=>setPhone(media.matches);media.addEventListener('change',change);return()=>media.removeEventListener('change',change);},[]);
  useEffect(()=>{
    if(!phone)return;
    const modal=summary.current.closest('.tj-modal'),prior=document.activeElement;
    modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-label',modal.querySelector('.tj-modal-title').textContent);
    const background=[...document.querySelectorAll('.tj-topbar,.tj-content,.tj-mobile-bottom')].filter(node=>!node.contains(modal)).map(node=>[node,node.inert]);
    background.forEach(([node])=>{node.inert=true;});modal.querySelector('.tj-modal-close')?.focus();
    const key=event=>{
      if(event.key==='Escape'){event.stopPropagation();close.current();}
      if(event.key==='Tab'){
        const nodes=[...modal.querySelectorAll('button,input,textarea,[tabindex="0"]')].filter(node=>!node.disabled&&node.getClientRects().length),first=nodes[0],last=nodes.at(-1);
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
      }
    };
    modal.addEventListener('keydown',key);
    return()=>{modal.removeEventListener('keydown',key);for(const attr of ['role','aria-modal','aria-label'])modal.removeAttribute(attr);background.forEach(([node,inert])=>{node.inert=inert;});requestAnimationFrame(()=>prior?.isConnected&&prior.focus());};
  },[phone]);
  return {phone,summary};
}
