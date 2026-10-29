import test from 'node:test';
import assert from 'node:assert/strict';
import {expiredUnlinkedMarkups, markupStatus, MARKUP_STATUSES} from './markupLifecycle.js';
const account = {id:'a', trades:[{premarketMarkupId:'linked'}]};
const row = (id, date, status = 'Planned', accountId = 'a') => ({id,date,status,accountId});
test('today stays planned until exactly device-local 22:00', () => {
  const rows = [row('today','2026-10-12'),row('future','2026-10-13')];
  assert.deepEqual(expiredUnlinkedMarkups(rows,account,new Date(2026,9,12,21,59)),[]);
  assert.deepEqual(expiredUnlinkedMarkups(rows,account,new Date(2026,9,12,22)).map(x=>x.id),['today']);
});
test('missed cutoff catches up the next morning, including Watching; linked/other accounts are protected', () => {
  const rows = [row('old','2026-10-11'),row('watch','2026-10-11','Watching'),row('linked','2026-10-11'),row('done','2026-10-11','Executed'),row('other','2026-10-11','Planned','b'),row('new','2026-10-12'),row('invalid','')];
  assert.deepEqual(expiredUnlinkedMarkups(rows,account,new Date(2026,9,12,8)).map(x=>x.id),['old','watch']);
  assert.deepEqual(expiredUnlinkedMarkups(rows,null),[]);
});
test('legacy Passed displays as Not Executed without changing stored records', () => {
  assert.equal(markupStatus('Passed'),'Not Executed');
  assert.equal(markupStatus('Planned'),'Planned');
  assert.ok(MARKUP_STATUSES.includes('Not Executed'));
  assert.ok(!MARKUP_STATUSES.includes('Passed'));
});
