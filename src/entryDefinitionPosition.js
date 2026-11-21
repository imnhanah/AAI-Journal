// Keep definitions clear of clipping ancestors and inside the visible viewport.
export function entryDefinitionPosition(anchor, viewport, contentHeight) {
  const gap=8, margin=12;
  const width=Math.max(0,Math.min(400,viewport.width-margin*2));
  const maxHeight=Math.max(0,Math.min(340,viewport.height-margin*2));
  const height=Math.min(contentHeight||280,maxHeight);
  const right=viewport.left+viewport.width, bottom=viewport.top+viewport.height;
  const below=bottom-anchor.bottom-margin-gap, above=anchor.top-viewport.top-margin-gap;
  const up=below<height&&above>below;
  return {
    position:'fixed',visibility:'visible',width,maxHeight,
    left:Math.max(viewport.left+margin,Math.min(anchor.right-width,right-width-margin)),
    top:Math.max(viewport.top+margin,Math.min(up?anchor.top-height-gap:anchor.bottom+gap,bottom-height-margin)),
  };
}
