import { supabase } from './supabaseClient';

export async function readCloudSyncAccess(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('cloud_sync_enabled')
    .eq('id', userId)
    .maybeSingle();
  if (error) return { access: null, error };
  return { access: data?.cloud_sync_enabled === true, error: null };
}
