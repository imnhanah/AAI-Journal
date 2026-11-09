import {useEffect, useRef} from 'react';
import {createBackNavigation} from './backNavigation.js';

let navigation = null;

// The one navigation stack for the phone app.
export function getBackNavigation(homePath = '/dashboard') {
  if (!navigation) navigation = createBackNavigation({history:window.history, currentPath:() => window.location.pathname, homePath});
  return navigation;
}

export const useBackNavigation = () => getBackNavigation();

// Puts a step inside a page into history while `open` is true. Back, on screen or hardware,
// closes the step through onClose before it leaves the page. Pages only supply this one line.
// If onClose decides not to close, such as a form asking first, the step is put back.
export function useNavStep(key, open, onClose, {via = 'page'} = {}) {
  const close = useRef(onClose), stillOpen = useRef(open);
  close.current = onClose;
  stillOpen.current = open;
  useEffect(() => {
    const nav = getBackNavigation();
    if (!open || !nav.enabled) return undefined;
    const handle = () => {
      close.current?.();
      setTimeout(() => { if (stillOpen.current) nav.openStep(key, {via, onClose:handle}); }, 0);
    };
    nav.openStep(key, {via, onClose:handle});
    return () => { stillOpen.current = false; nav.closeStep(key); };
  }, [key, open, via]);
}
