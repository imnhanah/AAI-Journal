# Cloudflare Turnstile rollout

The email/password login, account-registration, and password-reset-request forms use Cloudflare Turnstile when it is enabled by the build configuration. Google OAuth and authenticated password updates are intentionally unchanged.

## Local development switch

Set `TURNSTILE_ENABLED=false` in `.env.local` to disable the widget and suppress CAPTCHA-token handling in a local Vite server. This is the default local configuration for this checkout. It applies equally when the app is opened through `127.0.0.1`, `localhost`, or a local-network IP address.

`TURNSTILE_ENABLED` is deliberately ignored in production builds. Production stays enabled by default; disabling it requires the separate, deliberate `TURNSTILE_PRODUCTION_ENABLED=false` setting in the production deployment environment.

Supabase Auth is the server-side verifier. It cannot be toggled per browser hostname by this frontend. For local sign-in without a token, use a local or dedicated development Supabase project with **Authentication → Settings → Bot and Abuse Protection → Enable CAPTCHA protection** disabled. Do not disable CAPTCHA on the production Supabase project to make localhost work. If local development points at the production project while its CAPTCHA enforcement is enabled, Supabase correctly rejects tokenless requests.

## Configuration

In the Cloudflare Pages environment variables for the relevant branch or deployment environment, set `VITE_TURNSTILE_SITE_KEY` to the public site key. Never add a Turnstile secret key to this repository, a Pages variable prefixed with `VITE_`, browser code, logs, or tests.

Configure the private Turnstile secret only in Supabase Dashboard: **Authentication → Settings → Bot and Abuse Protection → Enable CAPTCHA protection**. Select Cloudflare Turnstile and enter the secret there. Supabase Auth performs the server-side Siteverify request when it receives `captchaToken`; this prevents direct calls to its sign-up, password-login, and password-reset endpoints from bypassing the check.

## Safe rollout

1. Keep Supabase CAPTCHA protection **disabled**.
2. Add the public site key to a preview/staging Cloudflare Pages environment and deploy through the normal reviewed release process.
3. In Cloudflare Turnstile, allow the preview hostname and production hostname `aaijournal.trade` (and `www.aaijournal.trade` if served). Add `localhost` only for local testing if supported by the widget configuration.
4. Test login, registration, and password reset with a disposable account. Confirm absent, expired, invalid, and reused tokens are rejected by Supabase after CAPTCHA is enabled in the test environment.
5. Add the public site key to the production Pages environment and deploy the reviewed release. Confirm the widget works on desktop and mobile at `https://aaijournal.trade`.
6. Only then enable Supabase CAPTCHA protection with the private secret and re-test all three flows. Do not enable it before the deployed frontend supplies `captchaToken`.

When Turnstile is enabled, a missing public site key fails closed: email authentication remains unavailable rather than silently bypassing verification. When the local switch is disabled, no widget, CAPTCHA token request, warning, or Turnstile-specific error is shown.

## Key rotation

Create or rotate the key pair in Cloudflare, update the Supabase CAPTCHA secret and the Pages public site key through the same reviewed deployment window, then test a real login. Revoke the retired Cloudflare secret only after the replacement is verified.
