import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('read-only Case Study recovery uses a contained normal library presentation without enabling edits',()=>{
  const css=readFileSync(new URL('./caseStudyLibraryRedesign.css',import.meta.url),'utf8');
  const component=readFileSync(new URL('./CaseStudyLibrary.jsx',import.meta.url),'utf8');
  assert.match(css,/\.case-library--recovery \{ display:grid/);
  assert.match(css,/\.case-recovery-preview \{ background:var\(--surface\)/);
  assert.match(css,/\.case-recovery-integrity dl \{ display:grid/);
  assert.match(component,/saving, creating, editing, evidence changes, and template changes are disabled/i);
  assert.match(component,/function CaseStudyRecoveryLibrary/);
  assert.match(component,/if \(libraryState\.status === 'recovery'\) return <CaseStudyRecoveryLibrary/);
  assert.match(component,/Recovered study content is protected until the authoritative profile library is available/);
  assert.doesNotMatch(component,/case-recovery-preview[\s\S]{0,600}onSaveWorkspace/);
});
