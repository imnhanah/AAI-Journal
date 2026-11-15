// Drag-to-close for every phone bottom sheet. Hold a sheet's handle and pull down: the sheet follows the
// finger, closes when released past the distance or with a quick flick, and springs back otherwise.
export const SHEET_CLOSE_DISTANCE = 110;
export const SHEET_CLOSE_VELOCITY = 0.6;
export const SHEET_HANDLE_SELECTOR = '.tj-routine-sheet-handle,.tj-mc6-sheet-handle,.tj-st6-sheet-handle,.tj-phone-finance-handle,.tj-phone-picker-handle,.tj-mobile-sheet-handle,.tj-day-sheet-handle,.tj-sheet-handle';

export function shouldCloseSheet({distance, elapsed}) {
  if (distance <= 0) return false;
  if (distance >= SHEET_CLOSE_DISTANCE) return true;
  return distance > 24 && distance / Math.max(elapsed, 1) >= SHEET_CLOSE_VELOCITY;
}

export function sheetFor(handle) {
  for (let node = handle.parentElement; node && node !== document.body; node = node.parentElement) {
    const cls = typeof node.className === 'string' ? node.className : '';
    if (node.getAttribute('role') === 'dialog' || (/sheet/i.test(cls) && !/layer|overlay|backdrop|scrim/i.test(cls))) return node;
  }
  return handle.parentElement;
}

function closeSheet(handle, sheet) {
  if (handle.tagName === 'BUTTON') { handle.click(); return; }
  const host = sheet.parentElement;
  const scrim = host && [...host.children].find((el) => el !== sheet && /backdrop|scrim|blur/i.test(String(el.className)));
  if (scrim) { scrim.dispatchEvent(new MouseEvent('mousedown', {bubbles:true})); scrim.click(); return; }
  sheet.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape', bubbles:true}));
}

export function installSheetDrag(root = document) {
  let drag = null;
  const stop = (event) => { if (event.target.closest?.(SHEET_HANDLE_SELECTOR)) event.stopPropagation(); };
  const start = (event) => {
    const handle = event.target.closest?.(SHEET_HANDLE_SELECTOR);
    if (!handle || event.touches.length !== 1) return;
    const sheet = sheetFor(handle);
    if (!sheet) return;
    drag = {handle, sheet, y:event.touches[0].clientY, at:performance.now(), distance:0, moved:false};
    sheet.style.transition = 'none';
    event.stopPropagation();
  };
  const move = (event) => {
    if (!drag) return;
    const distance = Math.max(0, event.touches[0].clientY - drag.y);
    drag.distance = distance;
    if (distance > 4) drag.moved = true;
    drag.sheet.style.translate = `0 ${distance}px`;
    if (event.cancelable) event.preventDefault();
    event.stopPropagation();
  };
  const end = (event) => {
    if (!drag) return;
    const {handle, sheet, distance, moved, at} = drag;
    drag = null;
    event.stopPropagation();
    sheet.style.transition = 'translate .2s ease';
    if (moved && shouldCloseSheet({distance, elapsed:performance.now() - at})) {
      sheet.style.translate = '0 110%';
      setTimeout(() => { closeSheet(handle, sheet); sheet.style.translate = ''; sheet.style.transition = ''; }, 190);
    } else {
      sheet.style.translate = '';
      setTimeout(() => { sheet.style.transition = ''; }, 220);
    }
  };
  const opts = {capture:true};
  root.addEventListener('touchstart', start, {capture:true, passive:true});
  root.addEventListener('touchmove', move, {capture:true, passive:false});
  root.addEventListener('touchend', end, opts);
  root.addEventListener('touchcancel', end, opts);
  for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) root.addEventListener(type, stop, opts);
  return () => {
    root.removeEventListener('touchstart', start, opts);
    root.removeEventListener('touchmove', move, opts);
    root.removeEventListener('touchend', end, opts);
    root.removeEventListener('touchcancel', end, opts);
    for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) root.removeEventListener(type, stop, opts);
  };
}
