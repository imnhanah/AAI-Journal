import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source=readFileSync(new URL('./CaseStudyLibrary.jsx',import.meta.url),'utf8');
const css=readFileSync(new URL('./caseStudyEditor.css',import.meta.url),'utf8');

test('Case Study Editor mounts the profile-persisted Connections panel and app-rendered create/edit dialog',()=>{
  assert.match(source,/function StudyConnectionsPanel\(\{study,workspace,onOpenStudy,onCreate,onEdit,onRemove\}\)/);
  assert.match(source,/\['Evidence','Trades','Links','Connections','Actions'\]/);
  assert.match(source,/panel === 'Connections' && <StudyConnectionsPanel/);
  assert.match(source,/function ConnectionDialog\(\{study,studies,connection=null,onClose,onSave\}\)/);
  assert.match(source,/Find Case Study/);
  assert.match(source,/role="listbox" aria-label="Available Case Studies"/);
  assert.match(source,/id="case-study-connection-relationship"/);
  assert.doesNotMatch(source,/<select[^>]*case-study-connection/);
  assert.match(source,/event\.key==='Escape' && !saving/);
  assert.match(css,/\.cse-connection-dialog \{[^}]*background:var\(--surface\)[^}]*border:1px solid var\(--border\)/);
});

test('connection rows distinguish incoming, outgoing, symmetric records and use safe open/edit/remove handlers',()=>{
  assert.match(source,/const outgoing=connection\.source\.id===study\.id/);
  assert.match(source,/isDirectionalCaseStudyRelationship\(connection\.relationship\)/);
  assert.match(source,/This study \$\{relation\.toLowerCase\(\)\} connected study/);
  assert.match(source,/Connected study \$\{relation\.toLowerCase\(\)\} this study/);
  assert.match(source,/onClick=\{\(\)=>onOpenStudy\(counterpartId\)\}/);
  assert.match(source,/title:'Remove connection\?'/);
  assert.match(source,/Neither Case Study or its research will be deleted/);
});

test('connection writes await persistence and retain dialog input when a save fails',()=>{
  assert.match(source,/const persistConnectionWorkspace = async \(next, previous\)/);
  assert.match(source,/const persisted=await save\(next,true\)/);
  assert.match(source,/workspaceRef\.current=previous/);
  assert.match(source,/Connection could not be saved\. Your changes are still available to retry\./);
  assert.match(source,/if \(saving\) return;/);
  assert.match(source,/\{saving\?'Saving…':editing\?'Save connection':'Create connection'\}/);
});

test('Connections tab bar and compact controls remain usable in a narrow editor panel',()=>{
  assert.match(source,/className="cse-panel-tabs-viewport"><div className="cse-panel-tabs"/);
  assert.match(css,/\.cse-panel-tabs-viewport \{[^}]*height:45px[^}]*overflow:hidden/);
  assert.match(css,/\.cse-panel-tabs \{[^}]*display:flex[^}]*overflow-x:auto[^}]*scrollbar-width:none[^}]*-ms-overflow-style:none/);
  assert.match(css,/\.cse-panel-tabs::-webkit-scrollbar \{[^}]*display:none!important[^}]*height:0!important/);
  assert.match(css,/\.cse-panel-tabs button \{[^}]*flex:0 0 auto[^}]*white-space:nowrap/);
  assert.match(css,/\.cse-connection-list header \{[^}]*grid-template-columns:minmax\(0,1fr\) auto/);
  assert.match(css,/\.cse-connection-list p \{[^}]*overflow-wrap:anywhere/);
  assert.match(css,/\.cse-connection-list footer \.cse-connection-open \{[^}]*background:var\(--accent\)/);
  assert.match(css,/\.cse-connection-candidates > button\.is-selected \{[^}]*background:var\(--accent-soft\)/);
  assert.match(css,/@media \(max-width: 680px\) \{[\s\S]*?\.cse-connection-list header \{ grid-template-columns:1fr; \}/);
});

test('relationship dropdown in the connection dialog uses an anchored, stacked application popup',()=>{
  assert.match(css,/\.cse-connection-field \.case-library-dropdown \{[^}]*position:relative[^}]*width:100%/);
  assert.match(css,/\.cse-connection-field \.case-library-dropdown__menu \{[^}]*display:grid[^}]*position:absolute[^}]*top:100%[^}]*width:100%[^}]*z-index:90/);
  assert.match(css,/\.cse-connection-field \.case-library-dropdown__menu button \{[^}]*display:flex[^}]*width:100%/);
  assert.match(css,/\.cse-connection-field \.case-library-dropdown\[data-placement="up"\] \.case-library-dropdown__menu \{[^}]*bottom:100%/);
});
