import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('ordinary Case Study hydration uses the stable library shell instead of the recovery presentation',()=>{
  const component=readFileSync(new URL('./CaseStudyLibrary.jsx',import.meta.url),'utf8');
  assert.match(component,/function CaseStudyLoadingShell/);
  assert.match(component,/if \(libraryState\.status === 'loading'\) return <CaseStudyLoadingShell/);
  assert.doesNotMatch(component,/isLoading \? 'Loading Case Study Library/);
});

test('genuine recovery and load errors retain their separate guarded presentations',()=>{
  const component=readFileSync(new URL('./CaseStudyLibrary.jsx',import.meta.url),'utf8');
  assert.match(component,/if \(libraryState\.status === 'recovery'\) return <CaseStudyRecoveryLibrary/);
  assert.match(component,/if \(libraryState\.status !== 'ready'\) return <CaseStudyLoadState/);
  assert.match(component,/saving, creating, editing, evidence changes, and template changes are disabled/i);
});

test('profile-level Case Study refreshes retain a confirmed workspace instead of remounting it as loading',()=>{
  const journal=readFileSync(new URL('./TradingJournal.jsx',import.meta.url),'utf8');
  assert.match(journal,/current\.status === 'ready' && profileCaseStudyWorkspaceOwnerRef\.current === user\.id/);
  assert.match(journal,/remount the library or editor through a transient recovery-style state/);
});
