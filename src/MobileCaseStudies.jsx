import {useMobileCaseStudyDraftController} from './journalDataSafety.js';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Archive, BookOpen, Check, ChevronRight, Download, FileText, Grid,
  Image as ImageIcon, LayoutTemplate, Link2, List as ListIcon, MoreHorizontal,
  Network, Pin, Plus, Search, ShieldCheck, Star, Trash2, Upload, X,
} from 'lucide-react';
import { normaliseCaseStudyWorkspace } from './caseStudyWorkspace.js';
import { BUILT_IN_CASE_STUDY_TEMPLATES, templateSectionNames } from './caseStudyTemplates.js';
import { CASE_STUDY_CONNECTION_RELATIONSHIPS } from './caseStudyConnections.js';
import { migrateSectionRichDocument, patchSectionRichDocument, richDocumentText } from './studyRichDocument.js';
import { reportCaseStudyImageDecodeFailure, useEvidenceImageUrl } from './caseStudyEvidenceImages.js';
import { evidenceImageReference } from './caseStudyCover.js';
import { caseStudyBackup } from './caseStudyWorkspace.js';
import { CaseStudyReconciliationDialog } from './CaseStudyLibrary.jsx';
import './mobileCaseStudies.css';

const RICH_DOCUMENT_VERSION = 1;
const uid = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const dateLabel = value => value
  ? new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value))
  : '';
const studyTitle = study => study.title?.trim() || 'Untitled study';
const sectionText = (study, name, idx) => richDocumentText(migrateSectionRichDocument(study, name, idx));
const hasSectionContent = (study, name, idx) => sectionText(study, name, idx).length > 10;
const doneSections = study =>
  (Array.isArray(study.sections) ? study.sections : []).filter((name, idx) => hasSectionContent(study, name, idx)).length;
const totalSections = study => (Array.isArray(study.sections) ? study.sections : []).length;
const connectionLabel = id => CASE_STUDY_CONNECTION_RELATIONSHIPS.find(r => r.id === id)?.label || 'Related to';
const connectionRelClass = id => {
  if (id === 'supports' || id === 'builds-on') return 'supports';
  if (id === 'contradicts') return 'contradicts';
  if (id === 'alternative-approach') return 'alternative-approach';
  return 'related-to';
};
const textToDoc = text => {
  const lines = String(text || '').replace(/\r\n?/g, '\n').split(/\n{2,}/)
    .map(block => block.trim()).filter(Boolean);
  return {
    version: RICH_DOCUMENT_VERSION,
    content: {
      type: 'doc',
      content: lines.length
        ? lines.map(line => ({ type: 'paragraph', content: [{ type: 'text', text: line }] }))
        : [{ type: 'paragraph' }],
    },
  };
};

function EvidenceThumb({ evidence, sessionOwner, className = '' }) {
  // Shared assets resolve from this browser first, with a verified cloud copy
  // as the authenticated cross-device fallback.
  const ref = evidenceImageReference(evidence);
  const { url,observeRef } = useEvidenceImageUrl(ref, { userId: sessionOwner, cloudRef: evidence?.cloudRef || '',localOnly:evidence?.localOnly===true,defer:true });
  if (!url) return <div ref={observeRef} className={`mcs-nocov ${className}`}><ImageIcon size={20} /></div>;
  return <img ref={observeRef} src={url} alt="" className={className} onError={reportCaseStudyImageDecodeFailure} />;
}

function StudyCover({ study, workspace, sessionOwner, className = '' }) {
  const evidenceId = study?.evidenceIds?.[0];
  const evidence = evidenceId ? workspace.evidence.find(e => e.id === evidenceId) : null;
  return <EvidenceThumb evidence={evidence} sessionOwner={sessionOwner} className={className} />;
}

function StatusBadge({ status }) {
  const cls = (status || '').toLowerCase().replace(/\s+/g, '-');
  return <span className={`mcs-st ${cls}`}>{status === 'Validated' && <Check size={10} strokeWidth={3} />}{status || 'Draft'}</span>;
}

export default function MobileCaseStudies({
  profileWorkspace, onSaveWorkspace, profileName, draftContext, profileRevision, onSavePatch,
  trades = [], markups = [], libraryState, onRetryLoad,
  sessionOwner, syncConflict = null, onReconcileConflict = null,
}) {
  const studyDraft=useMobileCaseStudyDraftController({context:draftContext,confirmedWorkspace:profileWorkspace,confirmedRevision:profileRevision,submitPatch:onSavePatch,textToDoc});
  const workspace=studyDraft.workspace;

  const [view, setView] = useState('lib');
  const [openStudyId, setOpenStudyId] = useState(null);
  const [tab, setTab] = useState('studies');
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('recent');
  const [layout, setLayout] = useState('grid');
  const [evQuery, setEvQuery] = useState('');
  const [selEvId, setSelEvId] = useState(null);
  const [selTemplId, setSelTemplId] = useState(null);
  const [mapFilter, setMapFilter] = useState('All');
  const [selNodeId, setSelNodeId] = useState(null);
  const [reconcileOpen, setReconcileOpen] = useState(false);

  // study editor
  const [editSecIdx, setEditSecIdx] = useState(0);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelTab, setPanelTab] = useState('evidence');
  const [isSaving, setIsSaving] = useState(false);
  const [localSecs, setLocalSecs] = useState({});
  const saveTimerRef = useRef(null);
  const secRefs = useRef({});

  const activeSections = useMemo(() =>
    view === 'study' && openStudyId
      ? workspace.studies.find(s => s.id === openStudyId)?.sections || []
      : [],
    [view, openStudyId, workspace.studies]);

  const openStudy = useCallback((id) => {
    setOpenStudyId(id);
    setEditSecIdx(0);
    setLocalSecs({});
    setPanelOpen(false);
    setView('study');
    window.scrollTo(0, 0);
  }, []);

  const closeStudy = useCallback(() => {
    setView('lib');
    setOpenStudyId(null);
    setLocalSecs({});
  }, []);

  // Counts for filter chips
  const counts = useMemo(() => {
    const active = workspace.studies.filter(s => !s.archived);
    return {
      all: active.length,
      Draft: active.filter(s => !s.status || s.status === 'Draft').length,
      Validated: active.filter(s => s.status === 'Validated').length,
      fav: active.filter(s => s.favorite).length,
      pin: active.filter(s => s.pinned).length,
      arch: workspace.studies.filter(s => s.archived).length,
    };
  }, [workspace.studies]);

  // Filtered + sorted studies
  const filteredStudies = useMemo(() => {
    let list = workspace.studies.filter(s => filter === 'arch' ? s.archived : !s.archived);
    if (filter === 'fav') list = list.filter(s => s.favorite);
    else if (filter === 'pin') list = list.filter(s => s.pinned);
    else if (filter === 'Draft') list = list.filter(s => !s.status || s.status === 'Draft');
    else if (filter === 'Validated') list = list.filter(s => s.status === 'Validated');
    if (query) {
      const q = query.toLowerCase();
      list = list.filter(s =>
        studyTitle(s).toLowerCase().includes(q) ||
        (s.instrument || '').toLowerCase().includes(q)
      );
    }
    if (sort === 'az') list = [...list].sort((a, b) => studyTitle(a).localeCompare(studyTitle(b)));
    return list;
  }, [workspace.studies, filter, query, sort]);

  const continueStudy = filteredStudies.find(s => !s.status || s.status === 'Draft' || s.status === 'Researching');
  const pinnedStudies = workspace.studies.filter(s => s.pinned && !s.archived);

  // Connections for map
  const connectionsForStudy = useCallback(studyId =>
    (workspace.connections || []).filter(c =>
      c.source?.id === studyId || c.target?.id === studyId
    ), [workspace.connections]);

  const filteredConnections = useMemo(() => {
    if (mapFilter === 'All') return workspace.connections || [];
    return (workspace.connections || []).filter(c => connectionLabel(c.relationship) === mapFilter);
  }, [workspace.connections, mapFilter]);

  const studyById = id => workspace.studies.find(s => s.id === id);

  // Save workspace helpers
  const saveStudyPatch=useCallback((studyId,patch)=>studyDraft.patchStudy(studyId,patch),[studyDraft.patchStudy]);

  const toggleFav = useCallback((e, studyId) => {
    e.stopPropagation();
    const study = workspace.studies.find(s => s.id === studyId);
    if (!study) return;
    saveStudyPatch(studyId, { favorite: !study.favorite });
  }, [workspace.studies, saveStudyPatch]);

  // Section text editing with auto-save
  const getSectionText = useCallback((study, name, idx) => {
    return studyDraft.sectionText(study.id,{name,index:idx});
  }, [studyDraft.sectionText,workspace]);

  const handleSectionChange = useCallback((name, idx, value) => {
    setLocalSecs(prev => ({ ...prev, [name]: value }));
    studyDraft.editSection(openStudyId,{name,index:idx,text:value});
  }, [openStudyId,studyDraft.editSection]);

  useEffect(()=>()=>studyDraft.detachView(),[studyDraft.detachView]);

  const scrollToSection = useCallback((idx) => {
    setEditSecIdx(idx);
    setPanelOpen(false);
    const el = secRefs.current[idx];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const handleBackup = useCallback(() => {
    try {
      const data = JSON.stringify(caseStudyBackup(workspace), null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'case-study-library.json'; a.click();
      URL.revokeObjectURL(url);
    } catch {}
  }, [workspace]);

  const createNewStudy = useCallback((templateId) => {
    const allTemplates = [...BUILT_IN_CASE_STUDY_TEMPLATES, ...(workspace.personalTemplates || [])];
    const template = allTemplates.find(t => t.id === templateId) || allTemplates[0] || { id: 'blank', sections: ['Overview'] };
    const sections = templateSectionNames(template);
    const id = uid();
    const now = new Date().toISOString();
    const newStudy = {
      id, title: 'Untitled study',
      notebookId: workspace.notebooks?.[0]?.id || 'notes',
      templateId: template.id,
      instrument: '', sections,
      body: '', sectionNotes: {}, richDocument: undefined, sectionDocuments: {},
      status: 'Draft',
      evidenceIds: [], tradeIds: [], markupIds: [], relatedStudyIds: [],
      favorite: false, pinned: false, archived: false,
      createdAt: now, updatedAt: now, revisionCount: 1,
    };
    const updated = [newStudy, ...workspace.studies];
    onSaveWorkspace?.({ ...profileWorkspace, ...workspace, studies: updated });
    setTimeout(() => openStudy(id), 50);
  }, [workspace, profileWorkspace, onSaveWorkspace, openStudy]);

  // =========== Library view ===========
  const renderLibrary = () => {
    const allTemplates = [...BUILT_IN_CASE_STUDY_TEMPLATES, ...(workspace.personalTemplates || [])];
    const selTempl = allTemplates.find(t => t.id === selTemplId) || allTemplates[0];
    const selEv = workspace.evidence.find(e => e.id === selEvId) || workspace.evidence[0];
    const selNode = studyById(selNodeId) || workspace.studies.find(s => !s.archived);
    const relLabels = ['All', ...CASE_STUDY_CONNECTION_RELATIONSHIPS.map(r => r.label)];

    return (
      <div className="mcs-wrap">
        {/* hero */}
        <section className="mcs-hero mcs-rise">
          <div className="mcs-h1">
            <span className="mcs-eb">{profileName || 'Trader'} · Research workspace</span>
            <h1>Case Studies</h1>
            <p>Explore setups, continue your research, and turn observations into tested playbooks.</p>
          </div>
          <div className="mcs-stats">
            <div><b>{counts.all}</b><small>Studies</small></div>
            <div><b className="is-gain">{counts.Validated}</b><small>Validated</small></div>
            <div><b className="is-warn">{counts.Draft}</b><small>In draft</small></div>
            <div><b>{workspace.evidence.length}</b><small>Evidence</small></div>
          </div>
          <div className="mcs-ha">
            <button className="mcs-btn pri lg mcs-pri" onClick={() => createNewStudy(null)}>
              <Plus size={16} strokeWidth={2.4} />New case study
            </button>
            <button className="mcs-btn lg" onClick={handleBackup} aria-label="Backup">
              <Download size={16} />
            </button>
          </div>
        </section>

        {/* tabs */}
        <nav className="mcs-tabs">
          {[
            ['studies', 'Studies', <BookOpen size={16} />, counts.all],
            ['evidence', 'Evidence', <ImageIcon size={16} />, workspace.evidence.length],
            ['map', 'Connections', <Network size={16} />, (workspace.connections || []).length],
            ['templates', 'Templates', <LayoutTemplate size={16} />, allTemplates.length],
          ].map(([id, label, icon, count]) => (
            <button key={id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>
              {icon}{label}<b>{count}</b>
            </button>
          ))}
        </nav>

        {/* tab content */}
        {tab === 'studies' && renderStudiesTab()}
        {tab === 'evidence' && renderEvidenceTab(selEv)}
        {tab === 'map' && renderMapTab(selNode, relLabels)}
        {tab === 'templates' && renderTemplatesTab(selTempl, allTemplates)}
      </div>
    );
  };

  const renderStudiesTab = () => (
    <>
      {/* continue card */}
      {continueStudy && (
        <button className="mcs-cont" onClick={() => openStudy(continueStudy.id)}>
          <div className="mcs-cimg">
            <StudyCover study={continueStudy} workspace={workspace} sessionOwner={sessionOwner} className="" />
            <i />
          </div>
          <div className="mcs-cb">
            <span className="mcs-eb">Continue researching</span>
            <h2>{studyTitle(continueStudy)}</h2>
            <div className="mcs-rg">
              <svg viewBox="0 0 44 44">
                <circle cx="22" cy="22" r="18" fill="none" stroke="currentColor" strokeOpacity=".25" strokeWidth="4" />
                <circle cx="22" cy="22" r="18" fill="none" stroke="currentColor" strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={`${113 * doneSections(continueStudy) / Math.max(1, totalSections(continueStudy))} 113`}
                  transform="rotate(-90 22 22)" />
              </svg>
              <div>
                <b>{doneSections(continueStudy)} of {totalSections(continueStudy)} sections written</b>
                <span>Updated {dateLabel(continueStudy.updatedAt)}</span>
              </div>
            </div>
            <span className="mcs-btn pri" style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              Resume study <ChevronRight size={15} strokeWidth={2.4} />
            </span>
          </div>
        </button>
      )}

      {/* pinned */}
      {pinnedStudies.length > 0 && (
        <>
          <div className="mcs-ph"><b>Pinned playbooks</b><small>Quick access</small></div>
          <div className="mcs-pins">
            {pinnedStudies.map(s => (
              <button key={s.id} className="mcs-pin" onClick={() => openStudy(s.id)}>
                <span className="mcs-mini"><StudyCover study={s} workspace={workspace} sessionOwner={sessionOwner} className="" /></span>
                <div>
                  <b>{studyTitle(s)}</b>
                  <small>{s.instrument || dateLabel(s.updatedAt)} · {s.status || 'Draft'}</small>
                </div>
                <ChevronRight size={15} />
              </button>
            ))}
          </div>
        </>
      )}

      {/* filter bar */}
      <div className="mcs-filter-bar">
        <div className="mcs-search">
          <Search size={17} />
          <input
            type="search" placeholder="Search studies, notes and insights"
            value={query} onChange={e => setQuery(e.target.value)}
          />
        </div>
        <div className="mcs-chips">
          {[
            ['all', 'All', counts.all],
            ['Draft', 'Drafts', counts.Draft],
            ['Validated', 'Validated', counts.Validated],
            ['fav', 'Favorites', counts.fav],
            ['pin', 'Pinned', counts.pin],
            ['arch', 'Archived', counts.arch],
          ].map(([k, label, count]) => (
            <button key={k} className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>
              {label}<b>{count}</b>
            </button>
          ))}
        </div>
        <div className="mcs-fil">
          <select className="mcs-sel" value={sort} onChange={e => setSort(e.target.value)}>
            <option value="recent">Recently updated</option>
            <option value="az">A to Z</option>
          </select>
          <div className="mcs-seg" style={{ marginLeft: 'auto' }}>
            <button className={layout === 'grid' ? 'on' : ''} onClick={() => setLayout('grid')} aria-label="Grid"><Grid size={16} /></button>
            <button className={layout === 'list' ? 'on' : ''} onClick={() => setLayout('list')} aria-label="List"><ListIcon size={16} /></button>
          </div>
        </div>
      </div>

      {/* cards */}
      {filteredStudies.length === 0 ? (
        <div className="mcs-empty">
          <BookOpen size={30} strokeWidth={1.6} />
          <b>No studies match</b>
          <span>Try another filter or start a new case study.</span>
          <button className="mcs-btn pri" onClick={() => createNewStudy(null)}>
            <Plus size={15} strokeWidth={2.4} />New Case Study
          </button>
        </div>
      ) : layout === 'grid' ? (
        <div className="mcs-grid">
          {filteredStudies.map(s => <StudyCard key={s.id} study={s} workspace={workspace} sessionOwner={sessionOwner} onOpen={() => openStudy(s.id)} onFav={e => toggleFav(e, s.id)} />)}
        </div>
      ) : (
        <div className="mcs-list">
          {filteredStudies.map(s => <StudyRow key={s.id} study={s} workspace={workspace} sessionOwner={sessionOwner} onOpen={() => openStudy(s.id)} onFav={e => toggleFav(e, s.id)} />)}
        </div>
      )}
    </>
  );

  const renderEvidenceTab = (selEv) => {
    const evList = workspace.evidence.filter(e => !e.archived);
    const q = evQuery.toLowerCase();
    const filtered = q ? evList.filter(e => (e.title + (e.tags || []).join(' ')).toLowerCase().includes(q)) : evList;
    const studiesForEv = id => workspace.studies.filter(s => (s.evidenceIds || []).includes(id));

    return (
      <>
        <div className="mcs-ev-head">
          <div className="mcs-search">
            <Search size={17} />
            <input type="search" placeholder="Search title, tag or source" value={evQuery} onChange={e => setEvQuery(e.target.value)} />
          </div>
        </div>
        {filtered.length === 0 ? (
          <div className="mcs-empty"><ImageIcon size={28} strokeWidth={1.6} /><b>No evidence yet</b><span>Upload charts and annotated screenshots to build your evidence library.</span></div>
        ) : (
          <div className="mcs-ev-grid">
            {filtered.map(ev => (
              <article key={ev.id} className={`mcs-evc ${selEvId === ev.id ? 'on' : ''}`} onClick={() => setSelEvId(ev.id)}>
                <div className="mcs-evt"><EvidenceThumb evidence={ev} sessionOwner={sessionOwner} className="" /></div>
                <div className="mcs-evb">
                  <b>{ev.title || 'Untitled'}</b>
                  <span>{(ev.tags || []).slice(0, 3).join(' · ')}</span>
                  <small>{studiesForEv(ev.id).length} {studiesForEv(ev.id).length === 1 ? 'study' : 'studies'}</small>
                </div>
              </article>
            ))}
          </div>
        )}
        {selEv && (
          <div className="mcs-ev-panel">
            <div className="mcs-evt" style={{ borderRadius: 14, aspectRatio: '16/9' }}>
              <EvidenceThumb evidence={selEv} sessionOwner={sessionOwner} className="" />
            </div>
            <b style={{ fontSize: 15 }}>{selEv.title || 'Untitled'}</b>
            {(selEv.tags || []).length > 0 && (
              <div className="mcs-tags">{selEv.tags.map(t => <span key={t}>{t}</span>)}</div>
            )}
            {selEv.notes && <p className="mcs-muted">{selEv.notes}</p>}
            <div>
              <div className="mcs-flabel">Used in</div>
              {studiesForEv(selEv.id).map(s => (
                <button key={s.id} onClick={() => openStudy(s.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 12px', borderRadius: 13, background: 'var(--raised)', fontSize: 13, fontWeight: 600, width: '100%', marginBottom: 6 }}>
                  <FileText size={14} /><span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{studyTitle(s)}</span>
                  <StatusBadge status={s.status || 'Draft'} />
                </button>
              ))}
              {studiesForEv(selEv.id).length === 0 && <span className="mcs-muted">Not linked yet</span>}
            </div>
          </div>
        )}
      </>
    );
  };

  const renderMapTab = (selNode, relLabels) => {
    const active = workspace.studies.filter(s => !s.archived);
    const selConns = selNode ? connectionsForStudy(selNode.id) : [];

    return (
      <div className="mcs-map-wrap">
        <div className="mcs-map-head">
          <div className="mcs-chips" style={{ flex: 1, margin: 0, padding: 0 }}>
            {relLabels.map(r => (
              <button key={r} className={mapFilter === r ? 'on' : ''} onClick={() => setMapFilter(r)}>{r}</button>
            ))}
          </div>
          <span className="mcs-muted" style={{ whiteSpace: 'nowrap' }}>{active.length} studies · {(workspace.connections || []).length} connections</span>
        </div>

        {active.length === 0 ? (
          <div className="mcs-empty"><Network size={28} strokeWidth={1.6} /><b>No studies yet</b><span>Create case studies to build your connections map.</span></div>
        ) : (
          <div className="mcs-map-nodes">
            {active.map(s => {
              const conns = connectionsForStudy(s.id);
              const filtered = mapFilter === 'All' ? conns : conns.filter(c => connectionLabel(c.relationship) === mapFilter);
              return (
                <div key={s.id}>
                  <button className={`mcs-node-card ${selNodeId === s.id ? 'on' : ''}`}
                    onClick={() => setSelNodeId(selNodeId === s.id ? null : s.id)}>
                    <div className="mcs-nth"><StudyCover study={s} workspace={workspace} sessionOwner={sessionOwner} className="" /></div>
                    <div className="mcs-nc-body">
                      <b>{studyTitle(s)}</b>
                      <small>{s.status || 'Draft'} · {conns.length} {conns.length === 1 ? 'connection' : 'connections'}</small>
                    </div>
                    <ChevronRight size={16} style={{ color: 'var(--muted)', flex: 'none' }} />
                  </button>
                  {selNodeId === s.id && (
                    <div className="mcs-conns">
                      {filtered.length === 0 && <div className="mcs-no-conn">No {mapFilter !== 'All' ? mapFilter.toLowerCase() + ' ' : ''}connections</div>}
                      {filtered.map(c => {
                        const other = studyById(c.source?.id === s.id ? c.target?.id : c.source?.id);
                        if (!other) return null;
                        const isOut = c.source?.id === s.id;
                        return (
                          <div key={c.id} className="mcs-conn-item">
                            <div>
                              <b>{studyTitle(other)}</b>
                              <span className={`mcs-rel ${connectionRelClass(c.relationship)}`}>
                                {isOut ? 'Outgoing' : 'Incoming'} · {connectionLabel(c.relationship)}
                              </span>
                              {c.explanation && <p>{c.explanation}</p>}
                            </div>
                            <button className="mcs-ic sm" onClick={() => openStudy(other.id)} aria-label="Open study">
                              <ChevronRight size={16} />
                            </button>
                          </div>
                        );
                      })}
                      <button className="mcs-btn full" onClick={() => openStudy(s.id)}>
                        <BookOpen size={15} />Open study
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderTemplatesTab = (selTempl, allTemplates) => (
    <div className="mcs-tpl-layout">
      <div className="mcs-tpl-list">
        {allTemplates.map(t => (
          <button key={t.id} className={`mcs-tpl-item ${selTemplId === t.id || (!selTemplId && t.id === allTemplates[0]?.id) ? 'on' : ''}`}
            onClick={() => setSelTemplId(t.id)}>
            <span className="mcs-tpl-icon"><FileText size={18} /></span>
            <div>
              <b>{t.name}</b>
              <small>{t.description}</small>
            </div>
            <em>{t.builtIn !== false ? 'Built-in' : 'Mine'}</em>
          </button>
        ))}
      </div>
      {selTempl && (
        <div className="mcs-tpl-preview">
          <span className="mcs-eb">{selTempl.builtIn !== false ? 'Built-in template' : 'My template'}</span>
          <h2>{selTempl.name}</h2>
          <p>{selTempl.description}</p>
          <div className="mcs-tpl-secs">
            {templateSectionNames(selTempl).map((name, i) => (
              <div key={name}>
                <b>{String(i + 1).padStart(2, '0')}</b>
                <div>
                  <strong>{name}</strong>
                  {selTempl.guidance?.[name] && <small>{selTempl.guidance[name]}</small>}
                </div>
              </div>
            ))}
          </div>
          <div className="mcs-tpl-actions">
            <button className="mcs-btn pri full" onClick={() => createNewStudy(selTempl.id)}>
              <Plus size={15} strokeWidth={2.4} />Use template
            </button>
          </div>
        </div>
      )}
    </div>
  );

  // =========== Study editor ===========
  const renderStudyEditor = () => {
    const study = workspace.studies.find(s => s.id === openStudyId);
    if (!study) return <div className="mcs-loading">Study not found.</div>;

    const sections = Array.isArray(study.sections) ? study.sections : [];
    const studyEv = workspace.evidence.filter(e => (study.evidenceIds || []).includes(e.id));
    const studyConns = connectionsForStudy(study.id);
    const notebook = workspace.notebooks?.find(n => n.id === study.notebookId);

    return (
      <div className="mcs-sw">
        {/* top bar */}
        <div className="mcs-wbar">
          <button className="mcs-ic" onClick={closeStudy} aria-label="Back"><ChevronRight size={20} style={{ transform: 'rotate(180deg)' }} /></button>
          <div className="mcs-tw">
            <div className="mcs-wmeta">
              <StatusBadge status={study.status || 'Draft'} />
              {notebook && <span className="mcs-wnb">{notebook.name}</span>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                className="mcs-wt"
                value={study.title || ''}
                onChange={e => saveStudyPatch(study.id, { title: e.target.value })}
                placeholder="Study title"
                aria-label="Study title"
              />
              {isSaving && <span className="mcs-sv"><Check size={11} strokeWidth={3} /><em>Saved</em></span>}
            </div>
          </div>
          <button className={`mcs-ic ${study.favorite ? 'on' : ''}`} onClick={e => toggleFav(e, study.id)} aria-label="Favorite">
            <Star size={18} />
          </button>
        </div>

        {/* section nav chips */}
        <div className="mcs-schips">
          {sections.map((name, idx) => {
            const hasContent = hasSectionContent(study, name, idx) || (localSecs[name] || '').length > 10;
            return (
              <button key={name}
                className={`${editSecIdx === idx ? 'cur' : hasContent ? 'ok' : ''}`}
                onClick={() => scrollToSection(idx)}>
                <span>{name}</span>
                {hasContent && <b>✓</b>}
              </button>
            );
          })}
        </div>

        {/* document */}
        <div className="mcs-doc">
          {sections.map((name, idx) => {
            const text = getSectionText(study, name, idx);
            return (
              <div key={name} className="mcs-sec" ref={el => { secRefs.current[idx] = el; }}>
                <div className="mcs-sh2">
                  <span className="mcs-num">{String(idx + 1).padStart(2, '0')}</span>
                  <h3>{name}</h3>
                </div>
                <textarea
                  className="mcs-sbody"
                  value={getSectionText(study, name, idx)}
                  onChange={e => handleSectionChange(name, idx, e.target.value)}
                  onFocus={() => setEditSecIdx(idx)}
                  placeholder={`Write your ${name.toLowerCase()} here…`}
                  rows={6}
                />
              </div>
            );
          })}
          {sections.length === 0 && (
            <div className="mcs-empty"><FileText size={28} strokeWidth={1.6} /><b>No sections</b><span>This study has no sections yet.</span></div>
          )}
        </div>

        {/* dock */}
        <div className="mcs-dock">
          {panelOpen && (
            <div className="mcs-panel">
              <div className="mcs-ptabs">
                {[
                  ['evidence', 'Evidence', studyEv.length],
                  ['connections', 'Links', studyConns.length],
                  ['validation', 'Validation', null],
                ].map(([id, label, count]) => (
                  <button key={id} className={panelTab === id ? 'on' : ''} onClick={() => setPanelTab(id)}>
                    {label}{count !== null && <b>{count}</b>}
                  </button>
                ))}
              </div>
              {panelTab === 'evidence' && (
                <div>
                  {studyEv.length === 0 ? (
                    <div className="mcs-empty" style={{ padding: '20px 0' }}><span>No evidence linked. Open in desktop to add evidence.</span></div>
                  ) : studyEv.map(ev => (
                    <div key={ev.id} className="mcs-pev-item">
                      <div className="mcs-pev-img"><EvidenceThumb evidence={ev} sessionOwner={sessionOwner} className="" /></div>
                      <div><b>{ev.title || 'Untitled'}</b><small>{(ev.tags || []).slice(0, 2).join(' · ')}</small></div>
                    </div>
                  ))}
                </div>
              )}
              {panelTab === 'connections' && (
                <div>
                  {studyConns.length === 0 ? (
                    <div className="mcs-empty" style={{ padding: '20px 0' }}><span>No connections yet.</span></div>
                  ) : studyConns.map(c => {
                    const other = studyById(c.source?.id === study.id ? c.target?.id : c.source?.id);
                    if (!other) return null;
                    return (
                      <div key={c.id} className="mcs-conn-item" style={{ marginBottom: 6 }}>
                        <div>
                          <b>{studyTitle(other)}</b>
                          <span className={`mcs-rel ${connectionRelClass(c.relationship)}`}>{connectionLabel(c.relationship)}</span>
                          {c.explanation && <p>{c.explanation}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {panelTab === 'validation' && (
                <div className="mcs-val">
                  {['Supported', 'Needs more evidence', 'Not supported'].map(opt => (
                    <button key={opt} className={`mcs-val-opt ${study.reviewAssessment === opt ? 'on' : ''}`}
                      onClick={() => saveStudyPatch(study.id, { reviewAssessment: opt })}>
                      <b>{opt}</b>
                      <small>{opt === 'Supported' ? 'The evidence supports the hypothesis.' : opt === 'Needs more evidence' ? 'Collect more data before deciding.' : 'The hypothesis is not supported.'}</small>
                    </button>
                  ))}
                  {study.reviewAssessment === 'Supported' && (
                    <div className="mcs-val-ok">
                      <Check size={24} strokeWidth={2.5} />
                      <b>Assessment recorded</b>
                      <span>Update status to Validated when ready.</span>
                    </div>
                  )}
                  <select
                    className="mcs-sel" style={{ width: '100%' }}
                    value={study.status || 'Draft'}
                    onChange={e => saveStudyPatch(study.id, { status: e.target.value })}>
                    {['Draft', 'Researching', 'Needs validation', 'Validated'].map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
              )}
            </div>
          )}
          <div className="mcs-dtabs">
            {[
              ['evidence', 'Evidence', <ImageIcon size={21} />, studyEv.length],
              ['connections', 'Links', <Link2 size={21} />, studyConns.length],
              ['validation', 'Validate', <ShieldCheck size={21} />, null],
              ['outline', 'Outline', <ListIcon size={21} />, null],
            ].map(([id, label, icon, count]) => (
              <button key={id}
                className={panelOpen && panelTab === id ? 'on' : ''}
                onClick={() => {
                  if (id === 'outline') {
                    setPanelOpen(false);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  } else if (panelOpen && panelTab === id) {
                    setPanelOpen(false);
                  } else {
                    setPanelTab(id); setPanelOpen(true);
                  }
                }}>
                {icon}{label}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  if (libraryState?.status === 'loading') {
    return <div className="mcs-root"><div className="mcs-loading">Loading case studies…</div></div>;
  }
  if (libraryState?.status === 'error') {
    return (
      <div className="mcs-root mcs-wrap">
        <div className="mcs-empty">
          <b>Could not load case studies</b>
          <span>{libraryState.message || 'An error occurred.'}</span>
          {onRetryLoad && <button className="mcs-btn pri" onClick={onRetryLoad}>Retry</button>}
        </div>
      </div>
    );
  }

  return (
    <div className="mcs-root">
      {view === 'lib' && (
        <>
          <header className="mcs-topbar">
            <div className="mcs-crumb"><small>Insights</small><b>Case Studies</b></div>
            <span className="sp" style={{ flex: 1 }} />
          </header>
          {syncConflict && onReconcileConflict && <p className="mcs-sync-conflict" role="alert">Sync conflict: both device and cloud copies are protected. <button type="button" onClick={() => setReconcileOpen(true)}>Review and merge</button></p>}
          {renderLibrary()}
        </>
      )}
      {view === 'study' && renderStudyEditor()}
      {reconcileOpen && syncConflict && onReconcileConflict && <CaseStudyReconciliationDialog conflict={syncConflict} onClose={() => setReconcileOpen(false)} onSave={onReconcileConflict}/>} 
    </div>
  );
}

function StudyCard({ study, workspace, sessionOwner, onOpen, onFav }) {
  const done = doneSections(study);
  const total = totalSections(study);
  const pct = total ? Math.round(done / total * 100) : 0;
  return (
    <article className="mcs-scard" onClick={onOpen}>
      <div className="mcs-th">
        <StudyCover study={study} workspace={workspace} sessionOwner={sessionOwner} className="" />
        <div className="mcs-th-ov" />
        <div className="mcs-tt">
          <StatusBadge status={study.status || 'Draft'} />
          <button className={`mcs-ic ${study.favorite ? 'on' : ''}`} onClick={onFav} aria-label="Favorite">
            <Star size={16} />
          </button>
        </div>
        <div className="mcs-mbt">
          <small>{study.instrument || dateLabel(study.updatedAt)}</small>
          <h3>{studyTitle(study)}</h3>
        </div>
      </div>
      <div className="mcs-bd">
        <p>{sectionText(study, (study.sections || [])[0] || 'Overview', 0).slice(0, 130) || 'No notes yet. Tap to start writing.'}</p>
        <div className="mcs-tags">
          <span>{(study.tradeIds || []).length} trades</span>
          <span>{(study.evidenceIds || []).length} evidence</span>
          {study.pinned && <span className="is-pin"><Pin size={11} />Pinned</span>}
        </div>
        <div className="mcs-ft">
          {study.status === 'Validated' ? (
            <div className="mcs-vl"><ShieldCheck size={14} />Validated</div>
          ) : (
            <div className="mcs-prg">
              <i><s style={{ width: `${pct}%` }} /></i>
              <span>{done}/{total}</span>
            </div>
          )}
          <span className="mcs-dt">{dateLabel(study.updatedAt)}</span>
        </div>
      </div>
    </article>
  );
}

function StudyRow({ study, workspace, sessionOwner, onOpen, onFav }) {
  const done = doneSections(study);
  const total = totalSections(study);
  return (
    <article className="mcs-row" onClick={onOpen}>
      <div className="mcs-rth">
        <StudyCover study={study} workspace={workspace} sessionOwner={sessionOwner} className="" />
      </div>
      <div className="mcs-rb">
        <small>{study.instrument || ''}</small>
        <h3>{studyTitle(study)}</h3>
        <StatusBadge status={study.status || 'Draft'} />
      </div>
      <div className="mcs-rr">
        <button className={`mcs-ic sm ${study.favorite ? 'on' : ''}`} onClick={onFav} aria-label="Favorite"><Star size={16} /></button>
        <span className="mcs-dt" style={{ fontSize: "var(--text-min)" }}>{study.status === 'Validated' ? '✓' : `${done}/${total}`}</span>
      </div>
    </article>
  );
}
