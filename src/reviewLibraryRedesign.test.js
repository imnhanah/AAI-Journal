import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parse} from '@babel/parser';
import {runInNewContext} from 'node:vm';

const journal = readFileSync(new URL('./TradingJournal.jsx', import.meta.url), 'utf8');
const view = readFileSync(new URL('./ReviewPage.jsx', import.meta.url), 'utf8');
const phone = readFileSync(new URL('./MobilePeriodReviews.jsx', import.meta.url), 'utf8');
const desktop = readFileSync(new URL('./desktopReview.css', import.meta.url), 'utf8');

test('active Review Library derives live annual, quarterly and monthly models', () => {
  assert.match(journal, /function ReviewLibraryPage\(/);
  assert.match(journal, /const reviewModels = useMemo\(\(\) => \{/);
  assert.match(journal, /reviewPeriodStats\(trades, reviews, account, "monthly", key\)/);
  assert.match(journal, /reviewPeriodStats\(trades, reviews, account, "quarterly", key\)/);
  assert.match(journal, /reviewPeriodStats\(trades, reviews, account, "annual", String\(reviewYear\)\)/);
  // Bindings and scope are the contract; additional data props may appear in any order.
  const ast = parse(journal, {sourceType:'module',plugins:['jsx']});
  const library = collect(ast, n => n.type === 'FunctionDeclaration' && n.id?.name === 'ReviewLibraryPage');
  assert.equal(library.length, 1);
  const views = collect(library[0], n => n.type === 'JSXOpeningElement' && n.name.name === 'ReviewPage');
  assert.equal(views.length, 1);
  const binding = name => {
    const attributes = views[0].attributes.filter(a => a.name?.name === name);
    assert.equal(attributes.length, 1, `exactly one ${name} binding`);
    const expression = attributes[0].value.expression;
    return journal.slice(expression.start, expression.end);
  };
  assert.equal(binding('reviews'), 'reviewModels');
  assert.equal(binding('answers'), 'answers');
  assert.equal(binding('onSave'), 'save');
  assert.equal(binding('draftContext'), 'draftContext.forReviewScope(reviewBalanceId || null)');
});

test('active Review Library preserves account-scoped saves and review-trade linking', () => {
  assert.match(journal, /accountScopes: \{ \.\.\.\(rawPrevious\?\.content\?\.accountScopes \|\| \{\}\), \[reviewBalanceId\]: \{ content, completed \} \}/);
  assert.match(journal, /const reviewMonthTrades = \(period\) => \{/);
  assert.match(journal, /!isRunningTrade\(trade\) && !reviews\.some\(\(item\) => item\.tradeId === trade\.id\)/);
  assert.match(journal, /\{monthTrades && <TradeReviewEditorModal/);
  assert.match(view, /onReviewTrades=\{onReviewTrades\}/);
});

test('active desktop Review keeps its navigator and responsive page-width layout', () => {
  assert.match(view, /<nav className="rv-list rv2-nav" aria-label="Reviews">/);
  assert.match(view, /<QuarterTile key=\{quarter\.id\}/);
  assert.match(view, /<MonthTile key=\{month\.id\}/);
  assert.match(desktop, /\.rv2-qg \{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\);/);
  assert.match(desktop, /@container journal-workspace \(max-width:980px\)/);
});

test('active phone Review protects unsaved writing and keeps period save errors visible', () => {
  assert.match(phone, /useLeaveGuard\(dirty, 'review-detail'\)/);
  assert.match(view, /setError\("Could not save\. Your edits are still here\."\)/);
  assert.match(phone, /role="alert"/);
  assert.match(phone, /\{saving \? 'Saving…' : 'Save review'\}/);
});

test('the removed legacy Review library is not retained alongside the active library', async () => {
  assert.doesNotMatch(journal, /LegacyReviewLibraryPage/);
  assert.doesNotMatch(journal, /PeriodReviewModal/);
  // Lazy content hydration belongs to the active library and must be revision/owner checked.
  const ast = parse(journal, {sourceType:'module',plugins:['jsx']});
  const library = collect(ast, n => n.type === 'FunctionDeclaration' && n.id?.name === 'ReviewLibraryPage');
  assert.equal(library.length, 1);
  const saves = collect(library[0], n => n.type === 'VariableDeclarator' && n.id.name === 'save');
  assert.equal(saves.length, 1);
  const saveSource = journal.slice(saves[0].init.start, saves[0].init.end);
  const cacheSource = readFileSync(new URL('./journalCloudCache.js', import.meta.url), 'utf8');
  const cacheAst = parse(cacheSource, {sourceType:'module',plugins:['jsx']});
  const loaders = collect(cacheAst, n => n.type === 'FunctionDeclaration' && n.id?.name === 'loadPeriodReviewContent');
  assert.equal(loaders.length, 1);
  const loaderSource = cacheSource.slice(loaders[0].start, loaders[0].end);
  const raw = {id:'synthetic-review',updatedAt:'revision-one',contentLoaded:false,content:{accountScopes:{}}};
  const original = JSON.stringify(raw);
  const full = {unknown:'keep',accountScopes:{
    'balance-a':{content:{overview:'old',image:'tj-case-study-media:original'},completed:false},
    'balance-b':{content:{note:'other balance',image:'tj-journal-image:original'},completed:true},
  }};
  const fullOriginal = JSON.stringify(full);
  const attempt = {operationId:'synthetic-save'};
  function fixture({owner='synthetic-owner',version='revision-one',failure=null,delayed=false}={}) {
    const writes=[],filters=[];let reads=0,release;
    const hydrate = runInNewContext(`(${loaderSource})`, {
      privateCache:{token:()=>({owner}),get:async(_key,load)=>load()},
      supabase:{from:table=>{
        assert.equal(table,'period_reviews');
        const query={select:columns=>{assert.equal(columns,'content,updated_at');return query;},
          eq:(key,value)=>{filters.push([key,value]);return query;},
          single:async()=>{reads++;const result={data:failure?null:{content:full,updated_at:version},error:failure};
            return delayed?new Promise(resolve=>{release=()=>resolve(result);}):result;}};
        return query;
      }},
    });
    const save = runInNewContext(`(${saveSource})`, {
      rawPersisted:new Map([['monthly:2026-11',raw]]),reviewBalanceId:'balance-a',
      loadPeriodReviewContent:record=>{assert.equal(record,raw);return hydrate(record);},
      failedOutcome:({error})=>({status:'failed',error}),
      onSavePeriod:async(record,receivedAttempt)=>{writes.push({record,attempt:receivedAttempt});return {status:'confirmed'};},
    });
    return {save,writes,filters,reads:()=>reads,release:()=>release()};
  }
  const success = fixture({delayed:true});
  const pending = success.save('monthly:2026-11',{overview:'edited'},attempt);
  assert.equal(success.reads(),1);assert.equal(success.writes.length,0,'no save before hydration completes');
  success.release();await pending;
  assert.equal(success.writes.length,1);
  const {record,attempt:receivedAttempt}=success.writes[0];
  assert.equal(receivedAttempt,attempt);
  assert.equal(record.id,raw.id);assert.equal(record.updatedAt,raw.updatedAt);
  assert.equal(record.content.unknown,'keep');
  assert.equal(record.content.accountScopes['balance-a'].content.overview,'edited');
  assert.equal(record.content.accountScopes['balance-a'].content.image,'tj-case-study-media:original');
  assert.equal(JSON.stringify(record.content.accountScopes['balance-b']),JSON.stringify(full.accountScopes['balance-b']));
  assert.deepEqual(success.filters,[['id',raw.id],['user_id','synthetic-owner']]);
  for (const options of [{failure:new Error('synthetic offline')},{version:'revision-two'},{owner:null}]) {
    const failed=fixture(options),result=await failed.save('monthly:2026-11',{overview:'retained draft'},attempt);
    assert.equal(result.outcome.status,'failed');assert.equal(failed.writes.length,0,'failed/stale/unauthenticated read cannot save');
    assert.match(result.outcome.error.message,/synthetic offline|changed in another tab|Sign in/);
  }
  assert.equal(JSON.stringify(raw),original,'metadata/original record stays intact');
  assert.equal(JSON.stringify(full),fullOriginal,'hydrated originals stay intact');
  assert.doesNotMatch(journal, /reviewLibrarySignals/);
});

// Test-only AST traversal; no SDK or application module is imported.
function collect(node,predicate) {
  const found=[];
  const visit=value=>{
    if(!value||typeof value!=='object')return;
    if(predicate(value))found.push(value);
    for(const [key,child] of Object.entries(value)){
      if(['loc','start','end','extra','comments'].includes(key))continue;
      if(Array.isArray(child))child.forEach(visit);else if(child&&typeof child==='object')visit(child);
    }
  };
  visit(node);return found;
}
