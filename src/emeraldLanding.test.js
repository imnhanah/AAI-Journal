import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {BREAKDOWNS, FAQS, PLATFORMS, SAMPLE_END, SAMPLE_START, STUDIES, challengeLevels, equityCurve, sampleCandles} from './landingSample.js';

const read = file => readFileSync(new URL(file, import.meta.url), 'utf8');

test('the public site routes to the landing page and keeps sign in, sign up and the disclaimer', () => {
  const source = read('./PublicSite.jsx');
  assert.match(source, /import LandingPage from '\.\/LandingPage'/);
  assert.match(source, /export function PlatformLogo\(\{ platform \}\)/);
  assert.match(source, /const authMode = path === '\/signup' \? 'signup' : path === '\/login' \? 'login' : null/);
  assert.match(source, /<AuthPage key=\{authMode\} initialMode=\{authMode\}/);
  assert.match(source, /<LandingPage user=\{user\} onNavigate=\{navigate\}/);
  assert.match(source, /<FinancialDisclaimerDialog onClose=/);
  // Pricing is retired: the old route returns visitors to the home page.
  assert.match(source, /RETIRED_PATHS = new Set\(.*'\/pricing'\]\)/);
  assert.doesNotMatch(source, /PricingDialog|LandingGallery/);
});

test('the landing page shows the approved sections in order with translated copy', () => {
  const source = read('./LandingPage.jsx');
  const order = ['id="analytics"', 'id="challenge"', 'id="journal"', 'id="case-studies"', 'id="import"', 'id="how"', '<AlsoInside', 'id="faq"', 'lp-cta', 'lp-footer', 'lp-dock'];
  const positions = order.map(marker => source.lastIndexOf(marker));
  positions.forEach((position, index) => assert.ok(position > 0, order[index]));
  assert.deepEqual([...positions].sort((a, b) => a - b), positions);
  assert.match(source, /t\('Find what works\.'\)/);
  assert.match(source, /import '@fontsource-variable\/geist'/);
  assert.match(source, /import '@fontsource-variable\/geist-mono'/);
  assert.match(source, /<LanguageSelector publicSite\/>/);
  assert.match(source, /user \? '\/dashboard' : '\/signup'/);
  assert.match(source, /onClick=\{onDisclaimer\}/);
  // Motion always has a reduced-motion path.
  assert.match(source, /prefers-reduced-motion: reduce/);
  assert.match(read('./landing.css'), /@media \(prefers-reduced-motion: reduce\)/);
});

test('landing sample data is internally consistent', () => {
  const curve = equityCurve();
  assert.equal(curve.end, SAMPLE_END);
  assert.equal(curve.drawdown, 150);
  for (const group of BREAKDOWNS) {
    assert.equal(group.rows.reduce((sum, row) => sum + row[1], 0), 48, `${group.id} trades`);
    assert.equal(group.rows.reduce((sum, row) => sum + row[3], 0), SAMPLE_END - SAMPLE_START, `${group.id} net`);
    assert.equal(group.rows.reduce((sum, row) => sum + Math.round(row[1] * row[2] / 100), 0), 24, `${group.id} wins`);
  }
  const levels = challengeLevels();
  assert.equal(levels.length, 10);
  assert.equal(levels[4].start, 11698.59);
  assert.equal(levels[9].target.toFixed(2), '14802.44');
  assert.deepEqual(STUDIES.map(study => [study.trades, study.net]), BREAKDOWNS[0].rows.map(row => [row[1], row[3]]));
  assert.deepEqual(PLATFORMS.map(platform => platform.id), ['mt4', 'mt5', 'ctrader']);
  assert.equal(FAQS.length, 7);
  const chart = sampleCandles('reversal');
  assert.equal(chart.candles.length, 40);
  assert.ok(chart.candles.every(candle => candle.wickTop >= 0 && candle.wickTop + candle.wickHeight <= 100));
  assert.deepEqual(sampleCandles('reversal'), chart);
});
