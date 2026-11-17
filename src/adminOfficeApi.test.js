import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./adminOfficeApi.js', import.meta.url), 'utf8');

test('Office talks live only to staging or the host named at deploy time, and the mock is dev-server only', () => {
  assert.match(source, /VITE_ADMIN_OFFICE_LIVE_HOST/);
  assert.match(source, /liveHosts\(\)\.includes\(appHost\)/);
  assert.match(source, /officeApi = liveApp \? createLiveApi\(\) : \(import\.meta\.env\?\.DEV \? mock : unavailableApi\)/);
  assert.match(source, /forceMock = !!import\.meta\.env\?\.DEV/);
  assert.doesNotMatch(source, /!== `https:\/\/\$\{STAGING_HOST\}`/);
});
