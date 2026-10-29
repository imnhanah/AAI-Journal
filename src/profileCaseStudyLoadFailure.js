export const profileLibraryLoadFailure = error => {
  const message = String(error?.message || error || 'The Case Study Library could not be loaded.');
  const detail = `${message} ${error?.code || ''}`;
  if (/profile_case_study_libraries|relation .* does not exist|42P01/i.test(detail)) return { kind:'unavailable', message:'Profile Case Study cloud storage is not available yet.' };
  if (/42501|permission denied|row-level security|\brls\b|not authorized|forbidden|401|403/i.test(detail)) return { kind:'authorization', message:'You are not authorized to read this profile Case Study Library.' };
  if (/network|fetch|timeout|offline|failed to fetch|connection/i.test(detail)) return { kind:'network', message:'The Case Study Library could not be reached. Check your connection and try again.' };
  return { kind:'error', message };
};
