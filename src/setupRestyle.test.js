import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = (name) => readFileSync(new URL(`./${name}`, import.meta.url), 'utf8');
const desktop = read('DesktopJournalSetup.jsx');
const fields = read('writingFields.css');
const page = read('TradingJournal.jsx');
const members = read('MembershipManagement.jsx');
const certs = read('CertificateArchive.jsx');

test('Journal Setup nav is a real tablist with keyboard support and a gated Memberships tab', () => {
  assert.match(desktop, /role="tablist"/);
  assert.match(desktop, /role="tab"/);
  assert.match(desktop, /aria-selected=\{section === id\}/);
  assert.match(desktop, /ArrowRight/);
  assert.match(desktop, /membershipAdmin \? \[\.\.\.SECTIONS, \['Administration'/);
});

test('the three restyled areas stay boxed under the underline input system', () => {
  assert.equal((fields.match(/:not\(\.tj-mi input\)/g) || []).length, 3);
  assert.equal((fields.match(/:not\(\.tj-membership input\)/g) || []).length, 3);
});

test('phone Instruments, Certificates and Memberships styles are loaded and use theme tokens only', () => {
  assert.match(page, /import '\.\/mobileSetupThree\.css';/);
  assert.match(certs, /import '\.\/certificateArchive\.css';/);
  assert.match(members, /import '\.\/membershipManagement\.css';/);
  for (const name of ['mobileSetupThree.css', 'certificateArchive.css', 'membershipManagement.css']) {
    assert.doesNotMatch(read(name), /#[\da-f]{3,8}\b|rgba?\(|:\s*(?:white|black)\b/i, name);
    assert.doesNotMatch(read(name), /font-size:(?:[0-9]|1[01])(?:\.\d+)?px/, name);
  }
});

test('Memberships keeps its permission and save behaviour', () => {
  assert.match(members, /code === '42501'\) onAccessLost\(\)/);
  assert.match(members, /userId === account\.user_id/);
  assert.match(members, /changeMembership\(account, membership, cloudAllowed\)/);
  assert.match(members, /Review change/);
  assert.match(members, /Confirm change/);
  assert.match(members, /turned off for this account/);
});
