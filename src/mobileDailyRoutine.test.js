import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {addRoutineItem, deleteRoutineItem, normalizeRoutine, reorderRoutine, restoreRoutineItems, routineItems, updateRoutineItem} from './dailyRoutine.js';

const journal = readFileSync(new URL('./TradingJournal.jsx', import.meta.url), 'utf8');
const screen = readFileSync(new URL('./MobileDailyRoutine.jsx', import.meta.url), 'utf8');

test('phones get the routine screen and desktop keeps its manager', () => {
  assert.match(journal, /phone \? !phoneIndex && <PhoneRoutineScreen [\s\S]{0,200}?\/> : <DailyRoutineManagement /);
});

test('adding, editing, deleting and restoring routine items', () => {
  const start = normalizeRoutine({});
  const added = normalizeRoutine(addRoutineItem(start, {label:'Checked the calendar', group:'pretrade'}));
  const custom = routineItems(added).at(-1);
  assert.equal(custom.label, 'Checked the calendar');
  assert.equal(custom.group, 'pretrade');
  const paused = normalizeRoutine(updateRoutineItem(added, custom, {enabled:false}));
  assert.equal(routineItems(paused).at(-1).enabled, false);
  const gone = normalizeRoutine(deleteRoutineItem(added, custom));
  assert.equal(routineItems(gone).length, routineItems(start).length);
  const first = routineItems(start)[0];
  const removed = normalizeRoutine(deleteRoutineItem(start, first));
  assert.equal(routineItems(removed).some(item => item.id === first.id), false);
  assert.equal(routineItems(normalizeRoutine(restoreRoutineItems(removed))).some(item => item.id === first.id), true);
});

test('moving down swaps with the next item', () => {
  const start = normalizeRoutine({});
  const [a, b] = routineItems(start);
  const moved = routineItems(normalizeRoutine(reorderRoutine(start, b.id, a.id)));
  assert.deepEqual([moved[0].id, moved[1].id], [b.id, a.id]);
  assert.match(screen, /step < 0 \? reorderRoutine\(r, item\.id, other\.id\) : reorderRoutine\(r, other\.id, item\.id\)/);
});

test('a day still open is not shown as missed', () => {
  assert.match(screen, /day\.today && saved === 'missed' \? 'today' : saved/);
});
