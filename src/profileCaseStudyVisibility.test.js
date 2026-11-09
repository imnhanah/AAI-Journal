import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {profileLibraryLoadFailure} from './profileCaseStudyLoadFailure.js';
import {resolveProfileCaseStudyVisibility} from './profileCaseStudyVisibility.js';

const workspace = label => ({
  notebooks:[{id:`notebook-${label}`,name:`${label} notebook`}],
  studies:[{id:`study-${label}`,title:label,evidenceIds:[`evidence-${label}`],evidencePlacements:{[`evidence-${label}`]:{caption:`${label} caption`,annotations:[{id:`annotation-${label}`}],board:{objects:[{id:`text-${label}`,tool:'text',text:label}]}}},sectionNotes:{Overview:`${label} note`},richDocument:{type:'doc',content:[{type:'text',text:label}]}}],
  evidence:[{id:`evidence-${label}`,title:`${label} chart`}],
  personalTemplates:[{id:`template-${label}`,name:`${label} template`,sections:['Overview']}],
});

test('profile cloud failures are classified without treating a failed response as empty',()=>{
  assert.equal(profileLibraryLoadFailure({message:'relation "profile_case_study_libraries" does not exist',code:'42P01'}).kind,'unavailable');
  assert.equal(profileLibraryLoadFailure({message:'Could not find the revision column of profile_case_study_libraries in the schema cache'}).kind,'unavailable');
  assert.equal(profileLibraryLoadFailure({message:'Could not find the function public.tj_save_profile_case_study_library in the schema cache',code:'PGRST202'}).kind,'unavailable');
  assert.equal(profileLibraryLoadFailure({message:'new row violates row-level security policy',code:'42501'}).kind,'authorization');
  assert.equal(profileLibraryLoadFailure({message:'Failed to fetch'}).kind,'network');
});

test('missing profile storage produces a read-only legacy preview with all dependent content intact',()=>{
  const result=resolveProfileCaseStudyVisibility({loaded:{error:'storage unavailable',failure:{kind:'unavailable'}},accounts:[{id:'one',caseStudyWorkspace:workspace('one')},{id:'two',caseStudyWorkspace:workspace('two')}],lastValidWorkspace:null});
  assert.equal(result.status,'recovery');
  assert.deepEqual(result.sourceIds,['one','two']);
  assert.equal(result.workspace.studies.length,2);
  const recovered=result.workspace.studies.find(study=>study.title==='two');
  assert.equal(recovered.evidencePlacements['evidence-two'].board.objects[0].text,'two');
  assert.equal(recovered.evidencePlacements['evidence-two'].annotations[0].id,'annotation-two');
  assert.equal(recovered.sectionNotes.Overview,'two note');
  assert.equal(recovered.richDocument.content[0].text,'two');
});

test('network and authorization failures preserve the last valid library and never construct an empty replacement',()=>{
  const last=workspace('confirmed');
  for (const kind of ['network','authorization','error']) {
    const result=resolveProfileCaseStudyVisibility({loaded:{error:`${kind} failure`,failure:{kind}},accounts:[],lastValidWorkspace:last});
    assert.equal(result.status,'error');
    assert.deepEqual(result.workspace,last);
  }
});

test('a successful null response is the only genuinely empty writable state, while legacy sources stay read-only',()=>{
  const empty=resolveProfileCaseStudyVisibility({loaded:{data:null},accounts:[],lastValidWorkspace:null});
  assert.equal(empty.status,'ready'); assert.equal(empty.workspace.studies.length,0);
  const legacy=resolveProfileCaseStudyVisibility({loaded:{data:null},accounts:[{id:'one',caseStudyWorkspace:workspace('one')}],lastValidWorkspace:null});
  assert.equal(legacy.status,'recovery');
});

test('the application gates saves and mounts a non-editable recovery view until an authoritative load succeeds',()=>{
  const journal=readFileSync(new URL('./TradingJournal.jsx',import.meta.url),'utf8');
  const library=readFileSync(new URL('./CaseStudyLibrary.jsx',import.meta.url),'utf8');
  assert.match(journal,/resolveProfileCaseStudyVisibility\(\{ loaded, accounts, lastValidWorkspace \}\)/);
  assert.match(journal,/if \(profileCaseStudyState\.status !== 'ready'\) throw new Error/);
  assert.match(journal,/onRetryLoad=\{\(\)=>setProfileCaseStudyRetry/);
  assert.match(library,/if \(libraryState\.status === 'recovery'\) return <CaseStudyRecoveryLibrary/);
  assert.match(library,/if \(libraryState\.status !== 'ready'\) return <CaseStudyLoadState/);
  assert.match(library,/saving, creating, editing, evidence changes, and template changes are disabled/i);
});

test('temporary recovery keeps its protected local-only state without rendering the retired development banner',()=>{
  const library=readFileSync(new URL('./CaseStudyLibrary.jsx',import.meta.url),'utf8');
  assert.doesNotMatch(library,/Cloud sync unavailable/);
  assert.doesNotMatch(library,/case-work-in-progress/);
  assert.doesNotMatch(library,/Work in Progress — Coming Soon/);
});

test('ready Case Study Library keeps actionable conflict feedback without a passive header sync label',()=>{
  const library=readFileSync(new URL('./CaseStudyLibrary.jsx',import.meta.url),'utf8');
  assert.match(library,/syncConflict && <p className="case-sync-conflict" role="alert">/);
  assert.doesNotMatch(library,/case-header-actions"><span className=\{`case-save-state/);
});
