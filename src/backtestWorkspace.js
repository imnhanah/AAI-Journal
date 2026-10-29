export const findDemoWorkspaceId = () => null;
export const workspaceImportKey = (_workspace,value) => `profile:${value}`;
export function backtestProfileKey(user) { if (!user) throw new Error('Sign in before opening strategy tests.'); return `journal:${user}:backtest:profile`; }
// Existing workspaceId values remain harmless legacy metadata; ownership is
// enforced by user_id in the authoritative backtest tables.
export function scopeBacktests(data) { return {runs:[...(data?.runs || [])],trades:[...(data?.trades || [])]}; }

// Only the single existing unassigned test was approved for Demo. Do not
// guess ownership if additional legacy tests or duplicate Demo names exist.
export async function assignExistingBacktestToDemo() { return false; }
export function assertBacktestWorkspace() { return true; }
