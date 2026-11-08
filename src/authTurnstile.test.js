import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const auth = readFileSync(new URL('./auth.js', import.meta.url), 'utf8');
const page = readFileSync(new URL('./AuthPage.jsx', import.meta.url), 'utf8');
const widget = readFileSync(new URL('./Turnstile.jsx', import.meta.url), 'utf8');
const vite = readFileSync(new URL('../vite.config.js', import.meta.url), 'utf8');
const envExample = readFileSync(new URL('../.env.example', import.meta.url), 'utf8');

test('email auth operations forward the optional Supabase CAPTCHA token', () => {
  assert.match(auth, /captchaTokenForAuth/);
  assert.match(auth, /signUp\(\{ name, email, password, financialDisclaimerAcknowledged = false, captchaToken \}\)/);
  assert.match(auth, /signIn\(\{ email, password, captchaToken \}\)/);
  assert.match(auth, /requestPasswordReset\(email, captchaToken\)/);
  assert.ok((auth.match(/captchaToken/g) || []).length >= 6);
});

test('password login sends an enabled CAPTCHA token only in Supabase options, never as a top-level credential', () => {
  assert.match(auth, /signInWithPassword\(\{\s*email: cleanEmail,\s*password,\s*options: \{ \.\.\.\(captchaTokenForAuth\(captchaToken\) \? \{ captchaToken: captchaTokenForAuth\(captchaToken\) \} : \{\}\) \},\s*\}\)/s);
  assert.doesNotMatch(auth, /signInWithPassword\(\{ email: cleanEmail, password, \.\.\.\(captchaToken/);
  assert.match(auth, /Security verification failed or expired/);
});

test('auth page uses the central Turnstile switch and renders no disabled-state widget or warning', () => {
  const config = readFileSync(new URL('./turnstileConfig.js', import.meta.url), 'utf8');
  assert.match(config, /export const TURNSTILE_ENABLED = __AAI_TURNSTILE_ENABLED__/);
  assert.match(config, /TURNSTILE_CONFIGURATION_ERROR/);
  assert.match(page, /TURNSTILE_WIDGET_ENABLED/);
  assert.match(page, /turnstileEnabled && !captchaToken/);
  assert.match(page, /Complete the security verification before continuing/);
  assert.match(page, /resetTurnstile\(\)/);
  assert.doesNotMatch(page, /Bot verification is not configured/);
  assert.match(page, /turnstileEnabled && <Turnstile/);
});

test('local Turnstile switch cannot silently disable a production build', () => {
  assert.match(vite, /mode === 'production'\s*\? env\.TURNSTILE_PRODUCTION_ENABLED !== 'false'\s*:\s*env\.TURNSTILE_ENABLED !== 'false'/s);
  assert.match(envExample, /TURNSTILE_ENABLED=true/);
  assert.match(envExample, /TURNSTILE_PRODUCTION_ENABLED=true/);
  assert.match(page, /TURNSTILE_CONFIGURATION_ERROR/);
});

test('widget uses Cloudflare explicit rendering and handles completion, expiry, and errors', () => {
  assert.match(widget, /challenges\.cloudflare\.com\/turnstile\/v0\/api\.js\?render=explicit/);
  assert.match(widget, /theme: 'auto'/);
  assert.match(widget, /'expired-callback'/);
  assert.match(widget, /'error-callback'/);
  assert.match(widget, /turnstile\.reset/);
});
