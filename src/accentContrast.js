// Relative luminance of a resolved CSS hex or rgb color.
export function luminance(color) {
  const value = String(color).trim();
  let channels;
  if (/^#[\da-f]{6}$/i.test(value)) {
    const n = parseInt(value.slice(1), 16);
    channels = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  } else if (/^#[\da-f]{3}$/i.test(value)) {
    channels = [...value.slice(1)].map(v => parseInt(v + v, 16));
  } else {
    channels = value.match(/^rgba?\(\s*(\d+)\s*[, ]\s*(\d+)\s*[, ]\s*(\d+)/i)?.slice(1, 4).map(Number);
  }
  if (!channels) return 0;
  const [r, g, b] = channels.map(channel => {
    const v = channel / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function accentTextToken(color, darkText, lightText) {
  // Compare both foregrounds instead of using a brightness cutoff. The
  // defaults correspond to the theme's accent-text tokens; callers resolve
  // those tokens so future palette changes are respected too.
  const background = luminance(color);
  const dark = darkText ? luminance(darkText) : luminance(`rgb(${[7, 38, 27].join(',')})`);
  const light = lightText ? luminance(lightText) : 1;
  const contrast = foreground => (Math.max(background, foreground) + .05) / (Math.min(background, foreground) + .05);
  // A few middle-brightness swatches fall below 4.5:1 with both the usual
  // dark ink and white. Pure dark text closes that gap without changing
  // either the selected accent or the profit/loss palette.
  if (Math.max(contrast(dark), contrast(light)) < 4.5 && contrast(0) > contrast(light)) return 'var(--accent-text-high-contrast)';
  return contrast(dark) >= contrast(light) ? 'var(--accent-text-dark)' : 'var(--accent-text-light)';
}
