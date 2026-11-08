import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const routine = readFileSync(new URL('./DailyRoutine.jsx', import.meta.url), 'utf8');
const screen = readFileSync(new URL('./MobileStartDay.jsx', import.meta.url), 'utf8');

test('phones get Start day and larger screens keep the popup', () => {
  assert.match(routine, /return phone\?<MobileStartDay \{\.\.\.props\}\/>:<DesktopRoutinePopup \{\.\.\.props\}\/>/);
});

test('closing saves nothing and saving goes through the same path', () => {
  assert.match(screen, /await onSave\(checked\)/);
  assert.match(screen, /REQUIRE_ALL && !done/);
  assert.doesNotMatch(screen.slice(screen.indexOf('onClose={') - 1, screen.indexOf('onTouchStart')), /onSave/);
});

test('every exit asks first when there are unsaved ticks', () => {
  assert.match(screen, /const changed = checked\.length !== saved\.length \|\| checked\.some\(id => !saved\.includes\(id\)\)/);
  assert.match(screen, /useLeaveGuard\(changed && !busy, 'start-day'\)/);
  assert.match(screen, /getBackNavigation\(\)\.confirmLeave\(\)\) action\(\)/);
  assert.equal(screen.match(/leaveThen\(onClose\)/g).length, 4);
  assert.doesNotMatch(screen, /onClick=\{onClose\}/);
});

test('News and Guardrails keep the ticks, and a failed save stays on Start day', () => {
  assert.match(screen, /saveThen\(onNews\)/);
  assert.match(screen, /saveThen\(onGuardrails\)/);
  assert.match(screen, /if \(!changed\) \{ action\(\); return; \}/);
  assert.match(screen, /await onSaveTicks\(checked\); action\(\); \} catch/);
});

test('the save button says what will happen next', () => {
  assert.match(screen, /'Save & open markup'/);
  assert.match(screen, /'Finish Start day'/);
  assert.match(screen, /'Save progress'/);
});
