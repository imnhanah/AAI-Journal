import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('./TradingJournal.jsx', import.meta.url), 'utf8');
const routineCss = fs.readFileSync(new URL('./dailyRoutine.css', import.meta.url), 'utf8');

test('Management no longer exposes the unfinished Playbooks workspace', () => {
  assert.doesNotMatch(source, /\["playbooks", "Playbooks", "Soon"\]/);
  assert.doesNotMatch(source, /PlaybooksInProgress/);
  assert.doesNotMatch(routineCss, /tj-playbooks-in-progress/);
});

test('a persisted Playbooks selection resolves to a supported Management section', () => {
  assert.match(source, /const activeSection = selected === "playbooks" \? \(routineRequest \? "daily-routine" : "instruments"\) : selected;/);
  assert.match(source, /if \(selected === "playbooks"\) \{ setSelected\(activeSection\); setPhoneIndex\(false\); \}/);
  assert.match(source, /activeSection === "instruments"/);
});
