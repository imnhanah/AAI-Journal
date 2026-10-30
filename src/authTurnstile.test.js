import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const auth = readFileSync(new URL('./auth.js', import.meta.url), 'utf8');
const page = readFileSync(new URL('./AuthPage.jsx', import.meta.url), 'utf8');
const widget = readFileSync(new URL('./Turnstile.jsx', import.meta.url), 'utf8');

test('email auth operations forward the optional Supabase CAPTCHA token', () => {
  assert.match(auth, /signUp\(\{ name, email, password, financialDisclaimerAcknowledged = false, captchaToken \}\)/);
  assert.match(auth, /signIn\(\{ email, password, captchaToken \}\)/);
  assert.match(auth, /requestPasswordReset\(email, captchaToken\)/);
  assert.ok((auth.match(/captchaToken/g) || []).length >= 6);
});

test('auth page requires a Turnstile token only when a public site key is configured', () => {
  assert.match(page, /import\.meta\.env\.VITE_TURNSTILE_SITE_KEY/);
  assert.match(page, /turnstileEnabled && !captchaToken/);
  assert.match(page, /Complete the security verification before continuing/);
  assert.match(page, /resetTurnstile\(\)/);
  assert.match(page, /Bot verification is not configured/);
});

test('widget uses Cloudflare explicit rendering and handles completion, expiry, and errors', () => {
  assert.match(widget, /challenges\.cloudflare\.com\/turnstile\/v0\/api\.js\?render=explicit/);
  assert.match(widget, /theme: 'auto'/);
  assert.match(widget, /'expired-callback'/);
  assert.match(widget, /'error-callback'/);
  assert.match(widget, /turnstile\.reset/);
});
