import { ACCENT_OPTIONS, DEFAULT_ACCENT, DEFAULT_ACCENT_OPTION } from './siteTheme';
import {useState} from 'react';

const accents = [
  DEFAULT_ACCENT_OPTION,
  ...ACCENT_OPTIONS,
];

// Controlled by Profile so previewing a color remains reversible with Cancel.
export default function AccentPicker({ selected = DEFAULT_ACCENT, theme = 'dark', onChange, compact = false }) {
  const [expanded, setExpanded] = useState(false);
  const featured = [DEFAULT_ACCENT, 'ocean-blue', 'ice', 'purple', 'bronze', 'slate'];
  const labels = { [DEFAULT_ACCENT]: 'Teal', 'ocean-blue': 'Sky Blue', ice: 'Cyan', purple: 'Orchid', bronze: 'Bronze', slate: 'Slate' };
  const ordered = [...featured.map(id => accents.find(accent => accent.id === id)), ...accents.filter(accent => !featured.includes(accent.id))];
  const visible = compact ? expanded ? ordered : ordered.filter(accent => featured.includes(accent.id) || accent.id === selected) : accents;
  const pick = id => onChange?.(selected === id ? DEFAULT_ACCENT : id);
  return <div>
    <div className="tj-accent-head">
      <strong>Accent color</strong>
    </div>
    <div className="tj-accent-row tj-accent-row-twelve accent-grid" role="group" aria-label="Accent colors">
      {visible.map(accent => <button
        key={accent.id}
        type="button"
        title={accent.label}
        aria-label={accent.label}
        aria-pressed={selected === accent.id}
        data-accent={accent.id}
        className={`tj-accent-option accent-swatch ${selected === accent.id ? 'tj-accent-selected selected' : ''}`}
        onClick={() => pick(accent.id)}
      >
        <i aria-hidden="true" style={{ background: theme === 'light' ? accent.light : accent.dark }}>{compact && <><b className="tj-accent-preview-bars"/><b className="tj-accent-check">✓</b></>}</i>
        <span>{compact ? labels[accent.id] || accent.label : accent.label}{compact && accent.id === DEFAULT_ACCENT && <small>DEFAULT</small>}</span>
      </button>)}
    </div>
    {compact && <button type="button" className="tj-profile-more-accents" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{expanded ? 'Fewer colors' : 'More colors'}</button>}
  </div>;
}
