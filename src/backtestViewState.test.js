import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createBacktestViewState, reconcileBacktestView} from './backtestViewState.js';

const view=()=>({loaded:true,data:{runs:[{id:'run-1'}],trades:[{id:'trade-1',runId:'run-1',pnl:300}]},active:'run-1',expanded:{'run-1':true},phoneLog:true,scrollTop:480});
test('returning to Backtest restores data, open run, disclosures, phone log and scroll',()=>{
  const views=createBacktestViewState('user');
  const saved=view();
  views.write('user','demo',saved);
  assert.deepEqual(views.read('user','demo'),saved);
  assert.deepEqual(reconcileBacktestView(saved.data,saved),{active:'run-1',expanded:{'run-1':true},phoneLog:true});
});
test('views are scoped to user and workspace, including separate authenticated sessions',()=>{
  const views=createBacktestViewState('user');
  views.write('user','demo',view());
  assert.equal(views.read('other','demo'),undefined);
  assert.equal(views.read('user','live'),undefined);
  views.write('other','demo',{...view(),active:'foreign'});
  assert.equal(views.read('user','demo').active,'run-1');
  assert.equal(createBacktestViewState('user').read('user','demo'),undefined);
  views.clear();
  assert.equal(views.read('user','demo'),undefined);
});
test('unfinished first loads are never retained as valid cached views',()=>{
  const views=createBacktestViewState('user');
  views.write('user','demo',{...view(),loaded:false});
  views.write('user','',view());
  assert.equal(views.read('user','demo'),undefined);
  assert.equal(views.read('user',''),undefined);
});
test('background refresh removes deleted run selections without opening another workspace run',()=>{
  const prior=view();
  assert.deepEqual(reconcileBacktestView({runs:[{id:'new-run'}],trades:[]},prior),{active:null,expanded:{},phoneLog:false});
  assert.equal(prior.active,'run-1');
});
test('background refresh retains open run only while it still exists',()=>{
  const prior={...view(),expanded:{'run-1':true,deleted:true}};
  assert.deepEqual(reconcileBacktestView({runs:[{id:'run-1'}],trades:[]},prior),{active:'run-1',expanded:{'run-1':true},phoneLog:true});
});
test('navigation cache lives outside keyed page transitions and clears on session disposal',()=>{
  const journal=readFileSync(new URL('./TradingJournal.jsx',import.meta.url),'utf8');
  assert.match(journal,/<BacktestViewSession owner=\{user.id\}>\s*<div className="tj-page-transition"/);
  const session=readFileSync(new URL('./BacktestViewSession.jsx',import.meta.url),'utf8');
  assert.match(session,/useMemo\(\(\) => createBacktestViewState\(owner\), \[owner\]\)/);
  assert.match(session,/useEffect\(\(\) => \(\) => views.clear\(\), \[views\]\)/);
  const component=readFileSync(new URL('./BacktestAccounts.jsx',import.meta.url),'utf8');
  assert.match(component,/useState\(\(\)=>initial\?\.data/);
  assert.match(component,/if\(!retained.current\?\.loaded\)/);
  assert.match(component,/scroller.scrollTop=initial\?\.scrollTop \|\| 0/);
  assert.match(component,/if\(!cancel\)await refresh\(\)/);
  assert.match(component,/catch\(e\)\{if\(mounted.current&&n===sequence.current\)\{setError\(e.message\);setLoaded\(true\);\}\}/);
});
