import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const screen = readFileSync(new URL('./MobilePeriodReviews.jsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('./mobilePeriodReviews.css', import.meta.url), 'utf8');

test('leaving a review with unsaved writing asks first', () => {
  assert.match(screen, /useLeaveGuard\(dirty, 'review-detail'\)/);
});

test('the review answers keep the keys the desktop view saves under', () => {
  for (const key of ['technical0', 'technical1', 'technical2', 'mistakes', 'habits', 'markups', 'goals', 'overall']) assert.ok(screen.includes(`'${key}'`), key);
  assert.match(screen, /questions\.technical\.map/);
  assert.match(screen, /questions\.glance\.map/);
});

test('text stays readable and colours come from the theme', () => {
  for (const size of css.matchAll(/font-size:([\d.]+)px/g)) assert.ok(Number(size[1]) >= 12, size[0]);
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgba?\(/i);
});
