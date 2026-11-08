// `__AAI_TURNSTILE_ENABLED__` is supplied by Vite. It is intentionally
// controlled by TURNSTILE_ENABLED only outside production builds.
export const TURNSTILE_ENABLED = __AAI_TURNSTILE_ENABLED__;
export const TURNSTILE_SITE_KEY = String(import.meta.env.VITE_TURNSTILE_SITE_KEY || '').trim();
export const TURNSTILE_CONFIGURATION_ERROR = TURNSTILE_ENABLED && !TURNSTILE_SITE_KEY;
export const TURNSTILE_WIDGET_ENABLED = TURNSTILE_ENABLED && Boolean(TURNSTILE_SITE_KEY);

export function captchaTokenForAuth(captchaToken) {
  return TURNSTILE_WIDGET_ENABLED && captchaToken ? captchaToken : undefined;
}
