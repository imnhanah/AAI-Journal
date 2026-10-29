import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('AccentPicker has named pressed-state swatches and theme-aware colors', () => {
  const source = readFileSync(new URL('./AccentPicker.jsx', import.meta.url), 'utf8');
  assert.match(source, /aria-label=\{accent.label\}/);
  assert.match(source, /aria-pressed=\{selected === accent.id\}/);
  assert.match(source, /selected === id \? DEFAULT_ACCENT : id/);
  assert.match(source, /theme === 'light' \? accent.light : accent.dark/);
  assert.doesNotMatch(source, /localStorage/);
});
test('Profile owns the redesigned per-mode palette selection and preview', () => {
  const journal = readFileSync(new URL('./TradingJournal.jsx', import.meta.url), 'utf8');
  const picker = readFileSync(new URL('./ProfileThemePicker.jsx', import.meta.url), 'utf8');
  const grid = readFileSync(new URL('./ThemeGrid.jsx', import.meta.url), 'utf8');
  assert.match(journal, /ProfileThemePicker/);
  assert.match(picker, /const themes = mode === 'light' \? LIGHT_THEMES : DARK_THEMES/);
  assert.match(picker, /id\.replace\(`\$\{mode\}-`, ''\)/);
  assert.match(grid, /aria-pressed=\{value === theme\.id\}/);
  assert.match(grid, /onMouseEnter=\{\(\) => onPreview\?\.\(theme\.id\)\}/);
});
