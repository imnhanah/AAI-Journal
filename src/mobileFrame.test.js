import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MOBILE_BREAKPOINT,MOBILE_MEDIA,MOBILE_MORE_PAGES,mobileRoutineStatus} from './mobileNavigation.js';
import {normalizeRoutine,completeRoutine} from './dailyRoutine.js';
test('mobile dock action stays within its base bar without a glow or blurred rim',()=>{
  const css=readFileSync(new URL('./mobileFrame.css',import.meta.url),'utf8');
  const rule=css.match(/\.tj-mobile-bottom>\.tj-mobile-add \{([^}]+)\}/)?.[1];
  assert.ok(rule);
  for(const property of ['position:relative','z-index:2','box-shadow:none','backdrop-filter:none','-webkit-backdrop-filter:none','border:1px solid var(--tj-border)','background:var(--accent)','align-self:center','margin-top:0'])assert.ok(rule.includes(property));
  assert.match(rule,/width:52px;height:52px;min-height:52px/);
});
test('the bar stays fixed and full width while only the centre button floats above it',()=>{
  const css=readFileSync(new URL('./mobileBottomBar.css',import.meta.url),'utf8');
  const action=css.match(/\.tj-mobile-bottom>\.tj-mobile-add \{([^}]+)\}/)?.[1] || '';
  assert.doesNotMatch(css,/bottom:\s*calc\(14px/);
  assert.match(css,/right:0;bottom:0;left:0;height:var\(--mobile-bottom\)/);
  assert.match(action,/margin-top:-35px/);
  assert.match(action,/width:70px;height:70px/);
  assert.match(action,/border-radius:50%/);
});
test('phone navigation includes Case Studies and retains the exact 768px boundary',()=>{
  assert.equal(MOBILE_BREAKPOINT,768);assert.equal(MOBILE_MEDIA,'(max-width:767px)');
  assert.deepEqual(MOBILE_MORE_PAGES,['case-studies','psychology','news','finance','backtest','management']);
});
test('phone routine badge uses active profile items and the UTC routine day',()=>{
  const routine=normalizeRoutine({customItems:[{id:'custom',label:'Affirmation',group:'before'}]});
  assert.equal(mobileRoutineStatus(routine,new Date('2026-10-09T23:59:59Z')).total,9);
  const done=completeRoutine(routine,['slept_enough'],new Date('2026-10-09T23:59:59Z'));
  assert.deepEqual(mobileRoutineStatus(done,new Date('2026-10-09T23:59:59Z')),{total:9,ticked:1,completed:false,started:true,unfinished:true,skipped:false});
  assert.equal(mobileRoutineStatus(done,new Date('2026-10-12T00:00:00Z')).completed,false);
  assert.equal(mobileRoutineStatus({...done,customItems:[]},new Date('2026-10-09T23:59:59Z')).total,8);
  assert.equal(mobileRoutineStatus({...done,enabled:false}).skipped,true);
  assert.equal(mobileRoutineStatus(normalizeRoutine({appItems:Object.fromEntries(Object.keys(routine.appItems).map(id=>[id,{enabled:false}]))})).skipped,true);
});
test('mobile continuation recognises a legacy partial save instead of its obsolete completion stamp',()=>{
  const routine=normalizeRoutine({customItems:['focus','news','review'].map(id=>({id,label:id,group:'before'})),completions:{'2026-10-09':{tickedIds:['slept_enough','ate_water','moved'],total:11,completedAt:'2026-10-09T09:00:00.000Z'}}});
  assert.deepEqual(mobileRoutineStatus(routine,new Date('2026-10-09T12:00:00Z')),{total:11,ticked:3,completed:false,started:true,unfinished:true,skipped:false});
});
test('mobile CSS stays scoped, safe-area aware and readable without text transforms',()=>{
  const css=readFileSync(new URL('./mobileFrame.css',import.meta.url),'utf8');
  assert.match(css,/@media \(max-width:767px\)/);assert.match(css,/safe-area-inset-bottom/);
  assert.match(css,/grid-template-columns:repeat\(3,minmax/);assert.match(css,/grid-template-columns:repeat\(2,minmax/);
  assert.match(css,/padding:12px 16px calc\(24px \+ var\(--mobile-bottom\)\)/);assert.match(css,/min-height:44px/);
  assert.doesNotMatch(css,/(?:^|[;{])\s*(?:transform|will-change|filter)\s*:|#[\da-f]{3,8}\b/m);
  for(const size of css.matchAll(/font-size:\s*([\d.]+)px/g))assert.ok(Number(size[1])>=12);
  assert.match(css,/\.tj-mobile-sheet-backdrop \{[^}]*background:color-mix/);
  assert.doesNotMatch(css,/backdrop-filter:blur/);
  assert.doesNotMatch(css,/\.tj-mobile-sheet \{[^}]*(?:filter|backdrop-filter)/);
});
test('mobile sheets keep close, keyboard trapping, inert background and existing action wiring',()=>{
  const shell=readFileSync(new URL('./MobileShell.jsx',import.meta.url),'utf8');
  assert.match(shell,/aria-modal="true"/);assert.match(shell,/event.key==='Escape'/);assert.match(shell,/event.key!=='Tab'/);
  assert.match(shell,/inert=\{blocked \|\| \(sheet && !floating\) \? '' : undefined\}/);
  const source=readFileSync(new URL('./TradingJournal.jsx',import.meta.url),'utf8');
  assert.match(source,/onStartDay=\{openNewMarkup\} onContinueRoutine=\{continueDailyRoutine\} search=/);
  assert.doesNotMatch(source,/onNewMarkup=\{openNewMarkup\}|onLogTrade=\{openNewTrade\}/);
  assert.match(source,/onSelectAccount=\{setActiveId\}/);
});

test('mobile header keeps the account chooser, hides only duplicate entry actions, and permits full titles',()=>{
  const css=readFileSync(new URL('./mobileFrame.css',import.meta.url),'utf8');
  assert.match(css,/\.tj-topbar :is\(\.tj-sidebar-toggle,\.tj-header-search,\.tj-btn-primary,\.tj-start-day-action,\.tj-continue-routine-action\) \{display:none!important;/);
  assert.match(css,/\.tj-header-account-control \{display:block!important;min-width:0;max-width:min\(44vw,220px\);/);
  assert.match(css,/\.tj-page-title \{display:block;overflow:visible;text-overflow:clip;white-space:normal;overflow-wrap:anywhere;/);
  assert.match(css,/scroll-padding-bottom:calc\(24px \+ var\(--mobile-bottom\)\)/);
  assert.match(css,/@media \(max-width:375px\)[\s\S]*?\.tj-header-account-switcher>span:not\(\.tj-account-initial\) \{display:none;/);
});

test('phone shell has a self-contained flex height budget when crossing the breakpoint',()=>{
  const css=readFileSync(new URL('./mobileFrame.css',import.meta.url),'utf8');
  const main=css.match(/\.tj-main \{([^}]+)\}/)?.[1] || '';
  const content=css.match(/\.tj-content \{([^}]+)\}/)?.[1] || '';
  assert.match(main,/display:flex;flex-direction:column/);
  assert.match(main,/height:100dvh;min-height:0;max-height:100dvh/);
  assert.match(main,/padding:0/);
  assert.match(main,/overflow:hidden/);
  assert.match(content,/flex:1 1 auto;min-height:0/);
  assert.match(content,/overflow-y:auto;overflow-x:hidden/);
  const app=readFileSync(new URL('./mobileApp.css',import.meta.url),'utf8');
  assert.match(app,/grid-template-columns:minmax\(0,1fr\) minmax\(0,1fr\) 64px/);
  assert.match(app,/\.tj-mobile-bar-bg \{[^}]*border-radius:0/);
  assert.match(app,/\.tj-mobile-bottom>\.tj-mobile-add \{[^}]*margin-top:0[^}]*box-shadow:none/);
  const rules=readFileSync(new URL('./mobileRules.css',import.meta.url),'utf8');
  assert.doesNotMatch(rules,/\.tj-main \{padding:0 0 var\(--mobile-bottom\);\}/);
});
test('phone dock keeps the agreed pages and routes logging to its dedicated libraries',()=>{
  const shell=readFileSync(new URL('./MobileShell.jsx',import.meta.url),'utf8');
  const dock=shell.slice(shell.indexOf('<nav className'),shell.indexOf('</nav>'));
  for(const label of ['Dashboard','Analytics','Calendar','More'])assert.ok(dock.includes(`<span>${label}</span>`),label);
  assert.doesNotMatch(dock,/Journal/);
  assert.match(dock,/<WorkflowMark /);
  assert.doesNotMatch(dock,/<Plus\/>/);
  for(const label of ['Markup','Trade Logs','Review','Challenge'])assert.ok(shell.includes(`,'${label}',`),label);
  assert.doesNotMatch(shell,/label:'New markup'|label:'Log trade'/);
  assert.match(shell,/quickTile\('markups',Pencil,'Markup'/);
  assert.match(shell,/quickTile\('journal',NotebookText,'Trade Logs'/);
});

test('mobile More sheet keeps every destination and logging out moved to Profile',()=>{
  const shell=readFileSync(new URL('./MobileShell.jsx',import.meta.url),'utf8');
  const css=readFileSync(new URL('./mobileApp.css',import.meta.url),'utf8');
  for(const id of ['case-studies','backtest','finance','psychology','news','management'])assert.ok(shell.includes(`'${id}'`),id);
  assert.match(shell,/action\(onProfile\)/);
  assert.match(shell,/action\(onAccount\)/);
  assert.doesNotMatch(shell,/Log out|tj-more-theme/);
  assert.match(readFileSync(new URL('./MobileProfileSettings.jsx',import.meta.url),'utf8'),/await confirm\(\{title:'Log out of AAICOREFX\?'/);
  assert.doesNotMatch(shell,/MORE_GROUPS|tj-mobile-more-group|<h3>Setup<\/h3>/);
  assert.doesNotMatch(css,/\.tj-mobile-more-group h3/);
  assert.doesNotMatch(shell,/>Rules<|ListChecks|onOpenRules/);
});
