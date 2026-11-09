import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const journal = readFileSync(new URL('./TradingJournal.jsx', import.meta.url), 'utf8');
const menu = readFileSync(new URL('./MobileWorkspaceMenu.jsx', import.meta.url), 'utf8');

test('phones get the new switcher and desktop keeps its account menu', () => {
  assert.match(journal, /showAccountMenu && phoneViewport && <MobileWorkspaceMenu/);
  assert.match(journal, /showAccountMenu && !phoneViewport && <div className="tj-account-menu">/);
});

test('deleting a workspace keeps its warning, two taps and the last-workspace rule', () => {
  assert.match(menu, /<ConfirmDeleteButton /);
  assert.match(menu, /accounts\.length > 1/);
  assert.match(menu, /removes all of its trades/);
  assert.match(journal, /onDelete=\{handleDeleteAccount\}/);
});

test('popups opened from the switcher do not count as clicking outside it', () => {
  assert.match(journal, /!e\.target\.closest\?\.\('\.tj-ma-layer'\)/);
});
