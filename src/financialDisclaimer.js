import { supabase } from './supabaseClient';

// Bump this only when the published disclaimer changes in a material way.
// A new version intentionally prompts every signed-in user to acknowledge it.
export const FINANCIAL_DISCLAIMER_VERSION = '2026-10-24';

export async function getFinancialDisclaimerStatus(userId) {
  if (!userId) return { accepted: false, error: 'Sign in to continue.' };
  try {
    const { data, error } = await supabase
      .from('financial_disclaimer_acceptances')
      .select('accepted_at')
      .eq('user_id', userId)
      .eq('disclaimer_version', FINANCIAL_DISCLAIMER_VERSION)
      .maybeSingle();
    if (error) return { accepted: false, error: 'We could not verify your disclaimer acknowledgement. Please try again.' };
    return { accepted: Boolean(data?.accepted_at), acceptedAt: data?.accepted_at || null };
  } catch {
    return { accepted: false, error: 'We could not verify your disclaimer acknowledgement. Please try again.' };
  }
}

export async function acceptFinancialDisclaimer() {
  try {
    const { data, error } = await supabase.rpc('acknowledge_financial_disclaimer', {
      p_version: FINANCIAL_DISCLAIMER_VERSION,
    });
    if (error) return { error: 'We could not save your acknowledgement. Please try again.' };
    return { acceptedAt: data };
  } catch {
    return { error: 'We could not save your acknowledgement. Please try again.' };
  }
}
