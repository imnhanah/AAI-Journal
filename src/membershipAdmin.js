import { supabase } from './supabaseClient.js';

export const membershipAdminUiEnabled = import.meta.env?.VITE_MEMBERSHIP_ADMIN_UI === 'true';

export async function readMembershipAdmin() {
  const { data, error } = await supabase.rpc('tj_is_membership_admin');
  // A failed call is not an answer. Throwing lets the screen keep what it already knows instead of hiding the Memberships tab.
  if (error) throw error;
  return data === true;
}

export async function listMembershipAccounts({ search, cursor, pageSize }) {
  const { data, error } = await supabase.rpc('tj_list_membership_accounts', {
    search_email: search,
    after_user: cursor,
    page_size: pageSize + 1,
  });
  if (error) throw error;
  return { rows: data.slice(0, pageSize), hasMore: data.length > pageSize };
}

export async function changeMembership(account, membership, cloudAllowed) {
  const { data, error } = await supabase.rpc('tj_change_membership', {
    target_user: account.user_id,
    expected_membership: account.membership,
    expected_cloud_flag: account.cloud_flag,
    next_membership: membership,
    next_cloud_flag: membership === 'owner' && cloudAllowed,
  }).single();
  if (error) throw error;
  if (data?.user_id !== account.user_id) throw new Error('The server did not confirm the change.');
  return data;
}
