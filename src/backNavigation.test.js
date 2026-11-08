import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {createBackNavigation, isTopLevelPage, OVERLAY_STEP} from './backNavigation.js';

// A browser history that, like the real one, reports a move later rather than immediately.
function fakeBrowser(startPath) {
  const entries = [{state:null, path:startPath}];
  let index = 0;
  const pending = [];
  const history = {
    get state() { return entries[index].state; },
    pushState(state, _, path) { entries.splice(index + 1); entries.push({state, path}); index += 1; },
    replaceState(state, _, path) { entries[index] = {state, path}; },
    go(delta) { pending.push(delta); },
    back() { pending.push(-1); },
  };
  return {history, path:() => entries[index].path, size:() => entries.length, index:() => index, settle(nav) {
    let guard = 0;
    while (pending.length && guard++ < 20) { index = Math.max(0, index + pending.shift()); nav.handlePop(); }
  }};
}

function setup(path = '/dashboard', topLevel = true) {
  const browser = fakeBrowser(path), log = {more:0, paths:[]};
  const nav = createBackNavigation({history:browser.history, currentPath:browser.path, homePath:'/dashboard', onPath:value => log.paths.push(value), onOpenMore:() => { log.more += 1; }});
  nav.start({topLevel});
  return {browser, nav, log, back:() => { nav.back(); browser.settle(nav); }, hardwareBack:() => { browser.history.back(); browser.settle(nav); }};
}

test('only Dashboard, Analytics and Calendar are top level', () => {
  for (const page of ['dashboard', 'analytics', 'calendar']) assert.equal(isTopLevelPage(page), true);
  for (const page of ['finance', 'markups', 'tradelog', 'reviews', 'challenge', 'management', 'news']) assert.equal(isTopLevelPage(page), false);
});

test('More -> Finance -> Back lands on the page with More reopened', () => {
  const {browser, nav, log, back} = setup();
  nav.open('/finance', {via:'more'});
  back();
  assert.equal(browser.path(), '/dashboard');
  assert.equal(log.more, 1);
  assert.deepEqual(log.paths, ['/dashboard']);
});

test('+ sheet -> Challenge -> Back returns to the screen underneath without the sheet', () => {
  const {browser, nav, log, back} = setup('/analytics');
  nav.open('/challenge', {via:'sheet'});
  back();
  assert.equal(browser.path(), '/analytics');
  assert.equal(log.more, 0);
});

test('Setup -> Instruments -> Back returns to Setup, and Back again to More', () => {
  const {browser, nav, log, back} = setup();
  let closed = 0;
  nav.open('/management', {via:'more'});
  nav.openStep('setup:instruments', {onClose:() => { closed += 1; }});
  back();
  assert.equal(closed, 1);
  assert.equal(browser.path(), '/management');
  assert.equal(log.more, 0);
  back();
  assert.equal(browser.path(), '/dashboard');
  assert.equal(log.more, 1);
});

test('Case Studies: Back closes the study first, then leaves to More', () => {
  const {browser, nav, log, back} = setup();
  let study = true;
  nav.open('/case-studies', {via:'more'});
  nav.openStep('study', {onClose:() => { study = false; }});
  back();
  assert.equal(study, false);
  assert.equal(browser.path(), '/case-studies');
  back();
  assert.equal(log.more, 1);
});

test('unsaved edits: Back asks first, and Keep editing stays with history intact', async () => {
  const {browser, nav, log, hardwareBack} = setup();
  let closed = 0, answer = false, asked = 0;
  nav.open('/x', {via:'page'});
  nav.openStep('account', {via:'more', onClose:() => { closed += 1; }});
  nav.setLeaveGuard(async () => { asked += 1; return answer; }, 'account');
  const size = browser.size();
  hardwareBack();
  await Promise.resolve(); await Promise.resolve();
  assert.equal(asked, 1);
  assert.equal(closed, 0, 'the screen stays open');
  assert.equal(nav.depth, 2);
  assert.equal(browser.size(), size, 'history is intact');
  assert.equal(log.more, 0);
  answer = true;
  hardwareBack();
  await new Promise(resolve => setTimeout(resolve, 0));
  browser.settle(nav);
  assert.equal(asked, 2);
  assert.equal(closed, 1, 'Discard closes it');
  assert.equal(nav.depth, 1);
  assert.equal(log.more, 1, 'and More reopens as usual');
});

test('unsaved edits: a popup above the guarded screen closes without asking', () => {
  const {nav, hardwareBack} = setup();
  let asked = 0, popup = 0;
  nav.openStep('account', {});
  nav.setLeaveGuard(async () => { asked += 1; return false; }, 'account');
  nav.openStep('popup', {onClose:() => { popup += 1; }});
  hardwareBack();
  assert.equal(popup, 1);
  assert.equal(asked, 0);
  assert.equal(nav.depth, 1);
});

test('opening something while passing through a dead step lands in the right place', () => {
  const {browser, nav} = setup();
  nav.openStep('gone', {});
  nav.open('/finance', {via:'more'});
  nav.closeStep('gone');
  let reopened = 0;
  nav.configure({onOpenMore:() => { reopened += 1; nav.openStep(OVERLAY_STEP, {}); }});
  nav.back();
  browser.settle(nav);
  browser.settle(nav);
  assert.equal(reopened, 1);
  assert.equal(browser.path(), '/dashboard');
  assert.equal(nav.depth, 1);
  assert.equal(browser.size() >= 2, true);
});

test('hardware back behaves exactly like the on-screen button', () => {
  const {browser, nav, log, hardwareBack} = setup();
  let closed = 0;
  nav.open('/markups', {via:'sheet'});
  nav.openStep('markup-detail', {onClose:() => { closed += 1; }});
  hardwareBack();
  assert.equal(closed, 1);
  assert.equal(browser.path(), '/markups');
  hardwareBack();
  assert.equal(browser.path(), '/dashboard');
  assert.equal(log.more, 0);
});

test('a fresh load on an inner page gets Dashboard beneath it', () => {
  const {browser, back} = setup('/finance', false);
  assert.equal(browser.path(), '/finance');
  back();
  assert.equal(browser.path(), '/dashboard');
  const second = setup('/news', false);
  second.hardwareBack();
  assert.equal(second.browser.path(), '/dashboard');
});

test('switching bottom-bar tabs clears the history', async () => {
  const {browser, nav, log} = setup();
  let closed = 0;
  nav.open('/finance', {via:'more'});
  nav.open('/news', {via:'page'});
  nav.openStep('filters', {onClose:() => { closed += 1; }});
  await nav.openTab('/calendar');
  browser.settle(nav);
  assert.equal(browser.path(), '/calendar');
  assert.equal(nav.depth, 0);
  assert.equal(nav.canGoBack(), false);
  assert.equal(closed, 1);
  assert.equal(log.more, 0);
  nav.open('/finance', {via:'page'});
  nav.back(); browser.settle(nav);
  assert.equal(browser.path(), '/calendar');
});

test('a tab tapped from the top level replaces it rather than stacking', async () => {
  const {browser, nav} = setup();
  await nav.openTab('/analytics');
  browser.settle(nav);
  assert.equal(browser.size(), 1);
  assert.equal(browser.path(), '/analytics');
});

test('unsaved edits can stop a tab change', async () => {
  const {browser, nav} = setup();
  nav.open('/finance', {via:'more'});
  const release = nav.setLeaveGuard(async () => false);
  assert.equal(await nav.openTab('/calendar'), false);
  browser.settle(nav);
  assert.equal(browser.path(), '/finance');
  release();
  assert.equal(await nav.openTab('/calendar'), true);
  browser.settle(nav);
  assert.equal(browser.path(), '/calendar');
});

test('Back with an overlay open closes it and stays put, even on Dashboard', () => {
  const {browser, nav, log, hardwareBack} = setup();
  let overlay = true;
  nav.openStep(OVERLAY_STEP, {onClose:() => { overlay = false; }});
  hardwareBack();
  assert.equal(overlay, false);
  assert.equal(browser.path(), '/dashboard');
  assert.equal(nav.depth, 0);
  assert.equal(log.more, 0);
});

test('choosing a page from an overlay replaces its entry, so the sheet stays closed on Back', () => {
  const {browser, nav, log, back} = setup('/analytics');
  nav.openStep(OVERLAY_STEP, {});
  nav.open('/challenge', {via:'sheet'});
  nav.closeStep(OVERLAY_STEP);
  assert.equal(nav.depth, 1);
  assert.equal(browser.size(), 2);
  back();
  assert.equal(browser.path(), '/analytics');
  assert.equal(nav.depth, 0);
  assert.equal(log.more, 0);
});

test('closing an overlay without choosing removes its entry silently', () => {
  const {browser, nav} = setup();
  nav.openStep(OVERLAY_STEP, {});
  nav.closeStep(OVERLAY_STEP);
  browser.settle(nav);
  assert.equal(nav.depth, 0);
  assert.equal(browser.path(), '/dashboard');
});

test('an overlay left open by a refresh does not trap Back', () => {
  const {browser, nav} = setup();
  nav.open('/finance', {via:'page'});
  nav.openStep(OVERLAY_STEP, {});
  const fresh = createBackNavigation({history:browser.history, currentPath:browser.path, homePath:'/dashboard'});
  fresh.start({topLevel:false});
  browser.settle(fresh);
  assert.equal(fresh.depth, 1);
  assert.equal(browser.path(), '/finance');
});

test('a page closing its own step removes it from history silently', () => {
  const {browser, nav, log} = setup();
  let closed = 0;
  nav.open('/markups', {via:'more'});
  nav.openStep('detail', {onClose:() => { closed += 1; }});
  nav.closeStep('detail');
  browser.settle(nav);
  assert.equal(nav.depth, 1);
  assert.equal(browser.path(), '/markups');
  assert.equal(closed, 0);
  assert.equal(log.more, 0);
});

test('a step left without a screen, such as after a refresh, is passed through', () => {
  const {browser, nav} = setup();
  nav.open('/case-studies', {via:'page'});
  nav.openStep('study', {});
  const fresh = createBackNavigation({history:browser.history, currentPath:browser.path, homePath:'/dashboard'});
  fresh.start({topLevel:false});
  assert.equal(fresh.depth, 2);
  fresh.back();
  browser.settle(fresh);
  assert.equal(browser.path(), '/dashboard');
  assert.equal(fresh.depth, 0);
});

test('refresh keeps its place in history', () => {
  const {browser, nav} = setup();
  nav.open('/finance', {via:'more'});
  const size = browser.size();
  const reloaded = createBackNavigation({history:browser.history, currentPath:browser.path, homePath:'/dashboard'});
  reloaded.start({topLevel:false});
  assert.equal(browser.size(), size);
  assert.equal(reloaded.depth, 1);
});

test('phones use this stack and the desktop path is left alone', () => {
  const journal = readFileSync(new URL('./TradingJournal.jsx', import.meta.url), 'utf8');
  assert.match(journal, /const navigateMobile = async \(nextPage, via = 'page'\) => \{/);
  assert.match(journal, /if \(backNav\.enabled\) \{/);
  assert.match(journal, /if \(window\.location\.pathname !== JOURNAL_PATHS\[nextPage\]\) window\.history\.pushState\(\{\}, "", JOURNAL_PATHS\[nextPage\]\);/);
  assert.match(journal, /if \(getBackNavigation\(\)\.enabled\) return;/);
});

// Page motion reads one direction per page change from this layer (MobilePageStage.jsx).
test('page moves report push, pop and tab, each read once', async () => {
  const {browser, nav, back, hardwareBack} = setup();
  assert.equal(nav.takeMove(), null, 'nothing before the first move');
  nav.open('/finance', {via:'more'});
  assert.equal(nav.takeMove(), 'push');
  assert.equal(nav.takeMove(), null, 'a move is read only once');
  back();
  assert.equal(nav.takeMove(), 'pop');
  nav.open('/news', {via:'page'});
  nav.takeMove();
  hardwareBack();
  assert.equal(nav.takeMove(), 'pop', 'hardware back is the same pop');
  await nav.openTab('/calendar');
  browser.settle(nav);
  assert.equal(nav.takeMove(), 'tab');
});

test('a step inside a page is not a page move', () => {
  const {nav, back} = setup();
  nav.open('/management', {via:'more'});
  nav.takeMove();
  nav.openStep('setup:instruments', {onClose:() => {}});
  back();
  assert.equal(nav.takeMove(), null, 'closing the step leaves the page where it is');
});

test('Back with nothing beneath goes to Dashboard as a pop', () => {
  const {nav} = setup('/finance', true);
  nav.back();
  assert.equal(nav.takeMove(), 'pop');
});

test('unsaved edits stop a move before it is reported, so nothing animates', async () => {
  const {browser, nav, hardwareBack} = setup();
  nav.open('/finance', {via:'more'});
  nav.takeMove();
  const release = nav.setLeaveGuard(async () => false);
  assert.equal(await nav.openTab('/calendar'), false);
  assert.equal(nav.takeMove(), null, 'a blocked tab change reports nothing');
  hardwareBack();
  await Promise.resolve(); await Promise.resolve();
  assert.equal(nav.takeMove(), null, 'a blocked back reports nothing');
  assert.equal(browser.path(), '/finance');
  release();
});

test('a move whose page never changes is forgotten', () => {
  const {nav} = setup();
  const now = Date.now;
  try {
    nav.open('/finance', {via:'more'});
    Date.now = () => now() + 5000;
    assert.equal(nav.takeMove(), null);
  } finally { Date.now = now; }
});
