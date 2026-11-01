import { Component, useEffect, useMemo, useRef, useState } from 'react';
import {useConfirmation} from './ConfirmationDialog.jsx';
import { Archive, ArrowLeft, AlertTriangle, BookOpen, Check, Copy, Download, FileText, Image as ImageIcon, Link2, Pin, Plus, Search, Star, Trash2, X, LayoutTemplate, LibraryBig, MoreHorizontal, NotebookTabs, SlidersHorizontal, FolderOpen, Clock3 } from 'lucide-react';
import './caseStudyLibrary.css';
import './caseStudyLibraryRedesign.css';
import './caseStudyEditor.css';
import ChartViewer from './ChartViewer.jsx';
import { caseStudyBackup, linkEvidence, linkRelatedStudy, mergeCaseStudyWorkspace, normaliseCaseStudyWorkspace, readEvidenceImage, unlinkEvidence, validateEvidenceImage } from './caseStudyWorkspace.js';
import { activeEvidenceId as resolveActiveEvidenceId, outlineHasVirtualEvidence } from './caseStudyPresentation.js';
import { richDocumentFromSections } from './studyRichDocument.js';
import { auditRecoveredCaseStudyBackup, auditRecoveredCaseStudyWorkspace } from './recoveredCaseStudyIntegrity.js';

const now = () => new Date().toISOString();
const uid = (prefix) => globalThis.crypto?.randomUUID?.() || `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const NOTEBOOKS = [
  ['structure', 'Market Structure'], ['liquidity', 'Liquidity'], ['entries', 'Entries & Setups'],
  ['risk', 'Risk Management'], ['psychology', 'Trading Psychology'], ['playbook', 'My Strategy Playbook'],
  ['lessons', 'Trade Lessons'], ['notes', 'Personal Notes'],
];
const TEMPLATES = [
  { id:'blank', name:'Blank study', description:'A clean page for documenting a focused idea.', sections:['Overview', 'Notes', 'Conclusion'] },
  { id:'learning', name:'Learning note', description:'Capture a lesson while it is still fresh.', sections:['What I learned', 'Evidence', 'Practice'] },
  { id:'research', name:'Research study', description:'A complete research workflow for testing a trading idea.', sections:['Research question', 'Hypothesis', 'Market context', 'Liquidity and structure', 'Chart evidence', 'Examples and counterexamples', 'Findings', 'Limitations', 'Conclusion', 'Next actions'] },
  { id:'playbook', name:'Playbook', description:'Turn validated evidence into a repeatable setup.', sections:['Setup', 'Conditions', 'Risk', 'Execution', 'Review'] },
  { id:'lesson', name:'Trade lesson', description:'Turn one trade into a practical lesson.', sections:['Context', 'Decision', 'Outcome', 'Lesson'] },
  { id:'week', name:'Weekly review', description:'Review the week and identify the next priority.', sections:['Wins', 'Mistakes', 'Focus next week'] },
];
const STATUSES = ['Draft', 'Researching', 'Needs validation', 'Validated'];
const baseWorkspace = () => ({
  notebooks: NOTEBOOKS.map(([id, name]) => ({ id, name, builtIn:true })),
  studies: [], evidence: [], personalTemplates: [], settings:{ view:'grid', query:'', status:'All', notebook:'All' },
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
const dateLabel = (value) => value ? new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',year:'numeric'}).format(new Date(value)) : 'Not saved';
class ChartViewerBoundary extends Component { constructor(props){super(props);this.state={error:false};} static getDerivedStateFromError(){return {error:true};} componentDidCatch(error){console.error('Case Study chart viewer failed to render.', error);} render(){return this.state.error ? <main className="cv"><header><button onClick={this.props.onBack}><ArrowLeft/>Evidence</button></header><p className="cv-error">The chart viewer could not open this evidence safely. Return to the study and check the evidence image.</p></main> : this.props.children;} }
class RichDocumentBoundary extends Component { constructor(props){super(props);this.state={error:false};} static getDerivedStateFromError(){return {error:true};} componentDidCatch(error){console.error('Case Study document editor failed to render.', error);} render(){if(!this.state.error)return this.props.children;return <div className="cse-writing"><p className="cse-muted">The document editor could not open safely. Your existing text is still available below.</p><textarea aria-label="Overview fallback" value={this.props.value||''} onChange={event=>this.props.onChange(event.target.value)}/></div>;} }

function CaseStudyLoadState({ libraryState, profileName, onRetryLoad }) {
  const workspace=normalise(libraryState.workspace);
  const integrity=libraryState.workspace ? auditRecoveredCaseStudyWorkspace(libraryState.workspace) : null;
  const backup=libraryState.workspace ? auditRecoveredCaseStudyBackup(libraryState.workspace) : null;
  const isRecovery=libraryState.status === 'recovery';
  const isLoading=libraryState.status === 'loading';
  const sourceIds=libraryState.sourceIds || [];
  return <main className="case-library case-library--recovery" aria-busy={isLoading || undefined}>
    <section className="case-empty" role={isLoading ? 'status' : 'alert'}>
      <BookOpen size={30}/>
      <p className="case-eyebrow">{profileName} · learning library</p>
      <h1>{isLoading ? 'Loading Case Study Library…' : isRecovery ? 'Recovered legacy data preview' : 'Case Study Library unavailable'}</h1>
      <p>{libraryState.message || 'The Case Study Library is loading.'}</p>
      {!isLoading && <button className="case-button case-button--primary" onClick={onRetryLoad}>Retry Load</button>}
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

function CaseStudyLibraryReady({ profileWorkspace, temporaryNotice = '', syncStatus = '', onUploadDeviceLibrary = null, syncConflict = null, profileName = 'Profile', trades = [], markups = [], onSaveWorkspace }) {
  const confirm=useConfirmation();
  const [workspace, setWorkspace] = useState(() => normalise(profileWorkspace));
  const [selectedId, setSelectedId] = useState(null);
  const [screen, setScreen] = useState('library');
  const [saveState, setSaveState] = useState('All changes saved');
  const [templateOpen, setTemplateOpen] = useState(false);
  const [libraryView, setLibraryView] = useState('library');
  const [sort, setSort] = useState('recent');
  const [cardMenu, setCardMenu] = useState(null);
  const [evidenceDialog, setEvidenceDialog] = useState(false);
  const [restoreDialog, setRestoreDialog] = useState(false);
  const saveTimer = useRef();
  const saveVersion = useRef(0);
  const failedSave = useRef(null);

  useEffect(() => {
    clearTimeout(saveTimer.current);
    saveVersion.current+=1;
    failedSave.current=null;
    setWorkspace(normalise(profileWorkspace));
    setSaveState('Saved');
    setSelectedId(null);
    setScreen('library'); setLibraryView('library');
  }, [profileWorkspace]);
  useEffect(() => () => clearTimeout(saveTimer.current), []);

  const save = (next, immediate = false) => {
    const version=++saveVersion.current;
    setWorkspace(next);
    setSaveState('Saving…');
    failedSave.current=null;
    clearTimeout(saveTimer.current);
    const commit = async () => {
      try {
        await onSaveWorkspace(next);
        if (saveVersion.current===version) setSaveState('Saved');
      }
      catch {
        if (saveVersion.current===version) { failedSave.current={next,version}; setSaveState('Save failed'); }
      }
    };
    if (immediate) void commit();
    else saveTimer.current = setTimeout(commit, 550);
  };
  const retrySave = () => {
    const failed=failedSave.current;
    if (!failed || failed.version!==saveVersion.current) return;
    save(failed.next, true);
  };
  const studies = useMemo(() => workspace.studies.filter((item) => !item.archived), [workspace.studies]);
  const selected = workspace.studies.find((item) => item.id === selectedId) || null;
  const visibleStudies = useMemo(() => {
    const { query, status, notebook } = workspace.settings;
    const needle = (query || '').toLowerCase();
    const filtered = studies.filter((item) => (status === 'All' || item.status === status)
      && (notebook === 'All' || item.notebookId === notebook)
      && (!needle || [item.title, item.body, item.status, item.tags?.join(' ')].join(' ').toLowerCase().includes(needle)));
    return filtered.sort((a,b) => {
      if (sort === 'title') return studyTitle(a).localeCompare(studyTitle(b));
      if (sort === 'oldest') return new Date(a.updatedAt)-new Date(b.updatedAt);
      return Number(b.pinned)-Number(a.pinned) || Number(b.favorite)-Number(a.favorite) || new Date(b.updatedAt)-new Date(a.updatedAt);
    });
  }, [studies, workspace.settings, sort]);

  const updateSettings = (partial) => save({ ...workspace, settings:{...workspace.settings,...partial} });
  const createStudy = (template = TEMPLATES[0]) => {
    const created = { id:uid('study'), title:'Untitled study', notebookId:'notes', templateId:template.id, sections:template.sections, body:'', richDocument:template.richDocument || richDocumentFromSections(template.sections), status:'Draft', evidenceIds:[], tradeIds:[], markupIds:[], relatedStudyIds:[], favorite:false, pinned:false, archived:false, createdAt:now(), updatedAt:now(), revisionCount:1 };
    save({ ...workspace, studies:[created,...workspace.studies] }, true);
    setSelectedId(created.id); setScreen('editor'); setTemplateOpen(false);
  };
  const updateStudy = (partial) => {
    if (!selected) return;
    const nextStudy = { ...selected, ...partial, updatedAt:now(), revisionCount:(selected.revisionCount || 0)+1 };
    save({ ...workspace, studies:workspace.studies.map((item) => item.id === selected.id ? nextStudy : item) });
  };
  const removeStudy = async () => {
    if (!selected || !await confirm({title:'Delete study?',description:`Delete “${studyTitle(selected)}”? This cannot be undone.`,confirmLabel:'Delete study'})) return;
    save({ ...workspace, studies:workspace.studies.filter((item) => item.id !== selected.id) }, true);
    setSelectedId(null); setScreen('library');
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
  const addEvidence = (fields) => {
    if (!fields?.title?.trim()) return;
    const evidence = { id:uid('evidence'), title:fields.title.trim(), source:fields.source?.trim() || '', url:fields.url?.trim() || '', notes:fields.notes?.trim() || '', tags:fields.tags || [], kind:fields.kind || 'Reference', createdAt:now() };
    save({ ...workspace, evidence:[evidence,...workspace.evidence] }, true);
    if (selected) updateStudy(linkEvidence(selected, evidence.id));
    setEvidenceDialog(false);
  };
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
    if (!await confirm({title:'Delete evidence?',description:'Delete this evidence item? It will be unlinked from every study.',confirmLabel:'Delete evidence'})) return;
    save(unlinkEvidence(workspace, id), true);
  };
  const savePersonalTemplate = (fields, existingId = null) => {
    if (!fields?.name?.trim()) return;
    const template = { id:existingId || uid('template'), name:fields.name.trim(), description:fields.description?.trim() || 'A personal study structure.', sections:fields.sections?.filter(Boolean) || ['Overview'], updatedAt:now(), createdAt:existingId ? undefined : now() };
    save({ ...workspace, personalTemplates:existingId ? workspace.personalTemplates.map((item) => item.id===existingId ? {...item,...template} : item) : [template,...workspace.personalTemplates] }, true);
  };
  const duplicateTemplate = (template) => save({ ...workspace, personalTemplates:[{...template,id:uid('template'),name:`${template.name} copy`,createdAt:now(),updatedAt:now()},...workspace.personalTemplates] }, true);
  const removeTemplate = async (id) => { if (await confirm({title:'Delete template?',description:'Delete this personal template? Existing studies will not change.',confirmLabel:'Delete template'})) save({...workspace,personalTemplates:workspace.personalTemplates.filter((item)=>item.id!==id)},true); };
  const exportLibrary = () => {
    const blob = new Blob([JSON.stringify(caseStudyBackup(workspace), null, 2)], {type:'application/json'}); const url=URL.createObjectURL(blob); const link=document.createElement('a'); link.href=url; link.download=`case-study-library-${new Date().toISOString().slice(0,10)}.json`; link.click(); URL.revokeObjectURL(url);
  };
  const importLibrary = async (file, conflict) => {
    try { const parsed=JSON.parse(await file.text()); if (parsed?.kind !== 'aaicorefx-case-study-library' || !parsed.workspace) throw new Error(); save(mergeCaseStudyWorkspace(workspace, parsed.workspace, {conflict}), true); setRestoreDialog(false); }
    catch { window.alert('Choose a Case Study Library backup created by this journal.'); }
  };
  if (screen === 'editor' && selected) return <StudyEditor study={selected} workspace={workspace} profileName={profileName} storageNotice={temporaryNotice ? 'Saved only on this device. Your recovered legacy library is unchanged.' : ''} syncStatus={syncStatus} trades={trades} markups={markups} saveState={saveState} onRetrySave={retrySave} onBack={() => setScreen('library')} onUpdate={updateStudy} onRemove={removeStudy} onDuplicate={duplicateStudy} onToggle={toggleSelection} onAddEvidence={addEvidence} onExport={exportStudy} onSaveTemplate={(name)=>savePersonalTemplate({name:name||`${studyTitle(selected)} template`,description:`Based on ${studyTitle(selected)}.`,sections:selected.sections||[]})}/>;

  return <main className="case-library">
    <header className="case-library__header">
      <div><p className="case-eyebrow">{profileName} · learning library</p><h1>Case Study Library</h1><p>Turn trade evidence into repeatable decisions and a stronger playbook.</p></div>
      <div className="case-header-actions"><span className="case-save-state"><Check size={14}/>{syncStatus || saveState}</span>{onUploadDeviceLibrary && <button className="case-button case-button--quiet" onClick={onUploadDeviceLibrary}>Upload device library</button>}<button className="case-button case-button--quiet" onClick={() => setLibraryView('evidence')}><ImageIcon size={16}/>Evidence</button><button className="case-button case-button--quiet" onClick={() => setLibraryView('templates')}><LayoutTemplate size={16}/>Templates</button><button className="case-button case-button--quiet" onClick={exportLibrary}><Download size={16}/>Export</button><button className="case-button case-button--quiet" onClick={()=>setRestoreDialog(true)}>Restore</button><button className="case-button case-button--primary" onClick={() => setTemplateOpen(true)}><Plus size={17}/>New case study</button></div>
    </header>
    {temporaryNotice && <aside className="case-work-in-progress" role="note"><AlertTriangle aria-hidden="true" size={18}/><div><strong>Work in Progress — Coming Soon</strong><span>The Case Study Library is still under development. Some features, including cloud synchronization, may be temporarily unavailable. We're working to complete the experience soon. Thank you for your patience.</span></div></aside>}
    {syncConflict && <p className="case-sync-conflict" role="alert">Sync conflict: both device and cloud versions are preserved. Reconciliation is required before another cloud save.</p>}
    <div className="case-library-layout">
      <aside className="case-library-sidebar">
        <button className={libraryView==='library'?'is-active':''} onClick={()=>setLibraryView('library')}><LibraryBig size={17}/>All studies <span>{studies.length}</span></button>
        <button className={libraryView==='favorites'?'is-active':''} onClick={()=>setLibraryView('favorites')}><Star size={17}/>Favorites <span>{studies.filter(s=>s.favorite).length}</span></button>
        <button className={libraryView==='pinned'?'is-active':''} onClick={()=>setLibraryView('pinned')}><Pin size={17}/>Pinned playbooks <span>{studies.filter(s=>s.pinned).length}</span></button>
        <p className="case-sidebar-label">Notebooks</p>
        <button className={workspace.settings.notebook==='All'&&libraryView==='notebooks'?'is-active':''} onClick={()=>{setLibraryView('notebooks');updateSettings({notebook:'All'});}}><NotebookTabs size={17}/>All notebooks</button>
        {workspace.notebooks.map((notebook) => <button key={notebook.id} className={workspace.settings.notebook===notebook.id?'is-active':''} onClick={() => {setLibraryView('notebooks');updateSettings({notebook:notebook.id});}}><BookOpen size={16}/>{notebook.name}<span>{studies.filter(s=>s.notebookId===notebook.id).length}</span></button>)}
        <button className="case-add-notebook" onClick={createNotebook}><Plus size={16}/>New notebook</button>
      </aside>
      <div className="case-library-content">
      {libraryView === 'evidence' ? <EvidenceLibrary evidence={workspace.evidence} studies={studies} onAdd={()=>setEvidenceDialog(true)} onPatch={patchEvidence} onRemove={removeEvidence} onBack={()=>setLibraryView('library')}/> : libraryView === 'templates' ? <TemplateManager templates={TEMPLATES} personalTemplates={workspace.personalTemplates} onChoose={createStudy} onSave={savePersonalTemplate} onDuplicate={duplicateTemplate} onRemove={removeTemplate} onBack={()=>setLibraryView('library')}/> : <>
        <section className="case-metrics" aria-label="Library overview">
          <Metric value={studies.length} label="Total studies" onClick={()=>setLibraryView('library')}/><Metric value={studies.filter(s=>s.status === 'Researching').length} label="Researching" onClick={()=>updateSettings({status:'Researching'})}/><Metric value={studies.filter(s=>s.status === 'Needs validation').length} label="Needs validation" onClick={()=>updateSettings({status:'Needs validation'})}/><Metric value={studies.filter(s=>s.templateId === 'playbook' || s.pinned).length} label="Strategy playbooks" onClick={()=>setLibraryView('pinned')}/>
        </section>
        {(libraryView === 'library' || libraryView === 'notebooks') && <div className="case-research-panels"><LibraryShelf title="Continue researching" subtitle="Your active studies" studies={studies.filter(s=>['Researching','Needs validation','Draft'].includes(s.status)).slice(0,4)} notebooks={workspace.notebooks} onOpen={(id)=>{setSelectedId(id);setScreen('editor')}}/><LibraryShelf title="Pinned playbooks" subtitle="The rules you want to repeat" studies={studies.filter(s=>s.pinned || s.templateId === 'playbook').slice(0,3)} notebooks={workspace.notebooks} onOpen={(id)=>{setSelectedId(id);setScreen('editor')}} compact/></div>}
        <section className="case-library-all"><div className="case-library-all__heading"><div><h2>{libraryView === 'favorites' ? 'Favorites' : libraryView === 'pinned' ? 'Pinned playbooks' : 'Your library'}</h2><p>{visibleStudies.length} study{visibleStudies.length===1?'':'ies'} shown</p></div></div>
        <section className="case-toolbar"><label className="case-search"><Search size={17}/><input value={workspace.settings.query} onChange={(event)=>updateSettings({query:event.target.value})} placeholder="Search studies, notes, and insights"/></label><select value={workspace.settings.status} onChange={(event)=>updateSettings({status:event.target.value})}><option>All</option>{STATUSES.map(s=><option key={s}>{s}</option>)}</select><select value={sort} onChange={event=>setSort(event.target.value)}><option value="recent">Recently updated</option><option value="oldest">Oldest first</option><option value="title">Title A–Z</option></select><div className="case-view-toggle"><button className={workspace.settings.view==='grid'?'is-active':''} onClick={()=>updateSettings({view:'grid'})}>Grid</button><button className={workspace.settings.view==='list'?'is-active':''} onClick={()=>updateSettings({view:'list'})}>List</button></div></section>
        <section className={`case-study-grid case-study-grid--${workspace.settings.view}`}>
          {visibleStudies.filter(study => libraryView !== 'favorites' || study.favorite).filter(study => libraryView !== 'pinned' || study.pinned || study.templateId === 'playbook').map((study)=><StudyCard key={study.id} study={study} notebook={workspace.notebooks.find(n=>n.id===study.notebookId)} evidence={workspace.evidence} menuOpen={cardMenu===study.id} onMenu={()=>setCardMenu(cardMenu===study.id?null:study.id)} onOpen={()=>{setSelectedId(study.id);setScreen('editor')}} onPatch={(partial)=>patchStudy(study.id,partial)} onDuplicate={()=>{const copy={...study,id:uid('study'),title:`${studyTitle(study)} copy`,createdAt:now(),updatedAt:now(),revisionCount:1,pinned:false};save({...workspace,studies:[copy,...workspace.studies]},true);}} onDelete={async()=>{if(await confirm({title:'Delete study?',description:`Delete “${studyTitle(study)}”? This cannot be undone.`,confirmLabel:'Delete study'})) save({...workspace,studies:workspace.studies.filter(item=>item.id!==study.id)},true)}}/>) }
          {!visibleStudies.length && <div className="case-empty"><FileText size={30}/><h2>No studies here yet</h2><p>Start with a template, then attach trades, markups, and evidence as you learn.</p><button className="case-button case-button--primary" onClick={()=>setTemplateOpen(true)}><Plus size={17}/>Create a study</button></div>}
        </section></section>
      </>}
      </div>
    </div>
    {templateOpen && <TemplateDialog templates={[...TEMPLATES,...workspace.personalTemplates]} onClose={()=>setTemplateOpen(false)} onChoose={createStudy}/>} 
    {evidenceDialog && <EvidenceDialog onClose={()=>setEvidenceDialog(false)} onSave={addEvidence}/>} 
    {restoreDialog && <RestoreDialog onClose={()=>setRestoreDialog(false)} onImport={importLibrary}/>} 
  </main>;
}

export default function CaseStudyLibrary({ libraryState = { status:'ready', message:'' }, onRetryLoad = () => {}, profileName = 'Profile', temporaryNotice = '', syncStatus = '', onUploadDeviceLibrary = null, syncConflict = null, ...props }) {
  // Do not mount editable controls from an unconfirmed, failed, or recovery-only
  // load. This keeps every mutation path unreachable until the parent confirms
  // an authoritative library response.
  if (libraryState.status === 'recovery') return <CaseStudyRecoveryLibrary workspace={libraryState.workspace} libraryState={libraryState} profileName={profileName} onRetryLoad={onRetryLoad}/>;
  if (libraryState.status !== 'ready') return <CaseStudyLoadState libraryState={libraryState} profileName={profileName} onRetryLoad={onRetryLoad}/>;
  return <CaseStudyLibraryReady {...props} profileName={profileName} temporaryNotice={temporaryNotice} syncStatus={syncStatus} onUploadDeviceLibrary={onUploadDeviceLibrary} syncConflict={syncConflict}/>;
}

function Metric({value,label,onClick}) { return <button className="case-metric" onClick={onClick}><strong>{value}</strong><span>{label}</span></button>; }
function StudyCard({study, notebook, evidence = [], onOpen, onPatch, onDuplicate, onDelete, onMenu, menuOpen}) { const preview = evidence.find(item => (study.evidenceIds || []).includes(item.id) && (item.url || item.source?.match(/^https?:|^data:image/)))?.url || evidence.find(item => (study.evidenceIds || []).includes(item.id))?.source; return <article className="case-study-card" onClick={onOpen}><div className="case-study-card__preview">{preview ? <img src={preview} alt="" onError={(event)=>{event.currentTarget.style.display='none';}}/> : <><BookOpen size={28}/><span>{notebook?.name || 'Study'}</span></>}<span className={`case-status case-status--${study.status.toLowerCase().replaceAll(' ','-')}`}>{study.status}</span></div><div className="case-study-card__top"><span>{notebook?.name || 'Notebook'}</span><button aria-label="Study menu" onClick={(event)=>{event.stopPropagation();onMenu();}}><MoreHorizontal size={17}/></button>{menuOpen && <div className="case-card-menu" onClick={event=>event.stopPropagation()}><button onClick={()=>onPatch({favorite:!study.favorite})}><Star size={15}/>{study.favorite?'Remove favorite':'Favorite'}</button><button onClick={()=>onPatch({pinned:!study.pinned})}><Pin size={15}/>{study.pinned?'Unpin':'Pin playbook'}</button><button onClick={onDuplicate}><Copy size={15}/>Duplicate</button><button onClick={()=>onPatch({archived:true})}><Archive size={15}/>Archive</button><button className="is-danger" onClick={onDelete}><Trash2 size={15}/>Delete</button></div>}</div><h2>{studyTitle(study)}</h2><p>{study.body?.trim() || 'Open this study to start writing.'}</p><div className="case-card-tags"><span>{(study.tradeIds||[]).length} trades</span><span>{(study.markupIds||[]).length} markups</span><span>{(study.evidenceIds||[]).length} evidence</span></div><footer><span><Clock3 size={13}/>{dateLabel(study.updatedAt)}</span>{study.pinned && <Pin size={14}/>}</footer></article>; }
function LibraryShelf({title,subtitle,studies,notebooks,onOpen,compact=false}) { if (!studies.length) return null; return <section className={`case-shelf ${compact?'case-shelf--compact':''}`}><div className="case-shelf__heading"><div><h2>{title}</h2><p>{subtitle}</p></div>{compact&&<button className="case-button case-button--quiet" onClick={()=>onOpen(studies[0].id)}>View all</button>}</div><div className="case-shelf__items">{studies.map(study=><button key={study.id} onClick={()=>onOpen(study.id)}><div><strong>{studyTitle(study)}</strong><small>{notebooks.find(n=>n.id===study.notebookId)?.name || 'Notebook'} · Last worked on: {study.sections?.[0] || 'Overview'}</small></div><span><i className={`case-status case-status--${study.status.toLowerCase().replaceAll(' ','-')}`}>{study.status}</i><small>{dateLabel(study.updatedAt)}</small></span></button>)}</div></section>; }
function EvidenceLibrary({evidence,studies,onAdd,onPatch,onRemove,onBack}) {
  const [query,setQuery] = useState('');
  const [kind,setKind] = useState('All');
  const [selectedId,setSelectedId] = useState(evidence[0]?.id || null);
  useEffect(() => { if (!evidence.some((item) => item.id === selectedId)) setSelectedId(evidence[0]?.id || null); }, [evidence,selectedId]);
  const filtered = evidence.filter((item) => (kind === 'All' || (item.kind || 'Reference') === kind) && [item.title,item.source,item.notes,item.kind].join(' ').toLowerCase().includes(query.toLowerCase()));
  const selected = evidence.find((item) => item.id === selectedId) || filtered[0];
  const related = selected ? studies.filter((study) => (study.evidenceIds || []).includes(selected.id)) : [];
  const usableImage = selected?.url || (selected?.source?.match(/^(data:image|https?:\/\/)/) ? selected.source : '');
  return <section className="case-v2-resource">
    <header className="case-v2-resource__head"><button className="case-back" onClick={onBack}><ArrowLeft size={16}/>Library</button><div><p className="case-eyebrow">Research sourcebook</p><h2>Evidence library</h2><p>Store a chart, image, link, or reference once, then reuse it across your studies.</p></div><button className="case-button case-button--primary" onClick={onAdd}><Plus size={16}/>Upload chart</button></header>
    {!evidence.length ? <div className="case-empty"><ImageIcon size={30}/><h2>No evidence saved</h2><p>Add a chart, article, screenshot, or note to make it available to your studies.</p><button className="case-button case-button--primary" onClick={onAdd}><Plus size={16}/>Add evidence</button></div> : <div className="case-v2-resource__layout">
      <aside className="case-v2-resource__list"><label className="case-search"><Search size={16}/><input value={query} onChange={(event)=>setQuery(event.target.value)} placeholder="Search evidence"/></label><div className="case-v2-filter-row">{['All','Chart','Screenshot','Reference'].map((value)=><button key={value} className={kind===value?'is-active':''} onClick={()=>setKind(value)}>{value}</button>)}</div><p>{filtered.length} item{filtered.length===1?'':'s'}</p>{filtered.map((item)=>{const thumbnail=item.url||(item.source?.match(/^(data:image|https?:\/\/)/)?item.source:'');return <button key={item.id} className={selected?.id===item.id?'is-active':''} onClick={()=>setSelectedId(item.id)}>{thumbnail?<img className="case-v2-evidence-thumb" src={thumbnail} alt=""/>:<ImageIcon size={22}/>}<span><strong>{item.title}</strong><small>{item.tags?.join(' · ') || item.kind || 'Reference'} · {dateLabel(item.createdAt)}</small></span></button>})}</aside>
      {selected && <article className="case-v2-evidence-detail"><div className="case-v2-evidence-preview">{usableImage ? <img src={usableImage} alt={selected.title} onError={(event)=>{event.currentTarget.style.display='none';}}/> : <><ImageIcon size={42}/><span>{selected.kind || 'Reference'}</span></>}</div><div className="case-v2-evidence-detail__title"><input value={selected.title} onChange={(event)=>onPatch(selected.id,{title:event.target.value})}/><select value={selected.kind || 'Reference'} onChange={(event)=>onPatch(selected.id,{kind:event.target.value})}><option>Reference</option><option>Chart</option><option>Screenshot</option></select></div><label>Source or URL<input value={selected.source || ''} onChange={(event)=>onPatch(selected.id,{source:event.target.value})} placeholder="https://…"/></label><label>Research notes<textarea value={selected.notes || ''} onChange={(event)=>onPatch(selected.id,{notes:event.target.value})} placeholder="What does this evidence support or challenge?"/></label><section className="case-v2-reference-list"><h3>Referenced in {related.length} studies</h3>{related.length ? related.map((study)=><div key={study.id}><FileText size={15}/>{studyTitle(study)}<small>{study.status}</small></div>) : <p>Link this item to a study from its evidence panel.</p>}</section><footer><span>Added {dateLabel(selected.createdAt)}</span><button className="case-button case-button--danger" onClick={()=>onRemove(selected.id)}><Trash2 size={15}/>Delete evidence</button></footer></article>}
    </div>}
  </section>;
}
function TemplateManager({templates,personalTemplates,onChoose,onSave,onDuplicate,onRemove,onBack}) {
  const [scope,setScope] = useState('Built-in'); const [selectedId,setSelectedId] = useState('research'); const [editing,setEditing] = useState(null);
  const items = scope === 'Built-in' ? templates : personalTemplates; const selected = items.find((template) => template.id === selectedId) || items[0];
  return <section className="case-v2-templates"><header className="case-v2-resource__head"><button className="case-back" onClick={onBack}><ArrowLeft size={16}/>Library</button><div><p className="case-eyebrow">Start with a proven structure</p><h2>Template manager</h2><p>Built-ins are protected. Personal edits affect only future studies.</p></div>{scope==='Personal'&&<button className="case-button case-button--primary" onClick={()=>setEditing({})}><Plus size={16}/>New template</button>}</header><div className="case-v2-template-tabs"><button className={scope==='Built-in'?'is-active':''} onClick={()=>setScope('Built-in')}>Built-in templates ({templates.length})</button><button className={scope==='Personal'?'is-active':''} onClick={()=>setScope('Personal')}>Personal templates ({personalTemplates.length})</button></div>{!items.length ? <div className="case-empty"><LayoutTemplate size={30}/><h2>No personal templates yet</h2><p>Create one from a structure you want to repeat. Existing studies stay independent.</p><button className="case-button case-button--primary" onClick={()=>setEditing({})}>Create template</button></div> : <div className="case-v2-template-layout"><aside>{items.map((template)=><button key={template.id} className={selected?.id===template.id?'is-active':''} onClick={()=>setSelectedId(template.id)}><FileText size={17}/><span><strong>{template.name}</strong><small>{template.sections.length} sections</small></span></button>)}</aside>{selected && <article><p className="case-eyebrow">{scope==='Built-in'?'Built-in template':'Personal template'}</p><h2>{selected.name}</h2><p>{selected.description}</p><ol>{selected.sections.map((section,index)=><li key={`${section}-${index}`}><span>{String(index+1).padStart(2,'0')}</span>{section}</li>)}</ol><div className="case-template-actions"><button className="case-button case-button--primary" onClick={()=>onChoose(selected)}><Plus size={16}/>Use template</button>{scope==='Personal'&&<><button className="case-button case-button--quiet" onClick={()=>setEditing(selected)}>Edit</button><button className="case-button case-button--quiet" onClick={()=>onDuplicate(selected)}>Duplicate</button><button className="case-button case-button--danger" onClick={()=>onRemove(selected.id)}>Delete</button></>}</div></article>}</div>}{editing&&<PersonalTemplateDialog template={editing} onClose={()=>setEditing(null)} onSave={(fields)=>{onSave(fields,editing.id);setEditing(null)}}/>}</section>;
}
function EvidenceDialog({onClose,onSave}) { const [fields,setFields]=useState({title:'',kind:'Chart',source:'',url:'',notes:'',tags:''}); const [file,setFile]=useState(null); const [error,setError]=useState(''); const [saving,setSaving]=useState(false); const patch=(key,value)=>setFields({...fields,[key]:value}); const submit=async(e)=>{e.preventDefault();setError('');setSaving(true);try{const image=file?await readEvidenceImage(file):fields.url.trim();if(!image&&!fields.source.trim())throw new Error('Attach a chart image or provide a source URL.');onSave({...fields,url:image,tags:fields.tags.split(',').map(x=>x.trim()).filter(Boolean)});}catch(reason){setError(reason.message||'Evidence could not be saved.');setSaving(false);}}; return <div className="case-dialog-backdrop"><form className="case-form-dialog" onSubmit={submit}><button type="button" className="case-close" onClick={onClose}><X size={18}/></button><p className="case-eyebrow">Shared evidence</p><h2>Upload chart</h2><label>Title<input autoFocus required value={fields.title} onChange={e=>patch('title',e.target.value)}/></label><label>Chart image<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>{const next=e.target.files?.[0]||null;setFile(next);setError(next?validateEvidenceImage(next)||'':'');}}/><small>PNG, JPEG, or WebP · up to 3 MB</small></label><label>Or image URL<input value={fields.url} onChange={e=>patch('url',e.target.value)} placeholder="https://…png"/></label><label>Source or URL<input value={fields.source} onChange={e=>patch('source',e.target.value)} placeholder="Optional source"/></label><label>Tags<input value={fields.tags} onChange={e=>patch('tags',e.target.value)} placeholder="GBPUSD, M15"/></label><label>Research notes<textarea value={fields.notes} onChange={e=>patch('notes',e.target.value)} placeholder="What does this support or challenge?"/></label>{error&&<p className="case-form-error" role="alert">{error}</p>}<footer><button type="button" className="case-button case-button--quiet" onClick={onClose}>Cancel</button><button disabled={saving} className="case-button case-button--primary">{saving?'Saving…':'Save chart'}</button></footer></form></div>; }
function PersonalTemplateDialog({template,onClose,onSave}) { const [name,setName]=useState(template.name||''); const [description,setDescription]=useState(template.description||''); const [sections,setSections]=useState((template.sections||['Overview']).join('\n')); return <div className="case-dialog-backdrop"><form className="case-form-dialog" onSubmit={e=>{e.preventDefault();onSave({name,description,sections:sections.split('\n').map(x=>x.trim()).filter(Boolean)})}}><button type="button" className="case-close" onClick={onClose}><X size={18}/></button><p className="case-eyebrow">Personal template</p><h2>{template.id?'Edit template':'New template'}</h2><label>Name<input autoFocus required value={name} onChange={e=>setName(e.target.value)}/></label><label>Description<input value={description} onChange={e=>setDescription(e.target.value)}/></label><label>Sections, one per line<textarea value={sections} onChange={e=>setSections(e.target.value)}/></label><footer><button type="button" className="case-button case-button--quiet" onClick={onClose}>Cancel</button><button className="case-button case-button--primary">Save template</button></footer></form></div>; }
function RestoreDialog({onClose,onImport}) { const [file,setFile]=useState(null); const [conflict,setConflict]=useState('copy'); return <div className="case-dialog-backdrop"><form className="case-form-dialog" onSubmit={e=>{e.preventDefault();if(file)onImport(file,conflict)}}><button type="button" className="case-close" onClick={onClose}><X size={18}/></button><p className="case-eyebrow">Case Study Library backup</p><h2>Restore library data</h2><p>Import adds missing items. Matching IDs become copies by default, protecting current work.</p><label>Backup file<input type="file" accept="application/json" required onChange={e=>setFile(e.target.files?.[0])}/></label><label>Matching IDs<select value={conflict} onChange={e=>setConflict(e.target.value)}><option value="copy">Keep both as copies (safe)</option><option value="replace">Replace matching library items</option></select></label><footer><button type="button" className="case-button case-button--quiet" onClick={onClose}>Cancel</button><button className="case-button case-button--primary">Import library</button></footer></form></div>; }
function TemplateDialog({templates,onChoose,onClose}) { return <div className="case-dialog-backdrop" role="presentation"><section className="case-template-dialog" role="dialog" aria-modal="true" aria-label="Choose study template"><button className="case-close" onClick={onClose}><X size={18}/></button><p className="case-eyebrow">New case study</p><h2>Start with a structure</h2><div className="case-template-grid">{templates.map(template=><button key={template.id} onClick={()=>onChoose(template)}><FileText size={20}/><strong>{template.name}</strong><span>{template.sections.join(' · ')}</span></button>)}</div></section></div>; }

function StudyEditor({study,workspace,profileName,storageNotice='',syncStatus='',trades,markups,saveState,onRetrySave,onBack,onUpdate,onRemove,onDuplicate,onToggle,onAddEvidence,onExport,onSaveTemplate}) {
  const [mode,setMode] = useState('Write');
  const [panel,setPanel] = useState('Evidence');
  const [activeSection,setActiveSection] = useState(0);
  const [showOutline,setShowOutline] = useState(true);
  const [showPanel,setShowPanel] = useState(true);
  const [validationSummary,setValidationSummary] = useState(study.validation?.summary || '');
  const [viewerId,setViewerId] = useState(null);
  const [selectedEvidenceId,setSelectedEvidenceId] = useState(null);
  const evidenceShelfRef = useRef(null);
  const sections = study.sections || [];
  const sectionNotes = study.sectionNotes || {};
  const currentSection = sections[activeSection] || 'Research question';
  const linkedEvidence = (study.evidenceIds || []).map((id) => workspace.evidence.find((item) => item.id === id)).filter(Boolean);
  const activeEvidence = linkedEvidence.find((item) => item.id === resolveActiveEvidenceId(linkedEvidence, selectedEvidenceId));

  useEffect(() => {
    setActiveSection(0);
    setMode('Write');
    setValidationSummary(study.validation?.summary || '');
  }, [study.id]);
  useEffect(() => { setSelectedEvidenceId((current) => resolveActiveEvidenceId(linkedEvidence, current)); }, [study.id, study.evidenceIds, workspace.evidence]);
  if (viewerId) return <ChartViewerBoundary onBack={()=>setViewerId(null)}><ChartViewer study={study} evidence={linkedEvidence} activeId={viewerId} accountId="profile" saveState={saveState} onRetrySave={onRetrySave} onBack={()=>setViewerId(null)} onUpdate={onUpdate}/></ChartViewerBoundary>;

  const updateSection = (value) => onUpdate({ sectionNotes: { ...sectionNotes, [currentSection]: value }, body: activeSection === 0 ? value : study.body });
  const addSection = () => {
    const section = `New section ${sections.length + 1}`;
    onUpdate({ sections: [...sections, section] });
    setActiveSection(sections.length);
  };
  const relatedStudies = (study.relatedStudyIds || []).map((id) => workspace.studies.find((item) => item.id === id)).filter(Boolean);
  const selectEvidence = (id) => { setSelectedEvidenceId(id); if (mode === 'Analyze') setViewerId(id); };
  const switchMode = (nextMode) => { setMode(nextMode); if (nextMode === 'Analyze' && activeEvidence) setViewerId(activeEvidence.id); };
  const openViewer = (id = activeEvidence?.id) => { if (id) setViewerId(id); };
  const writing = <div className="cse-writing"><label htmlFor="case-section-copy">{currentSection}</label><textarea id="case-section-copy" value={sectionNotes[currentSection] ?? (activeSection === 0 ? study.body || '' : '')} onChange={(e) => updateSection(e.target.value)} placeholder="Write the observation, the evidence behind it, and what you will test next…"/><div className="cse-writing-guides" aria-hidden="true"><i/><i/><i/><i/><i/></div></div>;
  const evidenceShelf = <section ref={evidenceShelfRef} className="cse-evidence-shelf" aria-label="Chart evidence"><header><div><p className="case-eyebrow">Chart evidence</p><h3>Linked chart evidence</h3></div><span>{linkedEvidence.length} attached</span></header>{linkedEvidence.length ? <div className="cse-evidence-cards">{linkedEvidence.map((item) => <article className={item.id === activeEvidence?.id ? 'is-selected' : ''} key={item.id}><button type="button" className="cse-evidence-preview" onClick={() => selectEvidence(item.id)} aria-label={`Select ${item.title}`}><img src={item.url || item.source} alt={item.title}/></button><div><strong>{item.title}</strong><p>{study.evidencePlacements?.[item.id]?.caption || 'No placement caption yet.'}</p><div><button type="button" onClick={() => selectEvidence(item.id)}>{item.id === activeEvidence?.id ? 'Selected' : 'Use this evidence'}</button><button type="button" className="cse-open-viewer" onClick={() => openViewer(item.id)}>Open viewer</button></div></div></article>)}</div> : <div className="cse-empty-panel"><ImageIcon size={26}/><strong>No chart evidence attached</strong><p>Attach shared evidence from the Evidence panel to use Write, Split, or Analyze.</p></div>}</section>;

  return <main className="case-study-editor">
    <header className="cse-header">
      <button className="cse-crumb" onClick={onBack}><ArrowLeft size={16}/>Library</button>
      <span className="cse-crumb-separator">/</span>
      <select className="cse-notebook" value={study.notebookId} onChange={(e) => onUpdate({ notebookId: e.target.value })}>{workspace.notebooks.map((notebook) => <option key={notebook.id} value={notebook.id}>{notebook.name}</option>)}</select>
      <input className="cse-title" value={study.title} onChange={(e) => onUpdate({ title: e.target.value })} aria-label="Study title" />
      <select className="cse-status" value={study.status || 'Draft'} onChange={(e) => onUpdate({ status: e.target.value })}>{STATUSES.map((status) => <option key={status}>{status}</option>)}</select>
      <div className="cse-mode-switch" aria-label="Editor mode">{['Write','Split','Analyze'].map((item) => <button key={item} className={mode === item ? 'is-active' : ''} onClick={() => switchMode(item)}>{item}</button>)}</div>
      <span className="cse-save"><Check size={14}/>{saveState}</span>
      <button className={showOutline ? 'cse-tool is-active' : 'cse-tool'} onClick={() => setShowOutline((value) => !value)}>Outline</button>
      <button className={showPanel ? 'cse-tool is-active' : 'cse-tool'} onClick={() => setShowPanel((value) => !value)}>Panel</button>
      <div className="cse-overflow"><button className="case-icon-button" title="Duplicate study" onClick={onDuplicate}><Copy size={16}/></button><button className="case-icon-button" title="Export study" onClick={onExport}><Download size={16}/></button><button className="case-icon-button case-icon-button--danger" title="Delete study" onClick={onRemove}><Trash2 size={16}/></button></div>
    </header>
    <div className={`cse-layout${!showOutline ? ' cse-layout--no-outline' : ''}${!showPanel ? ' cse-layout--no-panel' : ''}`}>
      {showOutline && <aside className="cse-outline">
        <div className="cse-outline-head"><div><p className="case-eyebrow">Study outline</p><strong>{study.status || 'Draft'}</strong></div><label className="cse-favorite"><input type="checkbox" checked={!!study.favorite} onChange={(e) => onUpdate({ favorite: e.target.checked })}/><Star size={16}/></label></div>
        <ol>{sections.map((section,index) => <li key={`${section}-${index}`}><button className={activeSection === index ? 'is-active' : ''} onClick={() => setActiveSection(index)}><span>{String(index + 1).padStart(2, '0')}</span>{section}</button></li>)}{outlineHasVirtualEvidence(sections) && <li><button onClick={() => evidenceShelfRef.current?.scrollIntoView({block:'start',behavior:'smooth'})}><span>↳</span>Chart evidence</button></li>}</ol>
        <button className="cse-add-section" onClick={addSection}><Plus size={15}/>Add section</button>
      </aside>}
      <section className={`cse-workspace cse-workspace--${mode.toLowerCase()}`}>
        <div className="cse-workspace-head"><div><p className="case-eyebrow">{mode === 'Analyze' ? 'Chart evidence' : currentSection}</p><h2>{mode === 'Analyze' ? 'Map the trade context' : currentSection}</h2></div><span>Revision {study.revisionCount || 1} · Updated {dateLabel(study.updatedAt)}</span></div>
        {mode === 'Write' && <>{writing}{evidenceShelf}</>}
        {mode === 'Split' && <div className="cse-split-workspace"><section className="cse-split-evidence">{activeEvidence ? <><header><p className="case-eyebrow">Selected evidence</p><strong>{activeEvidence.title}</strong></header><button type="button" className="cse-split-preview" onClick={() => openViewer(activeEvidence.id)}><img src={activeEvidence.url || activeEvidence.source} alt={activeEvidence.title}/></button><p>{study.evidencePlacements?.[activeEvidence.id]?.caption || 'No placement caption yet.'}</p><button type="button" className="cse-open-viewer" onClick={() => openViewer(activeEvidence.id)}>Open viewer</button></> : <div className="cse-empty-panel"><ImageIcon size={26}/><strong>No chart evidence attached</strong><p>Attach and select evidence from the Evidence panel to use Split mode.</p></div>}</section>{writing}</div>}
        {mode === 'Analyze' && <div className="cse-analyze-empty">{activeEvidence ? <><ImageIcon size={28}/><strong>{activeEvidence.title}</strong><p>Analyze opens the full Freeform Drawing Board for this evidence placement.</p><button className="case-button case-button--primary" onClick={() => openViewer(activeEvidence.id)}>Open viewer</button></> : <><ImageIcon size={28}/><strong>No chart evidence attached</strong><p>Attach and select evidence from the Evidence panel before analyzing it.</p></>}</div>}
      </section>
      {showPanel && <aside className="cse-panel">
        <div className="cse-panel-tabs">{['Evidence','Trades','Links','Actions'].map((item) => <button key={item} className={panel === item ? 'is-active' : ''} onClick={() => setPanel(item)}>{item}</button>)}</div>
        {panel === 'Evidence' && <div className="cse-panel-content"><button className="case-button case-button--primary" onClick={onAddEvidence}><Plus size={15}/>Add shared evidence</button><details className="cse-evidence-linker"><summary>Link shared evidence</summary><div className="cse-picker-list">{workspace.evidence.map((item)=><label key={item.id}><input type="checkbox" checked={(study.evidenceIds||[]).includes(item.id)} onChange={()=>onToggle('evidenceIds',item.id)}/><span><strong>{item.title}</strong><small>{item.kind||'Reference'} · shared source</small></span></label>)}</div></details>{linkedEvidence.length ? <div className="cse-evidence-list">{linkedEvidence.map((item) => <article className={`cse-evidence-placement ${item.id === activeEvidence?.id ? 'is-selected' : ''}`} key={item.id}><button type="button" className="cse-evidence-thumb" onClick={() => selectEvidence(item.id)} aria-label={`Select ${item.title}`}><img src={item.url || item.source} alt=""/></button><div className="cse-evidence-summary"><strong>{item.title}</strong><small>{study.evidencePlacements?.[item.id]?.caption || item.notes || item.source || 'Shared evidence'}</small><small>{workspace.studies.filter((entry) => entry.evidenceIds?.includes(item.id)).length} studies use this evidence</small><div className="cse-evidence-actions">{item.id !== activeEvidence?.id && <button type="button" className="cse-evidence-choice" onClick={() => selectEvidence(item.id)}>Use for Split / Analyze</button>}<button type="button" className="cse-open-viewer" onClick={() => openViewer(item.id)}>Open viewer</button><details><summary>Details</summary><label>Placement caption<input value={study.evidencePlacements?.[item.id]?.caption||''} onChange={e=>onUpdate({evidencePlacements:{...(study.evidencePlacements||{}),[item.id]:{...(study.evidencePlacements?.[item.id]||{}),caption:e.target.value}}})} placeholder="Placement caption"/></label><label>Study-specific observation<textarea value={study.evidencePlacements?.[item.id]?.observation||''} onChange={e=>onUpdate({evidencePlacements:{...(study.evidencePlacements||{}),[item.id]:{...(study.evidencePlacements?.[item.id]||{}),observation:e.target.value}}})} placeholder="Study-specific observation"/></label></details></div></div><button onClick={() => onToggle('evidenceIds', item.id)} title="Unlink evidence"><X size={14}/></button></article>)}</div> : <div className="cse-empty-panel"><ImageIcon size={26}/><strong>No evidence attached</strong><p>Attach a shared source and add notes that belong only to this study.</p></div>}</div>}
        {panel === 'Trades' && <div className="cse-panel-content cse-picker-list">{trades.slice(0,10).map((trade) => <label key={trade.id}><input type="checkbox" checked={(study.tradeIds || []).includes(trade.id)} onChange={() => onToggle('tradeIds',trade.id)}/><span><strong>{trade.asset || trade.instrument || 'Trade'}</strong><small>{trade.date || 'Undated'} · {trade.direction || 'Trade'}</small></span></label>)}</div>}
        {panel === 'Links' && <div className="cse-panel-content"><div className="cse-picker-list">{markups.slice(0,10).map((markup) => <label key={markup.id}><input type="checkbox" checked={(study.markupIds || []).includes(markup.id)} onChange={() => onToggle('markupIds',markup.id)}/><span><strong>{markup.instrument || markup.market || 'Markup'}</strong><small>{markup.date || 'Undated'}</small></span></label>)}</div><h3>Related studies</h3><div className="cse-picker-list">{workspace.studies.filter(item=>item.id!==study.id&&!item.archived).map(item=><label key={item.id}><input type="checkbox" checked={(study.relatedStudyIds||[]).includes(item.id)} onChange={()=>onToggle('relatedStudyIds',item.id)}/><span><strong>{studyTitle(item)}</strong><small>{item.status||'Draft'}</small></span></label>)}</div></div>}
        {panel === 'Actions' && <div className="cse-panel-content cse-actions-panel"><button onClick={() => onUpdate({ pinned: !study.pinned })}><Pin size={16}/>{study.pinned ? 'Unpin study' : 'Pin to library'}</button><button onClick={() => onUpdate({ favorite: !study.favorite })}><Star size={16}/>{study.favorite ? 'Remove favorite' : 'Mark as favorite'}</button><label className="cse-validation"><strong>Validation summary <small>optional</small></strong><textarea value={validationSummary} onChange={e=>setValidationSummary(e.target.value)} placeholder="What evidence supports this conclusion?"/></label><button onClick={() => onUpdate({status:'Validated',validation:{summary:validationSummary,validatedAt:now()}})}><Check size={16}/>Mark validated</button><button onClick={onDuplicate}><Copy size={16}/>Duplicate study</button><button onClick={onExport}><Download size={16}/>Export study</button><button className="is-danger" onClick={onRemove}><Trash2 size={16}/>Delete study</button></div>}
        <p className="cse-account-scope">{storageNotice || syncStatus || `Saved to ${profileName}'s profile library.`}</p>
      </aside>}
    </div>
  </main>;
}
