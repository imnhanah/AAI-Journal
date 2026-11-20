import {canonicalWrite} from './journalWriteSafety.js';
import {classificationSection} from './workspaceClassification.js';
// Stable keys preserve historical associations; current labels are presentation only.
const copy = value => structuredClone(value);
const text = value => typeof value === 'string' ? value : '';
const key = value => text(value).trim().toLocaleLowerCase();
const legacyId = (kind, label) => `${kind}:${encodeURIComponent(label)}`;
export const newLibraryId = (kind='category') => `aai-${kind}:${globalThis.crypto.randomUUID()}`;
const names = values => [...new Set((Array.isArray(values) ? values : []).filter(value => typeof value === 'string' && value.trim()))];
const normalizeItem = (item, kind) => ({ id:text(item.id) || legacyId(kind,item.label), label:text(item.label), description:text(item.description), archived:item.archived === true, aliases:names(item.aliases) });

export function readEntryConfluenceLibrary(account = {}, typeTags = account.typeTags, entryTypes = account.confluenceSessions) {
  const workspace={...account,typeTags,confluenceSessions:entryTypes};
  const entrySection=classificationSection(workspace,'entryTypes');
  const confluenceSection=classificationSection(workspace,'confluences');
  const display=item=>({...item,label:item.name,aliases:[]});
  return {version:1,
    entries:entrySection.items.map(display),
    categories:confluenceSection.categories.map(category=>({...display(category),tags:category.tags.map(display)})),
    base:{id:account.id,classification:account.classification,confluenceSessions:entryTypes||[],typeTags:typeTags||[]},
    legacyCatalog:account.classification?.legacyCatalogSource && canonicalWrite(account.classification.legacyCatalogSource)===canonicalWrite(account.entryConfluenceLibrary??null) ? null : account.entryConfluenceLibrary ?? null,
  };
}
export function librarySaveValue(library, section) {
  if(library.legacyCatalog) throw new Error('This device has an older custom-definition catalog. Keep its recovery copy; a reviewed conversion is required before replacing it.');
  const item=({id,label,description='',archived=false})=>({id,name:label,description,archived});
  if(section==='entryTypes')return {items:library.entries.map(item)};
  if(section!=='confluences')throw new Error('Invalid classification section.');
  return {categories:library.categories.map(category=>({...item(category),mode:category.mode,tags:category.tags.map(item)}))};
}
export function libraryTagLabel(library,id) {
  const tags=libraryTags(library),tag=tags.find(item=>item.id===id);
  if(!tag)return /^aai-(tag|entry):/.test(id)?'Definition unavailable':id;
  const category=library.categories.find(c=>c.tags.some(t=>t.id===id));
  return tags.filter(t=>t.label.trim().toLowerCase()===tag.label.trim().toLowerCase()).length>1?`${tag.label} · ${category.label}`:tag.label;
}
export const libraryTags = library => library.categories.flatMap(c=>c.tags);
export const libraryEntries = library => library.entries.filter(e=>!e.archived);
export const activeLibraryCategories = library => library.categories.filter(c=>!c.archived);
export function entryConfluencePatch(library) {
  throw new Error('Use the revision-checked workspace classification save.');
}
export function libraryEntryForValue(library,value) {return library.entries.find(e=>e.id===value);}

// Strategy Testing retains its existing text-valued model records. Journal
// classifications use stable IDs; sharing the control must not mix the formats.
export function libraryEntryControlModel(library, value = '', valueMode = 'id') {
  const labels = valueMode === 'label';
  const legacy = labels && library.legacyCatalog?.version === 1 && Array.isArray(library.legacyCatalog.entries)
    ? library.legacyCatalog.entries.filter(item => item && typeof item.label === 'string' && item.label.trim())
    : null;
  const all = legacy || library.entries;
  const entries = all.filter(item => !item.archived).map(item => ({...item, value:labels ? item.label : item.id}));
  const entry = all.find(item => labels
    ? item.label === value || (Array.isArray(item.aliases) && item.aliases.includes(value))
    : item.id === value);
  return {entries, entry, historical:!!value && !entries.some(item => item.value === value)};
}
export function libraryItemById(library,kind,id) {return (kind==='entry'?library.entries:kind==='category'?library.categories:libraryTags(library)).find(item=>item.id===id);}
export function validateLibraryName(library,kind,label,id,categoryId) {
  const name=text(label).trim();if(!name)throw new Error('Enter a name with at least one non-space character.');
  if(name.length>160)throw new Error('Use 160 characters or fewer for the name.');
  const items=kind==='entry'?library.entries:kind==='category'?library.categories:(library.categories.find(c=>c.id===categoryId)?.tags||[]);
  if(items.some(item=>item.id!==id&&!item.archived&&key(item.label)===key(name)))throw new Error('This name is already used in this list.');
  return name;
}
export function saveLibraryItem(library,kind,id,fields) {
  const next=copy(library),existing=libraryItemById(next,kind,id),label=validateLibraryName(next,kind,fields.label,id,fields.categoryId);
  if(text(fields.description).length>600)throw new Error('Use 600 characters or fewer for the description.');
  const item=existing||{id:id||newLibraryId(kind),label,description:'',archived:false,aliases:[]};
  // Renames change presentation only; historical records retain the same ID.
  Object.assign(item,{label,description:text(fields.description).trim()});
  if(kind==='category')Object.assign(item,{mode:fields.mode==='single'?'single':'multi',tags:item.tags||[]});
  if(!existing){if(kind==='entry')next.entries.push(item);else if(kind==='category')next.categories.push(item);else{const c=next.categories.find(c=>c.id===fields.categoryId);if(!c)throw new Error('Choose a category.');c.tags.push(item);}}
  else if(kind==='tag'&&fields.categoryId){const c=next.categories.find(c=>c.id===fields.categoryId);if(!c)throw new Error('Choose a category.');if(!c.tags.some(t=>t.id===id)){next.categories.forEach(c=>c.tags=c.tags.filter(t=>t.id!==id));c.tags.push(item);}}
  return next;
}
export function archiveLibraryItem(library,kind,id) {const next=copy(library),item=libraryItemById(next,kind,id);if(!item)throw new Error('This item is no longer available.');item.archived=!item.archived;return next;}
export function moveLibraryItem(library,kind,id,position,categoryId) {
  const next=copy(library),item=libraryItemById(next,kind,id);if(!item)throw new Error('This item is no longer available.');
  let list=kind==='category'?next.categories:next.entries;
  if(kind==='tag'){const destination=next.categories.find(c=>c.id===categoryId);if(!destination)throw new Error('Choose a destination category.');const source=next.categories.find(c=>c.tags.some(t=>t.id===id));if(source!==destination){validateLibraryName(next,'tag',item.label,id,categoryId);source.tags=source.tags.filter(t=>t.id!==id);destination.tags.push(item);}list=destination.tags;}
  const predicate=x=>x.archived===item.archived,visible=list.filter(predicate),slots=list.map((x,i)=>predicate(x)?i:-1).filter(i=>i>=0);
  const at=Number(position);if(!Number.isInteger(at)||at<1||at>visible.length)throw new Error('Choose a valid position.');
  visible.splice(visible.findIndex(x=>x.id===id),1);visible.splice(at-1,0,item);slots.forEach((slot,i)=>list[slot]=visible[i]);return next;
}
export function toggleLibraryConfluence(library,selection,label) {
  const current=Array.isArray(selection)?selection:[];
  if(current.includes(label))return current.filter(value=>value!==label);
  const c=library.categories.find(c=>!c.archived&&c.tags.some(t=>!t.archived&&t.id===label));if(!c)return current;
  return [...(c.mode==='single'?current.filter(value=>!c.tags.some(t=>t.id===value)):current),label];
}
export function unavailableConfluences(library,selection) {return (selection||[]).filter(label=>!library.categories.some(c=>!c.archived&&c.tags.some(t=>!t.archived&&t.id===label)));}
