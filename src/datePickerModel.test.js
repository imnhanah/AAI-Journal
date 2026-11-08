import test from 'node:test';
import assert from 'node:assert/strict';
import {dateValueToday, dateWithinRange, isDateValue, parseDateValue} from './datePickerModel.js';

test('date picker accepts only canonical calendar dates', () => {
  assert.equal(isDateValue('2026-11-03'), true);
  assert.equal(isDateValue('2026-02-29'), false);
  assert.equal(isDateValue('2024-02-29'), true);
  assert.equal(isDateValue('11/03/2026'), false);
  assert.equal(isDateValue('2026-2-03'), false);
  assert.equal(isDateValue('2026-13-03'), false);
});

test('date picker stores a date-only value without UTC conversion', () => {
  const parsed = parseDateValue('2026-03-29');
  assert.equal(parsed.getFullYear(), 2026);
  assert.equal(parsed.getMonth(), 2);
  assert.equal(parsed.getDate(), 29);
  assert.equal(parsed.getHours(), 12);
  assert.equal(dateValueToday(new Date(2026, 2, 29, 23, 59)), '2026-03-29');
});

test('date picker enforces inclusive min and max values lexically after strict validation', () => {
  assert.equal(dateWithinRange('2026-05-10', '2026-05-10', '2026-05-20'), true);
  assert.equal(dateWithinRange('2026-05-09', '2026-05-10', '2026-05-20'), false);
  assert.equal(dateWithinRange('2026-05-21', '2026-05-10', '2026-05-20'), false);
  assert.equal(dateWithinRange('2026-02-30'), false);
});
