import EntryConfluenceManager from './EntryConfluenceManager.jsx';
import {readEntryConfluenceLibrary,librarySaveValue} from './entryConfluenceLibrary.js';
import React, {useEffect, useId, useLayoutEffect, useRef, useState} from 'react';
import {Archive, ArchiveRestore, GripVertical, Info, Layers, LogIn, Pencil, Plus, X} from 'lucide-react';
import {
  classificationLookup, classificationSection, duplicateClassificationName, entryTypeOptions,
  moveClassificationItem, newClassificationItem, selectionConflicts, toggleConfluence,
} from './workspaceClassification.js';
import './workspaceClassification.css';

export function OrderHandle({id, name, ids, onMove, disabled}) {
  const handle = useRef(null);
  const drag = useRef(null);
  const group = useId();
  const [destination,setDestination] = useState(null);
  const index = ids.indexOf(id);
  const move = position => onMove(moveClassificationItem(ids,id,position));
  const hit = event => {
    const row = document.elementFromPoint(event.clientX,event.clientY)?.closest('[data-classification-order]');
    const target = row?.querySelector('[data-order-list]');
    if (!target || target.dataset.orderList !== JSON.stringify(ids)) return null;
    const at = ids.indexOf(target.dataset.orderItem);
    return at < 0 ? null : at;
  };
  return <span className="tj-classification-order" data-order-list={JSON.stringify(ids)} data-order-item={id}>
    <button ref={handle} type="button" className="tj-classification-grip" aria-label={`Drag ${name} to reorder`} aria-describedby={group}
      disabled={disabled || ids.length < 2}
      onPointerDown={event => {
        if (!event.isPrimary || event.button !== 0) return;
        event.preventDefault();
        drag.current = event.pointerId;
        handle.current.setPointerCapture(event.pointerId);
      }}
      onPointerMove={event => {
        if (drag.current !== event.pointerId) return;
        const scroller = handle.current.closest('.tj-content');
        const bounds = scroller?.getBoundingClientRect();
        if (bounds && event.clientY < bounds.top + 36) scroller.scrollBy(0,-16);
        if (bounds && event.clientY > bounds.bottom - 36) scroller.scrollBy(0,16);
      }}
      onPointerUp={event => {
        if (drag.current !== event.pointerId) return;
        drag.current = null;
        const target = hit(event);
        if (target !== null && target !== index) move(target);
      }}
      onPointerCancel={() => { drag.current=null; }}
      onLostPointerCapture={() => { drag.current=null; }}
      onClick={() => document.getElementById(group)?.focus()}>
      <GripVertical size={16} aria-hidden="true"/>
    </button>
    <select id={group} aria-label={`Move ${name} to position`} value={destination ?? index} disabled={disabled || ids.length < 2}
      onChange={event=>setDestination(event.currentTarget.selectedIndex)}>
      {ids.map((key,position)=><option value={position} key={key}>{position+1}</option>)}
    </select>
    {destination !== null && destination !== index && <button type="button" className="tj-btn-outline"
      aria-label={`Confirm move ${name}`} disabled={disabled} onClick={()=>{move(destination);setDestination(null);}}>Move</button>}
  </span>;
}

function ItemEditor({draft,onChange,onCancel,onSave,busy,kind,categories=[]}) {
  const handleSubmit = event => {event.preventDefault();void onSave();};
  return <form className="tj-classification-editor" onSubmit={handleSubmit}>
    <label>Name<input autoFocus className="tj-input" required maxLength={160} value={draft.name}
      onChange={event=>onChange({...draft,name:event.target.value})}/></label>
    {kind === 'category' ? <label>Selection mode
      <select className="tj-input" value={draft.mode} onChange={event=>onChange({...draft,mode:event.target.value})}>
        <option value="multi">Multi-select</option><option value="single">Single Select</option>
      </select>
    </label> : <label>Description <small>(optional)</small><textarea rows={3} className="tj-input" maxLength={4000}
      value={draft.description ?? ''} onChange={event=>onChange({...draft,description:event.target.value})}/></label>}
    {kind === 'tag' && <label>Category<select className="tj-input" value={draft.categoryId}
      onChange={event=>onChange({...draft,categoryId:event.target.value})}>
      {categories.map(category=><option key={category.id} value={category.id}>{category.name}</option>)}
    </select></label>}
    <div className="tj-classification-actions">
      <button type="button" className="tj-btn-outline" disabled={busy} onClick={onCancel}>Cancel</button>
      <button type="submit" className="tj-btn-primary" disabled={busy || !draft.name.trim()}>{busy ? 'Saving…' : 'Save'}</button>
    </div>
  </form>;
}

const withOrder = (items, ids) => ids.map(id=>items.find(item=>item.id===id));

export function WorkspaceClassificationSetup({workspace,section,onSave,editable}) {
  const entry = section === 'entryTypes';
  const stored = classificationSection(workspace,section);
  const categories = stored.categories || [];
  const [draft,setDraft] = useState(null);
  const [failure,setFailure] = useState('');
  const [busy,setBusy] = useState(false);
  const [retryOrder,setRetryOrder] = useState(null);
  const inFlight = useRef(false);
  const begin = (kind, item, categoryId) => {
    setFailure('');
    setRetryOrder(null);
    setDraft({name:'',description:'',mode:'multi',...item,kind,categoryId,base:workspace});
  };
  const persist = async (value,base=workspace) => {
    if (!editable || inFlight.current) return false;
    inFlight.current=true;
    setBusy(true);
    setFailure('');
    try { await onSave(section,value,base);return true; }
    catch (error) { setFailure(error.message || 'Could not save Journal Setup.');return false; }
    finally { inFlight.current=false;setBusy(false); }
  };
  const reorder = async value => {
    const operation={value,base:workspace};
    setRetryOrder(operation);
    if (await persist(value,operation.base)) setRetryOrder(null);
  };
  const submit = async () => {
    const name=draft.name.trim();
    if (!name) return;
    const original=classificationSection(draft.base,section);
    const originalCategories=original.categories || [];
    const rejectDuplicate = () => setFailure('That name is already in use.');
    let next;
    if (entry) {
      if (duplicateClassificationName(original.items,name,draft.id)) return rejectDuplicate();
      const item={...newClassificationItem('entry',name,draft.description),...(draft.id ? {id:draft.id,archived:draft.archived} : {})};
      next={items:draft.id ? original.items.map(entryType=>entryType.id===draft.id ? item : entryType) : [...original.items,item]};
    } else if (draft.kind === 'category') {
      if (duplicateClassificationName(originalCategories,name,draft.id)) return rejectDuplicate();
      const existing=originalCategories.find(category=>category.id===draft.id);
      const item={id:existing?.id ?? newClassificationItem('category',name).id,name,mode:draft.mode,archived:existing?.archived ?? false,tags:existing?.tags ?? []};
      next={categories:existing ? originalCategories.map(category=>category.id===item.id ? item : category) : [...originalCategories,item]};
    } else {
      const target=originalCategories.find(category=>category.id===draft.categoryId);
      if (!target || target.archived) {setFailure('Choose an active category.');return;}
      if (duplicateClassificationName(target.tags,name,draft.id)) return rejectDuplicate();
      const item={...newClassificationItem('tag',name,draft.description),...(draft.id ? {id:draft.id,archived:draft.archived} : {})};
      next={categories:originalCategories.map(category=>{
        if (category.id !== target.id) return {...category,tags:category.tags.filter(tag=>tag.id!==item.id)};
        const stays=category.tags.some(tag=>tag.id===item.id);
        return {...category,tags:stays ? category.tags.map(tag=>tag.id===item.id ? item : tag) : [...category.tags,item]};
      })};
    }
    if (await persist(next,draft.base)) setDraft(null);
  };
  const archive = async (item, category) => {
    const toggle = candidate => candidate.id === item.id ? {...candidate,archived:!item.archived} : candidate;
    if (entry && item.archived && duplicateClassificationName(stored.items,item.name,item.id)) {setFailure('That name is already in use.');return;}
    if (category && item.archived && duplicateClassificationName(category.tags,item.name,item.id)) {setFailure('That name is already in use.');return;}
    await persist(entry ? {items:stored.items.map(toggle)} : {categories:category
      ? categories.map(group=>group.id===category.id ? {...group,tags:group.tags.map(toggle)} : group)
      : categories.map(toggle)});
  };
  const editor = (kind,id) => editable && draft?.kind===kind && draft.id===id &&
    <ItemEditor kind={kind} draft={draft} onChange={setDraft} onSave={submit} onCancel={()=>setDraft(null)}
      busy={busy} categories={categories.filter(category=>!category.archived)}/>;
  const controls = (kind,item,category) => editable && <div className="tj-classification-actions tj-classification-item-actions">
    <button type="button" disabled={busy} className="tj-classification-icon" aria-label={`Edit ${item.name}`} title={`Edit ${item.name}`}
      onClick={()=>begin(kind,item,category?.id)}><Pencil size={15} aria-hidden="true"/></button>
    <button type="button" disabled={busy} className="tj-classification-icon" aria-label={`${item.archived?'Restore':'Archive'} ${item.name}`} title={`${item.archived?'Restore':'Archive'} ${item.name}`}
      onClick={()=>void archive(item,category)}>{item.archived?<ArchiveRestore size={15} aria-hidden="true"/>:<Archive size={15} aria-hidden="true"/>}</button>
  </div>;
  const itemRow = (item,kind,category) => <div className={`tj-classification-row${item.archived?' is-archived':''}`} key={item.id} data-classification-order>
    <div className="tj-classification-line">
      <div className="tj-classification-label"><strong>{item.name}</strong>{item.archived && <small>Archived</small>}
        {item.description && <p title={item.description}>{item.description}</p>}</div>
      {kind==='tag' && editable && <OrderHandle id={item.id} name={item.name} ids={category.tags.map(tag=>tag.id)} disabled={busy}
        onMove={ids=>void reorder({categories:categories.map(group=>group.id===category.id ? {...group,tags:withOrder(group.tags,ids)} : group)})}/>}
      {controls(kind,item,category)}
    </div>{editor(kind,item.id)}
  </div>;
  return <section className="tj-classification-setup" aria-label={entry?'Entry Types':'Confluences'}>
    <header className="tj-classification-heading">
      <span className="tj-classification-heading-icon" aria-hidden="true">{entry?<LogIn size={22}/>:<Layers size={22}/>}</span>
      <div className="tj-classification-heading-copy"><h2>{entry?'Entry Types':'Confluences'}</h2>
        <p>{entry?`${stored.items.length} entry types`:`${categories.length} categories · ${categories.reduce((sum,category)=>sum+category.tags.length,0)} tags`}<span> · This workspace</span></p></div>
      {editable && <button type="button" className="tj-btn-primary tj-classification-add" disabled={busy}
        onClick={()=>begin(entry?'entry':'category')}><Plus size={16} aria-hidden="true"/>{entry?'Add Entry Type':'Add category'}</button>}</header>
    {failure && <p role="alert">{failure}</p>}
    {retryOrder && failure && <button type="button" className="tj-btn-outline" disabled={busy}
      onClick={async()=>{if (await persist(retryOrder.value,retryOrder.base)) setRetryOrder(null);}}>Retry reorder</button>}
    {editor(entry?'entry':'category',undefined)}
    {entry ? <div className="tj-classification-entry-list">{stored.items.map(item=>itemRow(item,'entry'))}</div> : categories.map(category=>
      <section className="tj-classification-category" key={category.id} data-classification-order>
        <div className="tj-classification-line tj-classification-category-heading">
          <div className="tj-classification-label"><h3>{category.name}</h3><small className="tj-classification-mode">{category.mode==='single'?'Single Select':'Multi-select'}{category.archived?' · Archived':''}</small></div>
          {editable && <OrderHandle id={category.id} name={category.name} ids={categories.map(group=>group.id)} disabled={busy}
            onMove={ids=>void reorder({categories:withOrder(categories,ids)})}/>}
          {controls('category',category)}
        </div>
        {editor('category',category.id)}
        <div className="tj-classification-tag-list">{category.tags.map(tag=>itemRow(tag,'tag',category))}</div>
        {editable && !category.archived && <button className="tj-classification-add-tag" type="button" disabled={busy}
          onClick={()=>begin('tag',undefined,category.id)}><Plus size={15} aria-hidden="true"/>Add tag</button>}
        {!draft?.id && draft?.categoryId===category.id && editor('tag',undefined)}
      </section>)}
    {!(entry?stored.items.length:categories.length) && <p>{entry?'No entry types yet.':'No confluence categories yet.'}</p>}
  </section>;
}

export function EntryTypeDefinitions({workspace}) {
  const [open,setOpen] = useState(false);
  const [layout,setLayout] = useState({});
  const wrapper=useRef(null), trigger=useRef(null), body=useRef(null);
  const id=useId();
  const close = restore => {setOpen(false);if (restore) trigger.current?.focus();};
  useLayoutEffect(()=>{
    if (!open) return;
    const measure=()=>{
      const anchor=wrapper.current.getBoundingClientRect();
      const panel=wrapper.current.closest('.tj-entry-panel,.tj-modal,.sp-body,.tj-entry-layout')?.getBoundingClientRect();
      const left=Math.max(8,(panel?.left ?? 0)+8);
      const right=Math.min(window.innerWidth-8,(panel?.right ?? window.innerWidth)-8);
      const top=Math.max(8,(panel?.top ?? 0)+8);
      const bottom=Math.min(window.innerHeight-8,(panel?.bottom ?? window.innerHeight)-8);
      const width=Math.min(300,right-left);
      const below=bottom-anchor.bottom-6, above=anchor.top-top-6;
      const opensAbove=below<160 && above>below;
      setLayout({width,maxHeight:Math.max(56,Math.min(300,opensAbove?above:below)),left:Math.max(left,Math.min(anchor.left,right-width))-anchor.left,
        ...(opensAbove?{bottom:'calc(100% + 6px)'}:{top:'calc(100% + 6px)'})});
    };
    measure();body.current?.focus();
    window.addEventListener('resize',measure);
    window.addEventListener('scroll',measure,true);
    return ()=>{ window.removeEventListener('resize',measure);window.removeEventListener('scroll',measure,true); };
  },[open]);
  useEffect(()=>{
    if (!open) return;
    const pointer=event=>{if(!wrapper.current?.contains(event.target)) close(false);};
    const key=event=>{if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();close(true);}};
    document.addEventListener('pointerdown',pointer,true);
    document.addEventListener('keydown',key,true);
    return ()=>{document.removeEventListener('pointerdown',pointer,true);document.removeEventListener('keydown',key,true);};
  },[open]);
  const definitions=entryTypeOptions(workspace);
  return <span className="tj-classification-info" ref={wrapper}>
    <button type="button" ref={trigger} className="tj-classification-info-trigger" aria-label="Entry Type definitions"
      aria-haspopup="dialog" aria-expanded={open} aria-controls={open?id:undefined} onClick={()=>open?close(true):setOpen(true)}><Info size={16}/></button>
    {open && <span id={id} ref={body} role="dialog" aria-label="Entry Type definitions" tabIndex={-1} className="tj-classification-popover" style={layout}>
      <span className="tj-classification-line"><strong>Entry Type definitions</strong><button type="button" aria-label="Close definitions"
        className="tj-classification-info-trigger" onClick={()=>close(true)}><X size={15}/></button></span>
      {definitions.length ? definitions.map(item=><span className="tj-classification-definition" key={item.id}><strong>{item.name}</strong><span>{item.description || 'No description added'}</span></span>)
        : <span className="tj-classification-definition">No entry types configured.</span>}
    </span>}
  </span>;
}

export function ConfluenceSelection({workspace,selected,onChange}) {
  const [tab,setTab]=useState(null);
  const [summaryOpen,setSummaryOpen]=useState(false);
  const [pending,setPending]=useState(null);
  const base=useId();
  const {categories}=classificationSection(workspace,'confluences');
  const active=categories.filter(category=>!category.archived);
  const category=active.find(group=>group.id===tab) || active[0];
  const lookup=classificationLookup(workspace);
  const conflicts=selectionConflicts(categories,selected);
  const select=tag=>{
    if (conflicts.includes(category) && !selected.includes(tag.id)) {setPending(tag);return;}
    onChange(toggleConfluence(category,selected,tag.id));
  };
  const tabKeys=event=>{
    const index=active.indexOf(category);
    const next=event.key==='ArrowRight'?active[(index+1)%active.length]:event.key==='ArrowLeft'?active[(index-1+active.length)%active.length]:
      event.key==='Home'?active[0]:event.key==='End'?active.at(-1):null;
    if (next) {event.preventDefault();setPending(null);setTab(next.id);document.getElementById(`${base}-${next.id}`)?.focus();}
  };
  return <div className="tj-classification-selection">
    {category && <>
      <div className="tj-classification-tabs" role="tablist" aria-label="Confluence categories" onKeyDown={tabKeys}>
        {active.map(group=><button key={group.id} id={`${base}-${group.id}`} type="button" role="tab" aria-selected={group===category}
          aria-controls={`${base}-tags`} tabIndex={group===category?0:-1} onClick={()=>{setPending(null);setTab(group.id);}}>{group.name}</button>)}
      </div>
      <div role="tabpanel" id={`${base}-tags`} aria-labelledby={`${base}-${category.id}`}>
        <small>{category.mode==='single'?'Select one':'Select all that apply'}</small>
        {conflicts.includes(category) && <p>This trade has multiple saved selections in this category. You can keep them or update your selection.</p>}
        <div className="tj-classification-chips">{category.tags.filter(tag=>!tag.archived).map(tag=><button key={tag.id}
          type="button" title={tag.description || undefined} aria-pressed={selected.includes(tag.id)} onClick={()=>select(tag)}>{tag.name}</button>)}</div>
        {pending && <p role="status">Replace this category’s selections with {pending.name}?
          <button type="button" className="tj-btn-outline" onClick={()=>{onChange(toggleConfluence(category,selected,pending.id));setPending(null);}}>Replace selections</button>
          <button type="button" className="tj-btn-outline" onClick={()=>setPending(null)}>Keep existing</button></p>}
      </div>
    </>}
    {!category && <p>No confluence categories configured.</p>}
    <button type="button" className="tj-classification-summary" aria-expanded={summaryOpen} aria-controls={`${base}-selected`} onClick={()=>setSummaryOpen(!summaryOpen)}>
      Selected Confluences ({selected.length})
    </button>
    {summaryOpen && <div id={`${base}-selected`} className="tj-classification-chips">{selected.length
      ? selected.map((id,index)=><button key={`${id}-${index}`} type="button" aria-label={`Remove ${lookup.tag(id)}`}
        onClick={()=>onChange(selected.filter(key=>key!==id))}>{lookup.tag(id)} <X size={13} aria-hidden="true"/></button>)
      : <small>Nothing selected yet.</small>}</div>}
  </div>;
}

export function useRuleOrdering(workspace,onSave,editable) {
  const [retry,setRetry]=useState(null);
  const [failure,setFailure]=useState('');
  const [busy,setBusy]=useState(false);
  const running=useRef(false);
  const ids=(workspace.rules || []).map(rule=>rule.id);
  const save=async operation=>{
    if (!editable || running.current) return;
    running.current=true;setBusy(true);setFailure('');setRetry(operation);
    try { await onSave('ruleOrder',{ids:operation.ids},operation.workspace);setRetry(null); }
    catch (error) { setFailure(error.message || 'Could not save Trading Rules order.'); }
    finally {running.current=false;setBusy(false);}
  };
  const problem=retry?.workspace.id===workspace.id ? failure : '';
  return editable ? {
    controls:row => <OrderHandle id={row.id} name={row.label || row.text} ids={ids} disabled={busy}
      onMove={next=>void save({ids:next,workspace})}/>,
    status:problem && <div role="alert">{problem} <button type="button" disabled={busy} className="tj-btn-outline" onClick={()=>void save(retry)}>Retry reorder</button></div>,
  } : {};
}

export function EntryConfluenceSetup({workspace,section,onSave,editable}) {
  const library=readEntryConfluenceLibrary(workspace);
  return <EntryConfluenceManager section={section==='entryTypes'?'entries':'confluences'} library={library}
    onSave={editable ? next=>onSave(section,librarySaveValue(next,section),next.base) : undefined}/>;
}
