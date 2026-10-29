// Theme pairs captured from the Demo workspace; no signed-in profile chrome is included.
export const LANDING_SCREENSHOTS = Object.freeze({
  dashboard: { label: 'Dashboard', width: 1280, height: 607 },
  trades: { label: 'Trade Logs', width: 1280, height: 607 },
  markups: { label: 'Markups', width: 1920, height: 1080 },
  review: { label: 'Review', width: 1280, height: 607 },
  analytics: { label: 'Analytics', width: 1280, height: 607 },
  backtest: { label: 'Backtest', width: 1280, height: 607 },
  guardrails: { label: 'Guardrails', width: 1835, height: 291 },
});

export function landingScreenshotUrl(id, theme) {
  if (!Object.hasOwn(LANDING_SCREENSHOTS, id)) throw new Error('Unknown landing screenshot');
  return `/landing/emerald/demo-${id}-${theme === 'light' ? 'light' : 'dark'}.jpg`;
}
