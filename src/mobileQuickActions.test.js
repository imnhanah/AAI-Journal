import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const shell = readFileSync(new URL('./MobileShell.jsx', import.meta.url), 'utf8');

test('the Start day action opens or continues the routine from one hero', () => {
  assert.match(shell, /action\(onContinueRoutine\)/);
  assert.match(shell, /status\.unfinished\?'Continue Start day':'Start day'/);
});

test('Markup and Trade Logs lock only until Start day is first saved on a trading day', () => {
  assert.match(shell, /startDayLock=due&&!status\.started\?'Start your day first':''/);
  assert.match(shell, /'Markup','is-blue',\{lock:startDayLock\}/);
  assert.match(shell, /'Trade Logs','is-purple',\{lock:startDayLock/);
  assert.match(shell, /lock\?showQuickNote\(lock\):go\(id\)/);
});

test('a switched-off challenge explains itself and the centre button shows the daily workflow', () => {
  assert.match(shell, /lock:challengeEnabled\?'':'Enable it in Account settings'/);
  assert.match(shell, /<WorkflowMark /);
});
