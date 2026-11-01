import ThemeGrid, { DARK_THEMES, LIGHT_THEMES } from './ThemeGrid';

export default function ProfileThemePicker({ mode = 'dark', palettes, onChange, onPreview, showHeading = true }) {
  const themes = mode === 'light' ? LIGHT_THEMES : DARK_THEMES;
  const selected = `${mode}-${palettes?.[mode] || 'default'}`;
  return <div className="tj-theme-gallery">
    {showHeading && <div className="tj-theme-studio-heading">
      <div><strong>{mode === 'light' ? 'Light themes' : 'Dark themes'}</strong><span>Pick a palette. Hover a card to preview it, click to keep it.</span></div>
    </div>}
    <ThemeGrid themes={themes} value={selected} onChange={(id) => onChange?.(mode, id.replace(`${mode}-`, ''))} onPreview={id => onPreview?.(id ? id.replace(`${mode}-`, '') : null)} />
  </div>;
}
