// The phone header slides away as you scroll down and returns as soon as you scroll up.
const SCROLL_THRESHOLD = 6; // Ignores small finger jitter.

// anchorY is where the last decision was made, so a slow scroll still adds up to a change.
export function nextHeaderState({hidden, anchorY, y, headerHeight, atBottom}) {
  if (y <= headerHeight) return {hidden:false, anchorY:y}; // The top of a page always shows it.
  if (atBottom) return {hidden, anchorY}; // The bounce at the end of a page is not a scroll up.
  const delta = y - anchorY;
  if (Math.abs(delta) < SCROLL_THRESHOLD) return {hidden, anchorY};
  return {hidden:delta > 0, anchorY:y};
}
