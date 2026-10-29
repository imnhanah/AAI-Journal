import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {migrateProfileCaseStudyLibrary} from './profileCaseStudy.js';
import {caseStudyBackup} from './caseStudyWorkspace.js';

const workspace = (title, extra = {}) => ({
  notebooks:[{id:'notebook',name:`${title} notebook`}],
  studies:[{id:'study',title,evidenceIds:['evidence'],notebookId:'notebook',relatedStudyIds:['study'],evidencePlacements:{evidence:{caption:`${title} caption`,observation:`${title} observation`,richDocument:{type:'doc',content:[{type:'text',text:title}]},sectionNotes:{Overview:`${title} note`},annotations:[{id:`annotation-${title}`}],board:{objects:[{id:`text-${title}`,tool:'text',text:title,start:{x:20,y:30}}]}}}}],
  evidence:[{id:'evidence',title:`${title} chart`}],
  personalTemplates:[{id:'template',name:`${title} template`,sections:['Overview'],metadata:{title}}],
  ...extra,
});

test('profile-first consolidation preserves an existing library and every dependent legacy reference',()=>{
  const profile=workspace('Profile');
  const legacy=workspace('Legacy');
  const result=migrateProfileCaseStudyLibrary(profile,[{id:'A',caseStudyWorkspace:legacy}]);
  assert.equal(result.migrated,true); assert.deepEqual(result.sourceIds,['A']);
  assert.equal(result.workspace.studies.length,2);
  assert.equal(result.workspace.studies[0].title,'Profile');
  const migrated=result.workspace.studies.find(study=>study.title==='Legacy');
  assert.equal(migrated.id,'legacy-A-study-study');
  assert.deepEqual(migrated.evidenceIds,['legacy-A-evidence-evidence']);
  assert.ok(migrated.evidencePlacements['legacy-A-evidence-evidence'].board.objects[0]);
  assert.deepEqual(migrated.evidencePlacements['legacy-A-evidence-evidence'].annotations,[{id:'annotation-Legacy'}]);
  assert.equal(migrated.evidencePlacements['legacy-A-evidence-evidence'].sectionNotes.Overview,'Legacy note');
  assert.equal(migrated.evidencePlacements['legacy-A-evidence-evidence'].richDocument.content[0].text,'Legacy');
  assert.equal(migrated.notebookId,'legacy-A-notebook-notebook');
  assert.deepEqual(migrated.relatedStudyIds,['legacy-A-study-study']);
  const template=result.workspace.personalTemplates.find(item=>item.name==='Legacy template');
  assert.equal(template.id,'legacy-A-template-template'); assert.equal(template.metadata.title,'Legacy');
  assert.deepEqual(result.workspace.migrationState.legacyProfileConsolidation.sourceAccountIds,['A']);
  assert.equal(result.workspace.legacyAccountLibraries[0].accountId,'A');
});

test('consolidation is idempotent, accepts newly arriving sources, and ignores duplicate or malformed descriptors',()=>{
  const first=migrateProfileCaseStudyLibrary(null,[{id:'A',caseStudyWorkspace:workspace('A')}]).workspace;
  const repeated=migrateProfileCaseStudyLibrary(first,[{id:'A',caseStudyWorkspace:workspace('A')}]);
  assert.equal(repeated.migrated,false);
  const withNew=migrateProfileCaseStudyLibrary(first,[{id:'A',caseStudyWorkspace:workspace('A')},{id:'B',caseStudyWorkspace:workspace('B')}]);
  assert.equal(withNew.migrated,true); assert.deepEqual(withNew.sourceIds,['B']);
  const duplicate={...first,legacyAccountLibraries:[...first.legacyAccountLibraries,first.legacyAccountLibraries[0],{accountId:'B',workspace:workspace('B')},{accountId:null,workspace:workspace('Ignored')},{accountId:'broken',workspace:null}]};
  const deduped=migrateProfileCaseStudyLibrary(duplicate,[]);
  assert.equal(deduped.migrated,true); assert.deepEqual(deduped.sourceIds,['B']);
  assert.equal(deduped.workspace.legacyAccountLibraries.length,2);
});

test('a failed persistence attempt cannot mark the saved library; retry produces the same candidate and backups retain metadata',()=>{
  const saved=workspace('Profile');
  const before=structuredClone(saved);
  const first=migrateProfileCaseStudyLibrary(saved,[{id:'A',caseStudyWorkspace:workspace('A')}]);
  // Simulate a failed write: the original saved value has not acquired a marker.
  assert.deepEqual(saved,before);
  const retry=migrateProfileCaseStudyLibrary(saved,[{id:'A',caseStudyWorkspace:workspace('A')}]);
  assert.deepEqual(retry.workspace,first.workspace);
  const backup=caseStudyBackup(first.workspace);
  assert.deepEqual(backup.workspace.migrationState,first.workspace.migrationState);
  assert.deepEqual(backup.workspace.legacyAccountLibraries,first.workspace.legacyAccountLibraries);
});

test('the application resolves failed loads without auto-saving a consolidation candidate',()=>{
  const journal=readFileSync(new URL('./TradingJournal.jsx',import.meta.url),'utf8');
  assert.match(journal,/resolveProfileCaseStudyVisibility/);
  assert.match(journal,/Recovery previews are intentionally not persisted here/);
  assert.doesNotMatch(journal,/const migrated=migrateProfileCaseStudyLibrary\(loaded\.data,accounts\);/);
});

test('profile library migration SQL merges descriptors without replacing existing records and enforces authenticated ownership',()=>{
  const migration=readFileSync(new URL('../supabase/profile_case_study_library_migration.sql',import.meta.url),'utf8');
  const verifier=readFileSync(new URL('../supabase/verify_installation.sql',import.meta.url),'utf8');
  assert.match(migration,/profile_case_study_libraries/);
  assert.match(migration,/enable row level security/i);
  assert.match(migration,/user_id=auth\.uid\(\)/);
  assert.match(migration,/tj_merge_case_study_legacy_sources/);
  assert.match(migration,/on conflict \(user_id\) do update/i);
  assert.match(migration,/completed \? source_id/);
  assert.doesNotMatch(migration,/delete\s+from\s+public\.accounts/i);
  assert.match(verifier,/profile_case_study_libraries/);
});
