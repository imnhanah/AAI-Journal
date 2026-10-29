import test from 'node:test';
import assert from 'node:assert/strict';
import { luminance, accentTextToken } from './accentContrast.js';

test('relative luminance handles hex and computed CSS colors', () => {
  assert.equal(luminance('#ffffff'), 1);
  assert.equal(luminance('#000'), 0);
  assert.equal(luminance('rgb(255, 255, 255)'), 1);
  assert.equal(luminance('#6ee7b7'), luminance('rgb(110, 231, 183)'));
});
test('middle-brightness accents use the high-contrast foreground when needed', () => {
  for (const color of ['#0b86c4', '#d6455a', '#6366f1', '#e0522f', '#a8743a']) {
    assert.equal(accentTextToken(color), 'var(--accent-text-high-contrast)');
    assert.ok((luminance(color) + .05) / .05 >= 4.5, color);
  }
});
test('bright accents use dark text and deeper shades use white text', () => {
  for (const color of ['#6ee7b7', '#e5e7eb', '#facc15', '#94a3b8', '#1f9d78']) assert.equal(accentTextToken(color), 'var(--accent-text-dark)');
  for (const color of ['#4f46e5', '#5b6b80', '#4f7a5a']) assert.equal(accentTextToken(color), 'var(--accent-text-light)');
});
