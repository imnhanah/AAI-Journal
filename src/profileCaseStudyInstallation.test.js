import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const installSql = () => readFileSync(new URL('../supabase/profile_case_study_library_concurrency_install.sql', import.meta.url), 'utf8');

test('initial Case Study installation establishes an authenticated revision RPC without direct browser writes', () => {
  const sql=installSql();
  assert.match(sql,/create table if not exists public\.profile_case_study_libraries/i);
  assert.match(sql,/revision bigint not null default 0/i);
  assert.match(sql,/updated_at timestamptz not null default clock_timestamp\(\)/i);
  assert.match(sql,/security definer/i);
  assert.match(sql,/requesting_user uuid := auth\.uid\(\)/i);
  assert.match(sql,/if requesting_user is null then[\s\S]*Authentication is required/i);
  assert.match(sql,/set search_path = pg_catalog, public/i);
  assert.match(sql,/where row\.user_id = requesting_user[\s\S]*and row\.revision = expected_revision/i);
  assert.match(sql,/revoke all on table public\.profile_case_study_libraries from public, anon, authenticated/i);
  assert.match(sql,/grant select on table public\.profile_case_study_libraries to authenticated/i);
  assert.doesNotMatch(sql,/grant\s+(?:select,\s*)?(?:insert|update|delete)[^\n]*on table public\.profile_case_study_libraries to authenticated/i);
});

test('initial Case Study installation returns saved and conflict payloads compatible with the existing client', () => {
  const sql=installSql();
  const client=readFileSync(new URL('./caseStudyCloud.js', import.meta.url), 'utf8');
  assert.match(sql,/returns table\(outcome text, library jsonb, revision bigint, updated_at timestamptz\)/i);
  assert.match(sql,/return query select 'conflict'::text/i);
  assert.match(sql,/outcome := 'saved';/i);
  assert.match(client,/select\('library,revision,updated_at'\)/);
  assert.match(client,/rpc\('tj_save_profile_case_study_library', \{ expected_revision:expectedRevision \?\? null, next_library:library \}\)/);
});

test('read-only installation verifier inspects the revision contract, policy, grants, and trigger without journal-row queries', () => {
  const sql=readFileSync(new URL('../supabase/verify_case_study_library_sync_installation.sql', import.meta.url), 'utf8');
  assert.match(sql,/begin read only;/i);
  assert.match(sql,/profile_case_study_libraries/i);
  assert.match(sql,/tj_save_profile_case_study_library/i);
  assert.match(sql,/pg_policies/i);
  assert.match(sql,/role_table_grants/i);
  assert.match(sql,/pg_trigger/i);
  assert.doesNotMatch(sql,/\b(?:insert|update|delete|alter|create|drop)\b/i);
});
