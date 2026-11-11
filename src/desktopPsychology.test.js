import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const journal = readFileSync(new URL('./TradingJournal.jsx', import.meta.url), 'utf8');
const view = readFileSync(new URL('./DesktopPsychology.jsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('./desktopPsychology.css', import.meta.url), 'utf8');

test('desktop Psychology shows v2 after the phone branch; phones keep the Psychology Lab', () => {
  assert.match(journal, /const PSYCHOLOGY_V2 = true;/);
  assert.match(journal, /import DesktopPsychologyV2 from '\.\/DesktopPsychology\.jsx';/);
  const phone = journal.indexOf('return <><MobilePsychologyLab data={data}');
  const desktop = journal.indexOf('if (PSYCHOLOGY_V2) {');
  assert.ok(phone > 0 && desktop > phone, 'v2 is returned only after the phone branch');
});

test('Psychology v2 reads the same models as the phone lab', () => {
  assert.match(journal, /<DesktopPsychologyV2 data=\{data\} trades=\{ordered\} account=\{account\} risk=\{riskInsightsData\(account, trades, riskStats\)\}/);
  assert.match(journal, /const exitTrades = ordered\.filter\(trade => Number\(trade\.rr\) < 1\);/);
  for (const label of ['Emotion × Rule Adherence', 'State Shifts', 'After-Loss Recovery', 'Win Rate by Emotion', 'Next Review', 'Mistake Patterns', 'Monthly Growth Evolution', 'Edge Optimization', 'Compounded return', 'Net journal result']) assert.ok(view.includes(label), label);
});

test('Psychology v2 has the section nav, chart layers and an honest verdict without rule checks', () => {
  assert.match(view, /\[\['beh', 'Behaviour'\], \['risk', 'Risk & growth'\], \['edge', 'Edge summary'\]\]/);
  assert.match(view, /\['eq', 'Real equity', ''\], \['bl', goalPct \? 'Projected target baseline' : 'Starting balance', 'is-dsh'\], \['dd', 'Max drawdown', 'is-r'\]/);
  assert.match(view, /!data\.evaluated \? \['Clean execution needs rule checks\.', 'Save your rule checks on each trade\.'\]/);
  assert.match(view, /\(points\.length <= 40 \|\| hover === i\) && <circle/);
});

test('Psychology briefing does not dereference finance data when Finance is disabled', () => {
  assert.match(journal, /finance\?\.savings > 0/);
  assert.match(journal, /fmtMoney\(finance\?\.tradingBalance\)/);
});

test('Psychology v2 styles are desktop-only, hide the duplicate banner and reflow by page width', () => {
  assert.match(css, /\.tj-page-transition:has\(\.ps2\)>\.tj-signal-page-psychology \{display:none;\}/);
  assert.match(css, /^@media \(min-width:768px\) \{/m);
  assert.match(css, /@container journal-workspace \(max-width:980px\)/);
  assert.match(css, /@media \(min-width:768px\) and \(prefers-reduced-motion:reduce\)/);
});
