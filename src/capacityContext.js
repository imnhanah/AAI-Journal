import { createContext } from 'react';

// How many more accounts the member may add (Infinity = no cap, 0 = none or not yet verified). Read by the settings screen's "Add account".
export const AccountCapacityContext = createContext(Infinity);
