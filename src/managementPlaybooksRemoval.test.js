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
  const expression = source.match(/const activeSection = ([^;]+);/);
  assert.ok(expression, 'Management resolves persisted selections');
  const resolve = new Function('selected', 'routineRequest', 'membershipAdmin', `return (${expression[1]});`);
  for (const admin of [false, true]) {
    assert.equal(resolve('playbooks', false, admin), 'instruments');
    assert.equal(resolve('playbooks', true, admin), 'daily-routine');
    for (const section of ['instruments', 'daily-routine', 'backup']) assert.equal(resolve(section, false, admin), section);
  }
  assert.equal(resolve('memberships', false, false), 'instruments');
  assert.equal(resolve('memberships', false, true), 'memberships');
  assert.match(source, /if \(selected === "playbooks"\) \{ setSelected\(activeSection\); setPhoneIndex\(false\); \}/);
  assert.match(source, /activeSection === "instruments"/);
});
