import React from 'react';

// Where the app's side panels open (left or right) and whether they push the page or
// overlay it. TradingJournal provides the user's saved choice; anything rendered inside
// can read it (Log trade, Profile, Review, the challenge and savings setup panels).
export const PanelPrefsContext = React.createContext({ position: 'right', behavior: 'push', userId: null });
