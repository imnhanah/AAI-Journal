import test from 'node:test';
import assert from 'node:assert/strict';
import { MEMBERSHIP, resolveEffectiveMembership } from './membership.js';

const client = (result) => ({ rpc: async () => result });

test('unauthenticated visitors receive no membership privileges without an RPC call', async () => {
  let called = false;
  const result = await resolveEffectiveMembership({ authenticated: false, client: { rpc: async () => { called = true; } } });
  assert.deepEqual(result, { status: 'unauthenticated', membership: null, error: '' });
  assert.equal(called, false);
});

test('an explicitly assigned owner is the only owner result the UI accepts', async () => {
  const result = await resolveEffectiveMembership({ authenticated: true, client: client({ data: 'owner', error: null }) });
  assert.equal(result.membership, MEMBERSHIP.OWNER);
  assert.equal(result.status, 'ready');
});

test('any non-owner response defaults an authenticated account to Free', async () => {
  const result = await resolveEffectiveMembership({ authenticated: true, client: client({ data: 'anything-client-controlled', error: null }) });
  assert.equal(result.membership, MEMBERSHIP.FREE);
  assert.equal(result.status, 'ready');
});

test('a failed lookup is never interpreted as Owner', async () => {
  const result = await resolveEffectiveMembership({ authenticated: true, client: client({ data: null, error: { message: 'network unavailable' } }) });
  assert.equal(result.membership, MEMBERSHIP.FREE);
  assert.equal(result.status, 'error');
  assert.match(result.error, /network unavailable/);
});

test('the entitlement preview honors the Owner restriction and rejects a Free cloud grant', async () => {
  const { resolveCurrentEntitlements } = await import('./membership.js');
  for (const [membership, allowed, expected] of [
    ['owner', true, true], ['owner', false, false], ['free', false, false], ['free', true, false],
  ]) {
    const result = await resolveCurrentEntitlements({
      authenticated: true,
      client: { rpc: async name => {
        assert.equal(name, 'tj_current_entitlements');
        return { data: [{ membership, cloud_writes_allowed: allowed }] };
      } },
    });
    assert.equal(result.status, 'ready');
    assert.equal(result.cloudWritesAllowed, expected);
  }
  const missing = await resolveCurrentEntitlements({ authenticated: true, client: client({ data: [] }) });
  assert.equal(missing.status, 'error');
  assert.equal(missing.cloudWritesAllowed, false);
});
