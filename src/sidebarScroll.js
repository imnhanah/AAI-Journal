// Browser API values, not translatable UI copy.
export const SIDEBAR_SCROLL_OPTIONS = {block:'nearest',inline:'nearest'};
export const SIDEBAR_TOOLTIP_ROLE = 'tooltip';
export function scrollEdges({scrollTop, scrollHeight, clientHeight}) {
  return {top:scrollTop>1, bottom:scrollTop+clientHeight<scrollHeight-1};
}
