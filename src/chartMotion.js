// Only presentation changes: the data, final geometry and tooltips are intact.
export const CHART_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
export function getChartAnimation(kind, reducedMotion = typeof window !== 'undefined' && window.matchMedia?.(CHART_MOTION_QUERY).matches) {
  return {
    isAnimationActive: !reducedMotion,
    animationBegin: 0,
    animationDuration: kind === 'line' ? 700 : 500,
    animationEasing: 'ease-out',
  };
}
