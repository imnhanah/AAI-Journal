// The phone header is visible only at the document's real top edge. Any scroll
// away from that edge hides it, regardless of direction; it cannot reappear
// during a small reverse gesture partway through a page.
export function nextHeaderState({hidden, anchorY, y, headerHeight, atBottom}) {
  // iOS can briefly report a small negative value while rubber-banding.
  // Treat it as the actual top rather than leaving the header stranded away.
  if (y <= 0) return {hidden:false, anchorY:0};
  return {hidden:true, anchorY:y};
}
