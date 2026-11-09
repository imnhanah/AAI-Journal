import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { activeEvidenceId, hasChartEvidenceSection, outlineHasVirtualEvidence } from './caseStudyPresentation.js';

test('Chart evidence outline entry is virtual only when a persisted section is absent', () => {
  assert.equal(hasChartEvidenceSection(['Overview', 'Chart evidence', 'Conclusion']), true);
  assert.equal(outlineHasVirtualEvidence(['Overview', 'Chart evidence']), false);
  assert.equal(outlineHasVirtualEvidence(['Overview', 'Notes']), true);
});

test('selected evidence remains valid across zero, one, and multiple linked images', () => {
  const evidence = [{id:'one'}, {id:'two'}];
  assert.equal(activeEvidenceId([], 'one'), null);
  assert.equal(activeEvidenceId([evidence[0]], null), 'one');
  assert.equal(activeEvidenceId(evidence, 'two'), 'two');
  assert.equal(activeEvidenceId(evidence, 'missing'), 'one');
});

test('Write, Split, and Analyze use linked evidence instead of the legacy mock canvas', () => {
  const editor = readFileSync(new URL('./CaseStudyLibrary.jsx', import.meta.url), 'utf8');
  const css = readFileSync(new URL('./caseStudyEditor.css', import.meta.url), 'utf8');
  assert.match(editor, /mode === 'Write'.*evidenceShelf/s);
  assert.match(editor, /mode === 'Split'.*cse-split-workspace/s);
  assert.match(editor, /nextMode === 'Analyze' && activeEvidence/);
  assert.match(editor, /<ChartViewer study=\{study\} evidence=\{linkedEvidence\}/);
  assert.match(editor, /Use for Split \/ Analyze/);
  assert.doesNotMatch(editor, /cse-chart-grid|cse-trend|cse-zone/);
  assert.doesNotMatch(css, /cse-chart-grid|cse-trend|cse-zone|cse-analysis-canvas/);
});

test('Write keeps evidence below writing without duplicate section tiles and Evidence details stay compact', () => {
  const editor = readFileSync(new URL('./CaseStudyLibrary.jsx', import.meta.url), 'utf8');
  const css = readFileSync(new URL('./caseStudyEditor.css', import.meta.url), 'utf8');
  assert.match(editor, /mode === 'Write' && <>\{writing\}\{evidenceShelf\}<\/>/);
  assert.match(editor, /Link from Evidence Library/);
  assert.match(editor, /Use for Split \/ Analyze/);
  assert.match(editor, /<summary>Study-specific details<\/summary>/);
  assert.match(css, /\.cse-evidence-linker/);
  assert.match(css, /\.cse-evidence-actions details/);
});

test('Research Notes mounts the Tiptap document surface without a fixed textarea canvas', () => {
  const editor = readFileSync(new URL('./CaseStudyLibrary.jsx', import.meta.url), 'utf8');
  const css = readFileSync(new URL('./caseStudyEditor.css', import.meta.url), 'utf8');
  const richCss = readFileSync(new URL('./richDocumentEditor.css', import.meta.url), 'utf8');
  assert.match(editor, /const writing = <div className="cse-writing"><RichDocumentEditor/);
  assert.match(css, /\.cse-writing > textarea \{ display:block; width:100%; min-height:0;/);
  assert.doesNotMatch(css, /\.cse-writing textarea \{[^}]*min-height: 270px/);
  assert.match(richCss, /\.case-study-editor \.rde-content \{ background:transparent; border:0; box-shadow:none;/);
});

test('long Study Outlines have a bounded independent scroller and do not rely on a sticky editor toolbar',()=>{
  const css=readFileSync(new URL('./caseStudyEditor.css',import.meta.url),'utf8');
  assert.match(css,/\.cse-header \{[\s\S]*position: relative;/);
  assert.doesNotMatch(css,/\.cse-header \{[\s\S]{0,120}position: sticky;/);
  assert.match(css,/\.cse-outline \{[^}]*max-height:calc\(100dvh - 48px\)[^}]*overflow:hidden[^}]*position:sticky/);
  assert.match(css,/\.cse-outline ol \{[^}]*flex:1 1 auto[^}]*min-height:0[^}]*overflow:auto/);
  assert.match(css,/\.cse-outline li button \{[^}]*overflow-wrap:anywhere/);
});

test('Case Study Library, Template Manager, and Editor use the shared full-width workspace',()=>{
  const libraryCss=readFileSync(new URL('./caseStudyLibraryRedesign.css',import.meta.url),'utf8');
  const editorCss=readFileSync(new URL('./caseStudyEditor.css',import.meta.url),'utf8');
  assert.match(libraryCss,/\.case-library--phase-one \{[^}]*width:100%[^}]*max-width:none[^}]*margin:0[^}]*padding:28px 0 0/);
  assert.match(libraryCss,/\.case-v2-template-layout \{ grid-template-columns:minmax\(230px,3fr\) minmax\(0,7fr\); \}/);
  assert.match(libraryCss,/@media \(max-width:780px\) \{ \.case-v2-template-layout \{ grid-template-columns:1fr; \} \}/);
  assert.match(editorCss,/\.case-study-editor \{[^}]*padding: 0;/);
  assert.match(editorCss,/\.case-study-editor--review \{ width:100%; max-width:none; margin:0; \}/);
});

test('Case Study and Chart Viewer toolbars use locally aligned, wrapping control groups',()=>{
  const viewer=readFileSync(new URL('./ChartViewer.jsx',import.meta.url),'utf8');
  const viewerCss=readFileSync(new URL('./chartViewer.css',import.meta.url),'utf8');
  const libraryCss=readFileSync(new URL('./caseStudyLibraryRedesign.css',import.meta.url),'utf8');
  assert.match(viewer,/className="cv-board-header-left"/);
  assert.match(viewer,/className="cv-board-header-actions"/);
  assert.match(viewer,/className="cv-board-bottom-controls"/);
  assert.match(viewerCss,/\.cv-board-chrome > header\{[^}]*align-items:center[^}]*display:flex/);
  assert.match(viewerCss,/\.cv-board-bottom-controls,.cv-board-zoom,.cv-board-bottom-actions \{[^}]*align-items:center[^}]*flex-wrap:wrap/);
  assert.match(libraryCss,/\.case-library--phase-one \.case-toolbar \{[^}]*display:flex[^}]*flex-wrap:wrap/);
  assert.match(libraryCss,/\.case-library--phase-one \.case-search \{[^}]*flex:1 1 260px/);
});

test('Research Notes uses a centered, continuous document canvas without adding a nested editor scroller',()=>{
  const editor=readFileSync(new URL('./RichDocumentEditor.jsx',import.meta.url),'utf8');
  const richCss=readFileSync(new URL('./richDocumentEditor.css',import.meta.url),'utf8');
  const workspaceCss=readFileSync(new URL('./caseStudyEditor.css',import.meta.url),'utf8');
  assert.match(editor,/className="rde-document-canvas"/);
  assert.match(richCss,/\.rde-document-canvas \{[^}]*max-width:900px[^}]*width:100%/);
  assert.match(richCss,/\.rde-toolbar \{[^}]*background:transparent[^}]*border-bottom:1px solid var\(--border\)[^}]*position:static/);
  assert.match(richCss,/\.case-study-editor \.rde-content \{[^}]*font-size:16px[^}]*line-height:1\.7[^}]*max-width:none/);
  assert.doesNotMatch(richCss,/\.rde-document-canvas \{[^}]*overflow:/);
  assert.match(workspaceCss,/\.cse-document-workspace \{[^}]*overflow:visible[^}]*width:100%/);
});

test('Research Notes anchors its Write canvas left while defaulting document content to left alignment',()=>{
  const richCss=readFileSync(new URL('./richDocumentEditor.css',import.meta.url),'utf8');
  assert.match(richCss,/\.rde-document-canvas \{[^}]*max-width:900px[^}]*text-align:left/);
  assert.match(richCss,/\.case-study-editor \.cse-workspace--write \.rde-document-canvas \{ margin-left:0; margin-right:0; padding-left:clamp\(32px,3vw,48px\); \}/);
  assert.match(richCss,/@media \(max-width:620px\) \{[\s\S]*?\.case-study-editor \.cse-workspace--write \.rde-document-canvas \{ padding-left:20px; padding-right:20px; \}/);
  assert.match(richCss,/\.rde-page \{[^}]*text-align:left/);
  assert.match(richCss,/\.case-study-editor \.rde-content \{[^}]*text-align:left/);
  assert.match(richCss,/Per-block Tiptap[\s\S]*?inline declaration and wins/);
});

test('Research Notes explicitly removes visual boundaries only from its own canvas wrappers',()=>{
  const editor=readFileSync(new URL('./RichDocumentEditor.jsx',import.meta.url),'utf8');
  const richCss=readFileSync(new URL('./richDocumentEditor.css',import.meta.url),'utf8');
  const writingCss=readFileSync(new URL('./writingFields.css',import.meta.url),'utf8');
  assert.match(richCss,/\.case-study-editor \.cse-workspace--write \.rde-document-canvas,[\s\S]*?\.case-study-editor \.cse-workspace--write \.rde-content\.ProseMirror \{ background:transparent !important; border:0 !important; box-shadow:none !important; outline:0 !important; \}/);
  assert.doesNotMatch(richCss,/\.rde-document-canvas \{[^}]*border:/);
  assert.doesNotMatch(richCss,/\.rde-document-canvas \{[^}]*box-shadow:/);
  const ordinaryFocusGroup=writingCss.match(/\/\* Keyboard users retain[\s\S]*?\*\/([\s\S]*?)\/\* Minimal underline input system/);
  assert.ok(ordinaryFocusGroup);
  assert.doesNotMatch(ordinaryFocusGroup[1],/\.rde-content\[contenteditable="true"\]/);
  assert.match(writingCss,/\.tj-root \.rde-content\[contenteditable="true"\]:focus-visible \{ outline:0 !important;/);
  assert.doesNotMatch(editor,/Research Notes editor diagnostic/);
});

test('Write mode uses the dedicated document workspace instead of the bordered shared workspace card',()=>{
  const library=readFileSync(new URL('./CaseStudyLibrary.jsx',import.meta.url),'utf8');
  const css=readFileSync(new URL('./caseStudyEditor.css',import.meta.url),'utf8');
  assert.match(library,/mode === 'Write' \? 'cse-document-workspace cse-workspace--write'/);
  assert.match(css,/\.cse-outline,\s*\.cse-workspace,\s*\.cse-panel \{[\s\S]*?border: 1px solid var\(--border\)/);
  assert.match(css,/\.cse-document-workspace \{ align-self:start; background:transparent; border:0; border-radius:0; box-shadow:none; outline:0; overflow:visible; width:100%; \}/);
});

test('Evidence Library uses reusable shared sources, upload feedback, and a responsive gallery-details layout',()=>{
  const editor=readFileSync(new URL('./CaseStudyLibrary.jsx',import.meta.url),'utf8');
  const css=readFileSync(new URL('./caseStudyLibraryRedesign.css',import.meta.url),'utf8');
  assert.match(editor,/function EvidenceLibrary/);
  assert.match(editor,/Search title, tag, or source/);
  assert.match(editor,/Upload evidence/);
  assert.match(editor,/onDragOver/);
  assert.match(editor,/clipboardData/);
  assert.match(editor,/saveEvidenceImage/);
  assert.match(editor,/Link from Evidence Library/);
  assert.match(editor,/Study-specific details/);
  assert.match(css,/\.case-evidence-layout \{[^}]*grid-template-columns:minmax\(0,7fr\) minmax\(260px,3fr\)/);
  assert.match(css,/\.case-evidence-gallery--grid/);
});

test('Research Notes can promote an existing local image to shared evidence without copying its blob',()=>{
  const editor=readFileSync(new URL('./RichDocumentEditor.jsx',import.meta.url),'utf8');
  const library=readFileSync(new URL('./CaseStudyLibrary.jsx',import.meta.url),'utf8');
  const storage=readFileSync(new URL('./caseStudyEvidenceImages.js',import.meta.url),'utf8');
  assert.match(editor,/Save to Evidence Library/);
  assert.match(editor,/View in Evidence Library/);
  assert.match(editor,/Saved to Evidence Library\. The inline image remains unchanged\./);
  assert.match(library,/readCaseStudyDocumentImage\(imageRef\)/);
  assert.match(library,/attachDocumentImageEvidence\(currentWorkspace,selectedId,evidence\)/);
  assert.match(library,/documentImageRef:imageRef/);
  assert.match(storage,/isDocumentImageReference/);
  assert.match(storage,/readCaseStudyDocumentImage/);
});

test('the selected Research Notes image action preserves node selection and never opens the generic uploader',()=>{
  const editor=readFileSync(new URL('./RichDocumentEditor.jsx',import.meta.url),'utf8');
  const library=readFileSync(new URL('./CaseStudyLibrary.jsx',import.meta.url),'utf8');
  assert.match(editor,/const keepNodeSelected=event=>event\.preventDefault\(\)/);
  assert.match(editor,/rde-evidence-action" onMouseDown=\{keepNodeSelected\}/);
  assert.match(editor,/onRequestEvidence\?\.\(\{ref:node\.attrs\.src,preview:resolved\}\)/);
  assert.match(editor,/evidenceActions\.current=\{documentEvidence,onRequestEvidence:setEvidenceImage,onViewEvidence\}/);
  assert.doesNotMatch(editor,/setEvidenceDialog/);
  assert.match(library,/onClick=\{onAddEvidence\}>.*Add shared evidence/);
  assert.match(library,/\{evidenceDialog && <EvidenceDialog/);
});

test('direct Evidence uploads retain previews and keep the dialog open until durable workspace persistence succeeds',()=>{
  const library=readFileSync(new URL('./CaseStudyLibrary.jsx',import.meta.url),'utf8');
  const css=readFileSync(new URL('./caseStudyLibraryRedesign.css',import.meta.url),'utf8');
  assert.match(library,/URL\.createObjectURL\(file\)/);
  assert.match(library,/Selected evidence preview/);
  assert.match(library,/const persisted=await save\(next,true\)/);
  assert.match(library,/if \(!persisted\)/);
  assert.match(library,/Your selected files and details are still available to retry/);
  assert.match(library,/if\(savingRef\.current\)return/);
  assert.match(library,/onAdd=\{\(fields\)=>addEvidence\(fields\)\}/);
  assert.match(library,/linkToSelectedStudy:true/);
  assert.match(css,/\.case-evidence-upload-list img/);
});

test('the Case Study Evidence panel mounts the existing upload dialog in Editor mode and shows source details',()=>{
  const library=readFileSync(new URL('./CaseStudyLibrary.jsx',import.meta.url),'utf8');
  assert.match(library,/if \(screen === 'editor' && selected\) return <>[\s\S]*?onAddEvidence=\{\(\)=>setEvidenceDialog\(true\)\}[\s\S]*?\{evidenceDialog && <EvidenceDialog onClose=\{\(\)=>setEvidenceDialog\(false\)\} onSave=\{\(fields\)=>addEvidence\(fields,\{linkToSelectedStudy:true\}\)\}\/>\}/);
  assert.match(library,/\{item\.kind\|\|'Reference'\} · \{item\.source \|\| 'Shared source'\}/);
  assert.match(library,/checked=\{\(study\.evidenceIds\|\|\[\]\)\.includes\(item\.id\)\}/);
});

test('Case Study card menus close on outside interaction, Escape, action selection, and navigation',()=>{
  const library=readFileSync(new URL('./CaseStudyLibrary.jsx',import.meta.url),'utf8');
  assert.match(library,/const cardMenuRoot = useRef\(null\)/);
  assert.match(library,/if \(!cardMenu\) return undefined;[\s\S]*?event\.key === 'Escape'\) setCardMenu\(null\)/);
  assert.match(library,/if \(!cardMenu\) return undefined;[\s\S]*?document\.addEventListener\('pointerdown', close\)/);
  assert.match(library,/setCardMenu\(null\);\s*setHeaderMenuOpen\(false\);[\s\S]*?\}, \[screen, libraryView, sort,/);
  assert.match(library,/const runAction=\(action\)=>event=>\{event\.stopPropagation\(\);action\(\);onMenu\(\);\}/);
  assert.match(library,/aria-haspopup="menu" aria-expanded=\{menuOpen\} aria-controls=\{menuId\}/);
});

test('Case Study Library filters use the application-rendered accessible dropdown instead of native selects',()=>{
  const library=readFileSync(new URL('./CaseStudyLibrary.jsx',import.meta.url),'utf8');
  const css=readFileSync(new URL('./caseStudyLibraryRedesign.css',import.meta.url),'utf8');
  assert.doesNotMatch(library,/<select className="case-library-select"/);
  assert.match(library,/function CaseStudyDropdown\(\{id,label,value,options,onChange,openId,setOpenId/);
  assert.match(library,/aria-haspopup="listbox" aria-expanded=\{open\}/);
  assert.match(library,/role="listbox"/);
  assert.match(library,/role="option" aria-selected=\{option\.value===value\}/);
  assert.match(library,/document\.addEventListener\('pointerdown',outside\)/);
  assert.match(library,/if\(event\.key==='Escape'\)\{event\.preventDefault\(\);close\(true\);return;\}/);
  assert.match(library,/setPlacement\(bounds\.bottom>window\.innerHeight-12/);
  assert.match(library,/id="case-study-notebook" label="Filter by notebook"/);
  assert.match(library,/id="case-study-status" label="Filter by status"/);
  assert.match(library,/id="case-study-sort" label="Sort studies"/);
  assert.match(library,/id="case-study-apply-template" label="Choose a template"/);
  assert.doesNotMatch(library,/Template<select/);
  assert.match(library,/setLibraryDropdown\(null\)/);
  assert.match(css,/\.case-library--phase-one \.case-library-dropdown__trigger \{[^}]*background:var\(--raised\)[^}]*border:1px solid var\(--border\)[^}]*border-radius:10px/);
  assert.match(css,/\.case-library--phase-one \.case-library-dropdown__menu \{[^}]*background:var\(--surface\)[^}]*z-index:25/);
  assert.match(css,/\.case-library--phase-one :is\(\.case-search,\.case-v2-template-library \.case-search\) input \{[^}]*caret-color:transparent/);
  assert.match(css,/input:focus \{ caret-color:var\(--text\); \}/);
});

test('Archived Case Studies reuse the persisted archive flag, shared cards, filters, and restore action',()=>{
  const library=readFileSync(new URL('./CaseStudyLibrary.jsx',import.meta.url),'utf8');
  assert.match(library,/const archivedStudies = useMemo\(\(\) => workspace\.studies\.filter\(\(item\) => item\.archived\)/);
  assert.match(library,/const collectionStudies = libraryView === 'archived' \? archivedStudies : studies/);
  assert.match(library,/Archived <span>\{archivedStudies\.length\}<\/span>/);
  assert.match(library,/libraryView === 'archived' \? 'Archived studies'/);
  assert.match(library,/No archived studies/);
  assert.match(library,/study\.archived\?<button[\s\S]*?onPatch\(\{archived:false\}\)[\s\S]*?Restore to Library/);
  assert.match(library,/onPatch\(\{archived:true\}\)/);
});
