export const ENTRY_PANEL_POSITIONS = Object.freeze(['left', 'right']);

export function normaliseEntryPanelPosition(value) {
  return ENTRY_PANEL_POSITIONS.includes(value) ? value : 'right';
}

// Push moves the page aside to make room; Overlay lays the panel over a dimmed page.
export const ENTRY_PANEL_BEHAVIORS = Object.freeze(['push', 'overlay']);

export function normaliseEntryPanelBehavior(value) {
  return ENTRY_PANEL_BEHAVIORS.includes(value) ? value : 'push';
}
