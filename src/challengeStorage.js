import {journalWriteSafetyEnabled, journalWriteProtocol, writeOperationKey} from './journalWriteSafety.js';
// One storage boundary for every challenge operation. Local mode must never
// contact Supabase, including schema probes and delete/setup flows.
export function createChallengeStorage({ isLocal, local, cloud }) {
  const table = scope => scope === 'balance' ? 'balance_challenge_progress' : 'challenge_progress';
  const column = scope => scope === 'balance' ? 'balance_id' : 'account_id';
  return {
    read: (scope, id, userId) => isLocal()
      ? local.readChallengeProgress(scope, id, userId)
      : cloud.from(table(scope)).select('*').eq(column(scope), id).eq('user_id', userId).maybeSingle(),
    save: async (scope, payload, baseRevision = undefined) => {
      if (isLocal()) return local.saveChallengeProgress(scope,payload);
      if (globalThis.__tjCloudWritesPaused===true) return {error:{message:'Saving is paused for this account.'}};
      if (!journalWriteSafetyEnabled) return cloud.from(table(scope)).upsert(payload,{onConflict:column(scope)});
      if (baseRevision===undefined) return {error:{message:'Load the saved challenge before saving. Your draft is kept.'}};
      const {updated_at:clientTime,...value}=payload;
      const args={kind:scope==='balance'?'balance-challenge':'challenge',target_id:payload[column(scope)],expected_version:baseRevision,value};
      return cloud.rpc('tj_save_progress',{...args,operation_key:await writeOperationKey('challenge',payload.user_id,args),protocol:journalWriteProtocol});
    },
    remove: async (scope,id,userId,baseRevision=undefined) => {
      if(isLocal())return local.deleteChallengeProgress(scope,id,userId);
      if(globalThis.__tjCloudWritesPaused===true)return {error:{message:'Saving is paused for this account.'}};
      if(!journalWriteSafetyEnabled)return cloud.from(table(scope)).delete().eq(column(scope),id).eq('user_id',userId);
      if(baseRevision===undefined)return {error:{message:'Load the saved challenge before deleting it.'}};
      const args={kind:scope==='balance'?'balance-challenge':'challenge',target_id:id,expected_version:baseRevision,value:{remove:true}};
      return cloud.rpc('tj_save_progress',{...args,operation_key:await writeOperationKey('challenge-delete',userId,args),protocol:journalWriteProtocol});
    },
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
