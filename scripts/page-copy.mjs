import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from '@babel/parser';

export function jsxCopy(value) {
  const lines=value.split(/\r\n|\n|\r/);let result='';
  lines.forEach((line,index)=>{let part=line.replace(/\t/g,' ');if(index)part=part.replace(/^ +/,'');if(index<lines.length-1)part=part.replace(/ +$/,'');if(part){result+=part;if(index<lines.length-1&&lines.slice(index+1).some(next=>next.trim()))result+=' ';}});
  return result.trim();
}
export const templateCopy = node => node.quasis.map((part,index)=>part.value.cooked+(index<node.expressions.length?`{${index}}`:'')).join('');
export function collectPageCopy(directory) {
  const copies=new Set();
  const human=value=>typeof value==='string'&&/[A-Za-z]{2}/.test(value)&&value.length<2200&&!/[\n\r]/.test(value)&&!/(?:https?:|\/src\/|\.png|\.jsx|\.css|\.html|\.csv|var\(--|color-mix\(|rgba?\(|@media|tj-|pub-|auth-|bt-)/.test(value)&&!/[<>;=]/.test(value)&&!/^\/?[\w.-]+\/[\w./-]+$/.test(value);
  const add=value=>{const copy=value?.trim();if (/^(?:--[\w-]+|[\d.]+(?:px|rem|em|vh|vw|dvh|ms|s))$/.test(copy || '')) return; if(human(copy?.replaceAll(';',',')))copies.add(copy);};
  const files=readdirSync(directory).filter(file=>file.endsWith('.jsx'));
  for(const file of files){
    const ast=parse(readFileSync(join(directory,file),'utf8'),{sourceType:'module',plugins:['jsx']});
    const visit=(node,parent,grandparent)=>{
      if(!node||typeof node!=='object')return;
      if(node.type==='JSXText') {
        const text=jsxCopy(node.value);
        const interpolated=parent?.children?.some(child=>child.type==='JSXExpressionContainer');
        // Text fragments next to a dynamic value (for example `, but`) are
        // implementation fragments, not independently meaningful labels.
        // Keep complete labels and percentage suffixes such as `% at risk`.
        if(!interpolated||/^[A-Z0-9%]/.test(text))add(text);
      }
      if(node.type==='StringLiteral'&&parent?.type==='JSXAttribute'&&['aria-label','title','placeholder','alt'].includes(parent.name?.name)) add(node.value);
      // A template used as a JSX child is visible copy. Templates in JSX
      // attributes are commonly implementation IDs (for example tab ids),
      // and must not become localization candidates.
      if(node.type==='TemplateLiteral'&&parent?.type==='JSXExpressionContainer'&&grandparent?.type!=='JSXAttribute')add(templateCopy(node));
      for(const[key,value]of Object.entries(node)){if(['loc','start','end','comments','tokens'].includes(key))continue;if(Array.isArray(value))value.forEach(child=>visit(child,node,parent));else if(value&&typeof value==='object')visit(value,node,parent);}
    };visit(ast,null);
  }
  return [...copies].sort();
}
