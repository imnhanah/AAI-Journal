import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = file => readFileSync(new URL(file, import.meta.url), 'utf8');

test('the landing gallery uses all five reviewed Demo screens and keeps screenshots theme-matched', () => {
  const source = read('./PublicSite.jsx');
  assert.match(source, /import LandingGallery from '\.\/LandingGallery'/);
  assert.match(source, /import \{ LANDING_SCREENSHOTS, landingScreenshotUrl \} from '\.\/landingScreenshots'/);
  assert.match(source, /const productShowcase = \['dashboard', 'trades', 'analytics', 'review', 'backtest'\]/);
  assert.match(source, /const productFeatureScreens = Object\.freeze\(\{/);
  assert.match(source, /function PlatformLogo\(\{ platform \}\)/);
  assert.match(source, /<PlatformLogo platform="mt4"\/>/);
  assert.match(source, /<PlatformLogo platform="mt5"\/>/);
  assert.match(source, /<PlatformLogo platform="ctrader"\/>/);
  assert.match(source, /dashboard: 'dashboard'/);
  assert.match(source, /trades: 'trades'/);
  assert.match(source, /markups: 'markups'/);
  assert.match(source, /reviews: 'review'/);
  assert.match(source, /analytics: 'analytics'/);
  assert.match(source, /guardrails: 'guardrails'/);
  assert.match(source, /<LandingGallery showcase files=\{productShowcase\}/);
  assert.match(source, /landingScreenshotUrl\(id, theme\)/);
  assert.match(source, /const \{ width, height \} = LANDING_SCREENSHOTS\[id\]/);
  assert.match(source, /productScreenshotButton\(productFeatureScreens\[id\], title\)/);
  assert.match(source, /<img src=\{preview\.src\} alt=\{preview\.title\}/);
  assert.match(source, /<ArrowUpRight size=\{17\}/);
  assert.match(source, /<details key=\{q\}><summary>\{translate\(q\)\}<ChevronDown aria-hidden="true" size=\{20\}\/><\/summary>/);

  const gallery = read('./LandingGallery.jsx');
  assert.match(gallery, /const showcaseLabels = \{/);
  assert.match(gallery, /backtest: 'Backtest'/);
  assert.match(gallery, /role="tablist"/);
  assert.match(gallery, /aria-selected=\{active === index\}/);
  assert.match(gallery, /const playing = !showcase/);
});
