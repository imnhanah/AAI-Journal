import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source=readFileSync(new URL('./CaseStudyLibrary.jsx',import.meta.url),'utf8');
const css=readFileSync(new URL('./caseStudyEditor.css',import.meta.url),'utf8');

test('Case Study right panel defaults to a persisted 360px push-layout width with bounded keyboard and pointer resizing',()=>{
  assert.match(source,/CASE_STUDY_PANEL_WIDTH_KEY='aai-case-study-editor-panel-width'/);
  assert.match(source,/CASE_STUDY_PANEL_MIN_WIDTH=320/);
  assert.match(source,/CASE_STUDY_PANEL_DEFAULT_WIDTH=360/);
  assert.match(source,/CASE_STUDY_PANEL_MAX_WIDTH=480/);
  assert.match(source,/Number\.isFinite\(numeric\) \? Math\.max\(CASE_STUDY_PANEL_MIN_WIDTH,Math\.min\(CASE_STUDY_PANEL_MAX_WIDTH,numeric\)\) : CASE_STUDY_PANEL_DEFAULT_WIDTH/);
  assert.match(source,/if \(stored!==null && String\(width\)!==stored\) window\.localStorage\.setItem\(CASE_STUDY_PANEL_WIDTH_KEY,String\(width\)\)/);
  assert.match(source,/useState\(readCaseStudyPanelWidth\)/);
  assert.match(source,/window\.localStorage\.setItem\(CASE_STUDY_PANEL_WIDTH_KEY,String\(value\)\)/);
  assert.match(source,/startWidth\+\(startX-moveEvent\.clientX\)/);
  assert.match(source,/\['ArrowLeft','ArrowRight','Home','End'\]/);
  assert.match(source,/className="cse-panel-resize-handle" role="separator"/);
});

test('resizable panel keeps the editor in a three-column reflow and falls back to the existing stacked panel below 940px',()=>{
  assert.match(source,/style=\{\{'--cse-panel-width':`\$\{panelWidth\}px`\}\}/);
  assert.match(css,/\.cse-layout \{[\s\S]*?grid-template-columns: 220px minmax\(0, 1fr\) minmax\(320px, min\(480px, var\(--cse-panel-width, 360px\)\)\)/);
  assert.match(css,/\.cse-panel-resize-handle \{[^}]*left:-8px[^}]*width:16px[^}]*cursor:col-resize/);
  assert.match(css,/\.cse-panel-resize-handle::before \{[^}]*width:4px[^}]*height:44px/);
  assert.match(css,/@media \(max-width: 940px\) \{[\s\S]*?\.cse-panel \{[^}]*grid-column: 1 \/ -1[^}]*min-width:0/);
  assert.match(css,/@media \(max-width: 940px\) \{[\s\S]*?\.cse-panel-resize-handle \{ display:none;/);
});

test('the workspace keeps the Case Study panel in its right-hand grid track through desktop container widths',()=>{
  const adaptive=readFileSync(new URL('./workspaceAdaptive.css',import.meta.url),'utf8');
  const desktopRule=adaptive.match(/@container journal-workspace \(max-width:1180px\) \{([\s\S]*?)\n\}/)?.[1] || '';
  assert.doesNotMatch(desktopRule,/\.cse-layout/);
  assert.doesNotMatch(desktopRule,/\.cse-panel/);
  assert.match(adaptive,/@container journal-workspace \(max-width:860px\) \{[\s\S]*?\.cse-layout,.cse-layout--no-outline,.cse-layout--no-panel \{ grid-template-columns:1fr;/);
});
