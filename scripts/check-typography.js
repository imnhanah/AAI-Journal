// Paste this whole script into DevTools after entrance animations settle.
// Read-only: includes controls, visible HTML text, and SVG text. Small text is
// intentionally reported until Phase C. SVG chart-coordinate transforms are
// reported separately from CSS transforms that rasterize HTML text.
(() => {
  const smallText = [], transformedText = [], svgCoordinates = [];
  const describe = el => `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${typeof el.className === 'string' ? `.${el.className.trim().replace(/\s+/g, '.')}` : ''}`;
  for (const el of document.querySelectorAll('*')) {
    if (el.closest('script,style,template')) continue;
    const text = Array.from(el.childNodes).filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim() || (el.matches('input,textarea,select') ? el.value || el.placeholder : '');
    if (!text || !el.getClientRects().length) continue;
    let visible = true;
    for (let p = el; p; p = p.parentElement) {
      const s = getComputedStyle(p);
      if (s.display === 'none' || s.visibility !== 'visible' || Number(s.opacity) === 0) { visible = false; break; }
    }
    if (!visible) continue;
    const size = Number(getComputedStyle(el).fontSize.replace('px',''));
    if (size < 12) smallText.push({ element: describe(el), text: text.slice(0,80), fontSize: size });
    for (let p = el; p; p = p.parentElement) {
      const s = getComputedStyle(p);
      const effects = ['transform','translate','scale','rotate','perspective'].filter(k => s[k] && s[k] !== 'none');
      if (!effects.length) continue;
      const row = { element: describe(el), text: text.slice(0,80), ancestor: describe(p), effects: effects.map(k => `${k}: ${s[k]}`).join('; ') };
      if (p.namespaceURI === 'http://www.w3.org/2000/svg' && p.hasAttribute('transform') && !p.style.transform) svgCoordinates.push(row);
      else transformedText.push(row);
    }
  }
  console.table(transformedText);
  console.table(smallText);
  console.table(svgCoordinates);
  console.log({ transformedText: transformedText.length, below12px: smallText.length, svgCoordinateTransforms: svgCoordinates.length });
  return { transformedText, smallText, svgCoordinates };
})();
