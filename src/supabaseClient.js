import { createClient } from "@supabase/supabase-js";
import { notifyJournalMutation } from './privateCacheRuntime';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
// Safari occasionally leaves a restored-session request pending forever after
// a reload. Abort it so the journal's retry flow can recover instead of leaving
// the loading screen permanently visible.
const SAFARI_SAFE_REQUEST_TIMEOUT = 25000;
const timedFetch = async (input, init = {}) => {
  const controller = new AbortController();
  const abort = () => controller.abort();
  const parentSignal = init.signal;
  if (parentSignal?.aborted) abort();
  else parentSignal?.addEventListener?.("abort", abort, { once: true });
  const timer = window.setTimeout(abort, SAFARI_SAFE_REQUEST_TIMEOUT);
  try {
    const response = await fetch(input, { ...init, signal: controller.signal });
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    const table = url.pathname.match(/\/rest\/v1\/([^/]+)$/)?.[1];
    if (response.ok && table && !['GET','HEAD'].includes(String(init.method || 'GET').toUpperCase())) {
      let body; try { body = JSON.parse(init.body || '{}'); } catch { body = {}; }
      const id = url.searchParams.get('id')?.replace(/^eq\./, '') || null;
      notifyJournalMutation(table, init.method === 'DELETE' || Object.hasOwn(body, 'screenshots'), id);
    }
    return response;
  } finally {
    window.clearTimeout(timer);
    parentSignal?.removeEventListener?.("abort", abort);
  }
};

if (!url || !anonKey) {
  // Fails loudly and early rather than silently breaking auth later —
  // this is almost always a missing/misnamed .env file.
  console.error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. " +
    "Copy .env.example to .env and fill in your Supabase project's URL and anon key."
  );
}

export const supabase = createClient(url, anonKey, {
  global: { fetch: timedFetch },
  auth: {
    persistSession: true, // keeps the session in localStorage's Supabase-managed slot across browser restarts
    autoRefreshToken: true, // silently refreshes the JWT before it expires
    detectSessionInUrl: true, // required for the password-reset email link flow
  },
});
