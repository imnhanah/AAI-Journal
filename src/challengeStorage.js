// One storage boundary for every challenge operation. Local mode must never
// contact Supabase, including schema probes and delete/setup flows.
export function createChallengeStorage({ isLocal, local, cloud }) {
  const table = scope => scope === 'balance' ? 'balance_challenge_progress' : 'challenge_progress';
  const column = scope => scope === 'balance' ? 'balance_id' : 'account_id';
  return {
    read: (scope, id, userId) => isLocal()
      ? local.readChallengeProgress(scope, id, userId)
      : cloud.from(table(scope)).select('*').eq(column(scope), id).eq('user_id', userId).maybeSingle(),
    save: (scope, payload) => isLocal()
      ? local.saveChallengeProgress(scope, payload)
      : cloud.from(table(scope)).upsert(payload, { onConflict: column(scope) }),
    remove: (scope, id, userId) => isLocal()
      ? local.deleteChallengeProgress(scope, id, userId)
      : cloud.from(table(scope)).delete().eq(column(scope), id).eq('user_id', userId),
    probe: (scope, id) => isLocal()
      ? Promise.resolve({ error: null })
      : cloud.from(table(scope)).select('automation').eq(column(scope), id).limit(0),
    snapshot: async userId => {
      if (isLocal()) {
        const backup = await local.exportLocalJournal(userId);
        return backup.data.challengeProgress || { account: {}, balance: {} };
      }
      const result = { account: {}, balance: {} };
      for (const scope of ['account', 'balance']) {
        const { data, error } = await cloud.from(table(scope)).select('*').eq('user_id', userId);
        if (error) throw error;
        for (const row of data || []) result[scope][row[column(scope)]] = row;
      }
      return result;
    },
  };
}
