import React, {useEffect, useId, useRef, useState} from 'react';
import {Check, Info, X} from 'lucide-react';
import {ThemeSelect} from './JournalControls';
import {activeLibraryCategories, libraryEntryControlModel, libraryTagLabel, toggleLibraryConfluence, unavailableConfluences} from './entryConfluenceLibrary.js';
import './entryConfluenceLibrary.css';

export function EntryTypeControl({library, value = '', onChange, label = 'Entry Type', valueMode = 'id', ...accessibility}) {
  const [info,setInfo]=useState(false), id=useId(),root=useRef(null),button=useRef(null);
  const {entries,entry,historical}=libraryEntryControlModel(library,value,valueMode);
  useEffect(()=>{
    if(!info)return;
    const outside=event=>{if(!root.current?.contains(event.target))setInfo(false);};
    const escape=event=>{if(event.key==='Escape'){event.stopPropagation();setInfo(false);button.current?.focus();}};
    document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape,true);
    return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape,true);};
  },[info]);
  return <div className="ecl-entry-control" ref={root} {...accessibility}>
    <div className="ecl-entry-pick"><ThemeSelect label={label} className="tj-input" value={value} onChange={event=>onChange(event.target.value,entries.find(entry=>entry.value===event.target.value))}><option value="">None</option>{historical&&<option value={value}>{entry?.label||(/^aai-entry:/.test(value)?'Definition unavailable':value)} · previously saved</option>}{entries.map(e=><option key={e.id||e.value} value={e.value}>{e.label}</option>)}</ThemeSelect><button ref={button} type="button" className="ecl-info" aria-label={`${label} description`} aria-expanded={info} aria-controls={id} onClick={()=>setInfo(open=>!open)}><Info size={15}/></button></div>
    {info&&<div id={id} className="ecl-info-box" role="dialog" aria-label="Entry Type definitions"><button type="button" className="ecl-icon-button" aria-label="Close definitions" onClick={()=>{setInfo(false);button.current?.focus();}}><X size={14}/></button>{[...entries,...(historical&&entry?[entry]:[])].map(item=><div key={item.id}><strong>{item.label}{item.archived?' · archived':''}</strong><p>{item.description||'No description has been added for this entry type.'}</p></div>)}{!entries.length&&!entry&&<p>No Entry Types configured yet.</p>}</div>}
  </div>;
}

export function ConfluenceControls({library, selected = [], onChange}) {
  const unavailable=unavailableConfluences(library,selected),categories=activeLibraryCategories(library);
  const toggle=id=>onChange(toggleLibraryConfluence(library,selected,id));
  return <div className="ecl-confluence-controls">
    {categories.map(c=><section className="ecl-trade-group" key={c.id} aria-label={c.label}><header><strong>{c.label}</strong><span className="ecl-mode-pill">{c.mode==='single'?'Pick one':'Pick any'}</span><span className="ecl-count">{c.tags.filter(t=>!t.archived&&selected.includes(t.id)).length}/{c.tags.filter(t=>!t.archived).length}</span></header><div className="sp-chips ecl-chips" role="group" aria-label={`${c.label} confluences`}>{c.tags.filter(t=>!t.archived).map(t=><button key={t.id} type="button" className={`sp-chip ecl-chip ${selected.includes(t.id)?'is-on':''} ${c.mode==='single'?'is-single':''}`} aria-pressed={selected.includes(t.id)} title={t.description||t.label} onClick={()=>toggle(t.id)}><span className="sp-chip-check" aria-hidden="true"><Check size={11} strokeWidth={3}/></span>{t.label}</button>)}</div>{!c.tags.some(t=>!t.archived)&&<p className="ecl-muted">No active tags in this category.</p>}</section>)}
    {unavailable.length>0&&<section className="ecl-trade-group"><header><strong>Previously selected</strong><span>Preserved on this trade</span></header><p className="ecl-muted">These saved selections are archived or no longer in your active library.</p><div className="ecl-selected">{unavailable.map(id=><span key={id}>{libraryTagLabel(library,id)}<button type="button" aria-label={`Remove ${libraryTagLabel(library,id)}`} onClick={()=>onChange(selected.filter(value=>value!==id))}><X size={12}/></button></span>)}</div></section>}
    {!!selected.length&&<details className="ecl-selected-summary"><summary>Selected Confluences ({selected.length})</summary><div className="ecl-selected">{selected.map(id=><span key={id}>{libraryTagLabel(library,id)}<button type="button" aria-label={`Remove selected ${libraryTagLabel(library,id)}`} onClick={()=>onChange(selected.filter(value=>value!==id))}><X size={12}/></button></span>)}</div></details>}
    {!categories.some(c=>c.tags.some(t=>!t.archived))&&!unavailable.length&&<p className="ecl-muted">Add confluences in Journal Setup to select them here.</p>}
  </div>;
}
