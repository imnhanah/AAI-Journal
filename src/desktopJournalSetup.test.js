import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const page = readFileSync(new URL('./TradingJournal.jsx', import.meta.url), 'utf8');
const view = readFileSync(new URL('./DesktopJournalSetup.jsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('./desktopJournalSetup.css', import.meta.url), 'utf8');
const fields = readFileSync(new URL('./writingFields.css', import.meta.url), 'utf8');

test('desktop Journal Setup shows v2; phones and the old page stay behind the flag', () => {
  assert.match(page, /const SETUP_V2 = true;/);
  const v2 = page.indexOf('if (SETUP_V2 && !phone) return <DesktopJournalSetup section={activeSection} onSection={chooseList} ');
  const old = page.indexOf('return <Card className={`tj-management-reference ');
  assert.ok(v2 > 0 && old > v2);
  // Every hook in ManagementPage runs before the v2 return.
  assert.ok(page.lastIndexOf('useStepMotion(phoneListOpen ? 1 : 0);', v2) > page.indexOf('function ManagementPage('));
});

test('Journal Setup v2 saves through the existing handlers and routine model', () => {
  for (const handler of ['onRiskPresets', 'onTypeTags', 'onMistakes', 'onConfluence', 'onInstruments', 'onAddRule', 'onUpdateRule', 'onRemoveRule', 'onExportBackup', 'onImportBackup', 'onRestoreSnapshot', 'onUpdateRoutine']) assert.match(page, new RegExp(`${handler}=\\{${handler}\\}`));
  assert.match(view, /from '\.\/dailyRoutine'/);
  assert.match(view, /reorderRoutine\(current, item\.id, items\[index - 1\]\.id\)/);
  assert.match(view, /updateRoutineItem\(next, item, \{ group: targetGroup \}\)/);
  assert.match(view, /aaicorefx-management:\$\{userId\}:import-mappings/);
});

test('Journal Setup v2 keeps built-in items locked and asks before deleting', () => {
  assert.match(view, /item\.locked \? <span className="js2-pr">/);
  assert.match(view, /item\.fixed \? <span className="js2-c" key=\{item\.symbol\}>/);
  assert.match(view, />Delete\?<\/button>/);
});

test('Journal Setup v2 styles are desktop-only, reflow by page width and keep fields boxed', () => {
  assert.match(css, /^@media \(min-width:768px\) \{/m);
  assert.match(css, /@container journal-workspace \(max-width:1180px\)/);
  assert.match(css, /@container journal-workspace \(max-width:700px\)/);
  assert.match(css, /@media \(min-width:768px\) and \(prefers-reduced-motion:reduce\)/);
  assert.doesNotMatch(css, /font-size:(?:[0-9]|1[01])(?:\.\d+)?px/);
  assert.equal((fields.match(/:not\(\.js2 input\)/g) || []).length, 3);
});
