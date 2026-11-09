// Phone back navigation. The browser's history is the only stack, so the on-screen
// Back button and the hardware back button can never disagree: both are one history
// step, and everything that should happen on the way back happens when that step lands.
//
//   depth 0   the top-level page (Dashboard, Analytics or Calendar)
//   depth 1+  inner pages and steps inside them
//
// An entry remembers how it was reached:
//   via 'more'   leaving it reopens the More overlay
//   via 'sheet'  leaving it just returns to the screen underneath (the sheet stays closed)
//   via 'page'   leaving it returns to the page that opened it
//   step         it is a step inside a page; leaving it calls that step's onClose
//
// An open overlay (More, the + sheet, search) is also a step, so Back closes it rather than
// leaving the app. Choosing a page from it replaces that entry, which is why the + sheet does
// not come back, while via 'more' reopens More deliberately.
export const TOP_LEVEL_PAGES = ['dashboard', 'analytics', 'calendar'];
export const isTopLevelPage = page => TOP_LEVEL_PAGES.includes(page);
export const OVERLAY_STEP = 'overlay';

const SILENT_POP_TIMEOUT = 600;
// How long a reported move waits for its page to change before it is forgotten.
const MOVE_LIFETIME = 1500;

export function createBackNavigation({history, currentPath, homePath, onPath = () => {}, onOpenMore = () => {}}) {
  const steps = new Map();
  const queue = [];
  let handlers = {onPath, onOpenMore};
  let current = {depth:0, via:null, step:null, path:homePath};
  let waiting = null, enabled = false, leaveGuard = null, leaveGuardDepth = 0;
  // The direction of the last page change, for the page animation: 'push' (a page opened
  // on top), 'pop' (back to the page underneath) or 'tab' (a bottom-bar tab). This is only
  // a label on moves this layer already makes; it is not a second stack.
  let move = null;
  const report = kind => { move = {kind, at:Date.now()}; };

  const read = () => history.state?.tjNav || null;
  const write = (method, entry) => { history[method]({...(history.state || {}), tjNav:entry}, '', entry.path); current = entry; };

  // Moves that must not look like the user pressing back: only one runs at a time,
  // because the browser reports a history move later, not when it is requested.
  const drain = () => { while (!waiting && queue.length) queue.shift()(); };
  const run = operation => { queue.push(operation); drain(); };
  const silentGo = (delta, after) => {
    if (!delta) { after?.(); return; }
    waiting = {after, timer:setTimeout(() => settle(), SILENT_POP_TIMEOUT)};
    history.go(delta);
  };
  const settle = () => {
    if (!waiting) return;
    const {after, timer} = waiting;
    clearTimeout(timer); waiting = null;
    current = read() || current;
    after?.();
    drain();
  };
  // A step whose screen no longer exists, such as after a refresh, is passed through. It holds the
  // queue until it lands, so nothing opened in the meantime ends up on the wrong entry.
  const passThrough = () => {
    const from = current.path;
    silentGo(-1, () => {
      if (current.path !== from) { report('pop'); handlers.onPath(current.path); }
      if (current.step && !steps.has(current.step)) passThrough();
    });
  };
  const closeStepsDeeperThan = depth => {
    [...steps.entries()].filter(([, step]) => step.depth > depth).sort((a, b) => b[1].depth - a[1].depth).forEach(([key, step]) => { steps.delete(key); step.onClose?.(); });
  };

  const api = {
    get enabled() { return enabled; },
    get depth() { return current.depth; },
    canGoBack: () => current.depth > 0,
    configure(next) { handlers = {...handlers, ...next}; },
    // The page animation reads the move once, when the page changes.
    takeMove() {
      const taken = move && Date.now() - move.at <= MOVE_LIFETIME ? move.kind : null;
      move = null;
      return taken;
    },

    // Called once at load. A refresh keeps its place in history. A page opened directly
    // gets Dashboard placed underneath it, so Back always has somewhere to go.
    start({topLevel, path = currentPath()}) {
      if (enabled) return;
      enabled = true;
      const saved = read();
      if (saved) {
        current = {...saved, path};
        // An overlay does not survive a refresh, so its entry goes too.
        if (saved.step === OVERLAY_STEP) run(() => silentGo(-1));
        return;
      }
      if (topLevel) { write('replaceState', {depth:0, via:null, step:null, path}); return; }
      write('replaceState', {depth:0, via:null, step:null, path:homePath});
      write('pushState', {depth:1, via:null, step:null, path});
    },
    stop() { enabled = false; },

    // Inner page. via: 'more', 'sheet' or 'page'.
    open(path, {via = 'page'} = {}) {
      // Reported now, not when the queued move runs, because the page changes straight away.
      report('push');
      run(() => {
        if (path === current.path) return;
        if (current.step === OVERLAY_STEP) { steps.delete(OVERLAY_STEP); write('replaceState', {depth:current.depth, via, step:null, path}); return; }
        write('pushState', {depth:current.depth + 1, via, step:null, path});
      });
    },

    // Bottom-bar tab: returns to the bottom of the stack and replaces it, which clears
    // the history. The optional guard lets a page with unsaved edits stop this.
    async openTab(path) {
      if (!(await api.confirmLeave())) return false;
      report('tab');
      run(() => {
        closeStepsDeeperThan(0);
        silentGo(-current.depth, () => write('replaceState', {depth:0, via:null, step:null, path}));
      });
      return true;
    },
    // While a guard is set, leaving its step asks first. Without a step it covers the current screen.
    setLeaveGuard(guard, stepKey) {
      leaveGuard = guard;
      leaveGuardDepth = (stepKey && steps.get(stepKey)?.depth) || current.depth;
      return () => { if (leaveGuard === guard) leaveGuard = null; };
    },
    // Asks if there are unsaved edits. Choosing to leave drops the guard.
    async confirmLeave() {
      if (!leaveGuard) return true;
      if (!(await leaveGuard())) return false;
      leaveGuard = null;
      return true;
    },

    // The on-screen Back button. If nothing is beneath this page, go to Dashboard.
    back() {
      if (current.depth > 0) { history.back(); return; }
      if (current.path !== homePath) { write('replaceState', {depth:0, via:null, step:null, path:homePath}); report('pop'); handlers.onPath(homePath); }
    },

    // A step inside a page: a sub-page, an open study, a trade or markup detail, a full-screen editor.
    // Re-opening the step a refresh left us on adopts that entry instead of adding another.
    openStep(key, {via = 'page', onClose} = {}) {
      run(() => {
        if (current.step === key) { steps.set(key, {depth:current.depth, onClose}); return; }
        const entry = {depth:current.depth + 1, via, step:key, path:current.path};
        steps.set(key, {depth:entry.depth, onClose});
        write('pushState', entry);
      });
    },
    // The page closed the step itself (not through Back). If something was opened on top
    // of it, it just forgets the step; landing on that entry later passes straight through.
    closeStep(key) {
      run(() => {
        const step = steps.get(key);
        if (!step) return;
        steps.delete(key);
        if (current.step === key) silentGo(-1);
      });
    },

    handlePop() {
      if (waiting) { settle(); return; }
      const left = current, next = read() || {depth:0, via:null, step:null, path:currentPath()};
      const backward = next.depth < left.depth, leftNoScreen = left.step && !steps.has(left.step);

      // A page cannot stop a back move, only undo it. So unsaved edits put the step straight back,
      // before anything has closed, and ask. Keep editing has nothing more to do.
      if (backward && leaveGuard && next.depth < leaveGuardDepth) {
        write('pushState', left);
        api.confirmLeave().then(leaving => { if (leaving) history.back(); });
        return;
      }

      current = {...next, path:currentPath()};
      closeStepsDeeperThan(next.depth);
      if (next.path !== left.path) { report(backward ? 'pop' : 'push'); handlers.onPath(currentPath()); }
      if ((next.step && !steps.has(next.step)) || (backward && leftNoScreen)) passThrough();
      if (backward && left.via === 'more') handlers.onOpenMore();
    },
  };
  return api;
}
