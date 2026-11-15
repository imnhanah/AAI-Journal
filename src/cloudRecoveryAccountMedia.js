// Explicit recovery reads the image field omitted by the normal slim journal.
// No cloud writes or local mutations occur here. The caller supplies its
// captured metadata revisions and session barrier for the whole export.
export async function loadRecoveryAccountMedia({cloud,userId,accounts,versions,assertSession}) {
  assertSession();
  if (!userId || !Array.isArray(accounts) || !Array.isArray(versions)) throw new Error('Account recovery metadata is incomplete. Sync and retry.');
  const expected = new Map(versions.map(row => [row.id,row.updated_at]));
  if (expected.size !== accounts.length || accounts.some(row => !expected.get(row.id))) throw new Error('Account recovery metadata is incomplete. Sync and retry.');
  const media = new Map();
  let after = null;
  while (true) {
    assertSession();
    let request = cloud.from('accounts').select('id,profile_image,updated_at').eq('user_id',userId).order('id',{ascending:true}).limit(500);
    if (after !== null) request = request.gt('id',after);
    const {data,error} = await request;
    assertSession();
    if (error || !Array.isArray(data)) throw new Error('Could not read account images for recovery. Retry before relying on this export.');
    if (!data.length) break;
    for (const row of data) {
      if (typeof row.id !== 'string' || (after !== null && row.id <= after) || media.has(row.id)
        || !Object.hasOwn(row,'profile_image') || (row.profile_image !== null && typeof row.profile_image !== 'string')) {
        throw new Error('Account image recovery returned an incomplete page. Retry.');
      }
      media.set(row.id,row);
      after = row.id;
    }
    // A service row cap may be lower than the requested page size. Only an
    // empty page proves that the owner-scoped account list is complete.
  }
  if (media.size !== expected.size || [...media].some(([id,row]) => !expected.has(id) || row.updated_at !== expected.get(id))) {
    throw new Error('Accounts changed during recovery. Sync and retry the export.');
  }
  return accounts.map(account => ({...account,profileImage:media.get(account.id).profile_image || ''}));
}
