import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const library = readFileSync(new URL('./CaseStudyLibrary.jsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('./desktopCaseStudies.css', import.meta.url), 'utf8');

test('desktop Case Studies library shows v2; phones keep the old library', () => {
  assert.match(library, /const CASE_STUDIES_V2 = true;/);
  assert.match(library, /const CS2_DESKTOP = '\(min-width: 768px\)';/);
  assert.match(library, /import '\.\/desktopCaseStudies\.css';/);
  assert.match(library, /if \(CASE_STUDIES_V2 && cs2Desktop && screen === 'library'\) \{/);
  assert.match(library, /<main className="cs2"/);
});

test('Case Studies v2 has the hero, tabs, filters and both layouts', () => {
  for (const label of ['Studies', 'Evidence', 'Connections', 'Templates']) assert.ok(library.includes(`'${label}'`), label);
  for (const chip of ['Drafts', 'Validated', 'Favorites', 'Pinned', 'Archived']) assert.ok(library.includes(chip), chip);
  assert.match(library, /className=\{workspace\.settings\.view === 'list' \? 'cs2-list' : 'cs2-grid'\}/);
  assert.match(library, /<div className="cs2-lay" role="group" aria-label="Layout">/);
});

test('Case Studies library toolbar matches the desktop mockup controls', () => {
  const toolbar = library.match(/<div className="cs2-tb">([\s\S]*?)<\/div>\n          \{chipFiltered/)[1];
  assert.match(toolbar, /id="cs2-notebook"/);
  assert.match(toolbar, /id="cs2-instrument"/);
  assert.match(toolbar, /id="cs2-sort"/);
  assert.doesNotMatch(toolbar, /id="cs2-tag"|>Notebook<\/button>/);
  assert.match(css, /\.cs2-tb \.case-library-dropdown__trigger \{display:flex;align-items:center;justify-content:space-between;/);
});

test('the study card menu has every action and closes only on outside presses', () => {
  for (const action of ['Open study', 'Pin to top', 'Duplicate', 'Export study', 'Archive', 'Delete study']) assert.ok(library.includes(action), action);
  assert.match(library, /!cardMenuRoot\.current\?\.contains\(event\.target\) && !event\.target\.closest\?\.\(':is\(\.cs2-card,\.cs2-row\) \.cs2-more'\)/);
  assert.match(library, /onClose: \(\) => setCardMenu\(null\)/);
});

test('Case Studies v2 styles are desktop-only, reflow with the side panel and respect reduced motion', () => {
  assert.match(css, /^@media \(min-width:768px\) \{/m);
  assert.match(css, /@container journal-workspace \(max-width:760px\) \{[\s\S]*?\.cs2-tabs \{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css, /@media \(min-width:768px\) and \(prefers-reduced-motion:reduce\)/);
});

test('Evidence tab v2 has search, upload, cards and an editable details aside', () => {
  assert.match(library, /\{tabOf === 'evidence' \? <Cs2Evidence evidence=\{workspace\.evidence\}/);
  assert.match(library, /placeholder="Search title, tag or source"/);
  assert.match(library, /<input type="file" accept="image\/\*" multiple hidden onChange=\{upload\}/);
  assert.match(library, /const invalid = files\.map\(\(file\) => validateEvidenceImage\(file\)\)\.find\(Boolean\);/);
  for (const label of ['"Title"', '"Source"', '"Research notes"', 'Used in {related.length}', 'Delete evidence']) assert.ok(library.includes(label), label);
});

test('Open viewer hands the evidence to the study editor viewer', () => {
  assert.match(library, /const openEditor = \(id, viewerId = null\) =>/);
  assert.match(library, /initialViewerId=\{editorViewer\}/);
  assert.match(library, /const \[viewerId,setViewerId\] = useState\(initialViewerId\);/);
});

test('the Case Studies search box opts out of the underline field style', () => {
  const fields = readFileSync(new URL('./writingFields.css', import.meta.url), 'utf8');
  assert.equal(fields.split(':not(.cse-writing > textarea):not(.cs2-sr input)').length - 1, 3);
});

test('Connections tab v2 has filters, a draggable map, a details aside and a connect dialog', () => {
  assert.match(library, /: tabOf === 'connections' \? <Cs2Connections studies=\{studies\} connections=\{workspace\.connections \|\| \[\]\}/);
  assert.match(library, /onCreate=\{async \(fields\) => \{ const created = await addConnection\(fields\); notify\('Connection created'\); return created; \}\}/);
  assert.match(library, /Drag studies to arrange · click one to inspect/);
  assert.match(library, /const CS2_REL_TONE = \{ supports: 'gain', contradicts: 'loss', 'builds-on': 'acc', 'related-to': 'blu', 'alternative-approach': 'warn' \};/);
  for (const label of ['Connect studies', 'Connect to another study', 'Why are these studies connected?', 'Remove connection', 'Arrow keys move it.']) assert.ok(library.includes(label), label);
  assert.match(css, /\.cs2-map \{position:relative;overflow:hidden;/);
});

test('Templates tab v2 lists, previews, uses and duplicates templates', () => {
  assert.match(library, /: tabOf === 'templates' \? <Cs2Templates templates=\{creationTemplates\} onUse=\{\(id\) => setCs2NewDialog\(\{ templateId: id \}\)\}/);
  for (const label of ['Built-in template · protected', 'My template', 'Use template', 'Duplicate template', 'New template']) assert.ok(library.includes(label), label);
  assert.match(library, /const selected = list\.find\(\(item\) => item\.id === selectedId\) \|\| list\[0\] \|\| null;/);
});

test('desktop New Case Study is a modal; phones keep the full-page create screen', () => {
  assert.match(library, /onClick=\{\(\) => setCs2NewDialog\(\{ templateId: null \}\)\}><Plus size=\{16\}\/>New Case Study/);
  assert.match(library, /const created = await createStudyFromSetup\(draft, template\);/);
  assert.match(library, /if \(screen === 'create'\) return <NewCaseStudyWorkspace/);
  assert.match(library, /Give your study a title to continue\./);
});

test('Add from template uses the v2 dialog on desktop and keeps the old one on phones', () => {
  assert.match(library, /window\.matchMedia\(CS2_DESKTOP\)\.matches \? <Cs2AddTemplateDialog study=\{study\}/);
  assert.match(library, /: <ApplyTemplateDialog study=\{study\}/);
  assert.match(css, /\.tj-root \.cs2\.cs2-bk \{position:fixed;inset:0;z-index:300;/);
});

test('a library refresh that overlaps a save cannot replace the newer in-memory library', () => {
  const journal = readFileSync(new URL('./TradingJournal.jsx', import.meta.url), 'utf8');
  assert.match(journal, /const caseStudySaveSeqRef = useRef\(0\);/);
  assert.match(journal, /if \(caseStudySaveSeqRef\.current !== saveSeqAtStart && profileCaseStudyWorkspaceOwnerRef\.current === user\.id && profileCaseStudyWorkspaceRef\.current\) return;/);
  assert.match(journal, /caseStudySaveSeqRef\.current\+=1;\n\s*try \{ return await saveCaseStudyWorkspaceNow\(caseStudyWorkspace\); \}\n\s*finally \{ caseStudySaveSeqRef\.current\+=1; \}/);
});

test('desktop study workspace replaces the editor on desktop; phones keep the old editor', () => {
  assert.match(library, /if \(mode !== 'Review' && typeof window !== 'undefined' && window\.matchMedia\(CS2_DESKTOP\)\.matches\) return <>\n\s*<Cs2StudyWorkspace /);
  assert.match(library, /onOpenReview=\{\(\) => setMode\('Review'\)\}/);
  assert.match(library, /return <main className="case-study-editor">/);
});

test('study header controls stay on one centre line', () => {
  assert.match(css, /\.cs2-wbar \.cse-connection-field \{align-self:center;gap:0;margin-top:0;\}/);
});

test('every section is one document with a shared toolbar, rename, remove and add', () => {
  assert.match(library, /<RichDocumentEditor bare document=\{migrateSectionRichDocument\(study, name, index\)\}/);
  assert.match(library, /onFocusEditor=\{setActiveEditor\}/);
  assert.match(library, /<Cs2Toolbar editor=\{activeEditor\}/);
  assert.match(library, /else if \(!isSafeLink\(value\)\) \{ setNotice\('Use an http, https, or mailto link\.'\); return; \}/);
  assert.match(library, /const renameStudySection = \(study, index, next\) =>/);
  assert.match(library, /const removeStudySection = \(study, index\) =>/);
  const editor = readFileSync(new URL('./RichDocumentEditor.jsx', import.meta.url), 'utf8');
  assert.match(editor, /export async function insertImageInView\(view,file,coordinates\)/);
  assert.match(editor, /bare=false, placeholder='', onFocusEditor=null/);
});

test('the workspace side panel has Evidence, Links, Connections and Validate', () => {
  assert.match(library, /\[\['evidence', 'Evidence', linkedEvidence\.length\], \['links', 'Links', linkedTrades\.length \+ linkedMarkups\.length\], \['connections', 'Connections', connections\.length\], \['validate', 'Validate', null\]\]/);
  assert.match(library, /const readiness = reviewReadiness\(study\.review\);/);
  assert.match(library, /Complete the three items above to validate\./);
  for (const label of ['Upload a new image', 'Link a trade', 'Connect to a study', 'Reopen for edits', 'Open full review', 'Save as template']) assert.ok(library.includes(label) || library.includes(label.replace('a trade', '{noun}')), label);
});

test('a section rename moves its notes; removing the first section hands over the overview', async () => {
  const { migrateSectionRichDocument, richDocumentText } = await import('./studyRichDocument.js');
  const study = { sections: ['A', 'B'], sectionDocuments: { A: { version: 1, content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'alpha' }] }] } } }, sectionNotes: { A: 'alpha' } };
  const rename = new Function('return ' + library.match(/const renameStudySection = (\(study, index, next\) => \{[\s\S]*?\n\};)/)[1].replace(/;$/, ''))();
  const renamed = { ...study, ...rename(study, 0, 'Alpha') };
  assert.deepEqual(renamed.sections, ['Alpha', 'B']);
  assert.equal(richDocumentText(migrateSectionRichDocument(renamed, 'Alpha', 0)), 'alpha');
  assert.equal(renamed.sectionNotes.A, undefined);
});

test('desktop evidence viewer v2: rail with swatches, details with linked studies and tags, annotation count', () => {
  const viewer = readFileSync(new URL('./ChartViewer.jsx', import.meta.url), 'utf8');
  const viewerCss = readFileSync(new URL('./desktopChartViewer.css', import.meta.url), 'utf8');
  const evidence = readFileSync(new URL('./chartEvidence.js', import.meta.url), 'utf8');
  assert.match(viewer, /const v2=typeof window!=='undefined'&&!!window\.matchMedia\?\.\('\(min-width: 768px\)'\)\.matches;/);
  assert.match(viewer, /<main className=\{`cv cv-board\$\{v2\?' cv-v2':''\}`\}>/);
  assert.match(viewer, /\{ANNOTATION_SWATCHES\.map\(color=><button key=\{color\}/);
  for (const label of ['Linked case studies', 'Tags', 'cv-count', 'cv-details-toggle', 'aria-label="Undo"', 'aria-label="Redo"', 'aria-label="Delete selected"']) assert.ok(viewer.includes(label), label);
  assert.match(evidence, /export const ANNOTATION_SWATCHES = Object\.freeze\(\['#B89AFF', '#FBBF24', '#F87171', '#2FD6A0'\]\);/);
  assert.match(viewerCss, /^@media \(min-width:768px\) \{/m);
  assert.match(library, /<ChartViewer study=\{study\} evidence=\{linkedEvidence\} allEvidence=\{workspace\.evidence\} studies=\{workspace\.studies\}/);
});

test('desktop Case Studies use their own confirm dialog and toasts; phones keep the app dialog', () => {
  const dialog = readFileSync(new URL('./ConfirmationDialog.jsx', import.meta.url), 'utf8');
  assert.match(dialog, /export const ConfirmationContext=createContext\(async\(\)=>false\);\nconst C=ConfirmationContext;/);
  assert.match(library, /if \(!desktop\) return appConfirm\(options\);/);
  assert.match(library, /<ConfirmationContext\.Provider value=\{confirm\}><Cs2ToastContext\.Provider value=\{notify\}>/);
  assert.match(library, /return <Cs2Feedback><CaseStudyLibraryReady /);
  assert.match(library, /if \(open\[open\.length - 1\] !== backdrop\.current\) return;/);
  for (const message of ['Pinned to top', 'Study deleted', 'Library exported', 'Library restored', 'Connection created', 'Evidence attached', 'Study validated']) assert.ok(library.includes(message), message);
});

test('restore reports a bad file inline on desktop instead of a browser alert', () => {
  assert.match(library, /catch \{ if \(!cs2Desktop\) window\.alert\('Choose a Case Study Library backup created by this journal\.'\); return false; \}/);
  assert.match(library, /\{restoreDialog && <Cs2RestoreDialog /);
  assert.match(library, /That file is not a Case Study Library backup from this journal\./);
  assert.match(css, /\.tj-root \.cs2\.cs2-toast \{position:fixed;/);
});

test('a selected annotation keeps its own thickness so the slider previews live', () => {
  const viewer = readFileSync(new URL('./ChartViewer.jsx', import.meta.url), 'utf8');
  const viewerCss = readFileSync(new URL('./chartViewer.css', import.meta.url), 'utf8');
  assert.match(viewer, /strokeWidth:settings\.thickness\|\|3/);
  assert.doesNotMatch(viewer, /strokeWidth:selected\?/);
  assert.match(viewerCss, /\.cv-board-objects \.is-selected\{stroke:var\(--warn\)\}/);
});

test('desktop viewer text: compact editor (Enter adds, Shift+Enter new line, Esc cancels) and boxed labels', () => {
  const viewer = readFileSync(new URL('./ChartViewer.jsx', import.meta.url), 'utf8');
  const viewerCss = readFileSync(new URL('./desktopChartViewer.css', import.meta.url), 'utf8');
  assert.match(viewer, /if\(event\.key==='Enter'&&\(event\.metaKey\|\|event\.ctrlKey\|\|\(v2&&!event\.shiftKey\)\)\)\{event\.preventDefault\(\);commitText\(false\);\}/);
  assert.match(viewer, /\{v2&&<div className="cv-ted-actions" role="toolbar"/);
  assert.match(viewer, /\{!v2&&<div className="cv-board-text-bubble"/);
  assert.match(viewer, /const shape=\(item,key,selected,boxed=false\)=>\{/);
  assert.match(viewerCss, /\.cv\.cv-v2 \.cv-ted \{display:flex;/);
});
