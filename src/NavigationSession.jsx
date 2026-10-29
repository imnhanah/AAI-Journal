import React, {createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {createNavigationState} from './navigationState.js';

const NavigationContext = createContext(null);
export function NavigationSession({owner, workspace, children}) {
  const store = useMemo(() => createNavigationState(owner), [owner]);
  const session = useMemo(() => ({store, owner, workspace}), [store, owner, workspace]);
  useEffect(() => () => store.clear(), [store]);
  return <NavigationContext.Provider value={session}>{children}</NavigationContext.Provider>;
}

export function useNavigationCache(page) {
  const session = useContext(NavigationContext);
  return useMemo(() => ({
    read: field => session?.store.read(session.owner, session.workspace, page, field),
    write: (field, value) => session?.store.write(session.owner, session.workspace, page, field, value),
  }), [session, page]);
}

export function usePageState(page, field, initial) {
  const cache = useNavigationCache(page);
  const [value, setValue] = useState(() => {
    const saved = cache.read(field);
    return saved !== undefined ? saved : typeof initial === 'function' ? initial() : initial;
  });
  useLayoutEffect(() => { cache.write(field, value); }, [cache, field, value]);
  return [value, setValue];
}

// Filter changes reset pagination, but restoring the same filters must not.
export function useWhenChanged(action, dependencies) {
  const previous = useRef(dependencies);
  useEffect(() => {
    const changed = dependencies.some((value, index) => !Object.is(value, previous.current[index]));
    previous.current = dependencies;
    if (changed) return action();
  }, dependencies);
}

export function PageScrollMemory({page}) {
  useLayoutEffect(() => {
    const scroller = document.querySelector('.tj-content');
    if (!scroller) return;
    // A new page should open from its own top edge. Restoring a previous
    // scroll offset made headings appear clipped beneath the shell.
    scroller.scrollTop = 0;
  }, [page]);
  return null;
}
