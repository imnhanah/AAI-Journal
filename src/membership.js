import {resolveImageUploadAccess} from './imagePolicy.js';
export const MEMBERSHIP = Object.freeze({
  OWNER: 'owner',
  FREE: 'free',
});

export const membershipState = (status, membership = null, error = '') => ({
  status,
  membership,
  error,
});

// This is deliberately only a UI/workflow hint. Supabase RLS and RPCs remain
// authoritative; no browser value grants a privilege.
export async function resolveEffectiveMembership({ client, authenticated = false } = {}) {
  if (!authenticated) return membershipState('unauthenticated');

  try {
    // Defer the browser client import. It keeps this small authorization helper
    // independently testable and does not load a client for signed-out visitors.
    if (!client) {
      ({ supabase: client } = await import('./supabaseClient.js'));
    }
    const { data, error } = await client.rpc('tj_current_membership');
    if (error) return membershipState('error', MEMBERSHIP.FREE, error.message || 'Membership lookup failed.');
    return membershipState('ready', data === MEMBERSHIP.OWNER ? MEMBERSHIP.OWNER : MEMBERSHIP.FREE);
  } catch (error) {
    return membershipState('error', MEMBERSHIP.FREE, error?.message || 'Membership lookup failed.');
  }
}

// Keep the transition opt-in until recovery and server enforcement are ready.
export const membershipPreviewEnabled = import.meta.env?.VITE_MEMBERSHIP_ENTITLEMENTS_PREVIEW === 'true';

export async function resolveCurrentEntitlements({ client, authenticated = false } = {}) {
  const denied = (status, error = '') => ({ ...membershipState(status, MEMBERSHIP.FREE, error), cloudWritesAllowed: false });
  if (!authenticated) return { ...membershipState('unauthenticated'), cloudWritesAllowed: false };
  try {
    if (!client) ({ supabase: client } = await import('./supabaseClient.js'));
    const { data, error } = await client.rpc('tj_current_entitlements');
    const result = Array.isArray(data) && data.length === 1 ? data[0] : null;
    if (error || ![MEMBERSHIP.FREE, MEMBERSHIP.OWNER].includes(result?.membership)
      || typeof result.cloud_writes_allowed !== 'boolean') {
      return denied('error', error?.message || 'Could not confirm cloud permissions.');
    }
    return {
      ...membershipState('ready', result.membership),
      cloudWritesAllowed: result.membership === MEMBERSHIP.OWNER && result.cloud_writes_allowed,
    };
  } catch (error) {
    return denied('error', error?.message || 'Could not confirm cloud permissions.');
  }
}

export const resolveJournalMembership = async options => {
  const [membership,images]=await Promise.all([membershipPreviewEnabled ? resolveCurrentEntitlements(options) : resolveEffectiveMembership(options),resolveImageUploadAccess(options)]);
  return {...membership,...images};
};
