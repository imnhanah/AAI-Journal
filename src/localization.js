import { messages } from './translations.js';
import { auditMessages } from './auditTranslations.js';

export const LANGUAGES = [
  ['en', 'English'], ['es', 'Español'], ['fr', 'Français'], ['pt', 'Português'],
  ['de', 'Deutsch'], ['it', 'Italiano'], ['ru', 'Русский'], ['zh', '中文'],
  ['ja', '日本語'], ['ko', '한국어'], ['hi', 'हिन्दी'], ['tr', 'Türkçe'],
  ['id', 'Bahasa Indonesia'], ['ar', 'العربية'],
].map(([code, name]) => ({ code, name, dir: code === 'ar' ? 'rtl' : 'ltr' }));
export const LANGUAGE_KEY = 'tj:language';
export const normalizeLanguage = value => LANGUAGES.some(item => item.code === value) ? value : 'en';
let language = 'en';
let storedLanguage = 'en';
try { storedLanguage = normalizeLanguage(globalThis.localStorage?.getItem(LANGUAGE_KEY)); } catch {}
const listeners = new Set();
const messageIndex = new Map(Object.entries({...messages,...auditMessages}).map(([key, value]) => [key.toLowerCase(), value]));
const pageLoaders = {
  es:()=>import('./locales/es.js'),fr:()=>import('./locales/fr.js'),pt:()=>import('./locales/pt.js'),
  de:()=>import('./locales/de.js'),it:()=>import('./locales/it.js'),ru:()=>import('./locales/ru.js'),
  zh:()=>import('./locales/zh.js'),ja:()=>import('./locales/ja.js'),ko:()=>import('./locales/ko.js'),
  hi:()=>import('./locales/hi.js'),tr:()=>import('./locales/tr.js'),id:()=>import('./locales/id.js'),ar:()=>import('./locales/ar.js'),
};
const pageCatalogs = new Map();
// Context-specific financial terminology that literal machine translation misses.
const terminology = {de:{'high-water':'Höchststand','low print':'Tiefststand','lowest balance print so far':'Bisher niedrigster Kontostand','best balance print so far':'Bisher höchster Kontostand','live':'Live','live balance':'Aktueller Kontostand','live balance right now':'Aktueller Kontostand','how the journal is distributed':'Verteilung der Trades','{0} carry mistake tags; review them before changing the plan.':'{0} Trades sind mit Fehlern markiert; überprüfe sie, bevor du den Plan änderst.'}};
const templateCatalogs = new Map();
const calendarCache = new Map();
function calendarText(source,locale) {
  const groups=[['Sunday Monday Tuesday Wednesday Thursday Friday Saturday'.split(' '),'weekday','long'],['Sun Mon Tue Wed Thu Fri Sat'.split(' '),'weekday','short'],['Su Mo Tu We Th Fr Sa'.split(' '),'weekday','short'],['January February March April May June July August September October November December'.split(' '),'month','long'],['Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' '),'month','short']];
  for(const [names,field,width] of groups){
    const index=names.findIndex(name=>name.toLowerCase()===source.toLowerCase());
    if(index<0)continue;
    const key=`${locale}:${field}:${width}:${index}`;
    if(!calendarCache.has(key))calendarCache.set(key,new Intl.DateTimeFormat(locale,{[field]:width,timeZone:'UTC'}).format(new Date(field==='month'?Date.UTC(2026,index,1):Date.UTC(2026,0,4+index))));
    return calendarCache.get(key);
  }
}
let requestVersion=0;
const escapePattern=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
function indexCatalog(locale,catalog) {
  pageCatalogs.set(locale,new Map(Object.entries(catalog).map(([source,translated])=>[source.toLowerCase(),translated])));
  templateCatalogs.set(locale,Object.entries(catalog).filter(([source])=>/\{\d+\}/.test(source)&&!(/\{\d+\}\{\d+\}/.test(source))).map(([source,translated])=>{
    const indexes=[];let previous=0,pattern='';
    for(const token of source.matchAll(/\{(\d+)\}/g)){pattern+=escapePattern(source.slice(previous,token.index))+'(.*?)';indexes.push(token[1]);previous=token.index+token[0].length;}
    pattern+=escapePattern(source.slice(previous));
    const anchor=source.split(/\{\d+\}/).filter(part=>/[a-zA-Z]{2}/.test(part)).sort((a,b)=>b.length-a.length)[0]?.trim().toLowerCase()||'';
    return {pattern:new RegExp(`^${pattern}$`,'i'),indexes,translated,anchor,source:source.toLowerCase()};
  }));
}
export async function loadLanguage(locale) {
  const code=normalizeLanguage(locale);
  if(code!=='en'&&!pageCatalogs.has(code))indexCatalog(code,(await pageLoaders[code]()).default);
}
export const getDateLocale = () => language === 'en' ? 'en-US' : `${language}-u-nu-latn`;
export function translateTemplate(source,parameters,locale=language) {
  return translate(source,locale).replace(/\{(\d+)\}/g,(_,index)=>String(parameters[index]??''));
}
export const getLanguage = () => language;
export const subscribeLanguage = listener => { listeners.add(listener); return () => listeners.delete(listener); };
export async function setLanguage(value) {
  const next=normalizeLanguage(value), version=++requestVersion;
  await loadLanguage(next);
  if(version!==requestVersion)return;
  language = next;
  try { globalThis.localStorage?.setItem(LANGUAGE_KEY, language); } catch {}
  if (typeof document !== 'undefined') {
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
  }
  listeners.forEach(listener => listener());
}
export function translate(value, locale = language) {
  if (typeof value !== 'string' || locale === 'en' || value.length>2200) return value;
  const source = value.trim();
  // Brand identity is not translatable UI copy.
  if (source.toUpperCase() === 'AAICOREFX') return value;
  const code=normalizeLanguage(locale);
  const calendar=calendarText(source,code);
  if(calendar)return value.replace(source,calendar);
  const translated = terminology[code]?.[source.toLowerCase()] || messageIndex.get(source.toLowerCase())?.[code] || pageCatalogs.get(code)?.get(source.toLowerCase());
  if (!translated && /\s\*$/.test(source)) return value.replace(source, `${translate(source.replace(/\s\*$/, ''), locale)} *`);
  if(translated)return value.replace(source,translated);
  for(const entry of templateCatalogs.get(code)||[]){
    if(entry.anchor&&!source.toLowerCase().includes(entry.anchor))continue;
    const match=source.match(entry.pattern);
    if(match){const parameters=Object.fromEntries(entry.indexes.map((index,position)=>[index,match[position+1]]));return value.replace(source,(terminology[code]?.[entry.source]||entry.translated).replace(/\{(\d+)\}/g,(_,index)=>parameters[index]??''));}
  }
  return value;
}
if (typeof window !== 'undefined') {
  void setLanguage(storedLanguage);
  window.addEventListener('storage', event => { if (event.key === LANGUAGE_KEY) void setLanguage(event.newValue); });
}
