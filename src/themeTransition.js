let activeTransition;

// Snapshot once; reveal the new theme without moving or re-mounting the UI.
export function transitionTheme(update, doc = document, win = window) {
  activeTransition?.skipTransition();
  activeTransition = undefined;
  if (!doc.startViewTransition || win.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    update();
    return;
  }
  const transition = doc.startViewTransition(update);
  activeTransition = transition;
  transition.ready.catch(() => {});
  transition.finished.catch(() => {}).finally(() => {
    if (activeTransition === transition) activeTransition = undefined;
  });
}
