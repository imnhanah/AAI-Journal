const RESTRICTED = 'Sign-in is unavailable for this account. Contact support if you need help.';
const FAILED = 'Sign-in could not be completed. If your account is restricted, contact support.';
const RESTRICTION_CODES = new Set(['user_banned', 'account_restricted', 'account_access_unavailable']);
const EMAIL_LINK_CODES = new Set(['otp_expired', 'otp_disabled', 'email_not_confirmed']);
const SUCCESS_FIELDS = ['access_token', 'refresh_token', 'code', 'token_hash', 'provider_token'];

export function signInCallbackError(href) {
  const url = new URL(href);
  if (url.pathname !== '/' && url.pathname !== '/login') return '';

  // Supabase can put a failed provider callback in either query or fragment.
  const fragment = new URLSearchParams(url.hash.slice(1));
  const query = url.searchParams;
  const value = name => query.get(name) ?? fragment.get(name) ?? '';

  if (SUCCESS_FIELDS.some(name => query.has(name) || fragment.has(name)) || value('type')) return '';

  const error = value('error');
  const code = value('error_code');
  const description = value('error_description').trim().toLowerCase();
  if ((!error && !code) || EMAIL_LINK_CODES.has(code)) return '';

  // Callback values are for presentation only. Render fixed messages, never provider text.
  if (RESTRICTION_CODES.has(code) || /^(?:403:\s*)?account access unavailable\.?$/.test(description)) {
    return RESTRICTED;
  }

  if (error === 'access_denied' || error === 'server_error') return FAILED;
  return '';
}
