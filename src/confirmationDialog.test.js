import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = (name) => readFileSync(new URL(`./${name}`, import.meta.url), 'utf8');
const provider = read('ConfirmationDialog.jsx');
const sources = ['TradingJournal.jsx', 'TradeLogsReference.jsx', 'MarkupsRedesign.jsx', 'CaseStudyLibrary.jsx'].map(read);

test('application confirmations use the shared themed provider instead of native dialogs', () => {
  for (const source of sources) assert.doesNotMatch(source, /window\.confirm\s*\(/);
  assert.match(provider, /createPortal/);
  assert.match(provider, /role="alertdialog"/);
  assert.match(provider, /tj-confirm-overlay/);
  assert.match(provider, /Escape/);
});

test('confirmation provider rejects duplicate prompts before an action is settled', () => {
  assert.match(provider, /if\(active\.current\)return Promise\.resolve\(false\)/);
  assert.match(provider, /if\(!o\|\|o\.settled\)return/);
});
