import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');

test('recovery libraries stay visible and offer a confirmed upload instead of a silent replacement', () => {
  const journal=read('./TradingJournal.jsx');
  const library=read('./CaseStudyLibrary.jsx');
  assert.match(journal,/const prepareCaseStudyLibraryUpload = async \(workspace\)/);
  assert.match(journal,/profileCaseStudyState\.status === 'recovery' \? \(temporaryCaseStudyWorkspaceOwnerRef\.current === user\.id \? temporaryCaseStudyWorkspace : profileCaseStudyWorkspace\)/);
  assert.match(journal,/setProfileCaseStudySyncStatus\('Uploading'\)/);
  assert.match(journal,/if \(saved\.conflict\)[\s\S]*persistCaseStudyConflict/);
  assert.match(journal,/Case Study Library uploaded and confirmed in cloud storage/);
  assert.match(library,/title:replacesCloud \? 'Replace the cloud Case Study Library\?' : 'Upload this device library\?'/);
  assert.match(library,/confirmLabel:replacesCloud \? 'Replace cloud copy' : 'Upload device library'/);
  assert.match(library,/This device has \$\{localSummary\}\. The cloud already has \$\{cloudSummary\}/);
});

test('the prepared database repair exposes the exact client RPC without touching Case Study JSON rows', () => {
  const sql=read('../supabase/profile_case_study_library_contract_repair.sql');
  assert.match(sql,/create or replace function public\.tj_save_profile_case_study_library\(/i);
  assert.match(sql,/expected_revision bigint,[\s\S]*next_library jsonb/i);
  assert.match(sql,/security definer/i);
  assert.match(sql,/grant execute on function public\.tj_save_profile_case_study_library\(bigint, jsonb\)\s+to authenticated/i);
  assert.doesNotMatch(sql,/delete\s+from\s+public\.profile_case_study_libraries/i);
  assert.doesNotMatch(sql,/update\s+public\.profile_case_study_libraries\s+set\s+library/i);
});
