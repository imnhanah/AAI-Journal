import { Component, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {ConfirmationContext, useConfirmation} from './ConfirmationDialog.jsx';
import {useNavStep} from './useBackNavigation.js';
import {useStepMotion} from './MobilePageStage.jsx';
import { ArrowRight, Bold, ChevronRight, ClipboardCheck, Eye, Focus, Heading1, Heading2, Heading3, ImagePlus, Italic, LayoutGrid, List, ListOrdered, Minus, Quote, Redo2, RemoveFormatting, ShieldCheck, Strikethrough, Underline as UnderlineIcon, Undo2, Unlink, Upload } from 'lucide-react';
import { Archive, ArrowLeft, BookOpen, Check, ChevronDown, Copy, Download, FileText, Image as ImageIcon, Link2, Pin, Plus, Search, Star, Trash2, X, LayoutTemplate, LibraryBig, MoreHorizontal, NotebookTabs, SlidersHorizontal, FolderOpen, Clock3 } from 'lucide-react';
import './caseStudyLibrary.css';
import './caseStudyLibraryRedesign.css';
import './caseStudyEditor.css';
import './desktopCaseStudies.css';
import ChartViewer from './ChartViewer.jsx';
import CaseStudyConnectionsExplorer from './CaseStudyConnectionsExplorer.jsx';
import RichDocumentEditor, { insertImageInView } from './RichDocumentEditor.jsx';
import { addEvidenceRecords, attachDocumentImageEvidence, caseStudyBackup, linkEvidence, linkRelatedStudy, mergeCaseStudyWorkspace, normaliseCaseStudyWorkspace, unlinkEvidence, validateEvidenceImage } from './caseStudyWorkspace.js';
import { CASE_STUDY_CONNECTION_RELATIONSHIPS, CaseStudyConnectionError, caseStudyConnectionsForStudy, createCaseStudyConnection, isDirectionalCaseStudyRelationship, removeCaseStudyConnection, removeConnectionsForCaseStudy, updateCaseStudyConnection } from './caseStudyConnections.js';
import { saveEvidenceImage, useEvidenceImageUrl } from './caseStudyEvidenceImages.js';
import { isDocumentImageReference, readCaseStudyDocumentImage } from './caseStudyDocumentImages.js';
import { activeEvidenceId as resolveActiveEvidenceId, outlineHasVirtualEvidence } from './caseStudyPresentation.js';
import { emptyRichDocument, isSafeLink, migrateSectionRichDocument, patchSectionRichDocument, richDocumentFromSections, richDocumentText } from './studyRichDocument.js';
import { auditRecoveredCaseStudyBackup, auditRecoveredCaseStudyWorkspace } from './recoveredCaseStudyIntegrity.js';
import {continuingCaseStudies, filterCaseStudies, pinnedCaseStudies, sortCaseStudies, studyInstruments, studyTags} from './caseStudyLibraryView.js';
import {caseStudyDraftError, createCaseStudyDraft, hasCaseStudyDraftChanges, initialCaseStudyDraft} from './caseStudyCreation.js';
import { REVIEW_STEPS, normaliseCaseStudyReview, patchStudyReview, reviewReadiness } from './caseStudyReview.js';
import { clearCaseStudyNavigation, readCaseStudyNavigation, writeCaseStudyNavigation } from './caseStudyNavigation.js';
import { evidenceImageReference, resolveCaseStudyCover } from './caseStudyCover.js';
import { synchronizeCaseStudyEvidenceImages } from './caseStudyEvidenceCloud.js';
import { BUILT_IN_CASE_STUDY_TEMPLATES, applyTemplateToStudy, templateSectionNames, templateSections } from './caseStudyTemplates.js';

const now = () => new Date().toISOString();
const uid = (prefix) => globalThis.crypto?.randomUUID?.() || `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const NOTEBOOKS = [
  ['structure', 'Market Structure'], ['liquidity', 'Liquidity'], ['entries', 'Entries & Setups'],
  ['risk', 'Risk Management'], ['psychology', 'Trading Psychology'], ['playbook', 'My Strategy Playbook'],
  ['lessons', 'Trade Lessons'], ['notes', 'Personal Notes'],
];
const TEMPLATES = BUILT_IN_CASE_STUDY_TEMPLATES;
const STATUSES = ['Draft', 'Researching', 'Needs validation', 'Validated'];
const baseWorkspace = () => ({
  notebooks: NOTEBOOKS.map(([id, name]) => ({ id, name, builtIn:true })),
  studies: [], evidence: [], personalTemplates: [], settings:{ view:'grid', query:'', status:'All', notebook:'All', instrument:'All', tag:'All' },
});
const normalise = (raw) => ({
  ...baseWorkspace(),
  ...(raw && typeof raw === 'object' ? raw : {}),
  notebooks: Array.isArray(raw?.notebooks) ? raw.notebooks : baseWorkspace().notebooks,
  studies: normaliseCaseStudyWorkspace(raw).studies,
  evidence: normaliseCaseStudyWorkspace(raw).evidence,
  personalTemplates: normaliseCaseStudyWorkspace(raw).personalTemplates,
  settings: { ...baseWorkspace().settings, ...(raw?.settings || {}) },
});
const studyTitle = (study) => study.title?.trim() || 'Untitled study';
const connectionRelationship = id => CASE_STUDY_CONNECTION_RELATIONSHIPS.find(item=>item.id===id) || null;
const connectionLabel = id => connectionRelationship(id)?.label || 'Related to';
const dateLabel = (value) => value ? new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',year:'numeric'}).format(new Date(value)) : 'Not saved';
const CASE_STUDY_PANEL_WIDTH_KEY='aai-case-study-editor-panel-width';
const CASE_STUDY_PANEL_MIN_WIDTH=320;
const CASE_STUDY_PANEL_DEFAULT_WIDTH=360;
const CASE_STUDY_PANEL_MAX_WIDTH=480;
const clampCaseStudyPanelWidth = value => {
  const numeric=Number(value);
  return Number.isFinite(numeric) ? Math.max(CASE_STUDY_PANEL_MIN_WIDTH,Math.min(CASE_STUDY_PANEL_MAX_WIDTH,numeric)) : CASE_STUDY_PANEL_DEFAULT_WIDTH;
};
const readCaseStudyPanelWidth = () => {
  if (typeof window==='undefined') return 360;
  try {
    const stored=window.localStorage.getItem(CASE_STUDY_PANEL_WIDTH_KEY);
    const width=stored===null ? CASE_STUDY_PANEL_DEFAULT_WIDTH : clampCaseStudyPanelWidth(stored);
    // Old preferences predate the current 320px minimum. Persist the repaired
    // value so every later load and drag begins from the same valid width.
    if (stored!==null && String(width)!==stored) window.localStorage.setItem(CASE_STUDY_PANEL_WIDTH_KEY,String(width));
    return width;
  } catch { return CASE_STUDY_PANEL_DEFAULT_WIDTH; }
};
const writeCaseStudyPanelWidth = value => { try { window.localStorage.setItem(CASE_STUDY_PANEL_WIDTH_KEY,String(value)); } catch {} };
class ChartViewerBoundary extends Component { constructor(props){super(props);this.state={error:false};} static getDerivedStateFromError(){return {error:true};} componentDidCatch(error){console.error('Case Study chart viewer failed to render.', error);} render(){return this.state.error ? <main className="cv"><header><button onClick={this.props.onBack}><ArrowLeft/>Evidence</button></header><p className="cv-error">The chart viewer could not open this evidence safely. Return to the study and check the evidence image.</p></main> : this.props.children;} }
class RichDocumentBoundary extends Component { constructor(props){super(props);this.state={error:false};} static getDerivedStateFromError(){return {error:true};} componentDidCatch(error){console.error('Case Study document editor failed to render.', error);} render(){if(!this.state.error)return this.props.children;return <div className="cse-writing"><p className="cse-muted">The document editor could not open safely. Your existing text is still available below.</p><textarea aria-label="Overview fallback" value={this.props.value||''} onChange={event=>this.props.onChange(event.target.value)}/></div>;} }

function CaseStudyDropdown({id,label,value,options,onChange,openId,setOpenId,className='',align='start'}) {
  const rootRef=useRef(null);
  const triggerRef=useRef(null);
  const listRef=useRef(null);
  const menuRef=useRef(null);
  const open=openId===id;
  const selectedIndex=Math.max(0,options.findIndex(option=>option.value===value));
  const [activeIndex,setActiveIndex]=useState(selectedIndex);
  const [placement,setPlacement]=useState('down');
  const [resolvedAlign,setResolvedAlign]=useState(align);
  const selected=options[selectedIndex] || options[0];
  const close=(restoreFocus=false)=>{
    setOpenId(current=>current===id?null:current);
    if(restoreFocus) queueMicrotask(()=>triggerRef.current?.focus());
  };
  const choose=(option)=>{
    onChange(option.value);
    close(true);
  };
  useEffect(()=>{
    if(!open)return undefined;
    setActiveIndex(selectedIndex);
    const position=()=>{
      const bounds=menuRef.current?.getBoundingClientRect();
      if(!bounds)return;
      setResolvedAlign(current=>bounds.right>window.innerWidth-12?'end':bounds.left<12?'start':current);
      setPlacement(bounds.bottom>window.innerHeight-12&&bounds.top>window.innerHeight-bounds.bottom?'up':'down');
    };
    const frame=window.requestAnimationFrame(()=>{listRef.current?.focus();position();});
    const outside=(event)=>{if(!rootRef.current?.contains(event.target))close();};
    document.addEventListener('pointerdown',outside);
    window.addEventListener('resize',position);
    return()=>{window.cancelAnimationFrame(frame);document.removeEventListener('pointerdown',outside);window.removeEventListener('resize',position);};
  },[open,selectedIndex]);
  const openWithKeyboard=(event)=>{
    if(!['ArrowDown','ArrowUp','Enter',' '].includes(event.key))return;
    event.preventDefault();
    if(open)return;
    setOpenId(id);
    setActiveIndex(event.key==='ArrowUp'?Math.max(0,options.length-1):selectedIndex);
  };
  const onListKeyDown=(event)=>{
    if(event.key==='Escape'){event.preventDefault();close(true);return;}
    if(event.key==='ArrowDown'){event.preventDefault();setActiveIndex(index=>(index+1)%options.length);return;}
    if(event.key==='ArrowUp'){event.preventDefault();setActiveIndex(index=>(index-1+options.length)%options.length);return;}
    if(event.key==='Home'){event.preventDefault();setActiveIndex(0);return;}
    if(event.key==='End'){event.preventDefault();setActiveIndex(options.length-1);return;}
    if(['Enter',' '].includes(event.key)){event.preventDefault();choose(options[activeIndex]);}
  };
  return <div ref={rootRef} className={`case-library-dropdown ${className}`} data-align={resolvedAlign} data-placement={placement}>
    <button ref={triggerRef} type="button" className="case-library-dropdown__trigger" aria-label={label} aria-haspopup="listbox" aria-expanded={open} aria-controls={`${id}-listbox`} onClick={()=>setOpenId(open?null:id)} onKeyDown={openWithKeyboard}><span>{selected?.label || value}</span><ChevronDown size={15} aria-hidden="true"/></button>
    {open&&<div ref={menuRef} id={`${id}-listbox`} className="case-library-dropdown__menu" role="listbox" aria-label={label} tabIndex={-1} aria-activedescendant={`${id}-option-${activeIndex}`} onKeyDown={onListKeyDown}>{options.map((option,index)=><button key={option.value} id={`${id}-option-${index}`} type="button" role="option" aria-selected={option.value===value} className={`${option.value===value?'is-selected':''}${index===activeIndex?' is-active':''}`} onMouseMove={()=>setActiveIndex(index)} onClick={()=>choose(option)}><span>{option.label}</span>{option.value===value&&<Check size={15} aria-hidden="true"/>}</button>)}</div>}
  </div>;
}

function CaseStudyLoadingShell({profileName}) {
  return <main className="case-library case-library--loading" aria-busy="true" aria-label="Loading Case Study Library">
    <header className="case-library__header">
      <div><p className="case-eyebrow">{profileName} · learning library</p><h1>Case Studies</h1><p>Your research workspace is opening.</p></div>
      <div className="case-header-actions"><span className="case-save-state">Loading saved research…</span></div>
    </header>
    <div className="case-library-layout case-library-loading-layout" aria-hidden="true">
      <aside className="case-library-sidebar"><i/><i/><i/><i/></aside>
      <div className="case-library-content"><section className="case-metrics">{Array.from({length:4},(_,index)=><div className="case-metric case-loading-block" key={index}/>)}</section><section className="case-loading-library"><i/><i/><i/></section></div>
    </div>
  </main>;
}

function CaseStudyLoadState({ libraryState, profileName, onRetryLoad }) {
  const workspace=normalise(libraryState.workspace);
  const integrity=libraryState.workspace ? auditRecoveredCaseStudyWorkspace(libraryState.workspace) : null;
  const backup=libraryState.workspace ? auditRecoveredCaseStudyBackup(libraryState.workspace) : null;
  const isRecovery=libraryState.status === 'recovery';
  const sourceIds=libraryState.sourceIds || [];
  return <main className="case-library case-library--recovery">
    <section className="case-empty" role="alert">
      <BookOpen size={30}/>
      <p className="case-eyebrow">{profileName} · learning library</p>
      <h1>{isRecovery ? 'Recovered legacy data preview' : 'Case Study Library unavailable'}</h1>
      <p>{libraryState.message || 'The Case Study Library could not be loaded.'}</p>
      <button className="case-button case-button--primary" onClick={onRetryLoad}>Retry Load</button>
    </section>
    {(isRecovery || libraryState.workspace) && <section className="case-recovery-preview" aria-label="Read-only Case Study recovery preview">
      <p><strong>Read-only:</strong> saving, creating, editing, evidence changes, and template changes are disabled until the authoritative profile library loads.</p>
      {sourceIds.length > 0 && <p>Recovered from {sourceIds.length} legacy workspace source{sourceIds.length === 1 ? '' : 's'}.</p>}
      <div><strong>{workspace.studies.length}</strong><span> studies</span><strong>{workspace.notebooks.length}</strong><span> notebooks</span><strong>{workspace.evidence.length}</strong><span> evidence items</span></div>
      {integrity && <details className="case-recovery-integrity"><summary>Integrity report: {integrity.valid ? 'all checks passed' : `${integrity.problems.length} issue${integrity.problems.length === 1 ? '' : 's'} found`}</summary><dl><div><dt>Templates</dt><dd>{integrity.counts.templates}</dd></div><div><dt>Evidence placements</dt><dd>{integrity.counts.placements}</dd></div><div><dt>Annotations</dt><dd>{integrity.counts.annotations}</dd></div><div><dt>Board drawings / text</dt><dd>{integrity.counts.boardDrawings} / {integrity.counts.textObjects}</dd></div><div><dt>Section notes / rich documents</dt><dd>{integrity.counts.sectionNotes} / {integrity.counts.richDocuments}</dd></div><div><dt>Captions / observations</dt><dd>{integrity.counts.captions} / {integrity.counts.observations}</dd></div><div><dt>Backup readiness</dt><dd>{backup?.valid ? `ready (${backup.descriptorCount} legacy source descriptor${backup.descriptorCount === 1 ? '' : 's'})` : 'needs review'}</dd></div></dl>{!integrity.valid && <ul>{integrity.problems.map((problem,index) => <li key={`${problem.kind}-${problem.studyId || ''}-${problem.id || ''}-${index}`}>{problem.kind.replaceAll('-', ' ')}</li>)}</ul>}<p>This report is read-only and does not include note content.</p></details>}
      {workspace.studies.length > 0 && <ul>{workspace.studies.map(study => <li key={study.id}><strong>{studyTitle(study)}</strong><span>Read-only recovered study</span></li>)}</ul>}
      {!workspace.studies.length && <p>No legacy studies were found in the available sources.</p>}
    </section>}
  </main>;
}

function CaseStudyRecoveryLibrary({ workspace: rawWorkspace, profileName, libraryState, onRetryLoad }) {
  const workspace=normalise(rawWorkspace);
  const studies=workspace.studies.filter(study => !study.archived);
  const integrity=auditRecoveredCaseStudyWorkspace(rawWorkspace);
  return <main className="case-library case-library--recovery-library">
    <header className="case-library__header">
      <div><p className="case-eyebrow">{profileName} · learning library</p><h1>Case Study Library</h1><p>Recovered legacy studies are shown in the normal library layout. Editing is disabled until profile storage is available.</p></div>
      <div className="case-header-actions"><span className="case-save-state">Read-only recovery preview</span><button className="case-button case-button--quiet" onClick={onRetryLoad}>Retry Load</button></div>
    </header>
    <div className="case-recovery-notice"><strong>Recovery protection is active.</strong><span>{libraryState.message}</span><span>{integrity.valid ? 'Integrity checks passed.' : `${integrity.problems.length} reference issue${integrity.problems.length === 1 ? '' : 's'} retained without changes.`}</span></div>
    <div className="case-library-layout">
      <aside className="case-library-sidebar case-library-sidebar--readonly" aria-label="Recovered library outline">
        <div className="is-active"><LibraryBig size={17}/>All studies <span>{studies.length}</span></div>
        <div><Star size={17}/>Favorites <span>{studies.filter(study=>study.favorite).length}</span></div>
        <div><Pin size={17}/>Pinned playbooks <span>{studies.filter(study=>study.pinned).length}</span></div>
        <p className="case-sidebar-label">Notebooks</p>
        {workspace.notebooks.map(notebook => <div key={notebook.id}><BookOpen size={16}/>{notebook.name}<span>{studies.filter(study=>study.notebookId===notebook.id).length}</span></div>)}
      </aside>
      <div className="case-library-content">
        <section className="case-metrics" aria-label="Recovered library overview"><div className="case-metric"><strong>{studies.length}</strong><span>Total studies</span></div><div className="case-metric"><strong>{workspace.evidence.length}</strong><span>Evidence items</span></div><div className="case-metric"><strong>{integrity.counts.placements}</strong><span>Evidence placements</span></div><div className="case-metric"><strong>{integrity.counts.annotations}</strong><span>Annotations</span></div></section>
        <section className="case-library-all"><div className="case-library-all__heading"><div><h2>Your recovered library</h2><p>{studies.length} recovered study{studies.length === 1 ? '' : 'ies'} · read-only</p></div><span className="case-save-state">Saving disabled</span></div>
          <section className="case-study-grid case-study-grid--grid">{studies.map(study => <article key={study.id} className="case-study-card case-study-card--readonly"><div className="case-study-card__preview"><BookOpen size={28}/><span>{workspace.notebooks.find(notebook=>notebook.id===study.notebookId)?.name || 'Study'}</span><i className={`case-status case-status--${(study.status || 'Draft').toLowerCase().replaceAll(' ','-')}`}>{study.status || 'Draft'}</i></div><div className="case-study-card__top"><span>{workspace.notebooks.find(notebook=>notebook.id===study.notebookId)?.name || 'Notebook'}</span><span>Read-only</span></div><h2>{studyTitle(study)}</h2><p>Recovered study content is protected until the authoritative profile library is available.</p><div className="case-card-tags"><span>{(study.evidenceIds || []).length} evidence</span><span>{Object.keys(study.evidencePlacements || {}).length} placements</span></div></article>)}</section>
        </section>
      </div>
    </div>
  </main>;
}

/* Desktop Case Studies v2 (aaicorefx-desktop-case-studies.html). Phones keep the layout below. */
const CASE_STUDIES_V2 = true;
const CS2_DESKTOP = '(min-width: 768px)';
const richText = (node) => !node || typeof node !== 'object' ? '' : (node.type === 'text' ? String(node.text || '') : Array.isArray(node.content) ? node.content.map(richText).join(' ') : '');
// Plain text of one section, from its saved rich document or its legacy note.
export const caseSectionText = (study, name, index = 0) => {
  const documentText = richText(study?.sectionDocuments?.[name]?.content);
  if (documentText.trim()) return documentText.replace(/\s+/g, ' ').trim();
  const note = typeof study?.sectionNotes?.[name] === 'string' ? study.sectionNotes[name] : '';
  if (note.trim()) return note.replace(/\s+/g, ' ').trim();
  return index === 0 ? String(study?.body || '').replace(/\s+/g, ' ').trim() : '';
};
// A section counts as written once it holds more than a short phrase.
export const caseStudyProgress = (study) => {
  const sections = Array.isArray(study?.sections) ? study.sections : [];
  const written = sections.filter((name, index) => caseSectionText(study, name, index).length > 20).length;
  return { written, total: sections.length };
};
const caseSummary = (study) => (study?.sections || []).map((name, index) => caseSectionText(study, name, index)).find(Boolean) || '';
const statusKey = (status) => String(status || 'Draft').toLowerCase().replaceAll(' ', '-');
function Cs2Status({ status }) { return <span className={`cs2-st is-${statusKey(status)}`}>{status === 'Validated' && <Check size={11} strokeWidth={3} aria-hidden="true"/>}{status || 'Draft'}</span>; }
function Cs2Ring({ value, total, size = 44 }) { const r = 18, c = 2 * Math.PI * r; return <svg className="cs2-ring" width={size} height={size} viewBox="0 0 44 44" aria-hidden="true"><circle cx="22" cy="22" r={r} className="cs2-ring-track"/><circle cx="22" cy="22" r={r} className="cs2-ring-value" strokeDasharray={`${total ? c * value / total : 0} ${c}`} transform="rotate(-90 22 22)"/></svg>; }
function Cs2Progress({ study }) { const { written, total } = caseStudyProgress(study); return <div className="cs2-prg"><i><s data-chart-fill="horizontal" style={{ width: `${total ? written / total * 100 : 0}%` }}/></i><span>{written}/{total} sections</span></div>; }
function Cs2StudyMenu({ study, onClose, onOpen, onPatch, onDuplicate, onExport, onDelete }) {
  const run = (action) => (event) => { event.stopPropagation(); onClose(); action(); };
  return <div className="cs2-menu" role="menu" onClick={(event) => event.stopPropagation()}>
    <button type="button" role="menuitem" onClick={run(onOpen)}><FileText size={15}/>Open study</button>
    <button type="button" role="menuitem" onClick={run(() => onPatch({ favorite: !study.favorite }))}><Star size={15}/>{study.favorite ? 'Remove favorite' : 'Mark as favorite'}</button>
    <button type="button" role="menuitem" onClick={run(() => onPatch({ pinned: !study.pinned }))}><Pin size={15}/>{study.pinned ? 'Unpin' : 'Pin to top'}</button>
    <button type="button" role="menuitem" onClick={run(onDuplicate)}><Copy size={15}/>Duplicate</button>
    <button type="button" role="menuitem" onClick={run(onExport)}><Download size={15}/>Export study</button>
    <button type="button" role="menuitem" onClick={run(() => onPatch({ archived: !study.archived }))}><Archive size={15}/>{study.archived ? 'Restore from archive' : 'Archive'}</button>
    <hr/>
    <button type="button" role="menuitem" className="is-danger" onClick={run(onDelete)}><Trash2 size={15}/>Delete study</button>
  </div>;
}
function Cs2StudyCard({ view, study, notebook, evidence, menuOpen, menuRootRef, onMenu, onOpen, menuActions }) {
  const { written, total } = caseStudyProgress(study);
  const summary = caseSummary(study);
  const meta = `${notebook?.name || 'Notebook'}${study.instrument ? ` · ${study.instrument}` : ''}`;
  const chips = <div className="cs2-chips"><span>{(study.tradeIds || []).length} trades</span><span>{(study.markupIds || []).length} markups</span><span>{(study.evidenceIds || []).length} evidence</span>{study.pinned && <span className="is-pin"><Pin size={11}/>Pinned</span>}</div>;
  const fav = <button type="button" className={`cs2-ic ${study.favorite ? 'is-on' : ''}`} aria-label={study.favorite ? 'Remove from favorites' : 'Add to favorites'} aria-pressed={!!study.favorite} onClick={(event) => { event.stopPropagation(); menuActions.onPatch({ favorite: !study.favorite }); }}><Star size={15} fill={study.favorite ? 'currentColor' : 'none'}/></button>;
  const more = <div className="cs2-more" ref={menuRootRef}><button type="button" className="cs2-ic is-sm" aria-label="Study menu" aria-haspopup="menu" aria-expanded={menuOpen} onClick={(event) => { event.stopPropagation(); onMenu(); }}><MoreHorizontal size={16}/></button>{menuOpen && <Cs2StudyMenu study={study} onClose={onMenu} onOpen={onOpen} {...menuActions}/>}</div>;
  const open = (event) => { if (event.target.closest('button,a,[role=menu]')) return; onOpen(); };
  const key = (event) => { if ((event.key === 'Enter' || event.key === ' ') && event.target === event.currentTarget) { event.preventDefault(); onOpen(); } };
  if (view === 'list') return <article className="cs2-row" tabIndex={0} role="button" aria-label={`Open ${studyTitle(study)}`} onClick={open} onKeyDown={key}>
    <div className="cs2-rth"><StudyCover study={study} evidence={evidence} notebook={notebook} compact/></div>
    <div className="cs2-rb"><small className="cs2-meta">{meta}</small><h3>{studyTitle(study)}</h3><p>{summary || 'No notes yet. Open the study to start writing.'}</p>{chips}</div>
    <div className="cs2-rr"><Cs2Status status={study.status}/><div className="cs2-rr-actions">{fav}{more}</div>{study.status !== 'Validated' && <div className="cs2-prg"><i><s data-chart-fill="horizontal" style={{ width: `${total ? written / total * 100 : 0}%` }}/></i><span>{written}/{total}</span></div>}<span className="cs2-dt">{dateLabel(study.updatedAt)}</span></div>
  </article>;
  return <article className="cs2-card" tabIndex={0} role="button" aria-label={`Open ${studyTitle(study)}`} onClick={open} onKeyDown={key}>
    <div className="cs2-th"><StudyCover study={study} evidence={evidence} notebook={notebook}/><div className="cs2-ov" aria-hidden="true"/><Cs2Status status={study.status}/>{fav}<span className="cs2-go">Open study <ArrowRight size={14}/></span></div>
    <div className="cs2-bd"><div className="cs2-mt"><small>{meta}</small>{more}</div><h3>{studyTitle(study)}</h3><p>{summary || 'No notes yet. Open the study to start writing.'}</p>{chips}
      <div className="cs2-ft">{study.status === 'Validated' ? <div className="cs2-vl"><ShieldCheck size={14}/>Validated</div> : <Cs2Progress study={study}/>}<span className="cs2-dt">{dateLabel(study.updatedAt)}</span></div></div>
  </article>;
}

// Evidence tab (stage 2): searchable card grid with a details aside for the selected item.
function Cs2EvidenceThumb({ item }) {
  const source = evidenceImageReference(item);
  const image = useEvidenceImageUrl(source);
  return image.url ? <img src={image.url} alt=""/> : <ImageIcon size={26} aria-hidden="true"/>;
}
function Cs2Field({ label, value, multiline = false, onCommit }) {
  const [draft, setDraft] = useState(value || '');
  useEffect(() => setDraft(value || ''), [value]);
  const commit = () => { if (draft.trim() !== (value || '').trim()) onCommit(draft.trim()); };
  return <label className="cs2-f"><small>{label}</small>{multiline
    ? <textarea rows={4} value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={commit}/>
    : <input value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={commit} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }}/>}</label>;
}
function Cs2Evidence({ evidence, studies, selectedId, onSelect, onUpload, onPatch, onRemove, onOpenStudy, onOpenViewer }) {
  const [query, setQuery] = useState('');
  const [tagDraft, setTagDraft] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const usedIn = (id) => studies.filter((study) => (study.evidenceIds || []).includes(id));
  const needle = query.trim().toLowerCase();
  const list = [...evidence]
    .filter((item) => !needle || [item.title, item.source, ...(item.tags || [])].join(' ').toLowerCase().includes(needle))
    .sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)));
  const selected = list.find((item) => item.id === selectedId) || list[0] || null;
  const related = selected ? usedIn(selected.id) : [];
  const upload = async (event) => {
    const files = [...(event.target.files || [])];
    event.target.value = '';
    if (!files.length) return;
    const invalid = files.map((file) => validateEvidenceImage(file)).find(Boolean);
    if (invalid) { setError(invalid); return; }
    setError(''); setBusy(true);
    try { await onUpload({ title: files[0].name.replace(/\.[^.]+$/, ''), files, tags: ['uploaded'], source: 'Uploaded image', kind: 'Chart' }); }
    catch (failure) { setError(failure?.message || 'The image could not be saved.'); }
    finally { setBusy(false); }
  };
  const addTag = () => {
    const tag = tagDraft.trim();
    if (!tag || !selected) return;
    if (!(selected.tags || []).some((item) => item.toLowerCase() === tag.toLowerCase())) onPatch(selected.id, { tags: [...(selected.tags || []), tag] });
    setTagDraft('');
  };
  return <div className="cs2-ev">
    <div className="cs2-evh">
      <label className="cs2-sr"><Search size={16} aria-hidden="true"/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title, tag or source" aria-label="Search evidence"/></label>
      <label className={`cs2-btn is-pri${busy ? ' is-busy' : ''}`}><Upload size={15}/>{busy ? 'Saving…' : 'Upload evidence'}<input type="file" accept="image/*" multiple hidden onChange={upload} disabled={busy}/></label>
    </div>
    {error && <p className="cs2-err" role="alert">{error}</p>}
    {!evidence.length ? <div className="cs2-empty"><ImageIcon size={28}/><h3>No evidence saved</h3><p>Upload charts or screenshots once, then reuse them in any study.</p></div>
      : <div className="cs2-evg">
        <div className="cs2-evl">{list.length ? list.map((item) => {
          const count = usedIn(item.id).length;
          return <button type="button" key={item.id} className={`cs2-evc${selected?.id === item.id ? ' is-on' : ''}`} aria-pressed={selected?.id === item.id} onClick={() => onSelect(item.id)}>
            <span className="cs2-evt"><Cs2EvidenceThumb item={item}/></span>
            <span className="cs2-evb"><b>{item.title || 'Untitled evidence'}</b><span>{(item.tags || []).slice(0, 3).join(' · ') || 'No tags'}</span><small>{count} {count === 1 ? 'study' : 'studies'}</small></span>
          </button>;
        }) : <div className="cs2-empty is-sm">No evidence found.</div>}</div>
        {selected && <aside className="cs2-evd" aria-label="Evidence details">
          <button type="button" className="cs2-evt is-big" onClick={() => onOpenViewer(selected.id, related[0]?.id || null)} disabled={!related.length} title={related.length ? 'Open the chart viewer' : 'Attach this evidence to a study to annotate it'}>
            <Cs2EvidenceThumb item={selected}/><span className="cs2-go"><Eye size={14}/>{related.length ? 'Open viewer' : 'Attach to a study to annotate'}</span>
          </button>
          <Cs2Field key={`t-${selected.id}`} label="Title" value={selected.title} onCommit={(title) => onPatch(selected.id, { title: title || 'Untitled evidence' })}/>
          <Cs2Field key={`s-${selected.id}`} label="Source" value={selected.source} onCommit={(source) => onPatch(selected.id, { source })}/>
          <div className="cs2-f"><small>Tags</small>
            <div className="cs2-tags">{(selected.tags || []).map((tag) => <span key={tag}>{tag}<button type="button" aria-label={`Remove tag ${tag}`} onClick={() => onPatch(selected.id, { tags: (selected.tags || []).filter((item) => item !== tag) })}><X size={11}/></button></span>)}
              <input value={tagDraft} onChange={(event) => setTagDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addTag(); } }} onBlur={addTag} placeholder="Add tag" aria-label="Add tag"/></div>
          </div>
          <Cs2Field key={`n-${selected.id}`} label="Research notes" value={selected.notes} multiline onCommit={(notes) => onPatch(selected.id, { notes })}/>
          <div className="cs2-f"><small>Used in {related.length} {related.length === 1 ? 'study' : 'studies'}</small>
            {related.length ? related.map((study) => <button type="button" key={study.id} className="cs2-lk" onClick={() => onOpenStudy(study.id)}><FileText size={14}/><span>{studyTitle(study)}</span><Cs2Status status={study.status}/></button>) : <span className="cs2-mut">Not linked yet</span>}
          </div>
          <button type="button" className="cs2-btn is-danger" onClick={() => onRemove(selected.id)}><Trash2 size={14}/>Delete evidence</button>
        </aside>}
      </div>}
  </div>;
}

// Connections tab (stage 3): draggable study map with relationship filters, a details aside and a connect dialog.
const CS2_REL_TONE = { supports: 'gain', contradicts: 'loss', 'builds-on': 'acc', 'related-to': 'blu', 'alternative-approach': 'warn' };
const CS2_NODE_W = 240, CS2_NODE_H = 68, CS2_MAP_H = 560;
const CS2_POS_KEY = 'aai-case-study-map-positions';
const readMapPositions = () => { try { return JSON.parse(window.localStorage.getItem(CS2_POS_KEY) || '{}') || {}; } catch { return {}; } };
const writeMapPositions = (value) => { try { window.localStorage.setItem(CS2_POS_KEY, JSON.stringify(value)); } catch {} };
const relLabel = (id) => CASE_STUDY_CONNECTION_RELATIONSHIPS.find((item) => item.id === id)?.label || 'Related to';
function Cs2ConnectDialog({ studies, fromId, connection = null, onClose, onSave }) {
  const editing = !!connection;
  const [source, setSource] = useState(connection?.source.id || fromId || studies[0]?.id || '');
  const [target, setTarget] = useState(connection?.target.id || studies.find((item) => item.id !== (fromId || studies[0]?.id))?.id || '');
  const [relationship, setRelationship] = useState(connection?.relationship || 'supports');
  const [explanation, setExplanation] = useState(connection?.explanation || '');
  const [openId, setOpenId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { const escape = (event) => { if (event.key === 'Escape' && !saving) onClose(); }; document.addEventListener('keydown', escape); return () => document.removeEventListener('keydown', escape); }, [saving, onClose]);
  const options = studies.map((item) => ({ value: item.id, label: studyTitle(item) }));
  const submit = async (event) => {
    event.preventDefault();
    if (saving) return;
    if (!editing && source === target) { setError('Choose two different studies.'); return; }
    if (!explanation.trim()) { setError('Explain why these studies are connected.'); return; }
    setSaving(true); setError('');
    try { await onSave(editing ? { relationship, explanation } : { source: { type: 'case-study', id: source }, target: { type: 'case-study', id: target }, relationship, explanation }); onClose(); }
    catch (reason) { setError(reason?.message || 'Connection could not be saved.'); }
    finally { setSaving(false); }
  };
  return <div className="cs2 cs2-bk" role="presentation" onPointerDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}>
    <form className="cs2-modal" role="dialog" aria-modal="true" aria-labelledby="cs2-connect-title" onSubmit={submit}>
      <header><div><span className="cs2-eb">Case study connection</span><h2 id="cs2-connect-title">{editing ? 'Edit connection' : 'Connect studies'}</h2><p>Link related research without changing either study's content.</p></div><button type="button" className="cs2-ic" aria-label="Close" onClick={onClose} disabled={saving}><X size={18}/></button></header>
      <div className="cs2-mbody">
        <div className="cs2-f2">
          <div className="cs2-f cse-connection-field"><small>From</small>{editing ? <strong className="cs2-fixed">{studyTitle(studies.find((item) => item.id === source) || {})}</strong> : <CaseStudyDropdown id="cs2-connect-from" label="From study" value={source} options={options} openId={openId} setOpenId={setOpenId} onChange={setSource}/>}</div>
          <div className="cs2-f cse-connection-field"><small>To</small>{editing ? <strong className="cs2-fixed">{studyTitle(studies.find((item) => item.id === target) || {})}</strong> : <CaseStudyDropdown id="cs2-connect-to" label="To study" value={target} options={options} openId={openId} setOpenId={setOpenId} onChange={setTarget}/>}</div>
        </div>
        <div className="cs2-f"><small>Relationship</small><div className="cs2-chp" role="group" aria-label="Relationship">{CASE_STUDY_CONNECTION_RELATIONSHIPS.map((item) => <button type="button" key={item.id} aria-pressed={relationship === item.id} className={relationship === item.id ? 'is-on' : ''} onClick={() => setRelationship(item.id)}>{item.label}</button>)}</div></div>
        <label className="cs2-f"><small>Why are these studies connected? <u>*</u></small><textarea rows={3} value={explanation} onChange={(event) => { setExplanation(event.target.value); setError(''); }} placeholder="Describe how they relate…"/></label>
        {error && <p className="cs2-err" role="alert">{error}</p>}
      </div>
      <footer><button type="button" className="cs2-btn" onClick={onClose} disabled={saving}>Cancel</button><button type="submit" className="cs2-btn is-pri" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save connection' : 'Create connection'}</button></footer>
    </form>
  </div>;
}
function Cs2Connections({ studies, connections, evidence, onOpenStudy, onCreate, onEdit, onRemove }) {
  const [filter, setFilter] = useState('all');
  const [selectedId, setSelectedId] = useState(() => connections[0]?.source.id || studies[0]?.id || null);
  const [dialog, setDialog] = useState(null);
  const [positions, setPositions] = useState(readMapPositions);
  const [width, setWidth] = useState(900);
  const mapRef = useRef(null);
  const drag = useRef(null);
  useEffect(() => {
    const node = mapRef.current; if (!node) return undefined;
    const measure = () => setWidth(node.clientWidth || 900);
    measure();
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
    observer?.observe(node);
    return () => observer?.disconnect();
  }, []);
  const ids = new Set(studies.map((study) => study.id));
  const usable = connections.filter((item) => ids.has(item.source.id) && ids.has(item.target.id));
  const visible = usable.filter((item) => filter === 'all' || item.relationship === filter);
  const linksOf = (id) => usable.filter((item) => item.source.id === id || item.target.id === id);
  const maxX = Math.max(0, width - CS2_NODE_W - 16), maxY = CS2_MAP_H - CS2_NODE_H - 16;
  const fallback = (index) => { const col = index % 3, row = Math.floor(index / 3); return { x: 24 + col * Math.max(0, (width - CS2_NODE_W - 48) / 2), y: 70 + row * 140 + (col === 1 ? 70 : 0) }; };
  const posOf = (id, index) => { const saved = positions[id] || fallback(index); return { x: Math.min(maxX, Math.max(16, saved.x)), y: Math.min(maxY, Math.max(56, saved.y)) }; };
  const placed = Object.fromEntries(studies.map((study, index) => [study.id, posOf(study.id, index)]));
  const selected = studies.find((study) => study.id === selectedId) || studies[0] || null;
  const move = (id, x, y) => setPositions((current) => ({ ...current, [id]: { x: Math.round(x), y: Math.round(y) } }));
  const onPointerDown = (event, id) => {
    if (event.button !== 0) return;
    const at = placed[id];
    drag.current = { id, startX: event.clientX, startY: event.clientY, x: at.x, y: at.y, moved: false };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const onPointerMove = (event) => {
    const state = drag.current; if (!state) return;
    const dx = event.clientX - state.startX, dy = event.clientY - state.startY;
    if (!state.moved && Math.hypot(dx, dy) < 4) return;
    state.moved = true;
    move(state.id, Math.min(maxX, Math.max(16, state.x + dx)), Math.min(maxY, Math.max(56, state.y + dy)));
  };
  const onPointerUp = () => {
    const state = drag.current; drag.current = null;
    if (!state) return;
    if (state.moved) setPositions((current) => { writeMapPositions(current); return current; });
    else setSelectedId(state.id);
  };
  const onKeyDown = (event, id) => {
    const step = event.shiftKey ? 40 : 12, at = placed[id];
    const delta = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[event.key];
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedId(id); return; }
    if (!delta) return;
    event.preventDefault();
    const next = { ...positions, [id]: { x: Math.min(maxX, Math.max(16, at.x + delta[0])), y: Math.min(maxY, Math.max(56, at.y + delta[1])) } };
    setPositions(next); writeMapPositions(next);
  };
  const edge = (item) => {
    const a = placed[item.source.id], b = placed[item.target.id];
    const leftToRight = a.x <= b.x;
    const ax = leftToRight ? a.x + CS2_NODE_W : a.x, bx = leftToRight ? b.x : b.x + CS2_NODE_W;
    const ay = a.y + CS2_NODE_H / 2, by = b.y + CS2_NODE_H / 2, mx = (ax + bx) / 2;
    return { d: `M${ax} ${ay} C${mx} ${ay} ${mx} ${by} ${bx} ${by}`, lx: mx, ly: (ay + by) / 2 };
  };
  const selectedLinks = selected ? linksOf(selected.id) : [];
  const counts = Object.fromEntries(CASE_STUDY_CONNECTION_RELATIONSHIPS.map((item) => [item.id, usable.filter((link) => link.relationship === item.id).length]));
  return <div className="cs2-cn">
    <div className="cs2-cnh">
      <div className="cs2-chp" role="group" aria-label="Relationship filter">
        <button type="button" aria-pressed={filter === 'all'} className={filter === 'all' ? 'is-on' : ''} onClick={() => setFilter('all')}>All<b>{usable.length}</b></button>
        {CASE_STUDY_CONNECTION_RELATIONSHIPS.map((item) => <button type="button" key={item.id} aria-pressed={filter === item.id} className={filter === item.id ? 'is-on' : ''} onClick={() => setFilter(item.id)}><i className={`cs2-dot is-${CS2_REL_TONE[item.id]}`} aria-hidden="true"/>{item.label}<b>{counts[item.id]}</b></button>)}
      </div>
      <span className="cs2-mut">{studies.length} {studies.length === 1 ? 'study' : 'studies'} · {usable.length} {usable.length === 1 ? 'connection' : 'connections'}</span>
      <button type="button" className="cs2-btn is-pri" onClick={() => setDialog({ fromId: selected?.id })} disabled={studies.length < 2}><Link2 size={15}/>Connect studies</button>
    </div>
    {!studies.length ? <div className="cs2-empty"><Link2 size={28}/><h3>No studies to connect</h3><p>Create two studies, then link the research that supports or challenges each other.</p></div>
      : <div className="cs2-cng">
        <div className="cs2-map" ref={mapRef} style={{ height: CS2_MAP_H }} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
          <span className="cs2-mhint">Drag studies to arrange · click one to inspect</span>
          <svg className="cs2-edges" aria-hidden="true">{visible.map((item) => { const { d, lx, ly } = edge(item); const tone = CS2_REL_TONE[item.relationship]; const label = relLabel(item.relationship); const w = Math.max(76, label.length * 7 + 22); return <g key={item.id} className={`cs2-eg is-${tone}`}><path d={d} className="cs2-edge"/><g transform={`translate(${lx} ${ly})`}><rect x={-w / 2} y="-12" width={w} height="24" rx="12" className="cs2-el"/><text textAnchor="middle" y="4" className="cs2-elt">{label}</text></g></g>; })}</svg>
          {studies.map((study) => { const at = placed[study.id]; const links = linksOf(study.id).length; return <div key={study.id} role="button" tabIndex={0} aria-pressed={selected?.id === study.id} aria-label={`${studyTitle(study)}, ${links} ${links === 1 ? 'link' : 'links'}. Arrow keys move it.`} className={`cs2-node${selected?.id === study.id ? ' is-on' : ''}${links ? '' : ' is-dim'}`} style={{ left: at.x, top: at.y, width: CS2_NODE_W, height: CS2_NODE_H }} onPointerDown={(event) => onPointerDown(event, study.id)} onKeyDown={(event) => onKeyDown(event, study.id)}>
            <span className="cs2-nth"><StudyCover study={study} evidence={evidence} compact/></span>
            <span className="cs2-ntx"><b>{studyTitle(study)}</b><small>{study.status || 'Draft'} · {links} {links === 1 ? 'link' : 'links'}</small></span>
          </div>; })}
        </div>
        {selected && <aside className="cs2-mside" aria-label="Selected study">
          <span className="cs2-eb">Case study</span>
          <h3>{studyTitle(selected)}</h3>
          <Cs2Status status={selected.status}/>
          <button type="button" className="cs2-btn is-pri is-full" onClick={() => onOpenStudy(selected.id)}>Open study</button>
          <div className="cs2-msh"><b>{selectedLinks.length} {selectedLinks.length === 1 ? 'connection' : 'connections'}</b></div>
          {selectedLinks.length ? selectedLinks.map((item) => {
            const outgoing = item.source.id === selected.id;
            const other = studies.find((study) => study.id === (outgoing ? item.target.id : item.source.id));
            const directional = isDirectionalCaseStudyRelationship(item.relationship);
            return <div className="cs2-con" key={item.id}>
              <div className="cs2-conh"><button type="button" className="cs2-conl" onClick={() => setSelectedId(other.id)}>{studyTitle(other)}</button>
                <span className="cs2-cona"><button type="button" className="cs2-ic is-sm" aria-label="Edit connection" onClick={() => setDialog({ connection: item })}><SlidersHorizontal size={14}/></button><button type="button" className="cs2-ic is-sm" aria-label="Remove connection" onClick={() => onRemove(item.id)}><Trash2 size={14}/></button></span></div>
              <span className={`cs2-rel is-${CS2_REL_TONE[item.relationship]}`}>{directional ? `${outgoing ? 'Outgoing' : 'Incoming'} · ` : ''}{relLabel(item.relationship)}</span>
              {item.explanation && <p>{item.explanation}</p>}
            </div>;
          }) : <div className="cs2-empty is-sm">No connections yet.</div>}
          <button type="button" className="cs2-btn is-full" onClick={() => setDialog({ fromId: selected.id })} disabled={studies.length < 2}><Link2 size={15}/>Connect to another study</button>
        </aside>}
      </div>}
    {dialog && <Cs2ConnectDialog studies={studies} fromId={dialog.fromId} connection={dialog.connection || null} onClose={() => setDialog(null)} onSave={(fields) => dialog.connection ? onEdit(dialog.connection.id, fields) : onCreate(fields)}/>}
  </div>;
}

// Templates tab (stage 4) plus the New Case Study and Add-from-template dialogs.
const templateGuidance = (template, title) => template?.guidance?.[title] || templateSections(template).find((item) => item.title === title)?.guidance || '';
function Cs2Dialog({ labelledBy, wide = false, small = false, role = 'dialog', onClose, busy = false, children }) {
  const backdrop = useRef(null);
  useEffect(() => {
    const escape = (event) => {
      if (event.key !== 'Escape' || busy) return;
      // Only the top-most Case Studies dialog closes, so a confirmation never takes its parent with it.
      const open = document.querySelectorAll('.cs2-bk');
      if (open[open.length - 1] !== backdrop.current) return;
      event.preventDefault(); onClose();
    };
    document.addEventListener('keydown', escape); return () => document.removeEventListener('keydown', escape);
  }, [busy, onClose]);
  return <div ref={backdrop} className="cs2 cs2-bk" role="presentation" onPointerDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <div className={`cs2-modal${wide ? ' is-wide' : ''}${small ? ' is-sm' : ''}`} role={role} aria-modal="true" aria-labelledby={labelledBy}>{children}</div>
  </div>;
}
function Cs2DialogHead({ id, eyebrow, title, intro, onClose, busy = false }) {
  return <header><div><span className="cs2-eb">{eyebrow}</span><h2 id={id}>{title}</h2><p>{intro}</p></div><button type="button" className="cs2-ic" aria-label="Close" onClick={onClose} disabled={busy}><X size={18}/></button></header>;
}
function Cs2NewStudyDialog({ templates, notebooks, initialTemplateId, onCreate, onClose }) {
  const initial = useMemo(() => ({ ...initialCaseStudyDraft({ notebooks, templates }), ...(initialTemplateId ? { templateId: initialTemplateId } : {}) }), []);
  const [draft, setDraft] = useState(initial);
  const [openId, setOpenId] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const template = templates.find((item) => item.id === draft.templateId) || templates[0];
  const sections = templateSectionNames(template);
  const patch = (key, value) => { setDraft((current) => ({ ...current, [key]: value })); setError(''); };
  const close = () => onClose(hasCaseStudyDraftChanges(draft, initial));
  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    const problem = caseStudyDraftError(draft);
    if (problem) { setError('Give your study a title to continue.'); return; }
    setBusy(true);
    try { if (!await onCreate(draft, template)) setError('The study could not be saved. Try again.'); }
    catch (reason) { setError(reason?.message || 'The study could not be saved. Try again.'); }
    finally { setBusy(false); }
  };
  return <Cs2Dialog labelledBy="cs2-new-title" wide onClose={close} busy={busy}>
    <Cs2DialogHead id="cs2-new-title" eyebrow="Create research" title="New Case Study" intro="Start with a focused question and a structure you can develop into a playbook." onClose={close} busy={busy}/>
    <form className="cs2-newg" onSubmit={submit}>
      <div className="cs2-nl" role="radiogroup" aria-label="Starting point"><small>Starting point</small>
        {templates.map((item) => <button type="button" role="radio" aria-checked={item.id === template?.id} key={item.id} className={item.id === template?.id ? 'is-on' : ''} onClick={() => patch('templateId', item.id)}><span><FileText size={17}/></span><span><b>{item.name}</b><small>{item.description}</small></span>{item.id === template?.id ? <Check size={14} strokeWidth={3}/> : <i/>}</button>)}
      </div>
      <div className="cs2-nr">
        <label className="cs2-f"><small>Case study title <u>*</u></small><input className="is-big" autoFocus value={draft.title} onChange={(event) => patch('title', event.target.value)} placeholder="e.g. NY AM liquidity sweep" aria-invalid={!!error && !draft.title.trim()}/></label>
        <div className="cs2-f2">
          <div className="cs2-f cse-connection-field"><small>Notebook</small><CaseStudyDropdown id="cs2-new-notebook" label="Notebook" value={draft.notebookId} options={notebooks.map((item) => ({ value: item.id, label: item.name }))} openId={openId} setOpenId={setOpenId} onChange={(value) => patch('notebookId', value)}/></div>
          <label className="cs2-f"><small>Instrument or market <i>optional</i></small><input value={draft.instrument} onChange={(event) => patch('instrument', event.target.value)} placeholder="e.g. EUR/USD"/></label>
        </div>
        <label className="cs2-f"><small>Research context <i>optional</i></small><textarea rows={3} value={draft.context} onChange={(event) => patch('context', event.target.value)} placeholder="What are you investigating? Capture the setup, market context, or question you want to test."/></label>
        <div className="cs2-prev"><small>{template?.name} · {sections.length} {sections.length === 1 ? 'section' : 'sections'}</small><div>{sections.map((name, index) => <span key={name}><b>{String(index + 1).padStart(2, '0')}</b>{name}</span>)}</div></div>
        <div className="cs2-mf">{error ? <span className="cs2-err" role="alert">{error}</span> : <span/>}<button type="button" className="cs2-btn" onClick={close} disabled={busy}>Cancel</button><button type="submit" className="cs2-btn is-pri" disabled={busy}><Plus size={15}/>{busy ? 'Creating…' : 'Create draft'}</button></div>
      </div>
    </form>
  </Cs2Dialog>;
}
function Cs2AddTemplateDialog({ study, templates, onClose, onApply }) {
  const [selectedId, setSelectedId] = useState(templates[0]?.id || '');
  const [openId, setOpenId] = useState(null);
  const template = templates.find((item) => item.id === selectedId) || templates[0];
  const have = new Set((study.sections || []).map((name) => String(name).trim().toLocaleLowerCase()));
  const names = templateSectionNames(template);
  const adding = names.filter((name) => !have.has(name.toLocaleLowerCase()));
  return <Cs2Dialog labelledBy="cs2-add-title" onClose={onClose}>
    <Cs2DialogHead id="cs2-add-title" eyebrow="Extend this study" title="Add from template" intro="Only missing sections are added. Your notes and evidence stay untouched." onClose={onClose}/>
    <div className="cs2-mbody">
      <div className="cs2-f cse-connection-field"><small>Template</small><CaseStudyDropdown id="cs2-add-template" label="Template" value={template?.id} options={templates.map((item) => ({ value: item.id, label: item.name }))} openId={openId} setOpenId={setOpenId} onChange={setSelectedId}/></div>
      <div className="cs2-ap">{names.map((name) => { const present = have.has(name.toLocaleLowerCase()); return <div key={name} className={present ? 'is-has' : 'is-add'}><span>{name}</span><em>{present ? 'Already present' : 'Will add'}</em></div>; })}</div>
    </div>
    <footer><button type="button" className="cs2-btn" onClick={onClose}>Cancel</button><button type="button" className="cs2-btn is-pri" disabled={!adding.length} onClick={() => onApply(template)}>Add {adding.length} {adding.length === 1 ? 'section' : 'sections'}</button></footer>
  </Cs2Dialog>;
}
function Cs2Templates({ templates, onUse, onDuplicate, onRemove, onNew, onEdit }) {
  const [scope, setScope] = useState('all');
  const [selectedId, setSelectedId] = useState(templates[0]?.id || '');
  const builtIn = templates.filter((item) => item.scope === 'Built-in'), mine = templates.filter((item) => item.scope !== 'Built-in');
  const list = scope === 'built' ? builtIn : scope === 'mine' ? mine : templates;
  const selected = list.find((item) => item.id === selectedId) || list[0] || null;
  const sections = templateSections(selected);
  const isMine = selected?.scope !== 'Built-in';
  return <div className="cs2-tg">
    <section className="cs2-tl" aria-label="Templates">
      <div className="cs2-tlh"><div className="cs2-chp" role="group" aria-label="Template filter">{[['all', 'All', templates.length], ['built', 'Built-in', builtIn.length], ['mine', 'Mine', mine.length]].map(([id, label, count]) => <button type="button" key={id} aria-pressed={scope === id} className={scope === id ? 'is-on' : ''} onClick={() => setScope(id)}>{label}<b>{count}</b></button>)}</div></div>
      {list.length ? list.map((item) => <button type="button" key={item.id} aria-pressed={selected?.id === item.id} className={`cs2-tc${selected?.id === item.id ? ' is-on' : ''}`} onClick={() => setSelectedId(item.id)}><span><FileText size={18}/></span><span><b>{item.name}</b><small>{item.description}</small></span><em>{item.scope === 'Built-in' ? 'Built-in' : 'Mine'}</em></button>)
        : <div className="cs2-empty is-sm">No personal templates yet. Duplicate a built-in one to start.</div>}
      <button type="button" className="cs2-btn cs2-tnew" onClick={onNew}><Plus size={15}/>New template</button>
    </section>
    {selected && <section className="cs2-tp" aria-label="Template preview">
      <span className="cs2-eb">{isMine ? 'My template' : 'Built-in template · protected'}</span>
      <h2>{selected.name}</h2>
      <p>{selected.description}</p>
      <div className="cs2-secs">{sections.map((item, index) => { const guide = templateGuidance(selected, item.title); return <div key={item.id || item.title}><b>{String(index + 1).padStart(2, '0')}</b><div><strong>{item.title}</strong>{guide && <small>{guide}</small>}</div></div>; })}</div>
      <div className="cs2-tact">
        <button type="button" className="cs2-btn is-pri" onClick={() => onUse(selected.id)}><Plus size={15}/>Use template</button>
        <button type="button" className="cs2-btn" onClick={() => { const copy = onDuplicate(selected); if (copy?.id) { setScope('mine'); setSelectedId(copy.id); } }}><Copy size={15}/>Duplicate template</button>
        {isMine && <><button type="button" className="cs2-btn" onClick={() => onEdit(selected)}><SlidersHorizontal size={15}/>Edit</button><button type="button" className="cs2-btn is-danger" onClick={() => onRemove(selected.id)}><Trash2 size={15}/>Delete</button></>}
      </div>
    </section>}
  </div>;
}

// Study workspace (stage 5): top bar, outline, every section in one document with a shared
// formatting toolbar, and a side panel with Evidence, Links, Connections and Validate.
const cs2SectionText = (study, name, index) => richDocumentText(migrateSectionRichDocument(study, name, index));
const cs2Words = (text) => (String(text || '').trim().match(/\S+/g) || []).length;
const cs2Money = (value) => { const number = Number(value); if (!Number.isFinite(number)) return null; return `${number >= 0 ? '+' : '−'}$${Math.abs(number).toFixed(2)}`; };
const renameStudySection = (study, index, next) => {
  const sections = [...(study.sections || [])]; const old = sections[index]; sections[index] = next;
  const move = (map) => { if (!map || !Object.prototype.hasOwnProperty.call(map, old)) return map; const { [old]: value, ...rest } = map; return { ...rest, [next]: value }; };
  return { sections, sectionDocuments: move(study.sectionDocuments), sectionNotes: move(study.sectionNotes) };
};
const removeStudySection = (study, index) => {
  const sections = (study.sections || []).filter((_, position) => position !== index); const name = (study.sections || [])[index];
  const drop = (map) => { if (!map) return map; const { [name]: _removed, ...rest } = map; return rest; };
  const patch = { sections, sectionDocuments: drop(study.sectionDocuments), sectionNotes: drop(study.sectionNotes) };
  if (index === 0) {
    // The first section mirrors into the legacy overview fields; hand that role to the new first section.
    const next = { ...study, ...patch };
    const document = sections[0] ? migrateSectionRichDocument({ ...next, richDocument: null, body: '' }, sections[0], 1) : emptyRichDocument();
    Object.assign(patch, { richDocument: document, body: richDocumentText(document) });
  }
  return patch;
};
function Cs2Toolbar({ editor, meta }) {
  const [, setTick] = useState(0);
  const [linkOpen, setLinkOpen] = useState(false);
  const [href, setHref] = useState('');
  const [notice, setNotice] = useState('');
  const fileInput = useRef(null);
  useEffect(() => { if (!editor) return undefined; const update = () => setTick((value) => value + 1); editor.on('transaction', update); editor.on('focus', update); return () => { editor.off('transaction', update); editor.off('focus', update); }; }, [editor]);
  const ready = !!editor && !editor.isDestroyed;
  const run = (fn) => () => { if (ready) fn(editor.chain().focus()).run(); };
  const button = (Icon, label, action, active = false, disabled = false) => <button type="button" aria-label={label} title={label} className={active ? 'is-on' : ''} disabled={!ready || disabled} onMouseDown={(event) => event.preventDefault()} onClick={action}><Icon size={16}/></button>;
  const openLink = () => { if (!ready) return; setHref(editor.getAttributes('link').href || ''); setNotice(''); setLinkOpen(true); };
  const applyLink = () => {
    if (!ready) return;
    const value = href.trim();
    if (!value) editor.chain().focus().extendMarkRange('link').unsetLink().run();
    else if (!isSafeLink(value)) { setNotice('Use an http, https, or mailto link.'); return; }
    else editor.chain().focus().extendMarkRange('link').setLink({ href: value }).run();
    setLinkOpen(false);
  };
  const insertImage = async (event) => { const file = event.target.files?.[0]; event.target.value = ''; if (!file || !ready) return; try { await insertImageInView(editor.view, file); setNotice(''); } catch (error) { setNotice(error.message); } };
  const is = (name, attrs) => ready && editor.isActive(name, attrs);
  return <div className="cs2-tbar" role="toolbar" aria-label="Document formatting">
    <div className="cs2-tbtns">
      {button(Undo2, 'Undo', run((chain) => chain.undo()), false, !ready || !editor.can().undo())}{button(Redo2, 'Redo', run((chain) => chain.redo()), false, !ready || !editor.can().redo())}<i/>
      {button(Bold, 'Bold', run((chain) => chain.toggleBold()), is('bold'))}{button(Italic, 'Italic', run((chain) => chain.toggleItalic()), is('italic'))}{button(UnderlineIcon, 'Underline', run((chain) => chain.toggleUnderline()), is('underline'))}{button(Strikethrough, 'Strikethrough', run((chain) => chain.toggleStrike()), is('strike'))}{button(RemoveFormatting, 'Clear formatting', run((chain) => chain.unsetAllMarks().clearNodes()))}<i/>
      {button(Heading1, 'Heading 1', run((chain) => chain.toggleHeading({ level: 1 })), is('heading', { level: 1 }))}{button(Heading2, 'Heading 2', run((chain) => chain.toggleHeading({ level: 2 })), is('heading', { level: 2 }))}{button(Heading3, 'Heading 3', run((chain) => chain.toggleHeading({ level: 3 })), is('heading', { level: 3 }))}<i/>
      {button(List, 'Bullet list', run((chain) => chain.toggleBulletList()), is('bulletList'))}{button(ListOrdered, 'Numbered list', run((chain) => chain.toggleOrderedList()), is('orderedList'))}{button(Quote, 'Quote', run((chain) => chain.toggleBlockquote()), is('blockquote'))}{button(Minus, 'Divider', run((chain) => chain.setHorizontalRule()))}<i/>
      {button(Link2, 'Add link', openLink, is('link'))}{button(Unlink, 'Remove link', run((chain) => chain.extendMarkRange('link').unsetLink()), false, !is('link'))}{button(ImagePlus, 'Insert image', () => fileInput.current?.click())}
      <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={insertImage}/>
      <span className="cs2-mut cs2-tmeta">{ready ? meta : 'Click into a section to format it'}</span>
    </div>
    {linkOpen && <div className="cs2-lnk"><input autoFocus value={href} onChange={(event) => { setHref(event.target.value); setNotice(''); }} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); applyLink(); } if (event.key === 'Escape') setLinkOpen(false); }} placeholder="Paste a link and press Enter" aria-label="Link address"/><button type="button" className="cs2-btn is-sm is-pri" onClick={applyLink}>Apply</button><button type="button" className="cs2-btn is-sm" onClick={() => setLinkOpen(false)}>Cancel</button></div>}
    {notice && <p className="cs2-err" role="alert">{notice}</p>}
  </div>;
}
function Cs2SectionHeading({ name, index, words, onRename, onRemove }) {
  const [draft, setDraft] = useState(name);
  useEffect(() => setDraft(name), [name]);
  const commit = () => { const next = draft.trim().replace(/\s+/g, ' '); if (!next || next === name) { setDraft(name); return; } if (!onRename(index, next)) setDraft(name); };
  return <div className="cs2-sh2"><b className="cs2-num">{String(index + 1).padStart(2, '0')}</b>
    <input className="cs2-sht" value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={commit} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); } if (event.key === 'Escape') { setDraft(name); event.currentTarget.blur(); } }} aria-label={`Section ${index + 1} title`}/>
    <span className="cs2-wc">{words} {words === 1 ? 'word' : 'words'}</span>
    <button type="button" className="cs2-ic is-sm" aria-label={`Remove section ${name}`} onClick={() => onRemove(index)}><Trash2 size={14}/></button>
  </div>;
}
function Cs2StudyWorkspace({ study, workspace, templates, trades = [], markups = [], saveState, onRetrySave, storageNotice, syncStatus, profileName, onBack, onUpdate, onRemove, onDuplicate, onToggle, onAddEvidence, onSaveDocumentImage, onViewEvidence, onExport, onSaveTemplate, onCreateConnection, onEditConnection, onDeleteConnection, onOpenStudy, onOpenViewer, onOpenTemplates, onOpenReview }) {
  const confirm = useConfirmation();
  const notify = useCs2Toast();
  const toggleLink = (field, id, added, removed) => { const linked = (study[field] || []).includes(id); onToggle(field, id); notify(linked ? removed : added); };
  const [focus, setFocus] = useState(false);
  const [tab, setTab] = useState('evidence');
  const [picker, setPicker] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [openId, setOpenId] = useState(null);
  const [activeEditor, setActiveEditor] = useState(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [connectDialog, setConnectDialog] = useState(false);
  const [notice, setNotice] = useState('');
  const menuRef = useRef(null);
  const sectionRefs = useRef({});
  const pendingFocus = useRef(null);
  const sections = study.sections || [];
  const texts = sections.map((name, index) => cs2SectionText(study, name, index));
  const written = texts.filter((text) => text.trim().length > 20).length;
  const totalWords = texts.reduce((sum, text) => sum + cs2Words(text), 0);
  const linkedEvidence = (study.evidenceIds || []).map((id) => workspace.evidence.find((item) => item.id === id)).filter(Boolean);
  const freeEvidence = workspace.evidence.filter((item) => !(study.evidenceIds || []).includes(item.id));
  const usedBy = (id) => workspace.studies.filter((item) => (item.evidenceIds || []).includes(id)).length;
  const connections = caseStudyConnectionsForStudy(workspace, study.id).filter((item) => workspace.studies.some((other) => other.id === (item.source.id === study.id ? item.target.id : item.source.id)));
  const review = normaliseCaseStudyReview(study.review);
  const readiness = reviewReadiness(study.review);
  const validated = study.status === 'Validated';
  const documentEvidence = Object.fromEntries(workspace.evidence.filter((item) => item.documentImageRef).map((item) => [item.documentImageRef, item]));
  const linkedTrades = (study.tradeIds || []).map((id) => trades.find((item) => item.id === id)).filter(Boolean);
  const linkedMarkups = (study.markupIds || []).map((id) => markups.find((item) => item.id === id)).filter(Boolean);
  const tradeLabel = (trade) => `${trade.asset || trade.instrument || 'Trade'} · ${trade.date || 'Undated'}${trade.direction ? ` · ${trade.direction}` : ''}`;
  const markupLabel = (markup) => `${markup.instrument || markup.market || 'Markup'} · ${markup.date || 'Undated'}${markup.bias ? ` · ${markup.bias}` : ''}`;
  useEffect(() => { if (!menuOpen) return undefined; const close = (event) => { if (!menuRef.current?.contains(event.target)) setMenuOpen(false); }; const escape = (event) => { if (event.key === 'Escape') { event.preventDefault(); setMenuOpen(false); } }; document.addEventListener('pointerdown', close); document.addEventListener('keydown', escape); return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', escape); }; }, [menuOpen]);
  useEffect(() => { if (!focus) return undefined; const exit = (event) => { if (event.key === 'Escape' && !event.defaultPrevented) setFocus(false); }; document.addEventListener('keydown', exit); return () => document.removeEventListener('keydown', exit); }, [focus]);
  useEffect(() => { if (pendingFocus.current == null) return; const node = sectionRefs.current[pendingFocus.current]; pendingFocus.current = null; node?.scrollIntoView({ block: 'start', behavior: 'smooth' }); node?.querySelector('.cs2-sht')?.select(); }, [sections.length]);
  const goTo = (key) => { setActiveIndex(key); sectionRefs.current[key]?.scrollIntoView({ block: 'start', behavior: 'smooth' }); };
  const rename = (index, next) => {
    if (sections.some((name, position) => position !== index && name.toLocaleLowerCase() === next.toLocaleLowerCase())) { setNotice(`A section called “${next}” already exists.`); return false; }
    setNotice(''); onUpdate((latest) => renameStudySection(latest, index, next)); return true;
  };
  const removeSection = async (index) => {
    const hasText = texts[index]?.trim();
    if (sections.length <= 1) { setNotice('A study needs at least one section.'); return; }
    if (hasText && !await confirm({ title: 'Remove this section?', description: `“${sections[index]}” and its notes will be removed from this study.`, confirmLabel: 'Remove section', tone: 'danger' })) return;
    onUpdate((latest) => removeStudySection(latest, index));
    notify('Section removed');
  };
  const addSection = () => {
    let number = sections.length + 1; let name = `New section ${number}`;
    while (sections.some((item) => item.toLocaleLowerCase() === name.toLocaleLowerCase())) { number += 1; name = `New section ${number}`; }
    pendingFocus.current = sections.length;
    onUpdate({ sections: [...sections, name] });
  };
  const patchReview = (patch) => onUpdate((latest) => patchStudyReview(latest, patch, now()));
  const markValidated = () => { if (!readiness.ready) return; onUpdate((current) => ({ ...patchStudyReview(current, {}, now()), status: 'Validated', validation: { ...(current.validation || {}), validatedAt: now(), summary: review.conclusion } })); notify('Study validated'); };
  const removeConnection = async (id) => { if (await confirm({ title: 'Remove this connection?', description: 'The two studies stay as they are; only the link between them is removed.', confirmLabel: 'Remove connection', tone: 'danger' })) { await onDeleteConnection(id); notify('Connection removed'); } };
  const menuItem = (Icon, label, action, danger = false) => <button type="button" role="menuitem" className={danger ? 'is-danger' : ''} onClick={() => { setMenuOpen(false); action(); }}><Icon size={15}/>{label}</button>;
  const saveLabel = saveState || 'Saved';
  const tabs = [['evidence', 'Evidence', linkedEvidence.length], ['links', 'Links', linkedTrades.length + linkedMarkups.length], ['connections', 'Connections', connections.length], ['validate', 'Validate', null]];
  return <main className={`cs2 cs2-w${focus ? ' is-focus' : ''}`}>
    <header className="cs2-wbar">
      <button type="button" className="cs2-btn" onClick={onBack}><ArrowLeft size={15}/>Library</button>
      <div className="cs2-wnb cse-connection-field"><CaseStudyDropdown id="cs2-ws-notebook" label="Notebook" value={study.notebookId} options={workspace.notebooks.map((item) => ({ value: item.id, label: item.name }))} openId={openId} setOpenId={setOpenId} onChange={(value) => onUpdate({ notebookId: value })}/></div>
      <input className="cs2-wtt" value={study.title} onChange={(event) => onUpdate({ title: event.target.value })} placeholder="Untitled study" aria-label="Study title"/>
      <div className="cs2-wst cse-connection-field"><CaseStudyDropdown id="cs2-ws-status" label="Status" value={study.status || 'Draft'} options={STATUSES.map((item) => ({ value: item, label: item }))} openId={openId} setOpenId={setOpenId} onChange={(value) => onUpdate({ status: value })}/></div>
      <span className={`cs2-sv${/fail/i.test(saveLabel) ? ' is-bad' : /saving/i.test(saveLabel) ? ' is-busy' : ''}`} role="status">{/fail/i.test(saveLabel) ? <button type="button" onClick={onRetrySave}>Save failed · Retry</button> : <><Check size={13} strokeWidth={3}/><em>{saveLabel}</em></>}</span>
      <button type="button" className={`cs2-ic${study.favorite ? ' is-on' : ''}`} aria-pressed={!!study.favorite} aria-label={study.favorite ? 'Remove favorite' : 'Mark as favorite'} title="Favorite" onClick={() => onUpdate({ favorite: !study.favorite })}><Star size={16} fill={study.favorite ? 'currentColor' : 'none'}/></button>
      <button type="button" className={`cs2-ic${study.pinned ? ' is-on' : ''}`} aria-pressed={!!study.pinned} aria-label={study.pinned ? 'Unpin' : 'Pin to top'} title="Pin" onClick={() => onUpdate({ pinned: !study.pinned })}><Pin size={16}/></button>
      <button type="button" className={`cs2-btn${focus ? ' is-on' : ''}`} aria-pressed={focus} onClick={() => setFocus((value) => !value)}><Focus size={15}/>Focus</button>
      <div className="cs2-more" ref={menuRef}><button type="button" className="cs2-ic" aria-label="More actions" aria-haspopup="menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((value) => !value)}><MoreHorizontal size={16}/></button>
        {menuOpen && <div className="cs2-menu is-end" role="menu">
          {menuItem(ClipboardCheck, 'Full review', onOpenReview)}
          {menuItem(Copy, 'Duplicate study', () => { onDuplicate(); notify('Study duplicated'); })}
          {menuItem(LayoutTemplate, 'Save as template', () => { onSaveTemplate(''); notify('Saved to My templates'); })}
          {menuItem(Download, 'Export study', () => { onExport(); notify('Study exported'); })}
          {menuItem(Archive, study.archived ? 'Restore from archive' : 'Archive', () => { onUpdate({ archived: !study.archived }); notify(study.archived ? 'Study restored' : 'Study archived'); })}
          <hr/>
          {menuItem(Trash2, 'Delete study', onRemove, true)}
        </div>}
      </div>
    </header>
    <div className="cs2-wg">
      <aside className="cs2-out" aria-label="Study outline">
        <div className="cs2-org"><Cs2Ring value={written} total={sections.length} size={44}/><div><b>{written} of {sections.length}</b><small>sections written</small></div></div>
        <div className="cs2-ol">{sections.map((name, index) => <button type="button" key={`${name}-${index}`} className={`${texts[index].trim().length > 20 ? 'is-ok' : ''}${activeIndex === index ? ' is-on' : ''}`} onClick={() => goTo(index)}><b>{String(index + 1).padStart(2, '0')}</b><span>{name}</span><i><Check size={11} strokeWidth={3.4}/></i></button>)}
          <button type="button" className={`${linkedEvidence.length ? 'is-ok' : ''}${activeIndex === 'evidence' ? ' is-on' : ''}`} onClick={() => goTo('evidence')}><b><ImageIcon size={13}/></b><span>Chart evidence</span><i><Check size={11} strokeWidth={3.4}/></i></button></div>
        <div className="cs2-oa"><button type="button" className="cs2-btn is-full" onClick={addSection}><Plus size={14}/>Add section</button><button type="button" className="cs2-btn is-full" onClick={onOpenTemplates}><LayoutTemplate size={14}/>Add from template</button></div>
      </aside>
      <section className="cs2-doc" aria-label="Study document">
        <Cs2Toolbar editor={activeEditor} meta={`${totalWords} ${totalWords === 1 ? 'word' : 'words'} · Updated ${dateLabel(study.updatedAt)}`}/>
        {notice && <p className="cs2-err cs2-docn" role="alert">{notice}</p>}
        {sections.map((name, index) => <section className="cs2-sec" key={`${study.id}:${name}`} ref={(node) => { sectionRefs.current[index] = node; }} onFocusCapture={() => setActiveIndex(index)}>
          <Cs2SectionHeading name={name} index={index} words={cs2Words(texts[index])} onRename={rename} onRemove={removeSection}/>
          <RichDocumentBoundary value={texts[index]} onChange={(value) => onUpdate((latest) => patchSectionRichDocument(latest, name, index, { version: 1, content: { type: 'doc', content: String(value).split(/\n{2,}/).map((block) => ({ type: 'paragraph', content: block ? [{ type: 'text', text: block }] : undefined })) } }))}>
            <RichDocumentEditor bare document={migrateSectionRichDocument(study, name, index)} placeholder={templateGuidance(templates.find((item) => item.id === study.templateId), name) || 'Write your notes here…'} onChange={(document) => onUpdate((latest) => patchSectionRichDocument(latest, name, index, document))} onFocusEditor={setActiveEditor} saveState={saveState} sectionName={name} documentEvidence={documentEvidence} onSaveImage={onSaveDocumentImage} onViewEvidence={onViewEvidence}/>
          </RichDocumentBoundary>
        </section>)}
        <section className="cs2-sec" ref={(node) => { sectionRefs.current.evidence = node; }}>
          <div className="cs2-sh2"><b className="cs2-num"><ImageIcon size={15}/></b><h3>Chart evidence</h3><span className="cs2-wc">{linkedEvidence.length} attached</span></div>
          {linkedEvidence.length ? linkedEvidence.map((item) => <figure className="cs2-fig" key={item.id}><button type="button" className="cs2-fi" onClick={() => onOpenViewer(item.id)}><Cs2EvidenceThumb item={item}/><span className="cs2-go"><Eye size={14}/>Open viewer &amp; annotate</span></button><figcaption><b>{item.title}</b>{study.evidencePlacements?.[item.id]?.caption && <span>{study.evidencePlacements[item.id].caption}</span>}</figcaption></figure>)
            : <div className="cs2-empty is-sm">Attach a chart from the Evidence panel on the right.</div>}
        </section>
      </section>
      <aside className="cs2-pan" aria-label="Study tools">
        <div className="cs2-ptabs" role="tablist">{tabs.map(([id, label, count]) => <button type="button" role="tab" key={id} aria-selected={tab === id} className={tab === id ? 'is-on' : ''} onClick={() => { setTab(id); setPicker(null); }}>{label}{count ? <b>{count}</b> : null}</button>)}</div>
        <div className="cs2-pb">
          {tab === 'evidence' && <>
            <button type="button" className="cs2-btn is-pri is-full" aria-expanded={picker === 'evidence'} onClick={() => setPicker(picker === 'evidence' ? null : 'evidence')}><Plus size={15}/>Add evidence</button>
            {picker === 'evidence' && <div className="cs2-pick">{freeEvidence.length ? freeEvidence.map((item) => <button type="button" key={item.id} onClick={() => { toggleLink('evidenceIds', item.id, 'Evidence attached', 'Evidence detached'); setPicker(null); }}><span className="cs2-mini"><Cs2EvidenceThumb item={item}/></span><span>{item.title}</span><Plus size={14}/></button>) : <p className="cs2-mut">Everything in your library is attached.</p>}<button type="button" className="cs2-upl" onClick={() => { setPicker(null); onAddEvidence(); }}><Upload size={14}/>Upload a new image</button></div>}
            {linkedEvidence.length ? linkedEvidence.map((item) => <div className="cs2-ea" key={item.id}><button type="button" className="cs2-mini is-lg" aria-label={`Open ${item.title} in the viewer`} onClick={() => onOpenViewer(item.id)}><Cs2EvidenceThumb item={item}/></button><div><b>{item.title}</b><small>{usedBy(item.id)} {usedBy(item.id) === 1 ? 'study uses' : 'studies use'} this</small><button type="button" className="cs2-btn is-sm" onClick={() => onOpenViewer(item.id)}>Open viewer</button></div><button type="button" className="cs2-ic is-sm" aria-label={`Detach ${item.title}`} onClick={() => toggleLink('evidenceIds', item.id, 'Evidence attached', 'Evidence detached')}><X size={14}/></button></div>)
              : <div className="cs2-empty is-sm">No evidence attached yet.</div>}
          </>}
          {tab === 'links' && [['trades', 'Trades', 'tradeIds', linkedTrades, trades, tradeLabel, 'a trade'], ['markups', 'Markups', 'markupIds', linkedMarkups, markups, markupLabel, 'a markup']].map(([key, title, field, linked, all, label, noun]) => <div className="cs2-lkg" key={key}>
            <div className="cs2-msh"><b>{title}</b><small>{linked.length} linked</small></div>
            {linked.length ? linked.map((item) => { const money = key === 'trades' ? cs2Money(item.netPnl ?? item.pnl) : null; return <div className="cs2-lkd" key={item.id}><span>{label(item)}</span>{money && <b className={money.startsWith('+') ? 'is-gain' : 'is-loss'}>{money}</b>}<button type="button" className="cs2-ic is-sm" aria-label={`Unlink ${label(item)}`} onClick={() => toggleLink(field, item.id, `${title.slice(0, -1)} linked`, `${title.slice(0, -1)} unlinked`)}><X size={13}/></button></div>; }) : <div className="cs2-empty is-sm">None linked.</div>}
            <button type="button" className="cs2-btn is-full" aria-expanded={picker === key} onClick={() => setPicker(picker === key ? null : key)}><Plus size={14}/>Link {noun}</button>
            {picker === key && <div className="cs2-pick">{all.filter((item) => !(study[field] || []).includes(item.id)).slice(0, 30).map((item) => <button type="button" key={item.id} onClick={() => { toggleLink(field, item.id, `${title.slice(0, -1)} linked`, `${title.slice(0, -1)} unlinked`); setPicker(null); }}><span>{label(item)}</span><Plus size={14}/></button>)}{!all.some((item) => !(study[field] || []).includes(item.id)) && <p className="cs2-mut">All linked.</p>}</div>}
          </div>)}
          {tab === 'connections' && <>
            <button type="button" className="cs2-btn is-pri is-full" onClick={() => setConnectDialog(true)} disabled={workspace.studies.filter((item) => !item.archived).length < 2}><Link2 size={15}/>Connect to a study</button>
            {connections.length ? connections.map((item) => { const outgoing = item.source.id === study.id; const other = workspace.studies.find((entry) => entry.id === (outgoing ? item.target.id : item.source.id)); const directional = isDirectionalCaseStudyRelationship(item.relationship); return <div className="cs2-con" key={item.id}>
              <b>{studyTitle(other)}</b><span className={`cs2-rel is-${CS2_REL_TONE[item.relationship]}`}>{directional ? (outgoing ? '→ ' : '← ') : ''}{relLabel(item.relationship)}</span>{item.explanation && <p>{item.explanation}</p>}
              <div className="cs2-row2"><button type="button" className="cs2-btn is-sm" onClick={() => onOpenStudy(other.id)}>Open study</button><button type="button" className="cs2-btn is-sm is-danger" onClick={() => removeConnection(item.id)}>Remove</button></div>
            </div>; }) : <div className="cs2-empty is-sm">No connected studies yet. Connect related research to build your knowledge network.</div>}
          </>}
          {tab === 'validate' && <>
            {validated && <div className="cs2-vok"><ShieldCheck size={26} strokeWidth={1.8}/><b>Validated</b><span>This study is marked as validated.</span><button type="button" className="cs2-btn is-full" onClick={() => onUpdate({ status: 'Researching' })}>Reopen for edits</button></div>}
            <div className="cs2-chk">{readiness.checks.map((check) => <div key={check.id} className={check.complete ? 'is-ok' : ''}><i><Check size={11} strokeWidth={3.4}/></i>{check.label}</div>)}</div>
            <div className="cs2-f"><small>Your assessment</small><div className="cs2-as" role="radiogroup" aria-label="Your assessment">{[['Supported', 'Evidence agrees with the hypothesis'], ['Inconclusive', 'Not enough clarity to decide'], ['Not Supported', 'Evidence contradicts it']].map(([value, hint]) => <button type="button" role="radio" key={value} aria-checked={review.assessment === value} className={review.assessment === value ? 'is-on' : ''} onClick={() => patchReview({ assessment: value })}><b>{value}</b><small>{hint}</small></button>)}</div></div>
            <label className="cs2-f"><small>Why did the evidence lead here?</small><textarea rows={3} value={review.explanation} onChange={(event) => patchReview({ explanation: event.target.value })} placeholder="Explain your assessment…"/></label>
            <label className="cs2-f"><small>Conclusion</small><textarea rows={3} value={review.conclusion} onChange={(event) => patchReview({ conclusion: event.target.value })} placeholder="What did you learn and what is next?"/></label>
            {!validated && <><button type="button" className="cs2-btn is-pri is-full" disabled={!readiness.ready} onClick={markValidated}><ShieldCheck size={15}/>Mark validated</button>{!readiness.ready && <p className="cs2-mut">Complete the three items above to validate.</p>}</>}
            <button type="button" className="cs2-btn is-full" onClick={onOpenReview}><ClipboardCheck size={15}/>Open full review</button>
          </>}
        </div>
        <p className="cs2-foot">{storageNotice || syncStatus || `Saved to ${profileName}'s profile library.`}</p>
      </aside>
    </div>
    {connectDialog && <Cs2ConnectDialog studies={workspace.studies.filter((item) => !item.archived)} fromId={study.id} onClose={() => setConnectDialog(false)} onSave={async (fields) => { const created = await onCreateConnection(fields); notify('Connection created'); return created; }}/>}
  </main>;
}

// Stage 7: desktop confirmations, toasts and restore. On desktop every useConfirmation() call inside
// Case Studies gets the cs2 alert dialog; phones fall through to the app's own dialog unchanged.
const Cs2ToastContext = createContext(() => {});
const useCs2Toast = () => useContext(Cs2ToastContext);
function Cs2Feedback({ children }) {
  const appConfirm = useConfirmation();
  const [desktop, setDesktop] = useState(() => typeof window === 'undefined' || window.matchMedia(CS2_DESKTOP).matches);
  useEffect(() => { const media = window.matchMedia(CS2_DESKTOP), change = () => setDesktop(media.matches); media.addEventListener('change', change); return () => media.removeEventListener('change', change); }, []);
  const [ask, setAsk] = useState(null);
  const [toast, setToast] = useState(null);
  const pending = useRef(false);
  const lastFocus = useRef(null);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const confirm = useCallback((options) => {
    if (!desktop) return appConfirm(options);
    if (pending.current) return Promise.resolve(false);
    pending.current = true;
    lastFocus.current = document.activeElement;
    return new Promise((resolve) => setAsk({ title: 'Confirm action', description: '', confirmLabel: 'Confirm', cancelLabel: 'Cancel', ...options, resolve }));
  }, [desktop, appConfirm]);
  const settle = (value) => { if (!ask) return; pending.current = false; setAsk(null); ask.resolve(value); lastFocus.current?.focus?.(); };
  const notify = useCallback((message) => { if (!desktop || !message) return; clearTimeout(timer.current); setToast({ message, id: Date.now() }); timer.current = setTimeout(() => setToast(null), 2200); }, [desktop]);
  const danger = (ask?.tone || ask?.variant || 'danger') !== 'neutral';
  return <ConfirmationContext.Provider value={confirm}><Cs2ToastContext.Provider value={notify}>
    {children}
    {ask && <Cs2Dialog labelledBy="cs2-confirm-title" role="alertdialog" small onClose={() => settle(false)}>
      <header><div><h2 id="cs2-confirm-title">{ask.title}</h2>{ask.description && <p id="cs2-confirm-description">{ask.description}</p>}</div></header>
      <footer><button type="button" className="cs2-btn" autoFocus onClick={() => settle(false)}>{ask.cancelLabel}</button><button type="button" className={`cs2-btn is-pri${danger ? ' is-dng' : ''}`} onClick={() => settle(true)}>{ask.confirmLabel}</button></footer>
    </Cs2Dialog>}
    {toast && <div className="cs2 cs2-toast" role="status" key={toast.id}><Check size={15} strokeWidth={3}/>{toast.message}</div>}
  </Cs2ToastContext.Provider></ConfirmationContext.Provider>;
}
function Cs2RestoreDialog({ onClose, onImport }) {
  const [file, setFile] = useState(null);
  const [conflict, setConflict] = useState('copy');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    if (!file) { setError('Choose a backup file first.'); return; }
    setBusy(true); setError('');
    const restored = await onImport(file, conflict);
    setBusy(false);
    if (!restored) setError('That file is not a Case Study Library backup from this journal.');
  };
  return <Cs2Dialog labelledBy="cs2-restore-title" onClose={onClose} busy={busy}>
    <Cs2DialogHead id="cs2-restore-title" eyebrow="Case Study Library backup" title="Restore library" intro="Import adds missing items. Studies, evidence and templates you already have are never overwritten unless you choose to replace them." onClose={onClose} busy={busy}/>
    <form className="cs2-mbody" onSubmit={submit}>
      <label className={`cs2-drop${file ? ' is-set' : ''}`}><Upload size={20}/><span><b>{file ? file.name : 'Choose a backup file'}</b><small>{file ? `${Math.max(1, Math.round(file.size / 1024))} KB · click to change` : 'A .json file exported from this journal'}</small></span><input type="file" accept="application/json,.json" onChange={(event) => { setFile(event.target.files?.[0] || null); setError(''); }}/></label>
      <div className="cs2-f"><small>If an item already exists</small><div className="cs2-as" role="radiogroup" aria-label="If an item already exists">
        <button type="button" role="radio" aria-checked={conflict === 'copy'} className={conflict === 'copy' ? 'is-on' : ''} onClick={() => setConflict('copy')}><b>Keep both as copies</b><small>Safe: your current work stays as it is.</small></button>
        <button type="button" role="radio" aria-checked={conflict === 'replace'} className={conflict === 'replace' ? 'is-on' : ''} onClick={() => setConflict('replace')}><b>Replace matching items</b><small>The backup version replaces items with the same ID.</small></button>
      </div></div>
      {error && <p className="cs2-err" role="alert">{error}</p>}
      <div className="cs2-mf"><span/><button type="button" className="cs2-btn" onClick={onClose} disabled={busy}>Cancel</button><button type="submit" className="cs2-btn is-pri" disabled={busy}><Upload size={15}/>{busy ? 'Restoring…' : 'Restore library'}</button></div>
    </form>
  </Cs2Dialog>;
}

function CaseStudyLibraryReady({ profileWorkspace, sessionOwner='', temporaryNotice = '', syncStatus = '', onUploadDeviceLibrary = null, syncActionLabel='Upload device library', syncConflict = null, profileName = 'Profile', trades = [], markups = [], onSaveWorkspace }) {
  const confirm=useConfirmation();
  const notify=useCs2Toast();
  const [cs2Desktop, setCs2Desktop] = useState(() => typeof window === 'undefined' || window.matchMedia(CS2_DESKTOP).matches);
  useEffect(() => { const media = window.matchMedia(CS2_DESKTOP), change = () => setCs2Desktop(media.matches); media.addEventListener('change', change); return () => media.removeEventListener('change', change); }, []);
  const [cs2Filter, setCs2Filter] = useState('all');
  const [cs2NewDialog, setCs2NewDialog] = useState(null);
  const [cs2TemplateEdit, setCs2TemplateEdit] = useState(null);
  // Writes from Tiptap can arrive before React has committed the preceding
  // render. Keep one authoritative in-memory snapshot so a later keystroke or
  // section change cannot build its save from an older study object.
  const workspaceRef = useRef(normalise(profileWorkspace));
  const [workspace, setWorkspace] = useState(() => workspaceRef.current);
  const restoredNavigation = useRef(readCaseStudyNavigation(sessionOwner));
  const [selectedId, setSelectedId] = useState(() => restoredNavigation.current?.studyId || null);
  const [screen, setScreen] = useState(() => restoredNavigation.current ? 'editor' : 'library');
  const [editorNavigation,setEditorNavigation] = useState(() => ({mode:restoredNavigation.current?.mode || 'Write',reviewStep:restoredNavigation.current?.reviewStep || 0}));
  const [saveState, setSaveState] = useState('All changes saved');
  const [libraryView, setLibraryView] = useState('library');
  useNavStep('case-screen', screen !== 'library', () => returnToLibrary());
  useNavStep('case-view', libraryView !== 'library', () => setLibraryView('library'));
  // An open study is deepest, then Evidence and Connections; the other collections are filters of the same list.
  useStepMotion(screen !== 'library' ? 2 : ['evidence', 'connections'].includes(libraryView) ? 1 : 0);
  const [sort, setSort] = useState('recent');
  const [libraryDropdown, setLibraryDropdown] = useState(null);
  const [cardMenu, setCardMenu] = useState(null);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [evidenceDialog, setEvidenceDialog] = useState(false);
  const [restoreDialog, setRestoreDialog] = useState(false);
  const [evidenceSelection,setEvidenceSelection]=useState(null);
  const saveTimer = useRef();
  const saveVersion = useRef(0);
  const failedSave = useRef(null);
  const pendingSave = useRef(null);
  const saveWorkspaceRef = useRef(onSaveWorkspace);
  const cardMenuRoot = useRef(null);
  const headerMenuRoot = useRef(null);
  saveWorkspaceRef.current=onSaveWorkspace;

  const libraryCounts = value => ({
    studies:Array.isArray(value?.studies) ? value.studies.length : 0,
    evidence:Array.isArray(value?.evidence) ? value.evidence.length : 0,
    connections:Array.isArray(value?.connections) ? value.connections.length : 0,
    templates:Array.isArray(value?.personalTemplates) ? value.personalTemplates.length : 0,
  });
  const countSummary = counts => `${counts.studies} ${counts.studies === 1 ? 'study' : 'studies'}, ${counts.evidence} evidence item${counts.evidence === 1 ? '' : 's'}, ${counts.connections} connection${counts.connections === 1 ? '' : 's'}, and ${counts.templates} personal template${counts.templates === 1 ? '' : 's'}`;
  const uploadDeviceLibrary = async () => {
    if (!onUploadDeviceLibrary) return;
    const prepared=await onUploadDeviceLibrary(workspaceRef.current);
    if (!prepared || prepared.kind==='nothing-to-upload' || prepared.kind==='already-synced') return;
    const localSummary=countSummary(libraryCounts(prepared.local));
    const cloudSummary=countSummary(libraryCounts(prepared.cloud));
    const replacesCloud=prepared.kind==='reconciliation-required';
    const confirmed=await confirm({
      title:replacesCloud ? 'Replace the cloud Case Study Library?' : 'Upload this device library?',
      description:replacesCloud
        ? `This device has ${localSummary}. The cloud already has ${cloudSummary}. Replacing the cloud copy is permanent for other browsers, but this device copy remains protected. Only continue if this device has the version you want to keep.`
        : `This device has ${localSummary}. Cloud storage is empty. Upload it so your signed-in browsers load the same library. Your device copy remains protected.`,
      confirmLabel:replacesCloud ? 'Replace cloud copy' : 'Upload device library',
      cancelLabel:'Keep current copies',
      variant:replacesCloud ? 'destructive' : 'default',
    });
    if (!confirmed) return;
    const result=await prepared.upload();
    if (result?.kind==='synced') notify('Case Study Library synced');
  };

  useEffect(() => {
    clearTimeout(saveTimer.current);
    saveVersion.current+=1;
    failedSave.current=null;
    workspaceRef.current=normalise(profileWorkspace);
    setWorkspace(workspaceRef.current);
    setSaveState('Saved');
    setSelectedId(current => {
      if (!current) return null;
      if (workspaceRef.current.studies.some(study=>study.id===current)) return current;
      clearCaseStudyNavigation(sessionOwner); setScreen('library'); return null;
    });
  }, [profileWorkspace,sessionOwner]);
  useEffect(() => {
    if (screen === 'editor' && selectedId) writeCaseStudyNavigation(sessionOwner,{studyId:selectedId,...editorNavigation});
    else clearCaseStudyNavigation(sessionOwner);
  }, [screen,selectedId,editorNavigation,sessionOwner]);
  useEffect(() => () => {
    clearTimeout(saveTimer.current);
    // Do not discard an image node (or a final text edit) simply because the
    // user leaves the editor before its short debounce completes.
    const pending=pendingSave.current;
    if (pending) void saveWorkspaceRef.current(pending.next).catch(() => {});
  }, []);
  useEffect(() => {
    if (!headerMenuOpen) return undefined;
    const close = (event) => { if (!headerMenuRoot.current?.contains(event.target)) setHeaderMenuOpen(false); };
    const closeOnEscape = (event) => { if (event.key === 'Escape') setHeaderMenuOpen(false); };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', closeOnEscape);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', closeOnEscape); };
  }, [headerMenuOpen]);
  useEffect(() => {
    if (!cardMenu) return undefined;
    const close = (event) => { if (!cardMenuRoot.current?.contains(event.target) && !event.target.closest?.(':is(.cs2-card,.cs2-row) .cs2-more')) setCardMenu(null); };
    const closeOnEscape = (event) => { if (event.key === 'Escape') setCardMenu(null); };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', closeOnEscape);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', closeOnEscape); };
  }, [cardMenu]);
  useEffect(() => {
    setCardMenu(null);
    setHeaderMenuOpen(false);
    setLibraryDropdown(null);
  }, [screen, libraryView, sort, workspace.settings.query, workspace.settings.status, workspace.settings.instrument, workspace.settings.tag, workspace.settings.notebook]);

  const save = (next, immediate = false) => {
    const version=++saveVersion.current;
    workspaceRef.current=next;
    pendingSave.current={next,version};
    setWorkspace(next);
    setSaveState('Saving…');
    failedSave.current=null;
    clearTimeout(saveTimer.current);
    const commit = async () => {
      try {
        await onSaveWorkspace(next);
        if (saveVersion.current===version) pendingSave.current=null;
        if (saveVersion.current===version) setSaveState('Saved');
        return true;
      }
      catch {
        if (saveVersion.current===version) { failedSave.current={next,version}; setSaveState('Save failed'); }
        return false;
      }
    };
    if (immediate) return commit();
    saveTimer.current = setTimeout(() => { void commit(); }, 550);
    return undefined;
  };
  const retrySave = () => {
    const failed=failedSave.current;
    if (!failed || failed.version!==saveVersion.current) return;
    save(failed.next, true);
  };
  const studies = useMemo(() => workspace.studies.filter((item) => !item.archived), [workspace.studies]);
  const archivedStudies = useMemo(() => workspace.studies.filter((item) => item.archived), [workspace.studies]);
  const selected = workspace.studies.find((item) => item.id === selectedId) || null;
  const collectionStudies = libraryView === 'archived' ? archivedStudies : studies;
  const visibleStudies = useMemo(() => sortCaseStudies(filterCaseStudies(collectionStudies, workspace.settings, {trades, markups, evidence:workspace.evidence}), sort), [collectionStudies, workspace.settings, sort, trades, markups, workspace.evidence]);
  const availableInstruments = useMemo(() => [...new Set(collectionStudies.flatMap(study => studyInstruments(study, trades, markups)))].sort((a,b) => a.localeCompare(b)), [collectionStudies, trades, markups]);
  const availableTags = useMemo(() => [...new Set(collectionStudies.flatMap(study => studyTags(study, workspace.evidence)))].sort((a,b) => a.localeCompare(b)), [collectionStudies, workspace.evidence]);
  const researchCandidates = useMemo(() => continuingCaseStudies(studies, Number.POSITIVE_INFINITY), [studies]);
  const pinnedCandidates = useMemo(() => pinnedCaseStudies(studies, Number.POSITIVE_INFINITY), [studies]);
  const activeResearch = useMemo(() => researchCandidates.slice(0,4), [researchCandidates]);
  const pinnedPlaybooks = useMemo(() => pinnedCandidates.slice(0,2), [pinnedCandidates]);
  const displayedStudies = useMemo(() => visibleStudies.filter(study => libraryView !== 'favorites' || study.favorite).filter(study => libraryView !== 'pinned' || study.pinned || study.templateId === 'playbook'), [visibleStudies, libraryView]);
  const creationTemplates = useMemo(() => [...TEMPLATES.map((template) => ({...template, scope:'Built-in'})), ...workspace.personalTemplates.map((template) => ({...template, scope:'Personal'}))], [workspace.personalTemplates]);
  const [editorViewer,setEditorViewer] = useState(null);
  const openEditor = (id, viewerId = null) => { setCardMenu(null); setHeaderMenuOpen(false); setEditorNavigation({mode:'Write',reviewStep:0}); setEditorViewer(viewerId); setSelectedId(id); setScreen('editor'); };
  const returnToLibrary = () => { setCardMenu(null); setHeaderMenuOpen(false); setScreen('library'); setSelectedId(null); };

  const updateSettings = (partial) => save({ ...workspace, settings:{...workspace.settings,...partial} });
  const createStudy = (template = TEMPLATES[0]) => {
    const created = { id:uid('study'), title:'Untitled study', notebookId:'notes', templateId:template.id, sections:template.sections, body:'', richDocument:template.richDocument || richDocumentFromSections(template.sections), status:'Draft', evidenceIds:[], tradeIds:[], markupIds:[], relatedStudyIds:[], favorite:false, pinned:false, archived:false, createdAt:now(), updatedAt:now(), revisionCount:1 };
    save({ ...workspace, studies:[created,...workspace.studies] }, true);
    openEditor(created.id);
  };
  const createStudyFromSetup = async (draft, template, id) => {
    const createdAt=now();
    const created=createCaseStudyDraft({draft,template,id:id || uid('study'),createdAt,richDocument:template.richDocument || richDocumentFromSections(template.sections)});
    const saved=await save({ ...workspace, studies:[created,...workspace.studies] }, true);
    if (!saved) { setWorkspace(workspace); return false; }
    openEditor(created.id);
    return true;
  };
  const updateStudy = (update) => {
    const currentWorkspace=workspaceRef.current;
    const currentStudy=currentWorkspace.studies.find((item) => item.id === selectedId);
    if (!currentStudy) return;
    const partial=typeof update === 'function' ? update(currentStudy) : update;
    const nextStudy = { ...currentStudy, ...partial, updatedAt:now(), revisionCount:(currentStudy.revisionCount || 0)+1 };
    save({ ...currentWorkspace, studies:currentWorkspace.studies.map((item) => item.id === currentStudy.id ? nextStudy : item) });
  };
  const removeStudy = async () => {
    if (!selected || !await confirm({title:'Delete study?',description:`Delete “${studyTitle(selected)}”? This cannot be undone.`,confirmLabel:'Delete study'})) return;
    save(removeConnectionsForCaseStudy({ ...workspace, studies:workspace.studies.filter((item) => item.id !== selected.id) }, selected.id), true);
    returnToLibrary();
  };
  const persistConnectionWorkspace = async (next, previous) => {
    const persisted=await save(next,true);
    if (persisted) return true;
    // An unsuccessful cloud/device write must not leave a dialog claiming the
    // relationship was saved. Restore the last confirmed in-memory workspace
    // while retaining the dialog's local field values for retry.
    workspaceRef.current=previous;
    pendingSave.current=null;
    setWorkspace(previous);
    throw new Error('Connection could not be saved. Your changes are still available to retry.');
  };
  const addConnection = async (fields) => {
    const previous=workspaceRef.current;
    const result=createCaseStudyConnection(previous,fields);
    await persistConnectionWorkspace(result.workspace,previous);
    return result.connection;
  };
  const editConnection = async (id, fields) => {
    const previous=workspaceRef.current;
    const result=updateCaseStudyConnection(previous,id,fields);
    await persistConnectionWorkspace(result.workspace,previous);
    return result.connection;
  };
  const deleteConnection = async (id) => {
    const previous=workspaceRef.current;
    await persistConnectionWorkspace(removeCaseStudyConnection(previous,id),previous);
  };
  const duplicateStudy = () => {
    if (!selected) return;
    const copy = { ...selected, id:uid('study'), title:`${studyTitle(selected)} copy`, createdAt:now(), updatedAt:now(), revisionCount:1, pinned:false };
    save({ ...workspace, studies:[copy,...workspace.studies] }, true);
    setSelectedId(copy.id);
  };
  const toggleSelection = (key, id) => {
    const current = selected?.[key] || [];
    if (key === 'evidenceIds') {
      if (current.includes(id)) { const placements={...(selected.evidencePlacements||{})}; delete placements[id]; updateStudy({ evidenceIds:current.filter((item)=>item!==id), evidencePlacements:placements }); }
      else updateStudy(linkEvidence(selected,id));
      return;
    }
    updateStudy({ [key]:current.includes(id) ? current.filter((item) => item !== id) : [...current,id] });
  };
  const addEvidence = async (fields, { linkToSelectedStudy = false } = {}) => {
    const files=Array.isArray(fields?.files) ? fields.files : [];
    if (!fields?.title?.trim() && !files.length) throw new Error('Add a title or choose at least one image.');
    const currentWorkspace=workspaceRef.current;
    const records=await Promise.all((files.length ? files : [null]).map(async(file,index)=>({
      id:uid('evidence'),
      title:(files.length > 1 ? (file?.name || `Evidence ${index+1}`).replace(/\.[^.]+$/,'') : fields.title.trim()) || `Evidence ${index+1}`,
      source:fields.source?.trim() || '', url:file ? await saveEvidenceImage(file) : fields.url?.trim() || '', notes:fields.notes?.trim() || '',
      tags:Array.isArray(fields.tags) ? fields.tags : [], kind:fields.kind || 'Chart', createdAt:now()
    })));
    const next=addEvidenceRecords(currentWorkspace,records,{studyId:linkToSelectedStudy ? selectedId : null});
    const persisted=await save(next,true);
    if (!persisted) {
      workspaceRef.current=currentWorkspace;
      pendingSave.current=null;
      setWorkspace(currentWorkspace);
      throw new Error('Evidence could not be saved to your local library. Your selected files and details are still available to retry.');
    }
    const imageSync=await synchronizeCaseStudyEvidenceImages({userId:sessionOwner,workspace:next});
    if (imageSync.uploaded) {
      workspaceRef.current=imageSync.workspace;
      setWorkspace(imageSync.workspace);
      await save(imageSync.workspace,true);
    }
    if (imageSync.failures.length) notify('Evidence saved on this device. Image upload can be retried from Backup.');
    setEvidenceDialog(false);
    return records;
  };
  const saveDocumentImageToEvidence=async ({imageRef,title,source='',tags=[]})=>{
    if (!isDocumentImageReference(imageRef)) throw new Error('This document image cannot be shared safely.');
    const blob=await readCaseStudyDocumentImage(imageRef);
    if (!blob) throw new Error('This image is unavailable in this browser. Your document was left unchanged.');
    const currentWorkspace=workspaceRef.current;
    const evidence={id:uid('evidence'),title:title.trim(),source:source.trim(),url:imageRef,documentImageRef:imageRef,notes:'',tags,kind:'Chart',createdAt:now()};
    const attached=attachDocumentImageEvidence(currentWorkspace,selectedId,evidence);
    const persisted=await save(attached.workspace,true);
    if (persisted) {
      const imageSync=await synchronizeCaseStudyEvidenceImages({userId:sessionOwner,workspace:attached.workspace});
      if (imageSync.uploaded) { workspaceRef.current=imageSync.workspace; setWorkspace(imageSync.workspace); await save(imageSync.workspace,true); }
    }
    return attached.evidence;
  };
  const openEvidenceLibrary=(id)=>{setEvidenceSelection(id);returnToLibrary();setLibraryView('evidence');};
  const patchStudy = (id, partial) => save({ ...workspace, studies: workspace.studies.map((study) => study.id === id ? { ...study, ...partial, updatedAt:now() } : study) }, true);
  const createNotebook = () => {
    const name = window.prompt('Notebook name');
    if (name?.trim()) save({ ...workspace, notebooks:[...workspace.notebooks,{id:uid('notebook'),name:name.trim()}] }, true);
  };
  const exportStudy = () => {
    if (!selected) return;
    const blob = new Blob([JSON.stringify(selected,null,2)], {type:'application/json'});
    const url = URL.createObjectURL(blob); const link = document.createElement('a');
    link.href=url; link.download=`${studyTitle(selected).replace(/[^a-z0-9]+/gi,'-').toLowerCase()}.json`; link.click(); URL.revokeObjectURL(url);
  };
  const patchEvidence = (id, partial) => save({ ...workspace, evidence:workspace.evidence.map((item) => item.id === id ? {...item, ...partial, updatedAt:now()} : item) }, true);
  const removeEvidence = async (id) => {
    const references=workspaceRef.current.studies.filter(study=>(study.evidenceIds||[]).includes(id));
    const description=references.length ? `This shared image is linked to ${references.length} ${references.length===1?'study':'studies'} and will be unlinked everywhere. Study-specific captions, observations, and chart annotations for it will no longer be reachable.` : 'Delete this unlinked shared evidence item?';
    if (!await confirm({title:'Delete shared evidence?',description,confirmLabel:'Delete evidence',tone:'danger'})) return;
    save(unlinkEvidence(workspaceRef.current,id),true);
  };
  const savePersonalTemplate = (fields, existingId = null) => {
    if (!fields?.name?.trim()) return;
    const sections=[...new Map((fields.sections || []).map(item=>String(item || '').trim()).filter(Boolean).map(item=>[item.toLocaleLowerCase(),item])).values()];
    const safeSections=sections.length ? sections : ['Overview'];
    const guidance=Object.fromEntries(safeSections.map(section=>[section, String(fields.guidance?.[section] || '').trim()]).filter(([,value])=>value));
    const template = { id:existingId || uid('template'), name:fields.name.trim(), description:fields.description?.trim() || 'A personal study structure.', sections:safeSections, guidance, updatedAt:now(), createdAt:existingId ? undefined : now() };
    save({ ...workspace, personalTemplates:existingId ? workspace.personalTemplates.map((item) => item.id===existingId ? {...item,...template} : item) : [template,...workspace.personalTemplates] }, true);
  };
  const duplicateTemplate = (template) => save({ ...workspace, personalTemplates:[{...template,id:uid('template'),name:`${template.name} copy`,createdAt:now(),updatedAt:now()},...workspace.personalTemplates] }, true);
  const removeTemplate = async (id) => { if (await confirm({title:'Delete template?',description:'Delete this personal template? Existing studies will not change.',confirmLabel:'Delete template'})) save({...workspace,personalTemplates:workspace.personalTemplates.filter((item)=>item.id!==id)},true); };
  const applyTemplate = (studyId,template) => {
    const current=workspaceRef.current.studies.find(item=>item.id===studyId);
    if (!current) return [];
    const result=applyTemplateToStudy(current,template);
    if (result.addedSections.length) save({...workspaceRef.current,studies:workspaceRef.current.studies.map(item=>item.id===studyId?{...result.study,updatedAt:now(),revisionCount:(item.revisionCount||0)+1}:item)},true);
    return result.addedSections;
  };
  const exportLibrary = () => {
    const blob = new Blob([JSON.stringify(caseStudyBackup(workspace), null, 2)], {type:'application/json'}); const url=URL.createObjectURL(blob); const link=document.createElement('a'); link.href=url; link.download=`case-study-library-${new Date().toISOString().slice(0,10)}.json`; link.click(); URL.revokeObjectURL(url);
  };
  const importLibrary = async (file, conflict) => {
    try { const parsed=JSON.parse(await file.text()); if (parsed?.kind !== 'aaicorefx-case-study-library' || !parsed.workspace) throw new Error(); save(mergeCaseStudyWorkspace(workspace, parsed.workspace, {conflict}), true); setRestoreDialog(false); return true; }
    catch { if (!cs2Desktop) window.alert('Choose a Case Study Library backup created by this journal.'); return false; }
  };
  if (screen === 'editor' && selected) return <>
    <StudyEditor study={selected} workspace={workspace} templates={creationTemplates} profileName={profileName} storageNotice={temporaryNotice ? 'Saved only on this device. Your recovered legacy library is unchanged.' : ''} syncStatus={syncStatus} trades={trades} markups={markups} saveState={saveState} onRetrySave={retrySave} initialMode={editorNavigation.mode} initialReviewStep={editorNavigation.reviewStep} initialViewerId={editorViewer} onNavigationChange={setEditorNavigation} onBack={returnToLibrary} onUpdate={updateStudy} onRemove={removeStudy} onDuplicate={duplicateStudy} onToggle={toggleSelection} onAddEvidence={()=>setEvidenceDialog(true)} onSaveDocumentImage={saveDocumentImageToEvidence} onViewEvidence={openEvidenceLibrary} onExport={exportStudy} onApplyTemplate={template=>applyTemplate(selected.id,template)} onSaveTemplate={(name)=>savePersonalTemplate({name:name||`${studyTitle(selected)} template`,description:`Based on ${studyTitle(selected)}.`,sections:selected.sections||[]})} onCreateConnection={addConnection} onEditConnection={editConnection} onDeleteConnection={deleteConnection} onOpenStudy={openEditor}/>
    {evidenceDialog && <EvidenceDialog onClose={()=>setEvidenceDialog(false)} onSave={(fields)=>addEvidence(fields,{linkToSelectedStudy:true})}/>} 
  </>;
  if (screen === 'create') return <NewCaseStudyWorkspace templates={creationTemplates} notebooks={workspace.notebooks} saveState={syncStatus || saveState} onCreate={createStudyFromSetup} onBack={returnToLibrary} onOpenTemplates={()=>{returnToLibrary();setLibraryView('templates');}}/>;

  // Desktop Case Studies v2 library (stage 1). Evidence, Connections and Templates tabs reuse the
  // existing screens until their own v2 layouts land.
  if (CASE_STUDIES_V2 && cs2Desktop && screen === 'library') {
    const tabOf = libraryView === 'evidence' ? 'evidence' : libraryView === 'connections' ? 'connections' : libraryView === 'templates' ? 'templates' : 'studies';
    const validated = studies.filter((study) => study.status === 'Validated');
    const drafts = studies.filter((study) => study.status !== 'Validated');
    const chipCounts = { all: studies.length, drafts: drafts.length, validated: validated.length, favorites: studies.filter((study) => study.favorite).length, pinned: studies.filter((study) => study.pinned).length, archived: archivedStudies.length };
    const chipBase = cs2Filter === 'archived' ? archivedStudies : studies;
    const chipFiltered = sortCaseStudies(filterCaseStudies(chipBase, { ...workspace.settings, status: 'All' }, { trades, markups, evidence: workspace.evidence }), sort)
      .filter((study) => cs2Filter === 'drafts' ? study.status !== 'Validated' : cs2Filter === 'validated' ? study.status === 'Validated' : cs2Filter === 'favorites' ? study.favorite : cs2Filter === 'pinned' ? study.pinned : true);
    const current = researchCandidates[0];
    const currentProgress = current ? caseStudyProgress(current) : null;
    const pins = pinnedCandidates.slice(0, 4);
    const notebookOf = (study) => workspace.notebooks.find((item) => item.id === study.notebookId);
    const exportStudy = (study) => { const blob = new Blob([JSON.stringify(study, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `${(studyTitle(study) || 'study').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.json`; link.click(); URL.revokeObjectURL(url); };
    const menuActionsFor = (study) => ({
      onPatch: (partial) => { patchStudy(study.id, partial); notify('pinned' in partial ? (partial.pinned ? 'Pinned to top' : 'Unpinned') : 'favorite' in partial ? (partial.favorite ? 'Added to favorites' : 'Removed from favorites') : 'archived' in partial ? (partial.archived ? 'Study archived' : 'Study restored') : ''); },
      onDuplicate: () => { const copy = { ...study, id: uid('study'), title: `${studyTitle(study)} copy`, createdAt: now(), updatedAt: now(), revisionCount: 1, pinned: false, archived: false }; save({ ...workspace, studies: [copy, ...workspace.studies] }, true); notify('Study duplicated'); },
      onExport: () => { exportStudy(study); notify('Study exported'); },
      onDelete: async () => { if (await confirm({ title: 'Delete this study?', description: `Delete “${studyTitle(study)}”? This removes the study and its notes from your library. Evidence stays in the Evidence tab.`, confirmLabel: 'Delete study' })) { const latest = workspaceRef.current; save(removeConnectionsForCaseStudy({ ...latest, studies: latest.studies.filter((item) => item.id !== study.id) }, study.id), true); notify('Study deleted'); } },
    });
    const templateCount = TEMPLATES.length + workspace.personalTemplates.length;
    const duplicateTemplateV2 = (template) => {
      const { scope, ...rest } = template;
      const copy = { ...rest, id: uid('template'), name: `Copy of ${template.name}`, sections: templateSectionNames(template), createdAt: now(), updatedAt: now() };
      save({ ...workspace, personalTemplates: [copy, ...workspace.personalTemplates] }, true);
      notify('Template duplicated to My templates');
      return copy;
    };
    const tabs = [['studies', 'Studies', <BookOpen key="i" size={16}/>, studies.length], ['evidence', 'Evidence', <ImageIcon key="i" size={16}/>, workspace.evidence.length], ['connections', 'Connections', <Link2 key="i" size={16}/>, (workspace.connections || []).length], ['templates', 'Templates', <LayoutTemplate key="i" size={16}/>, templateCount]];
    const openTab = (id) => { setCardMenu(null); setLibraryView(id === 'studies' ? 'library' : id); };
    const chip = (id, label) => <button type="button" key={id} aria-pressed={cs2Filter === id} className={cs2Filter === id ? 'is-on' : ''} onClick={() => setCs2Filter(id)}>{label}<b>{chipCounts[id]}</b></button>;
    return <main className="cs2">
      <section className="cs2-hero">
        <div className="cs2-h1"><span className="cs2-eb">{profileName} · Research workspace</span><h1>Case Study Library</h1><p>Explore setups, continue your research, and turn observations into tested playbooks.</p></div>
        <div className="cs2-stats"><div><b>{studies.length}</b><small>Studies</small></div><div><b className="is-gain">{validated.length}</b><small>Validated</small></div><div><b className="is-warn">{drafts.length}</b><small>In draft</small></div><div><b>{workspace.evidence.length}</b><small>Evidence</small></div></div>
        <div className="cs2-ha">
          <div ref={headerMenuRoot} className="cs2-more"><button type="button" className="cs2-btn" aria-haspopup="menu" aria-expanded={headerMenuOpen} onClick={() => setHeaderMenuOpen((open) => !open)}><Download size={15}/>Backup</button>{headerMenuOpen && <div className="cs2-menu" role="menu"><button type="button" role="menuitem" onClick={() => { exportLibrary(); setHeaderMenuOpen(false); notify('Library exported'); }}><Download size={15}/>Export library</button><button type="button" role="menuitem" onClick={() => { setRestoreDialog(true); setHeaderMenuOpen(false); }}><Upload size={15}/>Restore library</button><button type="button" role="menuitem" onClick={() => { void (async()=>{const result=await synchronizeCaseStudyEvidenceImages({userId:sessionOwner,workspace:workspaceRef.current}); if(result.uploaded){workspaceRef.current=result.workspace;setWorkspace(result.workspace);await save(result.workspace,true);} notify(result.failures.length?'Some images are still device-only. Retry after checking cloud storage.':'Evidence images synced');})(); setHeaderMenuOpen(false); }}><Upload size={15}/>Sync evidence images</button>{onUploadDeviceLibrary && <button type="button" role="menuitem" onClick={() => { void uploadDeviceLibrary(); setHeaderMenuOpen(false); }}><Upload size={15}/>{syncActionLabel}</button>}</div>}</div>
          <button type="button" className="cs2-btn is-pri is-lg" onClick={() => setCs2NewDialog({ templateId: null })}><Plus size={16}/>New Case Study</button>
        </div>
      </section>
      {(temporaryNotice || syncStatus) && <p className="cs2-sync" role="status">{temporaryNotice || syncStatus}</p>}
      {syncConflict && <p className="case-sync-conflict" role="alert">Sync conflict: both device and cloud versions are preserved. Reconciliation is required before another cloud save.</p>}
      <nav className="cs2-tabs" aria-label="Case Study Library sections">{tabs.map(([id, label, icon, count]) => <button key={id} type="button" aria-current={tabOf === id ? 'page' : undefined} className={tabOf === id ? 'is-on' : ''} onClick={() => openTab(id)}>{icon}{label}<b>{count}</b></button>)}</nav>
      <div className="cs2-body">
      {tabOf === 'evidence' ? <Cs2Evidence evidence={workspace.evidence} studies={workspace.studies} selectedId={evidenceSelection} onSelect={setEvidenceSelection} onUpload={async (fields) => { await addEvidence(fields); notify('Evidence uploaded'); }} onPatch={patchEvidence} onRemove={removeEvidence} onOpenStudy={(id) => openEditor(id)} onOpenViewer={(evidenceId, studyId) => { if (studyId) openEditor(studyId, evidenceId); }}/>
        : tabOf === 'connections' ? <Cs2Connections studies={studies} connections={workspace.connections || []} evidence={workspace.evidence} onOpenStudy={(id) => openEditor(id)} onCreate={async (fields) => { const created = await addConnection(fields); notify('Connection created'); return created; }} onEdit={async (id, fields) => { const edited = await editConnection(id, fields); notify('Connection updated'); return edited; }} onRemove={async (id) => { if (await confirm({ title: 'Remove this connection?', description: 'The two studies stay as they are; only the link between them is removed.', confirmLabel: 'Remove connection', tone: 'danger' })) { await deleteConnection(id); notify('Connection removed'); } }}/>
        : tabOf === 'templates' ? <Cs2Templates templates={creationTemplates} onUse={(id) => setCs2NewDialog({ templateId: id })} onDuplicate={duplicateTemplateV2} onRemove={removeTemplate} onNew={() => setCs2TemplateEdit({ sections: ['Overview'] })} onEdit={(template) => setCs2TemplateEdit({ ...template, sections: templateSectionNames(template) })}/>
        : <>
          {(current || pins.length > 0) && <div className="cs2-top">
            {current ? <section className="cs2-cont"><div className="cs2-ctx"><span className="cs2-eb">Continue researching</span><h2>{studyTitle(current)}</h2><p>{caseSummary(current).slice(0, 140) || 'Pick up where you left off.'}{caseSummary(current).length > 140 ? '…' : ''}</p><div className="cs2-rg"><Cs2Ring value={currentProgress.written} total={currentProgress.total}/><div><b>{currentProgress.written} of {currentProgress.total} sections written</b><span>Updated {dateLabel(current.updatedAt)}</span></div></div><button type="button" className="cs2-btn is-pri" onClick={() => openEditor(current.id)}>Resume study <ArrowRight size={15}/></button></div><div className="cs2-cimg"><StudyCover study={current} evidence={workspace.evidence} notebook={notebookOf(current)}/><i aria-hidden="true"/></div></section>
              : <section className="cs2-cont is-empty"><div className="cs2-ctx"><span className="cs2-eb">Continue researching</span><h2>No unfinished studies</h2><p>Start a new study when you have a question to test.</p></div></section>}
            <section className="cs2-pins"><div className="cs2-sh"><b>Pinned playbooks</b><small>Quick access to your key research</small></div>{pins.length ? pins.map((study) => <button type="button" key={study.id} className="cs2-pin" onClick={() => openEditor(study.id)}><span className="cs2-mini"><StudyCover study={study} evidence={workspace.evidence} notebook={notebookOf(study)} compact/></span><span><b>{studyTitle(study)}</b><small>{study.instrument || notebookOf(study)?.name || 'Study'} · {study.status}</small></span><ChevronRight size={15}/></button>) : <p className="cs2-empty is-sm">Pin a study to keep it here.</p>}</section>
          </div>}
          <div className="cs2-tb">
            <label className="cs2-sr"><Search size={16} aria-hidden="true"/><input value={workspace.settings.query} onChange={(event) => updateSettings({ query: event.target.value })} placeholder="Search studies, notes and insights" aria-label="Search studies"/></label>
            <div className="cs2-chp" role="group" aria-label="Study filter">{chip('all', 'All')}{chip('drafts', 'Drafts')}{chip('validated', 'Validated')}{chip('favorites', 'Favorites')}{chip('pinned', 'Pinned')}{chip('archived', 'Archived')}</div>
            <CaseStudyDropdown id="cs2-notebook" label="Filter by notebook" value={workspace.settings.notebook} options={[{ value: 'All', label: 'All notebooks' }, ...workspace.notebooks.map((notebook) => ({ value: notebook.id, label: notebook.name }))]} openId={libraryDropdown} setOpenId={setLibraryDropdown} onChange={(value) => updateSettings({ notebook: value })}/>
            {availableInstruments.length > 0 && <CaseStudyDropdown id="cs2-instrument" label="Filter by instrument" value={workspace.settings.instrument || 'All'} options={[{ value: 'All', label: 'All instruments' }, ...availableInstruments.map((value) => ({ value, label: value }))]} openId={libraryDropdown} setOpenId={setLibraryDropdown} onChange={(value) => updateSettings({ instrument: value })}/>}
            <CaseStudyDropdown id="cs2-sort" label="Sort studies" value={sort} options={[{ value: 'recent', label: 'Recently updated' }, { value: 'created', label: 'Created date' }, { value: 'title', label: 'A to Z' }]} openId={libraryDropdown} setOpenId={setLibraryDropdown} align="end" onChange={setSort}/>
            <div className="cs2-lay" role="group" aria-label="Layout"><button type="button" aria-label="Grid" aria-pressed={workspace.settings.view !== 'list'} className={workspace.settings.view !== 'list' ? 'is-on' : ''} onClick={() => updateSettings({ view: 'grid' })}><LayoutGrid size={15}/></button><button type="button" aria-label="List" aria-pressed={workspace.settings.view === 'list'} className={workspace.settings.view === 'list' ? 'is-on' : ''} onClick={() => updateSettings({ view: 'list' })}><List size={15}/></button></div>
          </div>
          {chipFiltered.length ? <div className={workspace.settings.view === 'list' ? 'cs2-list' : 'cs2-grid'}>{chipFiltered.map((study) => <Cs2StudyCard key={study.id} view={workspace.settings.view} study={study} notebook={notebookOf(study)} evidence={workspace.evidence} menuOpen={cardMenu === study.id} menuRootRef={cardMenu === study.id ? cardMenuRoot : null} onMenu={() => setCardMenu(cardMenu === study.id ? null : study.id)} onOpen={() => openEditor(study.id)} menuActions={{ ...menuActionsFor(study), onClose: () => setCardMenu(null) }}/>)}</div>
            : <div className="cs2-empty"><BookOpen size={30} strokeWidth={1.6} aria-hidden="true"/><b>{cs2Filter === 'archived' ? 'No archived studies' : 'No studies match'}</b><span>{cs2Filter === 'archived' ? 'Archived studies stay here until you restore them.' : 'Try another filter or start a new case study.'}</span>{cs2Filter !== 'archived' && <button type="button" className="cs2-btn is-pri" onClick={() => setScreen('create')}><Plus size={15}/>New Case Study</button>}</div>}
        </>}
      </div>
      {evidenceDialog && <EvidenceDialog onClose={() => setEvidenceDialog(false)} onSave={(fields) => addEvidence(fields, { linkToSelectedStudy: true })}/>}
      {restoreDialog && <Cs2RestoreDialog onClose={() => setRestoreDialog(false)} onImport={async (file, conflict) => { const restored = await importLibrary(file, conflict); if (restored) notify('Library restored'); return restored; }}/>}
      {cs2NewDialog && <Cs2NewStudyDialog templates={creationTemplates} notebooks={workspace.notebooks} initialTemplateId={cs2NewDialog.templateId} onCreate={async (draft, template) => { const created = await createStudyFromSetup(draft, template); if (created) setCs2NewDialog(null); return created; }} onClose={async (dirty) => { if (!dirty || await confirm({ title: 'Discard this new study?', description: 'The title and notes you entered will be lost.', confirmLabel: 'Discard' })) setCs2NewDialog(null); }}/>}
      {cs2TemplateEdit && <PersonalTemplateDialog template={cs2TemplateEdit} onClose={() => setCs2TemplateEdit(null)} onSave={(fields) => { savePersonalTemplate(fields, cs2TemplateEdit.id || null); setCs2TemplateEdit(null); }}/>}
    </main>;
  }

  return <main className={`case-library case-library--phase-one${libraryView==='templates'?' case-library--templates':''}`}>
    {libraryView !== 'templates' && libraryView !== 'connections' && <header className="case-library__header">
      <div><p className="case-eyebrow">{profileName} · research workspace</p><h1>Case Study Library</h1><p>Explore setups, continue your research, and turn observations into tested playbooks.</p></div>
      <div className="case-header-actions"><button className="case-button case-button--quiet" onClick={() => setLibraryView('evidence')}><ImageIcon size={16}/>Evidence Library</button><button className="case-button case-button--quiet" onClick={() => setLibraryView('templates')}><LayoutTemplate size={16}/>Template Manager</button><div ref={headerMenuRoot} className="case-header-more"><button className="case-button case-button--quiet" aria-haspopup="menu" aria-expanded={headerMenuOpen} aria-controls="case-library-more-actions" onClick={()=>setHeaderMenuOpen(open=>!open)}><MoreHorizontal size={16}/>More</button>{headerMenuOpen&&<div id="case-library-more-actions" className="case-header-more__menu" role="menu"><button role="menuitem" onClick={()=>{setLibraryView('connections');setHeaderMenuOpen(false);}}><Link2 size={16}/>Connections Explorer</button><button role="menuitem" onClick={()=>{exportLibrary();setHeaderMenuOpen(false);}}><Download size={16}/>Export library</button><button role="menuitem" onClick={()=>{setRestoreDialog(true);setHeaderMenuOpen(false);}}>Restore library</button>{onUploadDeviceLibrary&&<button role="menuitem" onClick={()=>{onUploadDeviceLibrary();setHeaderMenuOpen(false);}}>{syncActionLabel}</button>}</div>}</div><button className="case-button case-button--primary" onClick={() => setScreen('create')}><Plus size={17}/>New Case Study</button></div>
    </header>}
    {syncConflict && <p className="case-sync-conflict" role="alert">Sync conflict: both device and cloud versions are preserved. Reconciliation is required before another cloud save.</p>}
    <div className="case-library-content case-library-content--prototype">
      {libraryView === 'connections' ? <CaseStudyConnectionsExplorer workspace={workspace} onBack={()=>setLibraryView('library')} onOpenStudy={openEditor}/> : libraryView === 'evidence' ? <EvidenceLibrary evidence={workspace.evidence} studies={studies} selectedEvidenceId={evidenceSelection} onAdd={(fields)=>addEvidence(fields)} onPatch={patchEvidence} onRemove={removeEvidence} onBack={()=>setLibraryView('library')}/> : libraryView === 'templates' ? <TemplateManager templates={TEMPLATES} personalTemplates={workspace.personalTemplates} onChoose={createStudy} onSave={savePersonalTemplate} onDuplicate={duplicateTemplate} onRemove={removeTemplate} onBack={()=>setLibraryView('library')}/> : <>
        <nav className="case-library-nav" aria-label="Case Study Library navigation">
          <div className="case-library-nav__collections"><button className={libraryView==='library'?'is-active':''} onClick={()=>{setLibraryView('library');updateSettings({notebook:'All'});}}><LibraryBig size={16}/>All studies <span>{studies.length}</span></button><button className={libraryView==='favorites'?'is-active':''} onClick={()=>setLibraryView('favorites')}><Star size={16}/>Favorites <span>{studies.filter(s=>s.favorite).length}</span></button><button className={libraryView==='pinned'?'is-active':''} onClick={()=>setLibraryView('pinned')}><Pin size={16}/>Pinned <span>{studies.filter(s=>s.pinned).length}</span></button><button className={libraryView==='archived'?'is-active':''} onClick={()=>setLibraryView('archived')}><Archive size={16}/>Archived <span>{archivedStudies.length}</span></button></div>
          <div className="case-library-nav__notebook"><NotebookTabs size={16}/><span>Notebook</span><CaseStudyDropdown id="case-study-notebook" label="Filter by notebook" value={workspace.settings.notebook} options={[{value:'All',label:'All notebooks'},...workspace.notebooks.map(notebook=>({value:notebook.id,label:notebook.name}))]} openId={libraryDropdown} setOpenId={setLibraryDropdown} align="end" onChange={(value)=>{setLibraryView('notebooks');updateSettings({notebook:value});}}/></div>
          <button className="case-library-nav__add" onClick={createNotebook}><Plus size={16}/>New notebook</button>
        </nav>
        {(libraryView === 'library' || libraryView === 'notebooks') && <div className="case-research-panels"><LibraryShelf title="Continue researching" subtitle="Pick up where you left off." studies={activeResearch} total={researchCandidates.length} emptyMessage="No unfinished studies are ready to continue." notebooks={workspace.notebooks} evidence={workspace.evidence} onOpen={openEditor} onViewAll={()=>{setLibraryView('library');updateSettings({status:'All',notebook:'All'});}}/><LibraryShelf title="Pinned playbooks" subtitle="Quick access to your key research." studies={pinnedPlaybooks} total={pinnedCandidates.length} emptyMessage="Pin a study to keep it within reach." notebooks={workspace.notebooks} evidence={workspace.evidence} onOpen={openEditor} onViewAll={()=>setLibraryView('pinned')} compact/></div>}
        <section className="case-library-all"><div className="case-library-all__heading"><div><h2>{libraryView === 'favorites' ? 'Favorites' : libraryView === 'pinned' ? 'Pinned playbooks' : libraryView === 'archived' ? 'Archived studies' : 'All studies'}</h2><p>{displayedStudies.length} study{displayedStudies.length===1?'':'ies'} shown</p></div></div>
        <section className="case-toolbar"><label className="case-search"><Search size={17}/><input value={workspace.settings.query} onChange={(event)=>updateSettings({query:event.target.value})} placeholder="Search studies, notes, and insights"/></label><CaseStudyDropdown id="case-study-status" label="Filter by status" value={workspace.settings.status} options={['All',...STATUSES].map(value=>({value,label:value}))} openId={libraryDropdown} setOpenId={setLibraryDropdown} onChange={(value)=>updateSettings({status:value})}/>{availableInstruments.length > 0 && <CaseStudyDropdown id="case-study-instrument" label="Filter by instrument" value={workspace.settings.instrument} options={['All',...availableInstruments].map(value=>({value,label:value}))} openId={libraryDropdown} setOpenId={setLibraryDropdown} onChange={(value)=>updateSettings({instrument:value})}/>} {availableTags.length > 0 && <CaseStudyDropdown id="case-study-tag" label="Filter by tag" value={workspace.settings.tag} options={['All',...availableTags].map(value=>({value,label:value}))} openId={libraryDropdown} setOpenId={setLibraryDropdown} onChange={(value)=>updateSettings({tag:value})}/>}<CaseStudyDropdown id="case-study-sort" label="Sort studies" value={sort} options={[{value:'recent',label:'Recently updated'},{value:'created',label:'Created date'},{value:'title',label:'Title A–Z'}]} openId={libraryDropdown} setOpenId={setLibraryDropdown} align="end" onChange={setSort}/><div className="case-view-toggle"><button aria-pressed={workspace.settings.view==='grid'} className={workspace.settings.view==='grid'?'is-active':''} onClick={()=>updateSettings({view:'grid'})}>Grid</button><button aria-pressed={workspace.settings.view==='list'} className={workspace.settings.view==='list'?'is-active':''} onClick={()=>updateSettings({view:'list'})}>List</button></div></section>
        <section className={`case-study-grid case-study-grid--${workspace.settings.view}`}>
          {displayedStudies.map((study)=><StudyCard key={study.id} view={workspace.settings.view} study={study} notebook={workspace.notebooks.find(n=>n.id===study.notebookId)} evidence={workspace.evidence} menuOpen={cardMenu===study.id} menuRootRef={cardMenu===study.id?cardMenuRoot:null} onMenu={()=>setCardMenu(cardMenu===study.id?null:study.id)} onOpen={()=>openEditor(study.id)} onPatch={(partial)=>patchStudy(study.id,partial)} onDuplicate={()=>{const copy={...study,id:uid('study'),title:`${studyTitle(study)} copy`,createdAt:now(),updatedAt:now(),revisionCount:1,pinned:false,archived:false};save({...workspace,studies:[copy,...workspace.studies]},true);}} onDelete={async()=>{if(await confirm({title:'Delete study?',description:`Delete “${studyTitle(study)}”? This cannot be undone.`,confirmLabel:'Delete study'})) save(removeConnectionsForCaseStudy({...workspace,studies:workspace.studies.filter(item=>item.id!==study.id)},study.id),true)}}/>) }
          {!displayedStudies.length && <div className="case-empty"><FileText size={30}/><h2>{libraryView==='archived'?'No archived studies':'No studies here yet'}</h2><p>{libraryView==='archived'?'Archived Case Studies stay here until you restore them to your active Library.':'Start with a template, then attach trades, markups, and evidence as you learn.'}</p>{libraryView!=='archived'&&<button className="case-button case-button--primary" onClick={()=>setScreen('create')}><Plus size={17}/>Create a study</button>}</div>}
        </section></section>
      </>}
    </div>
    {evidenceDialog && <EvidenceDialog onClose={()=>setEvidenceDialog(false)} onSave={(fields)=>addEvidence(fields,{linkToSelectedStudy:true})}/>} 
    {restoreDialog && <RestoreDialog onClose={()=>setRestoreDialog(false)} onImport={importLibrary}/>} 
  </main>;
}

export default function CaseStudyLibrary({ libraryState = { status:'ready', message:'' }, onRetryLoad = () => {}, profileName = 'Profile', temporaryNotice = '', syncStatus = '', onUploadDeviceLibrary = null, syncActionLabel='Upload device library', syncConflict = null, ...props }) {
  // Do not mount editable controls from an unconfirmed, failed, or recovery-only
  // load. This keeps every mutation path unreachable until the parent confirms
  // an authoritative library response.
  if (libraryState.status === 'loading') return <CaseStudyLoadingShell profileName={profileName}/>;
  if (libraryState.status === 'recovery') return <CaseStudyRecoveryLibrary workspace={libraryState.workspace} libraryState={libraryState} profileName={profileName} onRetryLoad={onRetryLoad}/>;
  if (libraryState.status !== 'ready') return <CaseStudyLoadState libraryState={libraryState} profileName={profileName} onRetryLoad={onRetryLoad}/>;
  return <Cs2Feedback><CaseStudyLibraryReady {...props} profileName={profileName} temporaryNotice={temporaryNotice} syncStatus={syncStatus} onUploadDeviceLibrary={onUploadDeviceLibrary} syncActionLabel={syncActionLabel} syncConflict={syncConflict}/></Cs2Feedback>;
}

function StudyCard({view='grid',study,notebook,evidence = [],onOpen,onPatch,onDuplicate,onDelete,onMenu,menuOpen,menuRootRef}) {
  const favorite=!!study.favorite;
  const toggleFavorite=event=>{event.stopPropagation();onPatch({favorite:!favorite});};
  const actions=<StudyCardActions favorite={favorite} onToggle={toggleFavorite} onMenu={onMenu} menuOpen={menuOpen} menuRootRef={menuRootRef} study={study} onPatch={onPatch} onDuplicate={onDuplicate} onDelete={onDelete}/>;
  if(view==='list') return <article className="case-study-card case-study-list-card" onClick={onOpen}>
    <div className="case-study-list-card__thumbnail"><StudyCover study={study} evidence={evidence} notebook={notebook}/></div>
    <div className="case-study-list-card__information"><div className="case-study-list-card__meta"><span>{notebook?.name || 'Notebook'}</span><span className={`case-status case-status--${study.status.toLowerCase().replaceAll(' ','-')}`}>{study.status}</span></div><h2>{studyTitle(study)}</h2><p>{study.body?.trim() || 'Open this study to start writing.'}</p><div className="case-card-tags"><span>{(study.tradeIds||[]).length} trades</span><span>{(study.markupIds||[]).length} markups</span><span>{(study.evidenceIds||[]).length} evidence</span></div><footer><span><Clock3 size={13}/>{dateLabel(study.updatedAt)}</span>{study.pinned && <Pin size={14}/>}</footer></div>
    <div className="case-study-list-card__action-column">{actions}</div>
  </article>;
  return <article className="case-study-card" onClick={onOpen}><div className="case-study-card__preview"><StudyCover study={study} evidence={evidence} notebook={notebook}/><span className={`case-status case-status--${study.status.toLowerCase().replaceAll(' ','-')}`}>{study.status}</span></div><div className="case-study-card__top"><span>{notebook?.name || 'Notebook'}</span>{actions}</div><h2>{studyTitle(study)}</h2><p>{study.body?.trim() || 'Open this study to start writing.'}</p><div className="case-card-tags"><span>{(study.tradeIds||[]).length} trades</span><span>{(study.markupIds||[]).length} markups</span><span>{(study.evidenceIds||[]).length} evidence</span></div><footer><span><Clock3 size={13}/>{dateLabel(study.updatedAt)}</span>{study.pinned && <Pin size={14}/>}</footer></article>;
}
function StudyCardActions({favorite,onToggle,onMenu,menuOpen,menuRootRef,study,onPatch,onDuplicate,onDelete}) {
  const menuId=`case-study-menu-${study.id}`;
  const runAction=(action)=>event=>{event.stopPropagation();action();onMenu();};
  return <div ref={menuRootRef} className="case-study-card__actions"><button type="button" className={`case-study-card__favorite${favorite?' is-favorite':''}`} aria-label={favorite?'Remove from favorites':'Add to favorites'} aria-pressed={favorite} onClick={onToggle}><Star size={17} fill={favorite?'currentColor':'none'}/></button><button type="button" aria-label="Study menu" aria-haspopup="menu" aria-expanded={menuOpen} aria-controls={menuId} onClick={event=>{event.stopPropagation();onMenu();}}><MoreHorizontal size={17}/></button>{menuOpen&&<div id={menuId} className="case-card-menu" role="menu" onClick={event=>event.stopPropagation()}><button type="button" role="menuitem" className={favorite?'is-favorite':''} aria-pressed={favorite} onClick={event=>{onToggle(event);onMenu();}}><Star size={15} fill={favorite?'currentColor':'none'}/>{favorite?'Remove favorite':'Favorite'}</button><button type="button" role="menuitem" onClick={runAction(()=>onPatch({pinned:!study.pinned}))}><Pin size={15}/>{study.pinned?'Unpin':'Pin playbook'}</button><button type="button" role="menuitem" onClick={runAction(onDuplicate)}><Copy size={15}/>Duplicate</button>{study.archived?<button type="button" role="menuitem" onClick={runAction(()=>onPatch({archived:false}))}><Archive size={15}/>Restore to Library</button>:<button type="button" role="menuitem" onClick={runAction(()=>onPatch({archived:true}))}><Archive size={15}/>Archive</button>}<button type="button" role="menuitem" className="is-danger" onClick={runAction(onDelete)}><Trash2 size={15}/>Delete</button></div>}</div>;
}
function LibraryShelf({title,subtitle,studies,total=studies.length,emptyMessage,notebooks,evidence = [],onOpen,onViewAll,compact=false}) { return <section className={`case-shelf ${compact?'case-shelf--compact':''}`}><div className="case-shelf__heading"><div><h2>{title}</h2><p>{subtitle}</p></div>{total > studies.length&&<button className="case-button case-button--quiet" onClick={onViewAll}>View all</button>}</div><div className={`case-shelf__items ${!studies.length?'is-empty':''}`}>{studies.length ? studies.map(study=>{const notebook=notebooks.find(item=>item.id===study.notebookId);return <button key={study.id} onClick={()=>onOpen(study.id)}><div className="case-shelf__preview" aria-hidden="true"><StudyCover study={study} evidence={evidence} notebook={notebook} compact/></div><div className="case-shelf__copy"><strong>{studyTitle(study)}</strong><small>{notebook?.name || 'Notebook'} · Updated {dateLabel(study.updatedAt)}</small></div><span><i className={`case-status case-status--${study.status.toLowerCase().replaceAll(' ','-')}`}>{study.status}</i>{study.pinned&&<Pin size={13} aria-label="Pinned"/>}</span></button>;}) : <p className="case-shelf__empty"><BookOpen size={17}/>{emptyMessage}</p>}</div></section>; }
function StudyCover({study,evidence,notebook,compact=false}) { const cover=resolveCaseStudyCover(study,evidence); const source=evidenceImageReference(cover); const image=useEvidenceImageUrl(source); const [failed,setFailed]=useState(false); useEffect(()=>setFailed(false),[source,image.url]); if(!cover || !image.url || failed) return <><BookOpen size={compact?17:28}/>{!compact&&<span>{notebook?.name || 'Study'}</span>}</>; return <img src={image.url} alt="" onError={()=>setFailed(true)}/>; }
function EvidenceImage({item,alt='',className=''}) { const image=useEvidenceImageUrl(evidenceImageReference(item)); if(!image.url)return <div className={`case-evidence-image-placeholder ${className}`}>{image.loading?'Loading image…':<ImageIcon size={22}/>}</div>; return <img className={className} src={image.url} alt={alt} onError={event=>{event.currentTarget.style.display='none';}}/>; }
function EvidenceLibrary({evidence,studies,selectedEvidenceId=null,onAdd,onPatch,onRemove,onBack}) {
  const [query,setQuery]=useState(''),[kind,setKind]=useState('All'),[sort,setSort]=useState('recent'),[view,setView]=useState('grid'),[selectedId,setSelectedId]=useState(evidence[0]?.id||null),[uploadOpen,setUploadOpen]=useState(false);
  useEffect(()=>{if(!evidence.some(item=>item.id===selectedId))setSelectedId(evidence[0]?.id||null);},[evidence,selectedId]);
  useEffect(()=>{if(selectedEvidenceId&&evidence.some(item=>item.id===selectedEvidenceId))setSelectedId(selectedEvidenceId);},[selectedEvidenceId,evidence]);
  const filtered=evidence.filter(item=>{const haystack=[item.title,item.source,item.notes,item.kind,...(item.tags||[])].join(' ').toLowerCase();return (kind==='All'||(item.kind||'Reference')===kind)&&haystack.includes(query.toLowerCase());}).sort((a,b)=>sort==='title'?String(a.title).localeCompare(String(b.title)):sort==='oldest'?String(a.createdAt).localeCompare(String(b.createdAt)):String(b.updatedAt||b.createdAt).localeCompare(String(a.updatedAt||a.createdAt)));
  const selected=evidence.find(item=>item.id===selectedId)||filtered[0]; const related=selected?studies.filter(study=>(study.evidenceIds||[]).includes(selected.id)):[];
  return <section className="case-evidence-library">
    <header className="case-v2-resource__head"><button className="case-back" onClick={onBack}><ArrowLeft size={16}/>Library</button><div><p className="case-eyebrow">Research sourcebook</p><h2>Evidence Library</h2><p>Store image evidence once and reuse it across research without duplicating the source.</p></div><button className="case-button case-button--primary" onClick={()=>setUploadOpen(true)}><Plus size={16}/>Upload evidence</button></header>
    <section className="case-evidence-toolbar"><label className="case-search"><Search size={16}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search title, tag, or source"/></label><select aria-label="Filter evidence" value={kind} onChange={event=>setKind(event.target.value)}>{['All','Chart','Screenshot','Reference'].map(value=><option key={value}>{value}</option>)}</select><select aria-label="Sort evidence" value={sort} onChange={event=>setSort(event.target.value)}><option value="recent">Recently added</option><option value="oldest">Oldest first</option><option value="title">Title A–Z</option></select><div className="case-view-toggle"><button type="button" className={view==='grid'?'is-active':''} aria-pressed={view==='grid'} onClick={()=>setView('grid')}>Grid</button><button type="button" className={view==='list'?'is-active':''} aria-pressed={view==='list'} onClick={()=>setView('list')}>List</button></div></section>
    {!evidence.length?<div className="case-empty"><ImageIcon size={30}/><h2>No evidence saved</h2><p>Upload charts, screenshots, or reference images to make them reusable in any Case Study.</p><button className="case-button case-button--primary" onClick={()=>setUploadOpen(true)}><Plus size={16}/>Add evidence</button></div>:<div className="case-evidence-layout"><section className={`case-evidence-gallery case-evidence-gallery--${view}`} aria-label="Evidence gallery">{filtered.length?filtered.map(item=><button type="button" key={item.id} className={selected?.id===item.id?'is-selected':''} onClick={()=>setSelectedId(item.id)}><EvidenceImage item={item} className="case-evidence-card__image"/><span><strong>{item.title||'Untitled evidence'}</strong><small>{item.tags?.join(' · ')||item.kind||'Reference'}</small><em>{studies.filter(study=>(study.evidenceIds||[]).includes(item.id)).length} studies</em></span></button>):<div className="case-empty"><Search size={24}/><h2>No matching evidence</h2><p>Try another search, filter, or upload a new image.</p></div>}</section>{selected&&<EvidenceDetails evidence={selected} related={related} onPatch={onPatch} onRemove={onRemove}/>}</div>}
    {uploadOpen&&<EvidenceDialog onClose={()=>setUploadOpen(false)} onSave={async fields=>{await onAdd(fields);setUploadOpen(false);}}/>}
  </section>;
}
function EvidenceDetails({evidence,related,onPatch,onRemove}) { const [tags,setTags]=useState((evidence.tags||[]).join(', ')); const image=useEvidenceImageUrl(evidenceImageReference(evidence)); useEffect(()=>setTags((evidence.tags||[]).join(', ')),[evidence.id]); return <aside className="case-evidence-details"><div className="case-evidence-details__preview">{image.url?<img src={image.url} alt={evidence.title}/>:<ImageIcon size={42}/>}</div><label>Title<input value={evidence.title||''} onChange={event=>onPatch(evidence.id,{title:event.target.value})}/></label><label>Source<input value={evidence.source||''} onChange={event=>onPatch(evidence.id,{source:event.target.value})} placeholder="Source or URL"/></label><label>Tags<input value={tags} onChange={event=>setTags(event.target.value)} onBlur={()=>onPatch(evidence.id,{tags:tags.split(',').map(tag=>tag.trim()).filter(Boolean)})} placeholder="EUR/USD, liquidity"/></label><label>Research notes<textarea value={evidence.notes||''} onChange={event=>onPatch(evidence.id,{notes:event.target.value})} placeholder="What does this support or challenge?"/></label><section className="case-v2-reference-list"><h3>Linked Case Studies · {related.length}</h3>{related.length?related.map(study=><div key={study.id}><FileText size={15}/><span>{studyTitle(study)}</span><small>{study.status}</small></div>):<p>Link this shared item from a Case Study’s Evidence tab.</p>}</section><footer><span>Uploaded {dateLabel(evidence.createdAt)}</span><button className="case-button case-button--danger" onClick={()=>onRemove(evidence.id)}><Trash2 size={15}/>Delete</button></footer></aside>; }
function TemplateManager({templates,personalTemplates,onChoose,onSave,onDuplicate,onRemove,onBack}) {
  const [scope,setScope]=useState('All');
  const [query,setQuery]=useState('');
  const [selectedId,setSelectedId]=useState(templates[0]?.id||'');
  const [editing,setEditing]=useState(null);
  const all=useMemo(()=>[...templates.map(template=>({...template,scope:'Built-in'})),...personalTemplates.map(template=>({...template,scope:'Personal'}))],[templates,personalTemplates]);
  const items=all.filter(template=>(scope==='All'||template.scope===scope)&&[template.name,template.description,...templateSectionNames(template)].join(' ').toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const selected=items.find(template=>template.id===selectedId)||all.find(template=>template.id===selectedId)||items[0]||null;
  useEffect(()=>{if(selected&&!items.some(template=>template.id===selected.id))setSelectedId(items[0]?.id||'');},[items,selected]);
  const beginPersonal=()=>setEditing({sections:['Overview']});
return <section className="case-v2-templates"><header className="case-v2-resource__head"><button className="case-back" onClick={onBack}><ArrowLeft size={16}/>Library</button><div><p className="case-eyebrow">Start with a proven structure</p><h1>Template Manager</h1><p>Built-ins are protected. Personal edits affect only future studies.</p></div><button className="case-button case-button--primary" onClick={beginPersonal}><Plus size={16}/>New template</button></header><div className="case-v2-template-layout"><aside className="case-v2-template-library"><div className="case-v2-template-library__head"><strong>Template library</strong></div><label className="case-search"><Search size={16}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search templates"/></label><div className="case-v2-template-tabs" role="tablist" aria-label="Template filters">{[['All','All templates'],['Built-in','Built-in'],['Personal','My templates']].map(([value,label])=><button type="button" role="tab" aria-selected={scope===value} key={value} className={scope===value?'is-active':''} onClick={()=>setScope(value)}>{label} <span>{value==='All'?all.length:all.filter(template=>template.scope===value).length}</span></button>)}</div><div className="case-v2-template-list">{items.map(template=><button type="button" key={template.id} className={selected?.id===template.id?'is-active':''} onClick={()=>setSelectedId(template.id)}><FileText size={17}/><span><strong>{template.name}</strong><small>{template.description||`${templateSectionNames(template).length} sections`}</small></span><em>{template.scope}</em></button>)}{!items.length&&<p className="case-v2-template-empty">No templates match this view.</p>}</div></aside>{selected&&<article className="case-v2-template-preview"><p className="case-eyebrow">{selected.scope} template</p><h2>{selected.name}</h2><p>{selected.description}</p><ol>{templateSectionNames(selected).map((section,index)=><li key={`${section}-${index}`}><span>{String(index+1).padStart(2,'0')}</span><div><strong>{section}</strong>{selected.guidance?.[section]&&<small>{selected.guidance[section]}</small>}</div></li>)}</ol><div className="case-template-actions"><button className="case-button case-button--primary" onClick={()=>onChoose(selected)}><Plus size={16}/>Use template</button><button className="case-button case-button--quiet" onClick={()=>onDuplicate(selected)}>Duplicate template</button>{selected.scope==='Personal'&&<><button className="case-button case-button--quiet" onClick={()=>setEditing(selected)}>Edit template</button><button className="case-button case-button--danger" onClick={()=>onRemove(selected.id)}>Delete template</button></>}</div></article>}{!selected&&<article className="case-empty"><LayoutTemplate size={30}/><h2>No template selected</h2><p>Choose a template or create your own structure.</p></article>}</div>{editing&&<PersonalTemplateDialog template={editing} onClose={()=>setEditing(null)} onSave={(fields)=>{onSave(fields,editing.id);setEditing(null)}}/>}</section>;
}
function EvidenceDialog({onClose,onSave}) {
  const [fields,setFields]=useState({title:'',kind:'Chart',source:'',url:'',notes:'',tags:''});
  const [files,setFiles]=useState([]);
  const [error,setError]=useState('');
  const [saving,setSaving]=useState(false);
  const savingRef=useRef(false);
  const fileInput=useRef(null);
  const previewUrls=useRef(new Set());
  useEffect(()=>()=>{previewUrls.current.forEach(url=>URL.revokeObjectURL(url));},[]);
  const patch=(key,value)=>setFields(current=>({...current,[key]:value}));
  const removeFile=id=>setFiles(current=>{
    const removed=current.find(item=>item.id===id);
    if(removed){URL.revokeObjectURL(removed.preview);previewUrls.current.delete(removed.preview);}
    return current.filter(item=>item.id!==id);
  });
  const addFiles=next=>{
    const selected=[...next];
    const rejected=selected.find(file=>validateEvidenceImage(file));
    const accepted=selected.filter(file=>!validateEvidenceImage(file)).map(file=>{
      const preview=URL.createObjectURL(file); previewUrls.current.add(preview);
      return {id:uid('evidence-file'),file,preview};
    });
    if(accepted.length)setFiles(current=>[...current,...accepted]);
    setError(rejected?validateEvidenceImage(rejected):'');
  };
  const submit=async event=>{
    event.preventDefault();
    if(savingRef.current)return;
    savingRef.current=true;
    setError('');setSaving(true);
    try{
      if(!files.length&&!fields.url.trim()&&!fields.source.trim())throw new Error('Attach one or more images, or provide a source URL.');
      await onSave({...fields,files:files.map(item=>item.file),tags:fields.tags.split(',').map(tag=>tag.trim()).filter(Boolean)});
    }catch(reason){
      setError(reason.message||'Evidence could not be saved. Your files and details are still here to retry.');
      savingRef.current=false;
      setSaving(false);
    }
  };
  return <div className="case-dialog-backdrop"><form className="case-form-dialog case-evidence-upload" onSubmit={submit} onPaste={event=>{const images=[...(event.clipboardData?.files||[])].filter(file=>file.type.startsWith('image/'));if(images.length){event.preventDefault();addFiles(images);}}}><button type="button" className="case-close" onClick={onClose}><X size={18}/></button><p className="case-eyebrow">Shared evidence</p><h2>Upload evidence</h2><label>Title <small>Optional for multiple uploads</small><input autoFocus value={fields.title} onChange={event=>patch('title',event.target.value)} placeholder="e.g. London sweep, 15m"/></label><input ref={fileInput} hidden type="file" multiple accept="image/png,image/jpeg,image/webp" onChange={event=>addFiles(event.target.files||[])}/><button type="button" className="case-evidence-dropzone" onClick={()=>fileInput.current?.click()} onDragOver={event=>event.preventDefault()} onDrop={event=>{event.preventDefault();addFiles(event.dataTransfer.files||[]);}}><ImageIcon size={23}/><strong>Drop images here or choose files</strong><span>Paste from clipboard also works · PNG, JPEG, or WebP · 3 MB each</span></button>{files.length>0&&<ul className="case-evidence-upload-list">{files.map(({id,file,preview})=><li key={id}><img src={preview} alt="Selected evidence preview"/><span><strong>{file.name}</strong><small>{Math.ceil(file.size/1024)} KB</small></span><button type="button" onClick={()=>removeFile(id)}>Remove</button></li>)}</ul>}<label>Or image URL<input value={fields.url} onChange={event=>patch('url',event.target.value)} placeholder="https://…png"/></label><label>Source<input value={fields.source} onChange={event=>patch('source',event.target.value)} placeholder="Optional source"/></label><label>Tags<input value={fields.tags} onChange={event=>patch('tags',event.target.value)} placeholder="EUR/USD, M15"/></label><label>Research notes<textarea value={fields.notes} onChange={event=>patch('notes',event.target.value)} placeholder="What does this evidence support or challenge?"/></label>{error&&<p className="case-form-error" role="alert">{error}</p>}<footer><button type="button" className="case-button case-button--quiet" onClick={onClose}>Cancel</button><button disabled={saving} className="case-button case-button--primary">{saving?'Saving evidence…':files.length>1?`Save ${files.length} images`:'Save evidence'}</button></footer></form></div>;
}
const templateEditorRows=template=>{
  const source=templateSections(template);
  const sections=source.length ? source : [{id:'overview',title:'Overview',guidance:''}];
  return sections.map((section,index)=>({id:section.id || `template-section-${template?.id || 'new'}-${index}-${uid('row')}`,title:section.title,guidance:section.guidance || template?.guidance?.[section.title] || ''}));
};

export function PersonalTemplateDialog({template,onClose,onSave}) {
  const confirm=useConfirmation();
  const [name,setName]=useState(template.name||'');
  const [description,setDescription]=useState(template.description||'');
  const [sections,setSections]=useState(()=>templateEditorRows(template));
  const sectionInputs=useRef({});
  const [focusSectionId,setFocusSectionId]=useState(null);
  const initial=useRef(null);
  if(initial.current===null) initial.current=JSON.stringify({name,description,sections});
  useEffect(()=>{if(!focusSectionId)return;sectionInputs.current[focusSectionId]?.focus();setFocusSectionId(null);},[focusSectionId]);
  const patchSection=(id,partial)=>setSections(current=>current.map(section=>section.id===id?{...section,...partial}:section));
  const moveSection=(index,direction)=>setSections(current=>{const next=[...current];const target=index+direction;if(target<0||target>=next.length)return current;[next[index],next[target]]=[next[target],next[index]];return next;});
  const addSection=()=>{const next={id:uid('template-section'),title:'',guidance:''};setSections(current=>[...current,next]);setFocusSectionId(next.id);};
  const save=()=>{const titles=sections.map(section=>section.title.trim()).filter(Boolean);const guidance=Object.fromEntries(sections.map(section=>[section.title.trim(),section.guidance.trim()]).filter(([title,guidance])=>title&&guidance));onSave({name,description,sections:titles,guidance});};
  const requestClose=async()=>{const changed=initial.current!==JSON.stringify({name,description,sections});if(!changed||await confirm({title:'Discard template changes?',description:'Your unsaved template edits will be lost.',confirmLabel:'Discard changes',tone:'danger'}))onClose();};
  return <div className="case-dialog-backdrop"><form className="case-form-dialog case-template-dialog" onSubmit={event=>{event.preventDefault();save();}}><button type="button" className="case-close" onClick={requestClose}><X size={18}/></button><p className="case-eyebrow">Personal template</p><h2>{template.id?'Edit template':'New template'}</h2><label>Name<input autoFocus required value={name} onChange={event=>setName(event.target.value)} placeholder="e.g. London sweep study"/></label><label>Description<input value={description} onChange={event=>setDescription(event.target.value)} placeholder="What this structure is for"/></label><fieldset><legend>Sections</legend><p>Add the writing sections new studies should start with. Existing studies are never changed.</p>{sections.map((section,index)=><div className="case-template-section-row" key={section.id}><input ref={node=>{sectionInputs.current[section.id]=node;}} aria-label={`Section ${index+1}`} required value={section.title} onChange={event=>patchSection(section.id,{title:event.target.value})} placeholder="Section title"/><input aria-label={`Guidance for ${section.title || `section ${index+1}`}`} value={section.guidance} onChange={event=>patchSection(section.id,{guidance:event.target.value})} placeholder="Optional guidance"/><button type="button" aria-label="Move section up" disabled={index===0} onClick={()=>moveSection(index,-1)}>↑</button><button type="button" aria-label="Move section down" disabled={index===sections.length-1} onClick={()=>moveSection(index,1)}>↓</button><button type="button" aria-label="Remove section" disabled={sections.length===1} onClick={()=>setSections(current=>current.filter(item=>item.id!==section.id))}>Remove</button></div>)}<button type="button" className="case-button case-button--quiet" onClick={addSection}><Plus size={15}/>Add section</button></fieldset><footer><button type="button" className="case-button case-button--quiet" onClick={requestClose}>Cancel</button><button className="case-button case-button--primary">Save template</button></footer></form></div>;
}

function ApplyTemplateDialog({study,templates,onClose,onApply}) {
  const [selectedId,setSelectedId]=useState(templates[0]?.id||'');
  const [templateDropdown,setTemplateDropdown]=useState(null);
  const selected=templates.find(template=>template.id===selectedId)||templates[0];
  const existing=new Set((study.sections||[]).map(section=>String(section).trim().toLocaleLowerCase()));
  const additions=templateSectionNames(selected).filter(section=>!existing.has(section.toLocaleLowerCase()));
  return <div className="case-dialog-backdrop"><section className="case-form-dialog case-template-apply" role="dialog" aria-modal="true" aria-labelledby="apply-template-title"><button type="button" className="case-close" onClick={onClose}><X size={18}/></button><p className="case-eyebrow">Extend this study</p><h2 id="apply-template-title">Apply template</h2><p>Only sections that are not already present will be added. Notes, evidence, review answers, and existing section content remain unchanged.</p><label>Template<CaseStudyDropdown id="case-study-apply-template" label="Choose a template" value={selected?.id||''} options={templates.map(template=>({value:template.id,label:`${template.name}${template.scope==='Personal'?' · Personal':''}`}))} openId={templateDropdown} setOpenId={setTemplateDropdown} align="end" onChange={setSelectedId}/></label>{selected&&<><h3>{selected.name}</h3><p className="case-template-description">{selected.description}</p><ol className="case-template-apply__sections">{templateSectionNames(selected).map((section,index)=><li key={`${section}-${index}`} className={existing.has(section.toLocaleLowerCase())?'is-existing':''}><span>{existing.has(section.toLocaleLowerCase())?'Already present':'Will add'}</span>{section}</li>)}</ol></>}<footer><button type="button" className="case-button case-button--quiet" onClick={onClose}>Cancel</button><button type="button" className="case-button case-button--primary" disabled={!additions.length} onClick={()=>selected&&onApply(selected)}>{additions.length ? `Add ${additions.length} section${additions.length===1?'':'s'}` : 'No new sections'}</button></footer></section></div>;
}
function RestoreDialog({onClose,onImport}) { const [file,setFile]=useState(null); const [conflict,setConflict]=useState('copy'); return <div className="case-dialog-backdrop"><form className="case-form-dialog" onSubmit={e=>{e.preventDefault();if(file)onImport(file,conflict)}}><button type="button" className="case-close" onClick={onClose}><X size={18}/></button><p className="case-eyebrow">Case Study Library backup</p><h2>Restore library data</h2><p>Import adds missing items. Matching IDs become copies by default, protecting current work.</p><label>Backup file<input type="file" accept="application/json" required onChange={e=>setFile(e.target.files?.[0])}/></label><label>Matching IDs<select value={conflict} onChange={e=>setConflict(e.target.value)}><option value="copy">Keep both as copies (safe)</option><option value="replace">Replace matching library items</option></select></label><footer><button type="button" className="case-button case-button--quiet" onClick={onClose}>Cancel</button><button className="case-button case-button--primary">Import library</button></footer></form></div>; }
function ReviewWorkspace({study,linkedEvidence,onOpenViewer,onUpdate,saveState,initialStep=0,onStepChange=()=>{}}) {
  const [step,setStep] = useState(initialStep);
  const focusRefs = useRef({});
  const review = normaliseCaseStudyReview(study.review);
  const readiness = reviewReadiness(review);
  useEffect(()=>setStep(initialStep),[study.id,initialStep]);
  useEffect(()=>onStepChange(step),[step]);
  const update = patch => onUpdate(current => patchStudyReview(current,patch,now()));
  const goTo = (next, field) => { setStep(next); requestAnimationFrame(()=>focusRefs.current[field]?.focus({preventScroll:true})); };
  const validate = () => { if (readiness.ready) onUpdate(current => ({...patchStudyReview(current,{},now()),status:'Validated',validation:{...(current.validation||{}),validatedAt:now(),summary:review.conclusion}})); };
  const content = [
    <><p className="csr-note">Assess the original idea from the evidence you collected. Selecting an assessment never removes your explanation.</p><p className="csr-label">What is your assessment?</p><div className="csr-assessment">{[['Supported','Evidence generally agrees with the hypothesis'],['Inconclusive','Not enough clarity to decide yet'],['Not Supported','Evidence contradicts the hypothesis']].map(([value,detail])=><button key={value} type="button" className={review.assessment===value?'is-selected':''} onClick={()=>update({assessment:value})}><strong>{value}</strong><small>{detail}</small></button>)}</div><label className="csr-field"><strong>Assessment Explanation</strong><small>Explain why the evidence supports, contradicts, or does not conclusively establish your hypothesis.</small><textarea ref={node=>{focusRefs.current.explanation=node;}} value={review.explanation} onChange={event=>update({explanation:event.target.value})} placeholder="Explain why you reached this assessment. What did the research show?"/></label></>,
    <><p className="csr-note">Classify linked evidence for this study. These notes belong only to this Case Study and never change the shared source.</p>{linkedEvidence.length?<div className="csr-evidence">{linkedEvidence.map(item=>{const value=review.evidence[item.id]||{};const classify=classification=>update({evidence:{...review.evidence,[item.id]:{...value,classification}}});return <article key={item.id}><header><div><strong>{item.title}</strong><small>{value.classification||'Not classified'}</small></div><button type="button" className="csr-open-viewer" onClick={()=>onOpenViewer(item.id)}>Open viewer</button></header><button className="csr-evidence-image" type="button" onClick={()=>onOpenViewer(item.id)} aria-label={`Open ${item.title} in Chart Viewer`}><EvidenceImage item={item} alt={item.title}/></button><div className="csr-evidence-body"><span>Classification</span><div className="csr-classification" role="group" aria-label={`Classify ${item.title}`}>{['Supporting','Contradicting','Neutral'].map(classification=><button key={classification} type="button" className={value.classification===classification?'is-selected':''} aria-pressed={value.classification===classification} onClick={()=>classify(classification)}>{classification}</button>)}</div><label>Observation<textarea value={value.observation||''} onChange={event=>update({evidence:{...review.evidence,[item.id]:{...value,observation:event.target.value}}})} placeholder="What does this chart suggest?"/></label></div></article>;})}</div>:<div className="csr-empty"><ImageIcon size={24}/><strong>No linked evidence yet</strong><p>Link evidence in the Evidence panel when it is useful. Validation does not require a fixed number of charts.</p></div>}</>,
    <><p className="csr-note">A sound conclusion acknowledges conditions, sample limitations, and research that is still needed.</p><label className="csr-field"><strong>Limitations and uncertainties</strong><textarea value={review.limitations} onChange={event=>update({limitations:event.target.value})} placeholder="What could make this conclusion unreliable?"/></label><label className="csr-field"><strong>Lessons learned</strong><textarea value={review.lessons} onChange={event=>update({lessons:event.target.value})} placeholder="What did this research teach you?"/></label><label className="csr-field"><strong>Further testing or research needed</strong><textarea value={review.nextSteps} onChange={event=>update({nextSteps:event.target.value})} placeholder="What will you test or improve next?"/></label></>,
    <><p className="csr-note">Summarize what was discovered, whether the hypothesis was supported, what the evidence suggests, how this affects the strategy, and what remains uncertain.</p><label className="csr-field"><strong>Conclusion</strong><textarea ref={node=>{focusRefs.current.conclusion=node;}} className="csr-conclusion" value={review.conclusion} onChange={event=>update({conclusion:event.target.value})} placeholder="My research suggests that… This holds under… The main limitation is…"/></label><section className="csr-summary"><strong>Review summary</strong><p>Hypothesis: <b>{review.assessment||'Not selected'}</b></p><p>Evidence classified: <b>{linkedEvidence.filter(item=>review.evidence[item.id]?.classification).length} of {linkedEvidence.length}</b></p><p>Conclusion: <b>{readiness.checks[2].complete?'Recorded':'Not written'}</b></p></section></>,
  ][step];
  return <section className="csr" aria-label="Review and Validation"><header className="csr-hero"><div><p className="case-eyebrow">Research workspace / Phase 6</p><h2>Review &amp; Validation</h2><p>Evaluate your trading hypothesis, weigh the chart evidence, and record a conclusion you can revisit.</p></div><span className={`csr-status ${study.status==='Validated'?'is-validated':''}`}>{study.status==='Validated'?'Validated':'Needs validation'}</span></header><div className="csr-layout"><nav className="csr-steps" aria-label="Review workflow"><p>Review workflow</p>{REVIEW_STEPS.map((item,index)=>{const completed=index===0?readiness.checks[0].complete&&readiness.checks[1].complete:index===3?readiness.checks[2].complete:index===1?linkedEvidence.some(e=>review.evidence[e.id]?.classification):!!(review.limitations||review.lessons||review.nextSteps);return <button key={item.id} className={step===index?'is-active':''} onClick={()=>setStep(index)}><span>{completed?'✓':String(index+1).padStart(2,'0')}</span><div><strong>{item.title}</strong><small>{item.description}</small></div></button>;})}<footer><span>Validation readiness</span><b>{readiness.percentage}%</b><i><em style={{width:`${readiness.percentage}%`}}/></i><small>A clear assessment and conclusion are required to validate.</small></footer></nav><main className="csr-sheet"><header><p>STEP {String(step+1).padStart(2,'0')} / 04</p><h3>{REVIEW_STEPS[step].heading}</h3><span>{REVIEW_STEPS[step].helper}</span></header><div className="csr-content">{content}</div><footer><span>{saveState}</span><div><button disabled={step===0} onClick={()=>setStep(value=>value-1)}>Previous</button><button disabled={step===REVIEW_STEPS.length-1} onClick={()=>setStep(value=>value+1)}>Next</button></div></footer></main><aside className="csr-readiness"><h3>Validation readiness</h3><p>Complete the core reasoning before validating your study. This is a quality check, not a score.</p>{readiness.checks.map(check=><button key={check.id} className={check.complete?'is-complete':''} onClick={()=>goTo(check.step,check.id==='reasoning'?'explanation':check.id==='conclusion'?'conclusion':'explanation')}><span>{check.complete?'✓':'○'}</span><div><strong>{check.label}</strong><small>{check.complete?'Complete':check.detail}</small></div></button>)}<section><strong>{study.status==='Validated'?'Study validated':readiness.ready?'Ready to validate':'Review in progress'}</strong><p>{readiness.ready?'The required reasoning is complete. You can validate this study.':`Missing: ${readiness.checks.filter(check=>!check.complete).map(check=>check.label.toLowerCase()).join(', ')}.`}</p><button className="case-button case-button--primary" disabled={!readiness.ready||study.status==='Validated'} onClick={validate}>Mark validated</button>{study.status==='Validated'&&<button className="case-button case-button--quiet" onClick={()=>onUpdate({status:'Researching'})}>Return to researching</button>}</section></aside></div></section>;
}
function NewCaseStudyWorkspace({templates,notebooks,saveState,onCreate,onBack,onOpenTemplates}) {
  const confirm=useConfirmation();
  const initial=useMemo(() => initialCaseStudyDraft({notebooks,templates}), [notebooks,templates]);
  const [draft,setDraft]=useState(initial);
  const [error,setError]=useState('');
  const [saving,setSaving]=useState(false);
  const draftId=useRef(uid('study'));
  const selected=templates.find((template)=>template.id===draft.templateId) || templates[0];
  const dirty=hasCaseStudyDraftChanges(draft,initial);
  const patch=(key,value)=>{setDraft((current)=>({...current,[key]:value}));setError('');};
  const leave=async(next)=>{if(dirty&&!await confirm({title:'Discard new Case Study?',description:'Your setup details have not been saved. Discard this draft and leave the workspace?',confirmLabel:'Discard draft',tone:'danger'}))return;next();};
  const submit=async(event)=>{event.preventDefault();const validation=caseStudyDraftError(draft);if(validation){setError(validation);return;}if(!selected){setError('Choose a template before creating the draft.');return;}setSaving(true);const created=await onCreate(draft,selected,draftId.current);if(!created){setError('The draft could not be saved. Your setup remains here so you can try again.');setSaving(false);}};
  return <main className="case-study-create">
    <header className="case-study-create__header"><button className="case-back" onClick={()=>leave(onBack)}><ArrowLeft size={16}/>Back to Library</button><div><p className="case-eyebrow">Create research</p><h1>New Case Study</h1><p>Start with a focused question and a structure you can develop into a repeatable playbook.</p></div><span className="case-save-state"><Check size={14}/>{saving?'Creating draft…':saveState}</span></header>
    <form className="case-study-create__form" onSubmit={submit}>
      <section className="case-study-create__templates"><div className="case-study-create__section-heading"><div><h2>Starting point</h2><p>Choose a proven structure or begin with a clean page.</p></div><button type="button" className="case-button case-button--quiet" onClick={()=>leave(onOpenTemplates)}><LayoutTemplate size={16}/>Template Manager</button></div><div className="case-study-create__template-groups">{['Built-in','Personal'].map((scope)=><section key={scope} className="case-study-create__template-group"><h3>{scope === 'Built-in' ? 'Built-in templates' : 'Personal templates'}</h3><div>{templates.filter((template)=>template.scope===scope).map((template)=><button type="button" key={template.id} className={selected?.id===template.id?'is-selected':''} onClick={()=>patch('templateId',template.id)} aria-pressed={selected?.id===template.id}><FileText size={18}/><span><strong>{template.name}</strong><small>{template.description || `${template.sections?.length || 0} sections`}</small></span><Check size={16}/></button>)}{scope==='Personal'&&!templates.some((template)=>template.scope===scope)&&<p className="case-study-create__empty-template">No personal templates yet.</p>}</div></section>)}</div>{selected&&<aside className="case-study-create__template-preview"><p className="case-eyebrow">Selected template</p><h3>{selected.name}</h3><p>{selected.description || 'A reusable research structure.'}</p><ol>{(selected.sections||[]).map((section,index)=><li key={`${section}-${index}`}><span>{String(index+1).padStart(2,'0')}</span>{section}</li>)}</ol></aside>}</section>
      <section className="case-study-create__details"><div className="case-study-create__section-heading"><div><h2>Study details</h2><p>Name the idea and capture enough context to begin researching safely.</p></div></div><label><span>Case Study title <b>*</b></span><input autoFocus value={draft.title} onChange={(event)=>patch('title',event.target.value)} placeholder="e.g. NY AM liquidity sweep" aria-invalid={!!error} aria-describedby={error?'case-study-create-error':undefined}/></label><div className="case-study-create__field-row"><label><span>Notebook</span><select value={draft.notebookId} onChange={(event)=>patch('notebookId',event.target.value)}>{notebooks.map((notebook)=><option key={notebook.id} value={notebook.id}>{notebook.name}</option>)}</select></label><label><span>Instrument or market <em>optional</em></span><input value={draft.instrument} onChange={(event)=>patch('instrument',event.target.value)} placeholder="e.g. EUR/USD"/></label></div><label><span>Research context <em>optional</em></span><textarea value={draft.context} onChange={(event)=>patch('context',event.target.value)} placeholder="What are you investigating? Capture the setup, market context, or question you want to test."/></label>{error&&<p id="case-study-create-error" className="case-study-create__error" role="alert">{error}</p>}<footer><button type="button" className="case-button case-button--quiet" onClick={()=>leave(onBack)}>Cancel</button><button className="case-button case-button--primary" disabled={saving}><Plus size={17}/>{saving?'Creating draft…':'Create draft'}</button></footer></section>
    </form>
  </main>;
}

function ConnectionDialog({study,studies,connection=null,onClose,onSave}) {
  const [query,setQuery]=useState('');
  const [targetId,setTargetId]=useState(connection?.target?.id || '');
  const [relationship,setRelationship]=useState(connection?.relationship || 'supports');
  const [explanation,setExplanation]=useState(connection?.explanation || '');
  const [openId,setOpenId]=useState(null);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  const editing=!!connection;
  useEffect(()=>{
    const escape=event=>{ if (event.key==='Escape' && !saving) onClose(); };
    document.addEventListener('keydown',escape);
    return()=>document.removeEventListener('keydown',escape);
  },[saving,onClose]);
  const sourceStudy=studies.find(item=>item.id===(editing ? connection.source.id : study.id)) || study;
  const target=studies.find(item=>item.id===(editing ? connection.target.id : targetId)) || null;
  const candidates=studies.filter(item=>item.id!==study.id && `${studyTitle(item)} ${item.status || ''} ${item.instrument || ''}`.toLowerCase().includes(query.trim().toLowerCase()));
  const submit=async event=>{
    event.preventDefault();
    if (saving) return;
    setError('');
    if (!target) { setError('Choose a Case Study to connect.'); return; }
    setSaving(true);
    try {
      await onSave(editing ? { relationship, explanation } : { source:{type:'case-study',id:study.id}, target:{type:'case-study',id:target.id}, relationship, explanation });
      onClose();
    } catch (reason) {
      setError(reason instanceof CaseStudyConnectionError ? reason.message : reason?.message || 'Connection could not be saved.');
    } finally { setSaving(false); }
  };
  const relationshipInfo=connectionRelationship(relationship);
  return <div className="case-dialog-backdrop" role="presentation"><form className="cse-connection-dialog" aria-modal="true" aria-labelledby="connection-dialog-title" onSubmit={submit}>
    <button type="button" className="case-close" onClick={onClose} aria-label="Close connection dialog" disabled={saving}><X size={18}/></button>
    <p className="case-eyebrow">Case Study connection</p><h2 id="connection-dialog-title">{editing?'Edit connection':'Connect Case Study'}</h2>
    <p className="cse-connection-dialog__intro">{editing?'Update the relationship and research reasoning. The connected studies stay fixed.':'Connect this research to another Case Study without changing either study’s content.'}</p>
    <section className="cse-connection-context"><span><small>From</small><strong>{studyTitle(sourceStudy)}</strong></span><span><small>{relationshipInfo?.directional ? 'Direction' : 'Relationship'}</small><strong>{relationshipInfo?.directional ? 'Source → target' : 'Mutual'}</strong></span><span><small>To</small><strong>{target ? studyTitle(target) : 'Choose a study'}</strong></span></section>
    {!editing && <label className="cse-connection-field"><span>Find Case Study</span><input autoFocus value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search titles, status, or instrument"/>{<div className="cse-connection-candidates" role="listbox" aria-label="Available Case Studies">{candidates.length ? candidates.map(item=><button key={item.id} type="button" role="option" aria-selected={targetId===item.id} className={targetId===item.id?'is-selected':''} onClick={()=>setTargetId(item.id)}><span><strong>{studyTitle(item)}</strong><small>{item.status || 'Draft'}{item.archived?' · Archived':''}</small></span><Check size={16}/></button>) : <p>No Case Studies match this search.</p>}</div>}</label>}
    {editing && <section className="cse-connection-locked"><small>Connected study</small><strong>{studyTitle(target)}</strong><span>{target?.status || 'Draft'}{target?.archived?' · Archived':''}</span></section>}
    <label className="cse-connection-field"><span>Relationship</span><CaseStudyDropdown id="case-study-connection-relationship" label="Connection relationship" value={relationship} options={CASE_STUDY_CONNECTION_RELATIONSHIPS.map(item=>({value:item.id,label:item.label}))} openId={openId} setOpenId={setOpenId} onChange={setRelationship}/></label>
    <label className="cse-connection-field"><span>Why are these studies connected? <b>*</b></span><textarea value={explanation} onChange={event=>setExplanation(event.target.value)} placeholder="Explain the research relationship, evidence, or alternative approach."/></label>
    {error&&<p className="cse-connection-error" role="alert">{error}</p>}
    <footer><button type="button" className="case-button case-button--quiet" disabled={saving} onClick={onClose}>Cancel</button><button className="case-button case-button--primary" disabled={saving}>{saving?'Saving…':editing?'Save connection':'Create connection'}</button></footer>
  </form></div>;
}

function StudyConnectionsPanel({study,workspace,onOpenStudy,onCreate,onEdit,onRemove}) {
  const confirm=useConfirmation();
  const [dialog,setDialog]=useState(null);
  const [actionError,setActionError]=useState('');
  const connections=caseStudyConnectionsForStudy(workspace,study.id).filter(connection=>workspace.studies.some(item=>item.id===connection.source.id)&&workspace.studies.some(item=>item.id===connection.target.id));
  const remove=async connection=>{
    if (!await confirm({title:'Remove connection?',description:'This removes only the relationship. Neither Case Study or its research will be deleted.',confirmLabel:'Remove connection',tone:'danger'})) return;
    try { setActionError(''); await onRemove(connection.id); } catch (error) { setActionError(error?.message || 'Connection could not be removed.'); }
  };
  return <div className="cse-panel-content cse-connections-panel"><button className="case-button case-button--primary" onClick={()=>setDialog({mode:'create'})}><Link2 size={15}/>Add Connection</button>
    {connections.length ? <div className="cse-connection-list">{connections.map(connection=>{
      const outgoing=connection.source.id===study.id;
      const counterpartId=outgoing ? connection.target.id : connection.source.id;
      const counterpart=workspace.studies.find(item=>item.id===counterpartId);
      const directional=isDirectionalCaseStudyRelationship(connection.relationship);
      const relation=connectionLabel(connection.relationship);
      const direction=directional ? outgoing ? `This study ${relation.toLowerCase()} connected study` : `Connected study ${relation.toLowerCase()} this study` : relation;
      return <article key={connection.id}><header><div><strong>{studyTitle(counterpart)}</strong><small>{counterpart?.status || 'Draft'}{counterpart?.archived?' · Archived':''}</small></div><span className={directional?'is-directional':''}>{directional ? `${outgoing?'→':'←'} ${relation}` : relation}</span></header><p>{connection.explanation}</p><footer><button type="button" className="cse-connection-open" onClick={()=>onOpenStudy(counterpartId)}>Open study</button><button type="button" className="cse-connection-edit" onClick={()=>setDialog({mode:'edit',connection})}>Edit</button><button type="button" className="is-danger" onClick={()=>remove(connection)}>Remove</button></footer></article>;
    })}</div> : <div className="cse-empty-panel"><Link2 size={26}/><strong>No connected studies yet</strong><p>Connect related research to build your knowledge network.</p></div>}
    {actionError&&<p className="cse-connection-error" role="alert">{actionError}</p>}
    {dialog&&<ConnectionDialog study={study} studies={workspace.studies} connection={dialog.connection || null} onClose={()=>setDialog(null)} onSave={fields=>dialog.mode==='edit' ? onEdit(dialog.connection.id,fields) : onCreate(fields)}/>} 
  </div>;
}

function StudyEditor({study,workspace,templates=[],profileName,storageNotice='',syncStatus='',trades,markups,saveState,onRetrySave,initialMode='Write',initialReviewStep=0,initialViewerId=null,onNavigationChange=()=>{},onBack,onUpdate,onRemove,onDuplicate,onToggle,onAddEvidence,onSaveDocumentImage,onViewEvidence,onExport,onApplyTemplate,onSaveTemplate,onCreateConnection,onEditConnection,onDeleteConnection,onOpenStudy}) {
  const [mode,setMode] = useState(initialMode);
  const [panel,setPanel] = useState('Evidence');
  const [activeSection,setActiveSection] = useState(0);
  const [showOutline,setShowOutline] = useState(true);
  const [showPanel,setShowPanel] = useState(true);
  const [validationSummary,setValidationSummary] = useState(study.validation?.summary || '');
  const [viewerId,setViewerId] = useState(initialViewerId);
  useNavStep('case-viewer', !!viewerId, () => setViewerId(null));
  useStepMotion(viewerId ? 1 : 0);
  const [selectedEvidenceId,setSelectedEvidenceId] = useState(null);
  const [templatePickerOpen,setTemplatePickerOpen] = useState(false);
  const [panelWidth,setPanelWidth] = useState(readCaseStudyPanelWidth);
  const evidenceShelfRef = useRef(null);
  const panelRef = useRef(null);
  const sections = study.sections || [];
  const currentSection = sections[activeSection] || 'Research question';
  const linkedEvidence = (study.evidenceIds || []).map((id) => workspace.evidence.find((item) => item.id === id)).filter(Boolean);
  const activeEvidence = linkedEvidence.find((item) => item.id === resolveActiveEvidenceId(linkedEvidence, selectedEvidenceId));
  const reviewCanValidate = reviewReadiness(study.review).ready;

  useEffect(() => {
    setActiveSection(0);
    setMode(initialMode);
    setValidationSummary(study.validation?.summary || '');
  }, [study.id,initialMode]);
  useEffect(()=>onNavigationChange({mode,reviewStep:initialReviewStep}),[mode,initialReviewStep,onNavigationChange]);
  useEffect(() => { setSelectedEvidenceId((current) => resolveActiveEvidenceId(linkedEvidence, current)); }, [study.id, study.evidenceIds, workspace.evidence]);
  if (viewerId) return <ChartViewerBoundary onBack={()=>setViewerId(null)}><ChartViewer study={study} evidence={linkedEvidence} allEvidence={workspace.evidence} studies={workspace.studies} activeId={viewerId} accountId="profile" saveState={saveState} onRetrySave={onRetrySave} onBack={()=>setViewerId(null)} onUpdate={onUpdate}/></ChartViewerBoundary>;

  const currentDocument = migrateSectionRichDocument(study, currentSection, activeSection);
  const updateDocument = (document) => onUpdate((latestStudy) => patchSectionRichDocument(latestStudy, currentSection, activeSection, document));
  const addSection = () => {
    const section = `New section ${sections.length + 1}`;
    onUpdate({ sections: [...sections, section] });
    setActiveSection(sections.length);
  };
  const relatedStudies = (study.relatedStudyIds || []).map((id) => workspace.studies.find((item) => item.id === id)).filter(Boolean);
  const selectEvidence = (id) => { setSelectedEvidenceId(id); if (mode === 'Analyze') setViewerId(id); };
  const switchMode = (nextMode) => { setMode(nextMode); if (nextMode === 'Analyze' && activeEvidence) setViewerId(activeEvidence.id); };
  const openViewer = (id = activeEvidence?.id) => { if (id) setViewerId(id); };
  const panelMaximumWidth = () => {
    const layout=panelRef.current?.closest('.cse-layout');
    const layoutWidth=layout?.getBoundingClientRect().width || window.innerWidth;
    const outlineWidth=layout?.querySelector('.cse-outline')?.getBoundingClientRect().width || 0;
    const gap=layout ? Number.parseFloat(window.getComputedStyle(layout).columnGap) || 0 : 14;
    // Leave the center workspace at least 280px wide without guessing which
    // responsive outline width is currently active.
    return Math.max(CASE_STUDY_PANEL_MIN_WIDTH,Math.min(CASE_STUDY_PANEL_MAX_WIDTH,layoutWidth-outlineWidth-(gap*2)-280));
  };
  const setSafePanelWidth = (value,{persist=false}={}) => {
    const width=Math.min(clampCaseStudyPanelWidth(value),panelMaximumWidth());
    setPanelWidth(width);
    if (persist) writeCaseStudyPanelWidth(width);
    return width;
  };
  const beginPanelResize = event => {
    if (typeof window==='undefined' || window.matchMedia('(max-width: 940px)').matches) return;
    event.preventDefault();
    const startX=event.clientX, startWidth=panelWidth;
    document.body.classList.add('cse-panel-resizing');
    const move=moveEvent=>setSafePanelWidth(startWidth+(startX-moveEvent.clientX));
    const finish=()=>{
      document.body.classList.remove('cse-panel-resizing');
      document.removeEventListener('pointermove',move);
      document.removeEventListener('pointerup',finish);
      setPanelWidth(current=>{const width=Math.min(clampCaseStudyPanelWidth(current),panelMaximumWidth());writeCaseStudyPanelWidth(width);return width;});
    };
    document.addEventListener('pointermove',move);
    document.addEventListener('pointerup',finish,{once:true});
  };
  const resizePanelWithKeyboard = event => {
    if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
    event.preventDefault();
    const next=event.key==='Home' ? CASE_STUDY_PANEL_MIN_WIDTH : event.key==='End' ? CASE_STUDY_PANEL_MAX_WIDTH : panelWidth+(event.key==='ArrowLeft' ? -16 : 16);
    setSafePanelWidth(next,{persist:true});
  };
  const documentEvidence=Object.fromEntries(workspace.evidence.filter(item=>item.documentImageRef).map(item=>[item.documentImageRef,item]));
  const writing = <div className="cse-writing"><RichDocumentEditor key={`${study.id}:${currentSection}:${Object.keys(documentEvidence).join('|')}`} document={currentDocument} onChange={updateDocument} saveState={saveState} sectionName={currentSection} documentEvidence={documentEvidence} onSaveImage={onSaveDocumentImage} onViewEvidence={onViewEvidence}/></div>;
  const editorHeader = <header className="cse-header">
    <button className="cse-crumb" onClick={onBack}><ArrowLeft size={16}/>Library</button><span className="cse-crumb-separator">/</span><select className="cse-notebook" value={study.notebookId} onChange={(e) => onUpdate({ notebookId: e.target.value })}>{workspace.notebooks.map((notebook) => <option key={notebook.id} value={notebook.id}>{notebook.name}</option>)}</select><input className="cse-title" value={study.title} onChange={(e) => onUpdate({ title: e.target.value })} aria-label="Study title"/><select className="cse-status" value={study.status || 'Draft'} onChange={(e) => onUpdate({ status: e.target.value })}>{STATUSES.map((status) => <option key={status} disabled={status==='Validated'&&study.status!=='Validated'&&!reviewCanValidate}>{status}</option>)}</select><div className="cse-mode-switch" aria-label="Editor mode">{['Write','Split','Analyze','Review'].map((item) => <button key={item} className={mode === item ? 'is-active' : ''} onClick={() => switchMode(item)}>{item}</button>)}</div><span className="cse-save"><Check size={14}/>{saveState}</span>{mode!=='Review'&&<><button className={showOutline ? 'cse-tool is-active' : 'cse-tool'} onClick={() => setShowOutline((value) => !value)}>Outline</button><button className={showPanel ? 'cse-tool is-active' : 'cse-tool'} onClick={() => setShowPanel((value) => !value)}>Panel</button></>}<div className="cse-overflow"><button className="case-icon-button" title="Duplicate study" onClick={onDuplicate}><Copy size={16}/></button><button className="case-icon-button" title="Export study" onClick={onExport}><Download size={16}/></button><button className="case-icon-button case-icon-button--danger" title="Delete study" onClick={onRemove}><Trash2 size={16}/></button></div>
  </header>;
  if (mode !== 'Review' && typeof window !== 'undefined' && window.matchMedia(CS2_DESKTOP).matches) return <>
    <Cs2StudyWorkspace study={study} workspace={workspace} templates={templates} trades={trades} markups={markups} saveState={saveState} onRetrySave={onRetrySave} storageNotice={storageNotice} syncStatus={syncStatus} profileName={profileName} onBack={onBack} onUpdate={onUpdate} onRemove={onRemove} onDuplicate={onDuplicate} onToggle={onToggle} onAddEvidence={onAddEvidence} onSaveDocumentImage={onSaveDocumentImage} onViewEvidence={onViewEvidence} onExport={onExport} onSaveTemplate={onSaveTemplate} onCreateConnection={onCreateConnection} onEditConnection={onEditConnection} onDeleteConnection={onDeleteConnection} onOpenStudy={onOpenStudy} onOpenViewer={(id) => setViewerId(id)} onOpenTemplates={() => setTemplatePickerOpen(true)} onOpenReview={() => setMode('Review')}/>
    {templatePickerOpen && <Cs2AddTemplateDialog study={study} templates={templates} onClose={() => setTemplatePickerOpen(false)} onApply={(template) => { onApplyTemplate?.(template); setTemplatePickerOpen(false); }}/>}
  </>;
  if (mode === 'Review') return <main className="case-study-editor case-study-editor--review">{editorHeader}<ReviewWorkspace study={study} linkedEvidence={linkedEvidence} onOpenViewer={openViewer} onUpdate={onUpdate} saveState={saveState} initialStep={initialReviewStep} onStepChange={reviewStep=>onNavigationChange({mode:'Review',reviewStep})}/></main>;
  const evidenceShelf = <section ref={evidenceShelfRef} className="cse-evidence-shelf" aria-label="Chart evidence"><header><div><p className="case-eyebrow">Chart evidence</p><h3>Linked chart evidence</h3></div><span>{linkedEvidence.length} attached</span></header>{linkedEvidence.length ? <div className="cse-evidence-cards">{linkedEvidence.map((item) => <article className={item.id === activeEvidence?.id ? 'is-selected' : ''} key={item.id}><button type="button" className="cse-evidence-preview" onClick={() => selectEvidence(item.id)} aria-label={`Select ${item.title}`}><EvidenceImage item={item} alt={item.title}/></button><div><strong>{item.title}</strong><p>{study.evidencePlacements?.[item.id]?.caption || 'No placement caption yet.'}</p><div><button type="button" onClick={() => selectEvidence(item.id)}>{item.id === activeEvidence?.id ? 'Selected' : 'Use this evidence'}</button><button type="button" className="cse-open-viewer" onClick={() => openViewer(item.id)}>Open viewer</button></div></div></article>)}</div> : <div className="cse-empty-panel"><ImageIcon size={26}/><strong>No chart evidence attached</strong><p>Attach shared evidence from the Evidence panel to use Write, Split, or Analyze.</p></div>}</section>;

  return <main className="case-study-editor">
    {editorHeader}
    <div className={`cse-layout${mode === 'Write' ? ' cse-layout--writing' : ''}${!showOutline ? ' cse-layout--no-outline' : ''}${!showPanel ? ' cse-layout--no-panel' : ''}`} style={{'--cse-panel-width':`${panelWidth}px`}}>
      {showOutline && <aside className="cse-outline">
        <div className="cse-outline-head"><div><p className="case-eyebrow">Study outline</p><strong>{study.status || 'Draft'}</strong></div><button type="button" className={`cse-favorite${study.favorite?' is-favorite':''}`} aria-label={study.favorite?'Remove from favorites':'Add to favorites'} aria-pressed={!!study.favorite} onClick={()=>onUpdate({favorite:!study.favorite})}><Star size={16} fill={study.favorite?'currentColor':'none'}/></button></div>
        <ol>{sections.map((section,index) => <li key={`${section}-${index}`}><button className={activeSection === index ? 'is-active' : ''} onClick={() => setActiveSection(index)}><span>{String(index + 1).padStart(2, '0')}</span>{section}</button></li>)}{outlineHasVirtualEvidence(sections) && <li><button onClick={() => evidenceShelfRef.current?.scrollIntoView({block:'start',behavior:'smooth'})}><span>↳</span>Chart evidence</button></li>}</ol>
        <div className="cse-outline-actions"><button className="cse-apply-template" onClick={()=>setTemplatePickerOpen(true)}><LayoutTemplate size={15}/>Apply template</button><button className="cse-add-section" onClick={addSection}><Plus size={15}/>Add section</button></div>
      </aside>}
      <section className={mode === 'Write' ? 'cse-document-workspace cse-workspace--write' : `cse-workspace cse-workspace--${mode.toLowerCase()}`}>
        <div className="cse-workspace-head"><div><p className="case-eyebrow">{mode === 'Analyze' ? 'Chart evidence' : currentSection}</p><h2>{mode === 'Analyze' ? 'Map the trade context' : currentSection}</h2></div><span>Revision {study.revisionCount || 1} · Updated {dateLabel(study.updatedAt)}</span></div>
        {mode === 'Write' && <>{writing}{evidenceShelf}</>}
        {mode === 'Split' && <div className="cse-split-workspace"><section className="cse-split-evidence">{activeEvidence ? <><header><p className="case-eyebrow">Selected evidence</p><strong>{activeEvidence.title}</strong></header><button type="button" className="cse-split-preview" onClick={() => openViewer(activeEvidence.id)}><EvidenceImage item={activeEvidence} alt={activeEvidence.title}/></button><p>{study.evidencePlacements?.[activeEvidence.id]?.caption || 'No placement caption yet.'}</p><button type="button" className="cse-open-viewer" onClick={() => openViewer(activeEvidence.id)}>Open viewer</button></> : <div className="cse-empty-panel"><ImageIcon size={26}/><strong>No chart evidence attached</strong><p>Attach and select evidence from the Evidence panel to use Split mode.</p></div>}</section>{writing}</div>}
        {mode === 'Analyze' && <div className="cse-analyze-empty">{activeEvidence ? <><ImageIcon size={28}/><strong>{activeEvidence.title}</strong><p>Analyze opens the full Freeform Drawing Board for this evidence placement.</p><button className="case-button case-button--primary" onClick={() => openViewer(activeEvidence.id)}>Open viewer</button></> : <><ImageIcon size={28}/><strong>No chart evidence attached</strong><p>Attach and select evidence from the Evidence panel before analyzing it.</p></>}</div>}
      </section>
      {showPanel && <aside ref={panelRef} className="cse-panel">
        <div className="cse-panel-resize-handle" role="separator" aria-label="Resize Case Study panel" aria-orientation="vertical" aria-valuemin={320} aria-valuemax={480} aria-valuenow={panelWidth} tabIndex={0} onPointerDown={beginPanelResize} onKeyDown={resizePanelWithKeyboard}/>
        <div className="cse-panel-tabs-viewport"><div className="cse-panel-tabs">{['Evidence','Trades','Links','Connections','Actions'].map((item) => <button key={item} className={panel === item ? 'is-active' : ''} onClick={() => setPanel(item)}>{item}</button>)}</div></div>
        {panel === 'Evidence' && <div className="cse-panel-content"><button className="case-button case-button--primary" onClick={onAddEvidence}><Plus size={15}/>Add shared evidence</button><details className="cse-evidence-linker"><summary>Link from Evidence Library</summary><div className="cse-picker-list">{workspace.evidence.map((item)=><label key={item.id}><input type="checkbox" checked={(study.evidenceIds||[]).includes(item.id)} onChange={()=>onToggle('evidenceIds',item.id)}/><span><strong>{item.title}</strong><small>{item.kind||'Reference'} · {item.source || 'Shared source'}</small></span></label>)}</div></details>{linkedEvidence.length ? <div className="cse-evidence-list">{linkedEvidence.map((item) => <article className={`cse-evidence-placement ${item.id === activeEvidence?.id ? 'is-selected' : ''}`} key={item.id}><button type="button" className="cse-evidence-thumb" onClick={() => selectEvidence(item.id)} aria-label={`Select ${item.title}`}><EvidenceImage item={item} alt=""/></button><div className="cse-evidence-summary"><strong>{item.title}</strong><small>{study.evidencePlacements?.[item.id]?.caption || item.notes || item.source || 'Shared evidence'}</small><small>{workspace.studies.filter((entry) => entry.evidenceIds?.includes(item.id)).length} studies use this evidence</small><div className="cse-evidence-actions">{item.id !== activeEvidence?.id && <button type="button" className="cse-evidence-choice" onClick={() => selectEvidence(item.id)}>Use for Split / Analyze</button>}<button type="button" className="cse-open-viewer" onClick={() => openViewer(item.id)}>Open viewer</button><details><summary>Study-specific details</summary><label>Placement caption<input value={study.evidencePlacements?.[item.id]?.caption||''} onChange={e=>onUpdate({evidencePlacements:{...(study.evidencePlacements||{}),[item.id]:{...(study.evidencePlacements?.[item.id]||{}),caption:e.target.value}}})} placeholder="Placement caption"/></label><label>Study-specific observation<textarea value={study.evidencePlacements?.[item.id]?.observation||''} onChange={e=>onUpdate({evidencePlacements:{...(study.evidencePlacements||{}),[item.id]:{...(study.evidencePlacements?.[item.id]||{}),observation:e.target.value}}})} placeholder="Study-specific observation"/></label></details></div></div><button onClick={() => onToggle('evidenceIds', item.id)} title="Unlink evidence"><X size={14}/></button></article>)}</div> : <div className="cse-empty-panel"><ImageIcon size={26}/><strong>No evidence attached</strong><p>Attach a shared source and add notes that belong only to this study.</p></div>}</div>}
        {panel === 'Trades' && <div className="cse-panel-content cse-picker-list">{trades.slice(0,10).map((trade) => <label key={trade.id}><input type="checkbox" checked={(study.tradeIds || []).includes(trade.id)} onChange={() => onToggle('tradeIds',trade.id)}/><span><strong>{trade.asset || trade.instrument || 'Trade'}</strong><small>{trade.date || 'Undated'} · {trade.direction || 'Trade'}</small></span></label>)}</div>}
        {panel === 'Links' && <div className="cse-panel-content"><div className="cse-picker-list">{markups.slice(0,10).map((markup) => <label key={markup.id}><input type="checkbox" checked={(study.markupIds || []).includes(markup.id)} onChange={() => onToggle('markupIds',markup.id)}/><span><strong>{markup.instrument || markup.market || 'Markup'}</strong><small>{markup.date || 'Undated'}</small></span></label>)}</div><h3>Related studies</h3><div className="cse-picker-list">{workspace.studies.filter(item=>item.id!==study.id&&!item.archived).map(item=><label key={item.id}><input type="checkbox" checked={(study.relatedStudyIds||[]).includes(item.id)} onChange={()=>onToggle('relatedStudyIds',item.id)}/><span><strong>{studyTitle(item)}</strong><small>{item.status||'Draft'}</small></span></label>)}</div></div>}
        {panel === 'Connections' && <StudyConnectionsPanel study={study} workspace={workspace} onOpenStudy={onOpenStudy} onCreate={onCreateConnection} onEdit={onEditConnection} onRemove={onDeleteConnection}/>} 
        {panel === 'Actions' && <div className="cse-panel-content cse-actions-panel"><button onClick={() => onUpdate({ pinned: !study.pinned })}><Pin size={16}/>{study.pinned ? 'Unpin study' : 'Pin to library'}</button><button className={study.favorite?'is-favorite':''} aria-pressed={!!study.favorite} onClick={() => onUpdate({ favorite: !study.favorite })}><Star size={16} fill={study.favorite?'currentColor':'none'}/>{study.favorite ? 'Remove favorite' : 'Mark as favorite'}</button><button onClick={()=>setTemplatePickerOpen(true)}><LayoutTemplate size={16}/>Apply template</button><label className="cse-validation"><strong>Validation summary <small>optional</small></strong><textarea value={validationSummary} onChange={e=>setValidationSummary(e.target.value)} placeholder="What evidence supports this conclusion?"/></label><button onClick={() => onUpdate({status:'Validated',validation:{summary:validationSummary,validatedAt:now()}})}><Check size={16}/>Mark validated</button><button onClick={onDuplicate}><Copy size={16}/>Duplicate study</button><button onClick={onExport}><Download size={16}/>Export study</button><button className="is-danger" onClick={onRemove}><Trash2 size={16}/>Delete study</button></div>}
        <p className="cse-account-scope">{storageNotice || syncStatus || `Saved to ${profileName}'s profile library.`}</p>
      </aside>}
    </div>{templatePickerOpen&&(typeof window!=='undefined'&&window.matchMedia(CS2_DESKTOP).matches ? <Cs2AddTemplateDialog study={study} templates={templates} onClose={()=>setTemplatePickerOpen(false)} onApply={template=>{onApplyTemplate?.(template);setTemplatePickerOpen(false);}}/> : <ApplyTemplateDialog study={study} templates={templates} onClose={()=>setTemplatePickerOpen(false)} onApply={template=>{onApplyTemplate?.(template);setTemplatePickerOpen(false);}}/>)}
  </main>;
}
