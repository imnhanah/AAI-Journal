import { supabase } from "./supabaseClient";
import { createAccount } from "./db";

const pending = new Map();
const DEMO_VERSION = 6;

async function stableId(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  const hex = Array.from(new Uint8Array(digest).slice(0, 16), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20)}`;
}

async function seed(user) {
  if (Number(user.user_metadata?.demo_history_version) >= DEMO_VERSION) return;

  const existing = await supabase.from("accounts").select("id").eq("user_id", user.id).eq("name", "Demo").limit(1);
  if (existing.error) throw new Error(`Demo setup: ${existing.error.message}`);
  if (existing.data?.length) {
    await supabase.auth.updateUser({ data: { demo_history_version: DEMO_VERSION, demo_workspace_version: DEMO_VERSION } });
    return;
  }

  const workspaceId = await stableId(`${user.id}:demo-workspace-v6`);
  const account = await createAccount(user.id, {
    id: workspaceId,
    name: "Demo",
    balance: 1000,
    baseCurrency: "USD",
    workspaceType: "standard",
    positionSizeEnabled: true,
    defaultRiskPct: 1,
    defaultStopLossPips: 20,
  });
  if (account.error) throw new Error(account.error);
  const { error } = await supabase.from("workspace_balances").upsert({
    id: await stableId(`${workspaceId}:primary-balance`),
    user_id: user.id,
    workspace_id: workspaceId,
    name: "Primary balance",
    starting_balance: 1000,
    base_currency: "USD",
    risk_settings: { defaultRiskPct: 1, defaultStopLossPips: 20 },
    challenge_enabled: false,
    challenge_starting_balance: 0,
    challenge_mode: null,
    is_active: true,
  }, { onConflict: "id" });
  if (error) throw new Error(`Demo setup: ${error.message}`);

  const saved = await supabase.auth.updateUser({
    data: { demo_history_version: DEMO_VERSION, demo_workspace_version: DEMO_VERSION },
  });
  if (saved.error) throw new Error(saved.error.message);
}

export function ensureDemoAccount(user) {
  if (!pending.has(user.id)) pending.set(user.id, seed(user).catch((error) => { pending.delete(user.id); throw error; }));
  return pending.get(user.id);
}
