export const profileLibraryLoadFailure = error => {
  const message = String(error?.message || error || 'The Case Study Library could not be loaded.');
  const detail = `${message} ${error?.code || ''}`;
  // The client reads the revisioned profile-library contract. A database that
  // has only the earlier table migration cannot satisfy that contract either:
  // PostgREST reports a missing `revision` column or RPC in its schema cache.
  if (/profile_case_study_libraries|relation .* does not exist|42P01|\brevision\b.*(?:column|schema cache|could not find)|(?:column|schema cache|could not find).*\brevision\b|tj_save_profile_case_study_library|PGRST202/i.test(detail)) return { kind:'unavailable', message:'Case Study cloud synchronization is unavailable because its profile-library storage upgrade is not available.' };
  if (/42501|permission denied|row-level security|\brls\b|not authorized|forbidden|401|403/i.test(detail)) return { kind:'authorization', message:'You are not authorized to read this profile Case Study Library.' };
  if (/network|fetch|timeout|offline|failed to fetch|connection/i.test(detail)) return { kind:'network', message:'The Case Study Library could not be reached. Check your connection and try again.' };
  return { kind:'error', message };
};
