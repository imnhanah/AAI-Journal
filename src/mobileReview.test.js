import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const review = readFileSync(new URL('./ReviewPage.jsx', import.meta.url), 'utf8');
const phone = readFileSync(new URL('./MobilePeriodReviews.jsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('./mobilePeriodReviews.css', import.meta.url), 'utf8');

test('phone Review uses the active period library with readable, touch-sized controls', () => {
  assert.match(review, /if \(phone\) return <MobilePeriodReviews/);
  assert.match(phone, /function PeriodList\(/);
  assert.match(css, /\.tj-pr-annual-top strong \{[^}]*font-size:32px/);
  assert.match(css, /\.tj-pr-months \{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(css, /\.tj-root \.tj-pr \.tj-pr-expand \{display:grid;flex:none;width:44px;height:44px/);
});

test('phone Review keeps the shared period controls, save state and outstanding-trade action', () => {
  assert.match(review, /controls=\{phoneControls\}/);
  assert.match(review, /onReviewTrades=\{onReviewTrades\}/);
  assert.match(phone, /onClick=\{\(\) => onReviewTrades\?\.\(review\)\}/);
  assert.match(phone, /\{toReview\} trade\{toReview === 1 \? '' : 's'\} still need/);
  assert.match(phone, /disabled=\{saving \|\| saveLocked \|\| !dirty\} onClick=\{onSave\}/);
});

test('phone Review has an explicit annual and quarterly period hierarchy', () => {
  assert.match(phone, /className="tj-pr-annual"/);
  assert.match(phone, /function QuarterCard\(/);
  assert.match(phone, /function PeriodList\(/);
  assert.match(phone, /year && <button type="button" className="tj-pr-annual"/);
  assert.match(phone, /quarterGroups\.map\(group => <QuarterCard/);
});

test('phone Review presents unsaved state without losing the active review', () => {
  assert.match(review, /const dirty = Object\.keys\(drafts\)\.length > 0;/);
  assert.match(phone, /tj-pr-saved \$\{dirty \? 'is-dirty' : ''\}/);
  assert.match(phone, /onCancel=\{onCancel\}/);
});
