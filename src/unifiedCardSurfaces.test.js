import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const css = readFileSync(new URL('./unifiedCardSurfaces.css', import.meta.url), 'utf8');

test('dark workspace surfaces share the Dashboard and Trade Log card hierarchy', () => {
  assert.match(css, /--tj-panel: var\(--color-surface-133\)/);
  assert.match(css, /--tj-panel-alt: var\(--color-surface-133\)/);
  for (const page of [
    'bt-reference-library', 'tj-news-workspace', 'tj-psychology-workspace',
    'tj-finance-page', 'tj-challenge-reference', 'tj-calendar-page',
    'tj-reference-analytics', 'tj-review-library', 'tj-account-settings-redesign',
    'tj-management-reference',
  ]) assert.match(css, new RegExp(page));
});

test('surface cleanup is scoped and retains semantic calendar states', () => {
  assert.match(css, /tj-calendar-page/);
  assert.doesNotMatch(css, /\.tj-attached-week-active/);
  assert.doesNotMatch(css, /\.tj-attached-week-loss/);
  assert.match(css, /tj-account-menu/);
});

test('Analytics and Finance controls do not create black inset wells', () => {
  assert.match(css, /tj-analytics-deck-controls[\s\S]*?background: transparent/);
  assert.match(css, /tj-finance-type-tabs[\s\S]*?background: transparent/);
  assert.match(css, /tj-savings-orbit[\s\S]*?background: var\(--tj-panel-alt\)/);
});

test('dark editable surfaces and overlays inherit the navy control surface', () => {
  assert.match(css, /\.tj-root\.tj-theme-dark \{\s*--tj-input-bg: var\(--color-surface-133\)/);
  for (const surface of ['tj-account-settings-hub-modal', 'tj-profile-studio-modal', 'tj-trade-composer-modal', 'tj-markup-composer-modal', 'tj-review-editor-modal', 'tj-compact-chart-tooltip']) {
    assert.match(css, new RegExp(surface));
  }
});

test('profile, account and entry modal cards override their legacy black surface tokens', () => {
  assert.match(css, /tj-profile-studio-modal[\s\S]*?--tj-input-bg: var\(--color-surface-133\) !important/);
  for (const surface of ['tj-personal-appearance-card', 'tj-profile-display-card', 'tj-settings-section', 'tj-trade-reference-card', 'tj-markup-section', 'tj-review-reference-card', 'tj-review-execution-grid', 'tj-entry-composer-footer', 'tj-trade-direction-toggle', 'tj-markup-bias-toggle']) {
    assert.match(css, new RegExp(surface));
  }
  assert.match(css, /:is\(\.tj-trade-composer-modal, \.tj-markup-composer-modal, \.tj-review-editor-modal\) \{\s*background: var\(--color-surface-133\) !important/);
});

test('Management routine rows inherit the shared navy surface', () => {
  assert.match(css, /\.tj-management-reference \{\s*--tj-input-bg: var\(--color-surface-133\) !important/);
});

test('Crisp Ledger light surfaces use a near-white canvas with crisp working cards', () => {
  assert.match(css, /\.tj-root\.tj-theme-light \{[\s\S]*?--tj-bg: var\(--journal-light-bg\)/);
  assert.match(css, /\.tj-root\.tj-root\.tj-root\.tj-root\.tj-root\.tj-root\.tj-theme-light,[\s\S]*?background: var\(--journal-light-bg\) !important/);
  assert.match(css, /\.tj-root\.tj-theme-light \.tj-sidebar \{\s*background: var\(--card-alt\)/);
  assert.match(css, /\.tj-root\.tj-theme-light :is\([\s\S]*?\.tj-review-editor-modal[\s\S]*?--tj-panel: var\(--bg\)/);
});
