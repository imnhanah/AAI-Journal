// Read-only codemod: emits an apply_patch patch; never writes source files.
// node scripts/floor-font-sizes.mjs --patch  (apply the emitted patch)
// node scripts/floor-font-sizes.mjs --check  (exit 1 if changes remain)
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export function floorSize(value, {rootPx=15, parentPx=15}={}) {
  const original=String(value), clean=original.trim();
  const match=clean.match(/^(\d*\.?\d+)\s*(px|rem|em)?(\s*!important)?$/);
  if (match) {
    const px=Number(match[1])*(match[2]==='rem'?rootPx:match[2]==='em'?parentPx:1);
    return px<12 ? `var(--text-min)${match[3]||''}` : original;
  }
  // A clamp minimum below the floor permits unreadable text on small screens.
  return original.replace(/clamp\(\s*(\d*\.?\d+)(px|rem|em)\s*,/g, (m,n,u)=>Number(n)*(u==='rem'?rootPx:u==='em'?parentPx:1)<12 ? 'clamp(var(--text-min),' : m);
}
export function transformSource(text, options={}) {
  let count=0;
  const replace=v=>{const next=floorSize(v,options);if(next!==v)count++;return next;};
  let next=text.replace(/(font-size\s*:\s*)([^;}\n]+)/g,(_,p,v)=>p+replace(v));
  next=next.replace(/(fontSize\s*:\s*)(\d+(?:\.\d+)?|"[^"]+"|'[^']+')/g,(m,p,v)=>{
    const quote=/^["']/.test(v), raw=quote?v.slice(1,-1):v, value=replace(raw);
    return value===raw?m:p+JSON.stringify(value);
  });
  next=next.replace(/fontSize=(?:\{(\d+(?:\.\d+)?)\}|"([\d.]+(?:px|rem|em)?)")/g,(m,a,b)=>{
    const value=replace(a||b);return value===(a||b)?m:`fontSize="${value}"`;
  });
  next=next.replace(/(\bfont\s*:\s*(?:\d+\s+)?)([\d.]+(?:px|rem|em))(?=[\s/])/g,(_,p,v)=>p+replace(v));
  return {text:next,count};
}
export function collectChanges(root=process.cwd()) {
  const changes=[];
  function walk(dir) {
    for(const entry of fs.readdirSync(dir,{withFileTypes:true})) {
      const file=path.join(dir,entry.name);
      if(entry.isDirectory()) {if(entry.name!=='locales')walk(file);continue;}
      if(!/\.(css|jsx|js)$/.test(entry.name)||entry.name.includes('.test.'))continue;
      const before=fs.readFileSync(file,'utf8'), result=transformSource(before);
      if(result.count)changes.push({file:path.relative(root,file),before,after:result.text,count:result.count});
    }
  }
  walk(path.join(root,'src'));return changes;
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===path.resolve(process.argv[1])) {
  const changes=collectChanges();
  if(process.argv.includes('--patch')) {
    let patch='*** Begin Patch\n';
    let remaining=process.argv.includes('--batch')?20:Infinity;
    for(const c of changes) {
      if(remaining<=0)break;
      let hunks='';
      const a=c.before.split('\n'),b=c.after.split('\n');
      for(let i=0;i<a.length&&remaining>0;i++)if(a[i]!==b[i]){hunks+=`@@\n-${a[i]}\n+${b[i]}\n`;remaining--;}
      if(hunks)patch+=`*** Update File: ${path.resolve(c.file)}\n`+hunks;
    }
    console.log(JSON.stringify({patch:patch+'*** End Patch',summary:changes.map(({file,count})=>({file,count}))}));
  } else {
    console.log(JSON.stringify(changes.map(({file,count})=>({file,count})),null,2));
    if(process.argv.includes('--check')&&changes.length)process.exitCode=1;
  }
}
