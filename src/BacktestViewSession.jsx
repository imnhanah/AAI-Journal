import React, {createContext, useMemo, useEffect} from 'react';
import {createBacktestViewState} from './backtestViewState.js';

export const BacktestViewContext = createContext(null);
export function BacktestViewSession({owner, children}) {
  const views = useMemo(() => createBacktestViewState(owner), [owner]);
  useEffect(() => () => views.clear(), [views]);
  return <BacktestViewContext.Provider value={views}>{children}</BacktestViewContext.Provider>;
}
