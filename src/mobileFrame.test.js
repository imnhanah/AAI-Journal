import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MOBILE_BREAKPOINT,MOBILE_MEDIA,MOBILE_MORE_PAGES,mobileRoutineStatus} from './mobileNavigation.js';
import {normalizeRoutine,completeRoutine} from './dailyRoutine.js';
test('raised mobile action stays above the fade without a glow or blurred rim',()=>{
  const css=readFileSync(new URL('./mobileFrame.css',import.meta.url),'utf8');
  const rule=css.match(/\.tj-mobile-bottom>\.tj-mobile-add \{([^}]+)\}/)?.[1];
  assert.ok(rule);
  for(const property of ['position:relative','z-index:2','box-shadow:none','backdrop-filter:none','-webkit-backdrop-filter:none','border:1px solid var(--tj-border)','background:var(--accent)'])assert.ok(rule.includes(property));
  assert.match(rule,/margin-top:-12px/);
  assert.match(rule,/width:56px;height:56px;min-height:56px/);
});
test('phone navigation includes Case Studies and retains the exact 768px boundary',()=>{
  assert.equal(MOBILE_BREAKPOINT,768);assert.equal(MOBILE_MEDIA,'(max-width:767px)');
  assert.deepEqual(MOBILE_MORE_PAGES,['markups','reviews','case-studies','analytics','psychology','news','challenge','finance','backtest','management']);
});
test('phone routine badge uses active profile items and the UTC routine day',()=>{
  const routine=normalizeRoutine({customItems:[{id:'custom',label:'Affirmation',group:'before'}]});
  assert.equal(mobileRoutineStatus(routine,new Date('2026-10-11T23:59:59Z')).total,9);
  const done=completeRoutine(routine,['slept_enough'],new Date('2026-10-11T23:59:59Z'));
  assert.deepEqual(mobileRoutineStatus(done,new Date('2026-10-11T23:59:59Z')),{total:9,ticked:1,completed:true,skipped:false});
  assert.equal(mobileRoutineStatus(done,new Date('2026-10-12T00:00:00Z')).completed,false);
  assert.equal(mobileRoutineStatus({...done,customItems:[]},new Date('2026-10-11T23:59:59Z')).total,9);
  assert.equal(mobileRoutineStatus({...done,enabled:false}).skipped,true);
  assert.equal(mobileRoutineStatus(normalizeRoutine({appItems:Object.fromEntries(Object.keys(routine.appItems).map(id=>[id,{enabled:false}]))})).skipped,true);
});
test('mobile CSS stays scoped, safe-area aware and readable without text transforms',()=>{
  const css=readFileSync(new URL('./mobileFrame.css',import.meta.url),'utf8');
  assert.match(css,/@media \(max-width:767px\)/);assert.match(css,/safe-area-inset-bottom/);
  assert.match(css,/grid-template-columns:repeat\(3,minmax/);assert.match(css,/grid-template-columns:repeat\(2,minmax/);
  assert.match(css,/padding:12px 16px 24px/);assert.match(css,/min-height:44px/);
  assert.doesNotMatch(css,/(?:^|[;{])\s*(?:transform|will-change|filter)\s*:|#[\da-f]{3,8}\b/m);
  for(const size of css.matchAll(/font-size:\s*([\d.]+)px/g))assert.ok(Number(size[1])>=12);
  assert.match(css,/\.tj-mobile-sheet-backdrop \{[^}]*backdrop-filter:blur/);
  assert.doesNotMatch(css,/\.tj-mobile-sheet \{[^}]*(?:filter|backdrop-filter)/);
});
test('mobile sheets keep close, keyboard trapping, inert background and existing action wiring',()=>{
  const shell=readFileSync(new URL('./MobileShell.jsx',import.meta.url),'utf8');
  assert.match(shell,/aria-modal="true"/);assert.match(shell,/event.key==='Escape'/);assert.match(shell,/event.key!=='Tab'/);
  assert.match(shell,/inert=\{sheet \|\| blocked \? '' : undefined\}/);
  const source=readFileSync(new URL('./TradingJournal.jsx',import.meta.url),'utf8');
  assert.match(source,/onStartDay=\{openNewMarkup\} onNewMarkup=\{openNewMarkup\} onLogTrade=\{openNewTrade\}/);
  assert.match(source,/onSelectAccount=\{setActiveId\}/);
});
