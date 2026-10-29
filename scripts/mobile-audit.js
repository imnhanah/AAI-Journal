// This function is serializable into an isolated Playwright page.
export function auditMobile() {
 const issues=[],tolerance=1,escape=s=>s.replace(/([^a-zA-Z0-9_-])/g,'\\$1'),selector=e=>{if(e.id)return '#'+escape(e.id);const parts=[];for(let n=e;n&&n!==document.body;n=n.parentElement){let part=n.tagName.toLowerCase();if(n.classList.length)part+='.'+[...n.classList].slice(0,2).map(escape).join('.');else if(n.parentElement)part+=`:nth-child(${[...n.parentElement.children].indexOf(n)+1})`;parts.unshift(part);if(parts.length===4)break;}return parts.join(' > ');};
 const visible=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'&&!e.closest('[hidden],[inert]');};
 const row=e=>e.closest('[data-scroll-row="true"]');
 const report=(kind,e,amount,detail)=>issues.push({kind,selector:selector(e),amount:Math.round(amount*100)/100,...(detail?{detail}:{})});
 if(document.documentElement.scrollWidth>innerWidth+tolerance)report('page-scroll',document.documentElement,document.documentElement.scrollWidth-innerWidth);
 for(const e of document.body.querySelectorAll('*')){
  if(!visible(e))continue;const s=getComputedStyle(e),r=e.getBoundingClientRect();
  // SVG drawing geometry is intentionally clipped to its chart plot. SVG text is still audited.
  if(e.namespaceURI==='http://www.w3.org/1999/xhtml'&&!row(e)){
   if(e.scrollWidth>e.clientWidth+tolerance&&e.clientWidth>0)report('content-overflow',e,e.scrollWidth-e.clientWidth);
   const parent=e.parentElement,p=parent?.getBoundingClientRect();
   // display:contents has no box; positioned descendants belong to their actual offset parent.
   const owner=s.position==='fixed'?null:s.position==='absolute'?e.offsetParent:parent,box=owner?.getBoundingClientRect();
   if(box?.width&&Math.max(box.left-r.left,r.right-box.right)>tolerance)report('parent-overflow',e,Math.max(box.left-r.left,r.right-box.right));
  }
  const text=[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim());
  if(text){if(Number(s.fontSize.replace('px',''))<12)report('small-text',e,Number(s.fontSize.replace('px','')));for(let n=e;n&&n!==document.body;n=n.parentElement){const style=getComputedStyle(n);if(style.transform!=='none'){report('transformed-text',e,0,selector(n));break;}if(style.filter!=='none'||style.backdropFilter!=='none'){report('filtered-text',e,0,selector(n));break;}}}
  if(e.matches('button,a[href],summary,input:not([type="hidden"]),select,textarea,[role="button"],[role="switch"],[role="checkbox"],[role="radio"],[role="tab"]')){const target=e.matches('input[type="checkbox"],input[type="radio"]')?e.closest('label')||e:e,b=target.getBoundingClientRect();if(b.width<43.9||b.height<43.9)report('small-target',e,Math.max(44-b.width,44-b.height),`${b.width.toFixed(1)} × ${b.height.toFixed(1)}`);}
 }
 return {ready:!!document.querySelector('.tj-page-title')&&!!document.querySelector('.tj-content'),title:document.querySelector('.tj-page-title')?.textContent,width:innerWidth,height:innerHeight,issues};
}
