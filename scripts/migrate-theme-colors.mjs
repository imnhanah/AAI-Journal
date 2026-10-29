import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
if(fs.existsSync('src/themeTokens.css'))throw new Error('Theme migration is already applied. Do not rerun on migrated files.');
const files=fs.readdirSync('src').filter(name=>/\.(css|jsx)$/.test(name) && name!=='themeTokens.css').map(name=>'src/'+name).concat('src/siteTheme.js');
const color=/#[\da-f]{8}\b|#[\da-f]{6}\b|#[\da-f]{4}\b|#[\da-f]{3}\b|rgba?\([^()]+\)/gi;
const registry=new Map(),changes=[];
const palette={bg:['#0e171c','#ffffff'],card:['#14222a','#f6f9f8'],'card-alt':['#12222a','#f3f7f6'],border:['#26363e','#e2e9e7'],'border-strong':['#3a4f58','#cdd9d6'],text:['#e8f0ee','#12212a'],'text-2':['#c5d3d6','#33474d'],muted:['#8fa3a8','#5f7378'],placeholder:['#5a6f78','#8aa0a5'],green:['#50c6a0','#1f9d78'],'green-bg':['#0e2a22','#e3f6ef'],'green-border':['#2f7a5f','#9bdcc4'],red:['#f08a8a','#d6455a'],'red-bg':['#3a1d22','#fde8ec'],'red-border':['#7a3a3a','#f2b8c2'],amber:['#f5b94a','#b7791f'],'amber-bg':['#2e2412','#fdf1d8'],'amber-border':['#8a6a1f','#e5c27a'],blue:['#60a5fa','#2f7fd6'],purple:['#8b7cf6','#6a5ad8'],'on-accent':['#07261b','#ffffff']};
function channels(raw){
  if(raw[0]==='#'){
    let hex=raw.slice(1);if(hex.length<5)hex=[...hex].map(c=>c+c).join('');
    return [0,2,4].map(i=>parseInt(hex.slice(i,i+2),16)).concat(hex.length===8?parseInt(hex.slice(6),16)/255:1);
  }
  const nums=raw.match(/[\d.]+/g).map(Number);return nums.concat(nums.length===3?[1]:[]);
}
function roleAt(source,offset){
  const previous=source.slice(Math.max(0,offset-180),offset);
  const matches=[...previous.matchAll(/([\w-]+)\s*:\s*/g)];
  const prop=matches.at(-1)?.[1] || '';
  if(/shadow/i.test(prop))return 'shadow';
  if(/contrast|on-accent/i.test(prop))return 'on-accent';
  if(/placeholder/i.test(prop))return 'placeholder';
  if(/border|outline|grid/i.test(prop))return 'border';
  if(/background|\bbg\b|panel|chrome|track|tooltip|input-bg|card|alt|muted.*bg/i.test(prop))return 'surface';
  return 'ink';
}
function lightValue(raw,role){
  const [r,g,b,a]=channels(raw),max=Math.max(r,g,b),min=Math.min(r,g,b),brightness=(r+g+b)/3;
  if(role==='shadow')return `rgba(18,33,42,${Math.min(a,.14).toFixed(3)})`;
  if(role==='on-accent')return 'var(--on-accent)';
  if(role==='placeholder')return 'var(--placeholder)';
  let hue;
  if(max-min>30){
    if(g>=r && g>=b || g>r*1.15 && b>r*1.2)hue='green';
    else if(r>b*1.2 && g>b*1.3 && g>r*.48)hue='amber';
    else if(r>=b && r>g*1.15)hue='red';
    else if(b>g*1.15 && r>g*1.12)hue='purple';
    else hue='blue';
  }
  if(hue){
    if(role==='surface' && a>.5 && brightness<115 && ['green','red','amber'].includes(hue))return `var(--${hue}-bg)`;
    if(role==='border' && ['green','red','amber'].includes(hue))return `var(--${hue}-border)`;
    return a<1?`color-mix(in srgb,var(--${hue}) ${(a*100).toFixed(2)}%,transparent)`:`var(--${hue})`;
  }
  if(a<1){
    return `rgba(18,33,42,${Math.min(a,role==='surface'?.08:.14).toFixed(3)})`;
  }
  if(role==='border')return 'var(--border)';
  if(role==='surface')return brightness>225?'var(--bg)':'var(--card-alt)';
  return brightness>185?'var(--text)':brightness>105?'var(--muted)':brightness>65?'var(--text-2)':'var(--text)';
}
for(const file of files){
  const original=fs.readFileSync(file,'utf8');
  let count=0;
  const updated=original.replace(color,(raw,offset)=>{
    const role=roleAt(original,offset),key=role+':'+raw.toLowerCase().replace(/\s+/g,'');
    if(!registry.has(key))registry.set(key,{name:`--color-${role}-${registry.size+1}`,dark:raw,light:lightValue(raw,role)});
    count++;return `var(${registry.get(key).name})`;
  });
  if(count){fs.writeFileSync(file,updated);changes.push({file,count});}
}
let css='/* Semantic palette. Historical tokens keep every original dark literal unchanged. */\n:root {\n';
for(const [name,values] of Object.entries(palette))css+=`  --${name}: ${values[0]};\n`;
for(const item of registry.values())css+=`  ${item.name}: ${item.dark};\n`;
css+='}\n:root[data-theme="light"] {\n';
for(const [name,values] of Object.entries(palette))css+=`  --${name}: ${values[1]};\n`;
for(const item of registry.values())css+=`  ${item.name}: ${item.light};\n`;
css+='}\n';
fs.writeFileSync('src/themeTokens.css',css);
fs.writeFileSync('scripts/theme-color-migration.json',JSON.stringify({changes,colors:[...registry.values()]},null,2)+'\n');
console.log(JSON.stringify({files:changes.length,replacements:changes.reduce((sum,item)=>sum+item.count,0),tokens:registry.size,changes},null,2));
