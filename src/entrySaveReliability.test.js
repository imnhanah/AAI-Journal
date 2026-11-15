import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = file => readFileSync(new URL(file, import.meta.url), 'utf8');
const journal = read('./TradingJournal.jsx');
const cloud = read('./db.js');

test('trade and markup editors await one guarded save operation and expose a Saving state', () => {
  const tradeStart = journal.indexOf('export function NewTradeModal');
  const markupStart = journal.indexOf('function MarkupModal');
  const panelStart = journal.indexOf('function PersistentEntryPanel');
  const trade = journal.slice(tradeStart, markupStart);
  const markup = journal.slice(markupStart, panelStart);
  for (const source of [trade, markup]) {
    assert.match(source, /const saveInFlight=useRef\(false\)/);
    assert.match(source, /if \([^)]*saveInFlight\.current[^)]*\) return/);
    assert.match(source, /saveInFlight\.current=true/);
    assert.match(source, /await onSave\(/);
    assert.match(source, /finally \{[\s\S]*saveInFlight\.current=false[\s\S]*setSaving\(false\)/);
    assert.match(source, /disabled=\{saving/);
    assert.match(source, /Saving…/);
  }
});

test('cloud creates retain a stable caller id and upsert retries instead of inserting duplicates', async () => {
  const createTrade = cloud.slice(cloud.indexOf('export async function createTrade'), cloud.indexOf('export async function updateTrade'));
  const createMarkup = cloud.slice(cloud.indexOf('export async function createMarkup'), cloud.indexOf('export async function updateMarkup'));
  const persistedUuid = new Function(`return (${cloud.match(/^const persistedUuid = (.+);$/m)[1]});`)();
  const userId = '11111111-1111-4111-8111-111111111111';
  const accountId = '22222222-2222-4222-8222-222222222222';
  const entryId = '33333333-3333-4333-8333-333333333333';
  for (const [name, source, table] of [['createTrade',createTrade,'trades'],['createMarkup',createMarkup,'premarket_markups']]) {
    const rows = new Map();
    const requests = [];
    const mediaIds = [];
    const input = {id:entryId,screenshots:{entry:[{src:'local-original'}]}};
    const dependencies = {
      persistedUuid,
      recordUuid:() => assert.fail('a supplied UUID must survive every retry'),
      supabase:{
        auth:{getSession:async () => ({data:{session:{user:{id:userId}}}})},
        from:actualTable => {
          assert.equal(actualTable,table);
          return {upsert(row,options) {
            assert.deepEqual(options,{onConflict:'id'});
            requests.push(structuredClone(row));
            rows.set(row.id,row);
            return {select:() => ({single:async () => requests.length === 1
              ? {error:{message:'Synthetic lost response after commit'}} : {data:row}})};
          }};
        },
      },
      mediaForSave:async (actualTable,id,entry,create) => {
        assert.equal(actualTable,table);
        assert.equal(create,true);
        assert.deepEqual(entry.screenshots,input.screenshots);
        mediaIds.push(id);
        return {value:'verified-cloud-reference',local:entry.screenshots};
      },
      toTrade:(user,account) => ({user_id:user,account_id:account}),
      markupRow:() => ({}),
      THIN_COLUMNS:{[table]:'id,user_id,account_id'},
      trade:row => row, markup:row => row,
      fail:error => ({error:error.message}),
    };
    // Execute the actual save implementation with a synthetic transport. The
    // first commit loses its response; retrying must upsert the same record.
    const create = new Function(...Object.keys(dependencies), source.replace('export ','') + `; return ${name};`)(...Object.values(dependencies));
    assert.match((await create(userId,accountId,input)).error,/lost response/);
    const result = await create(userId,accountId,input);
    assert.equal(result.error,undefined);
    assert.equal(result.data.id,entryId);
    assert.deepEqual(result.data.screenshots,input.screenshots);
    assert.deepEqual(mediaIds,[entryId,entryId]);
    assert.equal(rows.size,1);
    assert.deepEqual(requests.map(row => [row.id,row.user_id,row.account_id,row.screenshots]),[
      [entryId,userId,accountId,'verified-cloud-reference'],
      [entryId,userId,accountId,'verified-cloud-reference'],
    ]);
  }
  assert.match(journal, /const persistentEntryId = \(\) => globalThis\.crypto\?\.randomUUID\?\.\(\)/);
  assert.match(journal, /const base = \{ id: persistentEntryId\(\), date: todayISO\(\)/);
  assert.match(journal, /const base = \{ id: persistentEntryId\(\), date:todayISO\(\)/);
});

test('successful primary saves close the panel while secondary sync failures are warnings', () => {
  const saveTrade = journal.slice(journal.indexOf('const saveTrade = async'), journal.indexOf('const importTradesToAccount'));
  assert.match(saveTrade, /Trade saved, but account-result synchronization needs attention/);
  assert.match(saveTrade, /Trade saved, but its summary totals could not be synchronized/);
  assert.match(saveTrade, /showWarning\(/);
  assert.match(saveTrade, /setModal\(null\); setTradeEditor\(clearEntryEditor\)/);
  assert.match(saveTrade, /showSuccess\(exists \? 'Trade updated\.' : 'Trade saved\.'\)/);
  const saveMarkup = journal.slice(journal.indexOf('const handleSaveMarkup = async'), journal.indexOf('const handleDeleteMarkup'));
  assert.match(saveMarkup, /setModal\(null\); setMarkupEditor\(clearEntryEditor\)/);
  assert.match(saveMarkup, /showSuccess\(exists \? 'Markup updated\.' : 'Markup saved\.'\)/);
});

test('expiry and trade-link status changes serialize per markup and reconcile unlink and deletion', () => {
  assert.match(journal, /const markupMutationQueues = useRef\(new Map\(\)\)/);
  assert.match(journal, /const enqueueMarkupMutation = useCallback/);
  const expiry = journal.slice(journal.indexOf('const markupsToPass = expiredUnlinkedMarkups'), journal.indexOf('useEffect\(\(\) => \{\n    setTypeTags'));
  assert.match(expiry, /enqueueMarkupMutation\(markup\.id/);
  assert.match(expiry, /latestAccount\?\.trades\?\.some\(\(trade\) => trade\.premarketMarkupId === markup\.id\)/);
  const execute = journal.slice(journal.indexOf('const synchronizeMarkupLinkStatus = async'), journal.indexOf('const saveTrade = async'));
  assert.match(execute, /enqueueMarkupMutation\(markupId/);
  assert.match(execute, /hasLinkedTrade/);
  assert.match(execute, /\? "Executed"/);
  assert.match(execute, /\? "Not Executed"/);
  const deletion = journal.slice(journal.indexOf('const handleDeleteTrade = async'), journal.indexOf('const persistCustomInstrument'));
  assert.match(deletion, /const deletedTrade = account\.trades\.find/);
  assert.match(deletion, /synchronizeMarkupLinkStatus\(deletedTrade\.premarketMarkupId, remainingTrades\)/);
});

test('save notifications are application-rendered, dismissible, and include success and warning variants', () => {
  assert.match(journal, /const \[toast, setToast\] = useState\(null\)/);
  assert.match(journal, /const showSuccess = useCallback/);
  assert.match(journal, /const showWarning = useCallback/);
  assert.match(journal, /aria-label="Dismiss notification"/);
  assert.match(journal, /tj-toast-success/);
  assert.match(journal, /tj-toast-warning/);
});
