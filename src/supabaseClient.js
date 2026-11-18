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
    const requestUrl = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    const method = init.method || (input instanceof Request ? input.method : 'GET');
    const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
    // Compatibility marker only. Authentication, RLS and Office permissions
    // remain authoritative for every write.
    if (requestUrl.origin === new URL(url).origin && requestUrl.pathname.startsWith('/rest/v1/')
      && !['GET','HEAD','OPTIONS'].includes(method.toUpperCase())) {
      const info = headers.get('x-client-info') || '';
      if (!info.split(/\s+/).includes('aai-journal/atomic-broker-v1')) {
        headers.set('x-client-info', [info, 'aai-journal/atomic-broker-v1'].filter(Boolean).join(' '));
      }
    }
    if (requestUrl.origin === new URL(url).origin && requestUrl.pathname === '/rest/v1/rpc/tj_save_profile_case_study_library'
      && method.toUpperCase() === 'POST') {
      const client = headers.get('x-client-info') || '';
      headers.set('x-client-info', [...client.split(/\s+/).filter(Boolean), 'case-study-v8/1'].filter((value,index,all)=>all.indexOf(value)===index).join(' '));
    }
    const response = await fetch(input, { ...init, headers, signal: controller.signal });
    const table = requestUrl.pathname.match(/\/rest\/v1\/([^/]+)$/)?.[1];
    if (response.ok && table && !['GET','HEAD'].includes(String(init.method || 'GET').toUpperCase())) {
      let body; try { body = JSON.parse(init.body || '{}'); } catch { body = {}; }
      const id = requestUrl.searchParams.get('id')?.replace(/^eq\./, '') || null;
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
