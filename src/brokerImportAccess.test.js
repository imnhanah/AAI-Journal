import assert from 'node:assert/strict';
import { test } from 'node:test';
import { brokerImportAccessError, normalizeAccess } from './memberAccess.js';

const active = (overrides = {}) => normalizeAccess({
  available: true, status: 'active', deletion_at: null,
  journal_cloud_write_allowed: true, image_upload_allowed: false,
  account_limit: null, accounts_used: 1, multiple_accounts_allowed: true,
  features: {
    trade_logs: true, finance: true, challenge: true,
    strategy_testing: true, case_studies: true, ...overrides,
  },
});
const trades = [{ id: 'synthetic' }];
const cashMovements = [{ amount: 15 }];
const mixed = { trades, cashMovements };

test('a mixed or cash-only import requires Finance before any part runs', () => {
  const access = active({ finance: false });
  assert.match(brokerImportAccessError(mixed, access, true), /Finance is read-only/);
  assert.match(brokerImportAccessError({ cashMovements }, access, true), /Nothing was imported/);
  assert.equal(brokerImportAccessError(trades, access, true), null);
});
test('Trade Logs restrictions block trade import without affecting cash-only preflight', () => {
  const access = active({ trade_logs: false });
  assert.match(brokerImportAccessError(mixed, access, true), /Trade Logs is read-only/);
  assert.equal(brokerImportAccessError({ cashMovements }, access, true), null);
});
test('missing, restricted or cloud-write denied access cannot authorize an import', () => {
  for (const access of [undefined, { ...active(), status: 'suspended' },
    { ...active(), journalCloudWriteAllowed: false }]) {
    assert.match(brokerImportAccessError(mixed, access, true), /Nothing was imported/);
  }
});
test('unrelated restrictions, empty plans and the flag-disabled path preserve behavior', () => {
  assert.equal(brokerImportAccessError(mixed, active({ challenge: false, case_studies: false }), true), null);
  assert.equal(brokerImportAccessError([], undefined, true), null);
  assert.equal(brokerImportAccessError(mixed, undefined, false), null);
});
