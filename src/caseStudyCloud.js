import { supabase } from './supabaseClient.js';
import { profileLibraryLoadFailure } from './profileCaseStudyLoadFailure.js';
export { profileLibraryLoadFailure } from './profileCaseStudyLoadFailure.js';
const unavailable = error => profileLibraryLoadFailure(error).kind === 'unavailable';
export async function loadProfileCaseStudyLibrary(userId) {
  const { data, error } = await supabase.from('profile_case_study_libraries').select('library,revision,updated_at').eq('user_id', userId).maybeSingle();
  if (error) {
    const failure=profileLibraryLoadFailure(error);
    return { data:null, error:failure.message, unavailable:failure.kind === 'unavailable', failure };
  }
  // `null` with no error is a successfully read, genuinely empty library.
  return { data:data?.library ?? null, revision:data?.revision ?? null, updatedAt:data?.updated_at || null, failure:null };
}
export async function saveProfileCaseStudyLibrary(userId, library, expectedRevision) {
  // The server function compares the revision in its single write. Never
  // replace this with a read followed by an unconditional client upsert.
  const { data, error } = await supabase.rpc('tj_save_profile_case_study_library', { expected_revision:expectedRevision ?? null, next_library:library }).single();
  if (error) {
    const failure=profileLibraryLoadFailure(error);
    return { error:failure.message, unavailable:unavailable(error), failure };
  }
  if (data?.outcome === 'conflict') return { conflict:true, data:data.library ?? null, revision:data.revision ?? null, updatedAt:data.updated_at ?? null };
  if (data?.outcome !== 'saved') return { error:'The Case Study Library save was not confirmed by cloud storage.' };
  return { data:data.library, revision:data.revision, updatedAt:data.updated_at };
}
