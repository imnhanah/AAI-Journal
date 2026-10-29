// One-time catalog generation. Only compile-time application copy is sent.
// No browser, database, profile, notes, account, or trade data is accessed.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { collectPageCopy } from './page-copy.mjs';
import { messages } from '../src/translations.js';
import { auditMessages } from '../src/auditTranslations.js';

const root=fileURLToPath(new URL('../',import.meta.url));
const directory=join(root,'src/locales');
mkdirSync(directory,{recursive:true});
const source=collectPageCopy(join(root,'src'));
const locales=['de','ar','es','fr','pt','it','ru','zh','ja','ko','hi','tr','id'];
const existingKeys=new Set(Object.keys({...messages,...auditMessages}).map(key=>key.toLowerCase()));
const missing=source.filter(key=>!existingKeys.has(key.toLowerCase()));
writeFileSync(join(directory,'source.json'),JSON.stringify(source,null,2)+'\n');
console.log(`${source.length} source strings; ${missing.length} additional strings across ${locales.length} locales`);
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function translateBatch(keys,locale,attempt=0){
  const protectedKeys=keys.map(key=>key.replace(/\{(\d+)\}/g,(_,index)=>attempt ? `997310${String(index).padStart(3,'0')}` : `⟦${index}⟧`));
  const url=new URL('https://translate.googleapis.com/translate_a/single');
  url.search=new URLSearchParams({client:'gtx',sl:'en',tl:locale,dt:'t',q:protectedKeys.join('\n\n')});
  try {
    const response=await fetch(url,{signal:AbortSignal.timeout(25000)});
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    const data=await response.json();
    const output=data[0].map(part=>part[0]||'').join('').split(/\n\s*\n/).map(text=>{
      let result=text.trim().replace(/⟦\s*(\d+)\s*⟧/g,'{$1}');
      for(let index=0;index<30;index++)result=result.replace(new RegExp(`997310${String(index).padStart(3,'0')}`.split('').join('[,\\s.]*'),'g'),`{${index}}`);
      return result;
    });
    if(output.length!==keys.length||output.some((text,index)=>!text||(keys[index].match(/\{\d+\}/g)||[]).some(token=>!text.includes(token)))){
      if(keys.length===1)throw new Error(`Invalid placeholders or output for ${keys[0]}`);
      const middle=Math.ceil(keys.length/2);
      return [...await translateBatch(keys.slice(0,middle),locale),...await translateBatch(keys.slice(middle),locale)];
    }
    return output;
  }catch(error){
    if(attempt>=3)throw error;
    await pause(1000*(attempt+1));return translateBatch(keys,locale,attempt+1);
  }
}
const batches=[];let batch=[],size=0;
for(const key of missing){if(size+key.length>2600&&batch.length){batches.push(batch);batch=[];size=0;}batch.push(key);size+=key.length+2;}if(batch.length)batches.push(batch);
let nextLocale=0;
async function worker(){
  while(nextLocale<locales.length){
    const locale=locales[nextLocale++];
    const cachePath=join(directory,`${locale}.json`);
    const catalog=existsSync(cachePath)?JSON.parse(readFileSync(cachePath,'utf8')):{};
    let done=0;
    for(const keys of batches){
      const pending=keys.filter(key=>!catalog[key]);
      if(pending.length){const translated=await translateBatch(pending,locale);pending.forEach((key,index)=>catalog[key]=translated[index]);writeFileSync(cachePath,JSON.stringify(catalog,null,2)+'\n');}
      done++;if(done%10===0||done===batches.length)console.log(`${locale}: ${done}/${batches.length} batches, ${Object.keys(catalog).length} strings`);
      await pause(150);
    }
    writeFileSync(join(directory,`${locale}.js`),`// Generated from built-in page copy; never user content.\nexport default ${JSON.stringify(catalog)};\n`);
    console.log(`${locale}: complete`);
  }
}
await Promise.all([worker(),worker(),worker()]);
console.log('All catalogs complete.');
