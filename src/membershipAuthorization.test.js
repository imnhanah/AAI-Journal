import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const foundation = readFileSync(new URL('../supabase/membership_authorization_foundation.sql', import.meta.url), 'utf8');
const activation = readFileSync(new URL('../supabase/case_study_evidence_owner_upload_activation.sql', import.meta.url), 'utf8');
const existingStorage = readFileSync(new URL('../supabase/case_study_evidence_storage.sql', import.meta.url), 'utf8');

test('membership foundation is sparse, RLS-protected, and defaults non-assigned users to Free', () => {
  assert.match(foundation, /create table if not exists public\.tj_memberships/i);
  assert.match(foundation, /primary key references auth\.users\(id\)/i);
  assert.match(foundation, /check \(membership in \('owner', 'free'\)\)/i);
  assert.match(foundation, /alter table public\.tj_memberships enable row level security/i);
  assert.match(foundation, /revoke all on table public\.tj_memberships from public, anon, authenticated/i);
  assert.match(foundation, /return coalesce\(effective_membership, 'free'\)/i);
});

test('membership lookup has no caller-controlled account argument or public execution', () => {
  assert.match(foundation, /create or replace function public\.tj_current_membership\(\)/i);
  assert.match(foundation, /caller_id uuid := auth\.uid\(\)/i);
  assert.match(foundation, /security definer/i);
  assert.match(foundation, /set search_path = pg_catalog, public/i);
  assert.match(foundation, /revoke all on function public\.tj_current_membership\(\) from public, anon/i);
  assert.match(foundation, /grant execute on function public\.tj_current_membership\(\) to authenticated/i);
});

test('future owner-only upload policy is separate and keeps the existing private read policy untouched', () => {
  assert.match(activation, /Phase 3 activation only/i);
  assert.match(activation, /public\.tj_is_current_owner\(\)/i);
  assert.match(activation, /for insert to authenticated/i);
  assert.match(activation, /storage\.foldername\(name\)\)\[1\] = auth\.uid\(\)::text/i);
  assert.match(existingStorage, /case study evidence read own/i);
  assert.match(existingStorage, /for select to authenticated/i);
  assert.doesNotMatch(activation, /for select/i);
});
