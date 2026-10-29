// Use physical coordinates rather than translating readable tooltip text.
export function tooltipPoint(x, y, width, height, tooltipWidth, tooltipHeight) {
  const inset = 8, offset = 16;
  const place = (pointer, extent, size) => {
    const preferred = pointer + offset + size <= extent - inset
      ? pointer + offset : pointer - offset - size;
    return Math.max(inset, Math.min(preferred, extent - size - inset));
  };
  return { left: place(x, width, tooltipWidth), top: place(y, height, tooltipHeight) };
}

export function followAnalyticsPointer(event) {
  const chart = event.target.closest?.('.recharts-wrapper');
  if (!chart || !event.currentTarget.contains(chart)) return;
  const tooltip = chart.querySelector('.recharts-tooltip-wrapper');
  if (!tooltip) return;
  const bounds = chart.getBoundingClientRect();
  const size = tooltip.getBoundingClientRect();
  const point = tooltipPoint(event.clientX - bounds.left, event.clientY - bounds.top,
    bounds.width, bounds.height, size.width, size.height);
  chart.style.setProperty('--analytics-tooltip-left', `${point.left}px`);
  chart.style.setProperty('--analytics-tooltip-top', `${point.top}px`);
}
