import './theme-grid.css';

export const LIGHT_THEMES = [
  { id: 'light-default', name: 'Default', sub: 'Brand green' }, { id: 'light-calm', name: 'Calm', sub: 'Sage Ledger' }, { id: 'light-focus', name: 'Focus', sub: 'Slate Studio' }, { id: 'light-warm', name: 'Warm', sub: 'Sandstone' }, { id: 'light-soft', name: 'Soft', sub: 'Rose Paper' }, { id: 'light-bold', name: 'Bold', sub: 'Iris Note' }, { id: 'light-fresh', name: 'Fresh', sub: 'Sea Glass' }, { id: 'light-neutral', name: 'Neutral', sub: 'Graphite Paper' }, { id: 'light-dreamy', name: 'Dreamy', sub: 'Lilac Paper' },
];
export const DARK_THEMES = [
  { id: 'dark-default', name: 'Default', sub: 'Brand green' }, { id: 'dark-calm', name: 'Calm', sub: 'Moss Terminal' }, { id: 'dark-focus', name: 'Focus', sub: 'Blue Hour' }, { id: 'dark-warm', name: 'Warm', sub: 'Ember Desk' }, { id: 'dark-soft', name: 'Soft', sub: 'Plum Archive' }, { id: 'dark-bold', name: 'Bold', sub: 'Indigo Field' }, { id: 'dark-fresh', name: 'Fresh', sub: 'Ocean Ink' }, { id: 'dark-neutral', name: 'Neutral', sub: 'Smoke Grid' }, { id: 'dark-signal', name: 'Signal', sub: 'Rose Signal' },
];

export default function ThemeGrid({ themes, value, onChange, onPreview }) {
  return <div className="tg" role="group" aria-label="Themes">{themes.map((theme) => <button key={theme.id} type="button" className="tg-card" aria-pressed={value === theme.id} onClick={() => onChange(theme.id)} onMouseEnter={() => onPreview?.(theme.id)} onMouseLeave={() => onPreview?.(null)} onFocus={() => onPreview?.(theme.id)} onBlur={() => onPreview?.(null)}>
    <span className="tg-tick" aria-hidden="true">✓</span><span className="tg-mini" data-theme={theme.id} aria-hidden="true"><span className="tg-side"><i/><i/><i/></span><span className="tg-page"><span className="tg-panel"><span className="tg-lines"><i/><i/></span><span className="tg-pills"><i/><i/><i/></span></span></span></span><span className="tg-name">{theme.name}</span><span className="tg-sub">{theme.sub}</span>
  </button>)}</div>;
}
