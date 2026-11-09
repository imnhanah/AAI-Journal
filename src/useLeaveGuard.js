import {useEffect} from 'react';
import {useConfirmation} from './ConfirmationDialog.jsx';
import {getBackNavigation} from './useBackNavigation.js';

// While there are unsaved edits, every way of leaving asks first: on-screen Back, hardware back,
// bottom-bar tabs and links to other pages. Keep editing stays on the screen with history intact.
export function useLeaveGuard(dirty, stepKey) {
  const confirm = useConfirmation();
  useEffect(() => {
    const nav = getBackNavigation();
    if (!dirty || !nav.enabled) return undefined;
    return nav.setLeaveGuard(() => confirm({title:'Discard changes?', description:'Your unsaved changes will be lost.', confirmLabel:'Discard', cancelLabel:'Keep editing'}), stepKey);
  }, [dirty, stepKey, confirm]);
}
