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
  assert.doesNotMatch(editor, /cse-chart-grid|London sweep|NY response/);
  assert.doesNotMatch(css, /cse-chart-grid|cse-trend|cse-zone|cse-analysis-canvas/);
});

test('Write keeps evidence below writing without duplicate section tiles and Evidence details stay compact', () => {
  const editor = readFileSync(new URL('./CaseStudyLibrary.jsx', import.meta.url), 'utf8');
  const css = readFileSync(new URL('./caseStudyEditor.css', import.meta.url), 'utf8');
  assert.match(editor, /mode === 'Write' && <>\{writing\}\{evidenceShelf\}<\/>/);
  assert.match(editor, /Link shared evidence/);
  assert.match(editor, /Use for Split \/ Analyze/);
  assert.match(editor, /<summary>Details<\/summary>/);
  assert.match(css, /\.cse-evidence-linker/);
  assert.match(css, /\.cse-evidence-actions details/);
});
