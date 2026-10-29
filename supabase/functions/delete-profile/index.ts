import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {ownedStoragePaths} from '../_shared/deleteProfileStorage.js';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// Deletes only objects that Storage records as owned by this user. The current
// journal stores screenshots in database fields, but this also clears future
// Storage-backed uploads without ever touching another user's files.
async function removeOwnedStorage(service: ReturnType<typeof createClient>, userId: string) {
  const { data: buckets, error } = await service.storage.listBuckets();
  if (error) throw error;
  for (const bucket of buckets || []) {
    const paths = await ownedStoragePaths(service.storage, bucket.name, userId);
    for (let offset = 0; offset < paths.length; offset += 100) {
      const { error: removeError } = await service.storage.from(bucket.name).remove(paths.slice(offset, offset + 100));
      if (removeError) throw removeError;
    }
  }
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return reply({ error: "Method not allowed." }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceKey) return reply({ error: "Profile deletion is not configured on the server." }, 500);

  const body = await request.json().catch(() => ({}));

  const authorization = request.headers.get("Authorization") || "";
  const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } });
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return reply({ error: "Sign in again before deleting your profile." }, 401);
  // Non-destructive readiness probe used before enabling the confirmation UI.
  if (body.action === 'check') return reply({ready:true});
  if (body.confirmation !== "DELETE") return reply({ error: "Confirmation is required." }, 400);

  try {
    const service = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    await removeOwnedStorage(service, user.id);
    // All journal tables reference auth.users directly or through accounts with
    // ON DELETE CASCADE. Removing the auth identity therefore removes profiles,
    // accounts, trades, markups, reviews, finance, challenge data and settings.
    const { error } = await service.auth.admin.deleteUser(user.id);
    if (error) throw error;
    return reply({ deleted: true });
  } catch (error) {
    return reply({ error: error instanceof Error ? error.message : "Could not permanently delete this profile." }, 500);
  }
});
