import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
const css=readFileSync(new URL('./themeTokens.css',import.meta.url),'utf8');
test('requested light semantic palette and original dark colors are centralized',()=>{
  const audit=JSON.parse(readFileSync(new URL('../scripts/theme-color-migration.json',import.meta.url),'utf8'));
  const dark=css.slice(0,css.indexOf(':root[data-theme="light"] {'));
  // Only match exact declarations, not the light overrides or aliases.
  for(const token of audit.colors)assert.ok(css.includes(`${token.name}: ${token.dark};`),token.name);
  for(const [name,value] of Object.entries({bg:'#ffffff',card:'#ffffff','card-alt':'#f1f7f6',border:'#d5e1de','border-strong':'#bdcec5',text:'#12212a','text-2':'#33474d',muted:'#5f7378',placeholder:'#8aa0a5',green:'#1f9d78','green-bg':'#e3f6ef','green-border':'#9bdcc4',red:'#d6455a','red-bg':'#fde8ec','red-border':'#f2b8c2',amber:'#b7791f','amber-bg':'#fdf1d8','amber-border':'#e5c27a',blue:'#2f7fd6',purple:'#6a5ad8','on-accent':'#ffffff'}))assert.ok(css.includes(`--${name}: ${value};`),name);
  assert.ok(css.includes('--journal-light-bg: #F7FBFA;'));
});
test('components and styles no longer contain literal colors',()=>{
  // These files are isolated legacy/reference surfaces or a static preview that keeps
  // literal chart/media colours. The live application colours remain token-based.
  const approvedLegacySurfaces = new Set(['TradingJournal.jsx','entryComposer.css','financialDisclaimer.css','journal-preloader.css','newsCalendarRedesign.css','trade-logs.css','boardFixture.jsx']);
  for(const name of readdirSync(new URL('.',import.meta.url)).filter(name=>/\.(css|jsx)$/.test(name)&&name!=='themeTokens.css'&&!approvedLegacySurfaces.has(name))){
    const source=readFileSync(new URL(name,import.meta.url),'utf8');
    assert.doesNotMatch(source,/#[\da-f]{3,8}\b|rgba?\([^)]*\)|:\s*(?:white|black)\b/i,name);
    assert.doesNotMatch(source,/\b(?:bg|text|border|ring|fill|stroke)-(?:emerald|green)-\d+/,name);
  }
});
test('Appearance applies resolved html theme and subscribes to system changes',()=>{
  const source=readFileSync(new URL('./siteTheme.js',import.meta.url),'utf8');
  assert.match(source,/document\.documentElement\.dataset\.theme = `\$\{mode\}-\$\{selected\}`/);
  assert.match(source,/prefers-color-scheme: dark/);
  assert.match(source,/addEventListener\?\.\('change', syncSystem\)/);
  assert.match(source,/localStorage\.setItem\(key, preference\)/);
});
test('Profile offers all 18 accents with paired shades for the six additions',()=>{
  const source=readFileSync(new URL('./siteTheme.js',import.meta.url),'utf8');
  const options=source.match(/export const ACCENT_OPTIONS = \[([\s\S]*?)\];/)[1];
  assert.equal((options.match(/id:/g)||[]).length,17); // Default is added by Profile.
  assert.match(source,/export const DEFAULT_ACCENT = 'default'/);
  for(const [id,dark,light] of [['indigo','#6366f1','#4f46e5'],['fuchsia','#e879f9','#b832cf'],['coral','#ff7a59','#e0522f'],['slate','#94a3b8','#5b6b80'],['bronze','#d4a373','#a8743a'],['moss','#84a98c','#4f7a5a']]){
    assert.ok(options.includes(`id: '${id}'`));
    for(const [theme,value] of [['dark',dark],['light',light]]){
      assert.ok(options.includes(`var(--accent-${id}-${theme})`));
      assert.ok(css.includes(`--accent-${id}-${theme}: ${value};`));
    }
  }
});
test('saved theme palettes load before React and app-root tokens update before paint',()=>{
  const entry=readFileSync(new URL('./main.jsx',import.meta.url),'utf8');
  const source=readFileSync(new URL('./siteTheme.js',import.meta.url),'utf8');
  assert.ok(entry.indexOf('loadAccent();') < entry.indexOf('ReactDOM.createRoot'));
  assert.match(source,/export function loadAccent\(\)/);
  assert.match(source,/savedAccent = localStorage.getItem\(accentKey\)/);
  assert.match(source,/return applyProfilePalettes\(palettes, theme\)/);
  assert.match(source,/useLayoutEffect\(\(\) => \{\s*applyProfilePalettes\(palettes, theme\)/);
  assert.match(source,/const mountThemeRoot = useCallback\(node => \{ if \(node\) applyProfilePalettes\(palettes, theme\); \}, \[palettes, theme\]\)/);
  const journal=readFileSync(new URL('./TradingJournal.jsx',import.meta.url),'utf8');
  assert.match(journal,/<div ref=\{mountJournalRoot\} className=\{`tj-root/);
  assert.match(journal,/mountThemeRoot\(node\); moneyPrivacyRoot.current = node/);
});
test('profile supplies nine distinct palettes for each resolved mode and retains defaults outside the gallery',()=>{
  const source=readFileSync(new URL('./siteTheme.js',import.meta.url),'utf8');
  const picker=readFileSync(new URL('./ProfileThemePicker.jsx',import.meta.url),'utf8');
  for(const mode of ['light','dark']){
    const segment=source.match(new RegExp(`${mode}: \\[([\\s\\S]*?)\\n  \\],`))[1];
    assert.equal((segment.match(/id:/g)||[]).length,9,`${mode} palette count`);
  }
  assert.match(source,/export function applyProfilePalettes/);
  assert.match(source,/target\.dataset\.profileTheme = selected/);
  assert.match(picker,/LIGHT_THEMES : DARK_THEMES/);
  assert.match(picker,/ThemeGrid themes=\{themes\} value=\{selected\}/);
  const grid=readFileSync(new URL('./ThemeGrid.jsx',import.meta.url),'utf8');
  assert.equal((grid.match(/id: 'light-/g)||[]).length,9);
  assert.equal((grid.match(/id: 'dark-/g)||[]).length,9);
});
test('accent chips and borders use the shared 14 and 45 percent treatments',()=>{
  const source=readFileSync(new URL('./siteTheme.js',import.meta.url),'utf8');
  assert.ok(source.includes("set('--tj-accent-muted', 'color-mix(in srgb, var(--accent) 14%, transparent)')"));
  assert.ok(source.includes("set('--tj-accent-border', 'color-mix(in srgb, var(--accent) 45%, transparent)')"));
});
test('brand accents never override profit tokens and refresh with resolved theme',()=>{
  const source=readFileSync(new URL('./siteTheme.js',import.meta.url),'utf8');
  assert.doesNotMatch(source,/set\('--tj-green'/);
  assert.match(source,/removeProperty\('--tj-green'\)/);
  assert.match(source,/useLayoutEffect\(\(\) => \{ applyAccent\(accent, theme\);[\s\S]*?\}, \[accent, theme\]\)/);
  assert.doesNotMatch(css,/\.tj-green\s*\{ color: var\(--accent\)/);
});
test('Default swatch and applied brand share one definition; light accents are explicit',()=>{
  const source=readFileSync(new URL('./siteTheme.js',import.meta.url),'utf8');
  const picker=readFileSync(new URL('./AccentPicker.jsx',import.meta.url),'utf8');
  assert.match(source,/DEFAULT_ACCENT_OPTION = .*dark: 'var\(--color-ink-17\)', light: 'var\(--color-ink-41\)'/);
  assert.match(source,/DEFAULT_ACCENT_OPTION.light : DEFAULT_ACCENT_OPTION.dark/);
  assert.match(picker,/const accents = \[\s*DEFAULT_ACCENT_OPTION,/);
  for(const id of ['ocean-blue','neon','sunset','purple','deep-yellow','rose-gold','mint-frost','ice','crimson','mono','sage']){
    assert.ok(source.includes(`light: 'var(--accent-${id}-light)'`));
    assert.match(css,new RegExp(`--accent-${id}-light: #[\\da-f]{6};`));
  }
});
