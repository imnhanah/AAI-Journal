import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = file => readFileSync(new URL(file, import.meta.url), 'utf8');

test('account P&L bars use the same semantic tone as each account result', () => {
  const view = read('./TradeLogsReference.jsx');
  const css = read('./trade-logs.css');
  assert.match(view, /tone: accountPnl > 0 \? 'profit' : accountPnl < 0 \? 'loss' : 'neutral'/);
  assert.match(view, /tl-account--\$\{a\.tone\}/);
  assert.match(view, /tl-bar--\$\{a\.tone\}/);
  assert.match(css, /\.tl-bar--profit i \{ background: var\(--gr\); \}/);
  assert.match(css, /\.tl-bar--loss i \{ background: var\(--rd\); \}/);
});
