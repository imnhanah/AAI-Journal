import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import { transitionTheme } from './themeTransition';
import { accentTextToken } from './accentContrast';

const key = 'tj:site-theme';
const eventName = 'tj:theme-change';
const accentKey = 'tj:profile-accent';
const paletteKey = 'tj:profile-palettes';
export const DEFAULT_ACCENT = 'default';
export const DEFAULT_ACCENT_OPTION = { id: DEFAULT_ACCENT, label: 'Default', dark: 'var(--color-ink-17)', light: 'var(--color-ink-41)' };
export const ACCENT_OPTIONS = [
  { id: 'ocean-blue', label: 'Ocean Blue', dark: 'var(--color-ink-314)', light: 'var(--accent-ocean-blue-light)' },
  { id: 'neon', label: 'Neon', dark: 'var(--color-ink-316)', light: 'var(--accent-neon-light)' },
  { id: 'sunset', label: 'Sunset', dark: 'var(--color-ink-318)', light: 'var(--accent-sunset-light)' },
  { id: 'purple', label: 'Purple', dark: 'var(--color-ink-320)', light: 'var(--accent-purple-light)' },
  { id: 'deep-yellow', label: 'Deep Yellow', dark: 'var(--color-ink-322)', light: 'var(--accent-deep-yellow-light)' },
  { id: 'rose-gold', label: 'Rose Gold', dark: 'var(--color-ink-324)', light: 'var(--accent-rose-gold-light)' },
  { id: 'mint-frost', label: 'Mint Frost', dark: 'var(--color-ink-21)', light: 'var(--accent-mint-frost-light)' },
  { id: 'ice', label: 'Ice', dark: 'var(--color-ink-326)', light: 'var(--accent-ice-light)' },
  { id: 'crimson', label: 'Crimson', dark: 'var(--color-ink-328)', light: 'var(--accent-crimson-light)' },
  { id: 'mono', label: 'Mono', dark: 'var(--color-ink-330)', light: 'var(--accent-mono-light)' },
  { id: 'sage', label: 'Sage', dark: 'var(--color-ink-332)', light: 'var(--accent-sage-light)' },
  { id: 'indigo', label: 'Indigo', dark: 'var(--accent-indigo-dark)', light: 'var(--accent-indigo-light)' },
  { id: 'fuchsia', label: 'Fuchsia', dark: 'var(--accent-fuchsia-dark)', light: 'var(--accent-fuchsia-light)' },
  { id: 'coral', label: 'Coral', dark: 'var(--accent-coral-dark)', light: 'var(--accent-coral-light)' },
  { id: 'slate', label: 'Slate', dark: 'var(--accent-slate-dark)', light: 'var(--accent-slate-light)' },
  { id: 'bronze', label: 'Bronze', dark: 'var(--accent-bronze-dark)', light: 'var(--accent-bronze-light)' },
  { id: 'moss', label: 'Moss', dark: 'var(--accent-moss-dark)', light: 'var(--accent-moss-light)' },
];
const LEGACY_PROFILE_THEME_OPTIONS = {
  light: [
    { id: 'sage-ledger', label: 'Sage Ledger', caption: 'Quiet green ledger', preview: '#478569', tokens: { '--bg': '#f7faf7', '--card': '#f2f8f3', '--card-alt': '#e7f1e9', '--border': '#d5e2d8', '--border-strong': '#bdcec5', '--text': '#21302a', '--text-2': '#40564b', '--muted': '#687970', '--placeholder': '#8b9a92', '--accent': '#478569', '--on-accent': '#ffffff' } },
    { id: 'lilac-paper', label: 'Lilac Paper', caption: 'Quiet lavender notes', preview: '#9a82b7', tokens: { '--bg': '#fbf9fd', '--card': '#f7f3fa', '--card-alt': '#eee8f5', '--border': '#e1d9ea', '--border-strong': '#cdbfda', '--text': '#39323f', '--text-2': '#5b5064', '--muted': '#7c7088', '--placeholder': '#988ba4', '--accent': '#9a82b7', '--on-accent': '#ffffff' } },
    { id: 'terracotta-notes', label: 'Terracotta Notes', caption: 'Soft clay workspace', preview: '#b87462', tokens: { '--bg': '#fdf9f7', '--card': '#fdf3ef', '--card-alt': '#f6e8e1', '--border': '#ead9d2', '--border-strong': '#d8b9ae', '--text': '#42312d', '--text-2': '#684a42', '--muted': '#896a61', '--placeholder': '#a08379', '--accent': '#b87462', '--on-accent': '#ffffff' } },
    { id: 'sea-glass', label: 'Sea Glass', caption: 'Soft aqua workspace', preview: '#4f9091', tokens: { '--bg': '#f7fbfb', '--card': '#f0f8f8', '--card-alt': '#e4f1f0', '--border': '#d3e5e3', '--border-strong': '#b8d0ce', '--text': '#293839', '--text-2': '#466061', '--muted': '#6c8585', '--placeholder': '#89a09f', '--accent': '#4f9091', '--on-accent': '#ffffff' } },
    { id: 'sandstone', label: 'Sandstone', caption: 'Grounded capital desk', preview: '#917540', tokens: { '--bg': '#fbfaf5', '--card': '#faf6ec', '--card-alt': '#f2ecdc', '--border': '#e6dfcd', '--border-strong': '#d4c7ad', '--text': '#38362d', '--text-2': '#5d5949', '--muted': '#7d796a', '--placeholder': '#999281', '--accent': '#917540', '--on-accent': '#ffffff' } },
    { id: 'slate-studio', label: 'Slate Studio', caption: 'Measured structure', preview: '#5f778d', tokens: { '--bg': '#f5f8fa', '--card': '#f1f5f7', '--card-alt': '#e7eef2', '--border': '#d8e0e5', '--border-strong': '#bdc9d0', '--text': '#28333a', '--text-2': '#46555f', '--muted': '#70808a', '--placeholder': '#8b99a2', '--accent': '#5f778d', '--on-accent': '#ffffff' } },
    { id: 'rose-paper', label: 'Rose Paper', caption: 'Soft editorial rose', preview: '#a36b79', tokens: { '--bg': '#fcf8f9', '--card': '#fbf1f3', '--card-alt': '#f4e5e9', '--border': '#ead8dd', '--border-strong': '#d9bdc5', '--text': '#3c3034', '--text-2': '#604b51', '--muted': '#806c72', '--placeholder': '#9e898f', '--accent': '#a36b79', '--on-accent': '#ffffff' } },
    { id: 'iris-note', label: 'Iris Note', caption: 'Clear indigo notes', preview: '#6674a8', tokens: { '--bg': '#f8f9fd', '--card': '#f2f4fb', '--card-alt': '#e8ebf6', '--border': '#d9ddec', '--border-strong': '#c0c7df', '--text': '#303443', '--text-2': '#4e566c', '--muted': '#71798e', '--placeholder': '#8c94aa', '--accent': '#6674a8', '--on-accent': '#ffffff' } },
    { id: 'graphite-paper', label: 'Graphite Paper', caption: 'Neutral analytical desk', preview: '#63727a', tokens: { '--bg': '#f7f9fa', '--card': '#f1f5f6', '--card-alt': '#e7edef', '--border': '#d8e0e3', '--border-strong': '#becbd0', '--text': '#2c3438', '--text-2': '#4b5a60', '--muted': '#718086', '--placeholder': '#8b999f', '--accent': '#63727a', '--on-accent': '#ffffff' } },
  ],
  dark: [
    { id: 'graphite-ledger', label: 'Graphite Ledger', caption: 'Balanced graphite', preview: '#5bcda9', tokens: { '--bg': '#121c1f', '--card': '#17272b', '--card-alt': '#0d1518', '--border': '#294146', '--border-strong': '#3b5a60', '--text': '#dce9e7', '--text-2': '#b2c2c0', '--muted': '#90a6a5', '--placeholder': '#718886', '--accent': '#5bcda9', '--on-accent': '#07261b' } },
    { id: 'blue-hour', label: 'Blue Hour', caption: 'Composed night blue', preview: '#6bcfd2', tokens: { '--bg': '#111b29', '--card': '#162638', '--card-alt': '#0b1420', '--border': '#29465e', '--border-strong': '#3b6180', '--text': '#e0edf6', '--text-2': '#b5c8d8', '--muted': '#90a4b6', '--placeholder': '#70879a', '--accent': '#6bcfd2', '--on-accent': '#08262c' } },
    { id: 'plum-archive', label: 'Plum Archive', caption: 'Low-light editorial', preview: '#ce9cda', tokens: { '--bg': '#1b1920', '--card': '#27232d', '--card-alt': '#141218', '--border': '#413a48', '--border-strong': '#5a4e63', '--text': '#e8e0ea', '--text-2': '#c9bacd', '--muted': '#aa9daa', '--placeholder': '#86788a', '--accent': '#ce9cda', '--on-accent': '#2b1630' } },
    { id: 'ocean-ink', label: 'Ocean Ink', caption: 'Deep ocean ink', preview: '#72b9d4', tokens: { '--bg': '#101b22', '--card': '#14272f', '--card-alt': '#09141a', '--border': '#264750', '--border-strong': '#37636f', '--text': '#d8eaf0', '--text-2': '#b0cad2', '--muted': '#89a3ad', '--placeholder': '#6e8992', '--accent': '#72b9d4', '--on-accent': '#092b37' } },
    { id: 'moss-terminal', label: 'Moss Terminal', caption: 'Muted moss station', preview: '#aabf77', tokens: { '--bg': '#171b16', '--card': '#202820', '--card-alt': '#111511', '--border': '#374536', '--border-strong': '#52634e', '--text': '#e0e7d7', '--text-2': '#c2ceb5', '--muted': '#9ba791', '--placeholder': '#7d8975', '--accent': '#aabf77', '--on-accent': '#1d2818' } },
    { id: 'smoke-grid', label: 'Smoke Grid', caption: 'Neutral data grid', preview: '#a3b3bd', tokens: { '--bg': '#1a1d20', '--card': '#252a2e', '--card-alt': '#141618', '--border': '#3b4348', '--border-strong': '#566169', '--text': '#e5e8ea', '--text-2': '#c4ccd1', '--muted': '#9ca6ab', '--placeholder': '#7d898f', '--accent': '#a3b3bd', '--on-accent': '#19252b' } },
    { id: 'ember-desk', label: 'Ember Desk', caption: 'Muted copper after-hours', preview: '#d39470', tokens: { '--bg': '#211a18', '--card': '#302522', '--card-alt': '#16100f', '--border': '#4d3932', '--border-strong': '#704e42', '--text': '#f0e3dc', '--text-2': '#d7bfb2', '--muted': '#b59a8d', '--placeholder': '#8d7268', '--accent': '#d39470', '--on-accent': '#352018' } },
    { id: 'rose-signal', label: 'Rose Signal', caption: 'Calm rose contrast', preview: '#d18c9d', tokens: { '--bg': '#21181c', '--card': '#30242a', '--card-alt': '#160f13', '--border': '#503842', '--border-strong': '#754e5c', '--text': '#f0e0e5', '--text-2': '#d9b9c2', '--muted': '#b6949f', '--placeholder': '#8e6e78', '--accent': '#d18c9d', '--on-accent': '#371923' } },
    { id: 'indigo-field', label: 'Indigo Field', caption: 'Soft electric indigo', preview: '#9fa8ef', tokens: { '--bg': '#171923', '--card': '#222638', '--card-alt': '#0f1119', '--border': '#393f5c', '--border-strong': '#535e85', '--text': '#e5e7fa', '--text-2': '#c4c9e5', '--muted': '#9fa6c3', '--placeholder': '#78809d', '--accent': '#9fa8ef', '--on-accent': '#202553' } },
  ],
};
// The original individual palettes are retained above as a migration reference.
// The mood names below are the public theme contract and map directly to the
// CSS `data-theme` values supplied for the journal.
const themeChoice = (id, label, caption, preview, card, raised, text) => ({ id, label, caption, preview, tokens: { '--card': card, '--card-alt': raised, '--text': text } });
export const PROFILE_THEME_OPTIONS = {
  light: [
    themeChoice('default', 'Default', 'Brand green', '#0f7a4f', '#ffffff', '#eef2f0', '#14211c'),
    themeChoice('calm', 'Calm', 'Sage Ledger', '#3a6b4f', '#fbfdfb', '#e4ece5', '#17261d'),
    themeChoice('focus', 'Focus', 'Slate Studio', '#2c5a8f', '#fbfcfd', '#e3e8ee', '#16202b'),
    themeChoice('warm', 'Warm', 'Sandstone', '#6b6511', '#fffdf8', '#ece4d4', '#2a2116'),
    themeChoice('soft', 'Soft', 'Rose Paper', '#9b2c68', '#fffafb', '#f0e1e5', '#2a1a20'),
    themeChoice('bold', 'Bold', 'Iris Note', '#4b3fd1', '#fcfcff', '#e6e6f6', '#1a1a33'),
    themeChoice('fresh', 'Fresh', 'Sea Glass', '#1d7a78', '#fafdfd', '#dfeceb', '#12292a'),
    themeChoice('neutral', 'Neutral', 'Graphite Paper', '#3d4852', '#fcfcfc', '#e5e5e5', '#1c1c1c'),
    themeChoice('dreamy', 'Dreamy', 'Lilac Paper', '#7a4bc2', '#fdfbff', '#e9e0f4', '#231a33'),
  ],
  dark: [
    themeChoice('default', 'Default', 'Brand green', '#3ecf8e', '#161e1b', '#1f2a26', '#e8f1ed'),
    themeChoice('calm', 'Calm', 'Moss Terminal', '#a6d66b', '#171f18', '#202a21', '#e6efe3'),
    themeChoice('focus', 'Focus', 'Blue Hour', '#6aa6ff', '#141d2e', '#1d283d', '#e6edf8'),
    themeChoice('warm', 'Warm', 'Ember Desk', '#f0a56a', '#1f1814', '#2a211b', '#f2e8df'),
    themeChoice('soft', 'Soft', 'Plum Archive', '#d9a0ec', '#1d1523', '#281e30', '#f1e8f5'),
    themeChoice('bold', 'Bold', 'Indigo Field', '#8f9bff', '#151730', '#1e2142', '#e9eafc'),
    themeChoice('fresh', 'Fresh', 'Ocean Ink', '#4fd1d9', '#112328', '#1a3036', '#e3f3f4'),
    themeChoice('neutral', 'Neutral', 'Smoke Grid', '#d4d4d4', '#1b1b1b', '#262626', '#ececec'),
    themeChoice('signal', 'Signal', 'Rose Signal', '#f28bb5', '#21151a', '#2d1e25', '#f6e8ed'),
  ],
};
const paletteTokenNames = [...new Set(Object.values(PROFILE_THEME_OPTIONS).flat().flatMap(option => Object.keys(option.tokens)))];
const themeContractTokens = ['--bg', '--surface', '--raised', '--border', '--text', '--muted', '--accent', '--on-accent', '--accent-soft', '--focus', '--profit', '--profit-soft', '--loss', '--loss-soft', '--warn', '--warn-soft'];
const paletteSurfaceAliases = {
  '--tj-bg': 'var(--bg)', '--tj-bg-glow-left': 'color-mix(in srgb, var(--accent) 7%, transparent)', '--tj-bg-glow-right': 'color-mix(in srgb, var(--accent) 4%, transparent)', '--tj-panel': 'var(--card)', '--tj-panel-alt': 'var(--card-alt)', '--tj-chrome': 'var(--card-alt)', '--tj-border': 'var(--border)', '--tj-border-strong': 'var(--border-strong)', '--tj-text': 'var(--text)', '--tj-text-2': 'var(--text-2)', '--tj-muted': 'var(--muted)', '--tj-input-bg': 'var(--bg)', '--tj-chart-bg': 'var(--bg)', '--tj-chart-grid': 'var(--border)', '--tj-chart-text': 'var(--muted)', '--tj-tooltip-bg': 'var(--card)', '--tj-grid-line': 'var(--border)', '--tj-scroll-track': 'var(--card-alt)',
  '--color-surface-5': 'var(--card-alt)', '--color-surface-35': 'var(--card-alt)', '--color-surface-63': 'var(--bg)', '--color-surface-132': 'var(--bg)', '--color-surface-133': 'var(--card)', '--color-surface-134': 'var(--card-alt)', '--color-surface-143': 'var(--bg)', '--color-surface-144': 'var(--bg)', '--color-surface-159': 'var(--card-alt)', '--color-surface-160': 'color-mix(in srgb, var(--accent) 10%, var(--card))', '--color-surface-167': 'color-mix(in srgb, var(--accent) 10%, var(--card))', '--color-surface-183': 'color-mix(in srgb, var(--accent) 8%, var(--card))', '--color-surface-189': 'var(--card-alt)', '--color-surface-194': 'color-mix(in srgb, var(--accent) 9%, var(--card))', '--color-surface-197': 'color-mix(in srgb, var(--accent) 12%, var(--card))', '--color-surface-208': 'color-mix(in srgb, var(--accent) 12%, var(--card))', '--color-surface-214': 'color-mix(in srgb, var(--accent) 9%, var(--card))', '--color-surface-243': 'color-mix(in srgb, var(--accent) 10%, var(--card))', '--color-surface-249': 'var(--card-alt)', '--color-surface-252': 'var(--card-alt)', '--color-surface-278': 'var(--bg)', '--color-surface-312': 'color-mix(in srgb, var(--card) 94%, transparent)',
  '--color-border-145': 'var(--border)', '--color-border-161': 'color-mix(in srgb, var(--accent) 45%, var(--border))', '--color-border-168': 'color-mix(in srgb, var(--accent) 55%, var(--border))', '--color-border-172': 'var(--border)', '--color-border-211': 'var(--border)', '--color-border-237': 'var(--border)', '--color-border-241': 'var(--border)', '--color-border-250': 'var(--border)', '--color-border-251': 'var(--border)', '--color-border-253': 'color-mix(in srgb, var(--accent) 55%, var(--border))',
};
const defaultControlAliases = {
  dark: {
    '--tj-accent': 'var(--accent)', '--tj-primary-muted': 'color-mix(in srgb, var(--accent) 14%, transparent)', '--tj-accent-muted': 'color-mix(in srgb, var(--accent) 14%, transparent)', '--tj-accent-border': 'color-mix(in srgb, var(--accent) 45%, transparent)', '--tj-primary-hover': 'color-mix(in srgb, var(--accent) 82%, var(--bg))', '--tj-primary-contrast': 'var(--on-accent)', '--tj-scroll-thumb': 'color-mix(in srgb, var(--accent) 56%, var(--tj-scroll-track))', '--tj-scroll-thumb-hover': 'var(--accent)',
  },
  light: {
    '--tj-accent': 'var(--accent)', '--tj-primary-muted': 'color-mix(in srgb, var(--accent) 14%, transparent)', '--tj-accent-muted': 'color-mix(in srgb, var(--accent) 14%, transparent)', '--tj-accent-border': 'color-mix(in srgb, var(--accent) 45%, transparent)', '--tj-primary-hover': 'color-mix(in srgb, var(--accent) 82%, var(--bg))', '--tj-primary-contrast': 'var(--on-accent)', '--tj-scroll-thumb': 'color-mix(in srgb, var(--accent) 56%, var(--tj-scroll-track))', '--tj-scroll-thumb-hover': 'var(--accent)',
  },
};
export const normaliseProfilePalettes = (value) => {
  const source = value && typeof value === 'object' ? value : {};
  const result = {};
  for (const mode of ['light', 'dark']) result[mode] = PROFILE_THEME_OPTIONS[mode].some(option => option.id === source[mode]) ? source[mode] : 'default';
  return result;
};
const findProfilePalette = (mode, id) => PROFILE_THEME_OPTIONS[mode]?.find(option => option.id === id) || null;
export function applyProfilePalettes(value, theme = document.documentElement.dataset.theme) {
  const palettes = normaliseProfilePalettes(value);
  const mode = String(theme).startsWith('light') ? 'light' : 'dark';
  const selected = palettes[mode] || 'default';
  const palette = findProfilePalette(mode, selected);
  const target = document.querySelector('.tj-root') || document.documentElement;
  const clear = name => { document.documentElement.style.removeProperty(name); target.style.removeProperty(name); };
  [...themeContractTokens, ...paletteTokenNames, ...Object.keys(paletteSurfaceAliases)].forEach(clear);
  // These are derived from a selected palette. They must be cleared alongside
  // its base tokens so Restore default falls back to the journal's real
  // default button, toggle and focus colors instead of unresolved var(--accent).
  ['--tj-accent', '--tj-primary-muted', '--tj-accent-muted', '--tj-accent-border', '--tj-primary-hover', '--tj-primary-contrast', '--tj-scroll-thumb', '--tj-scroll-thumb-hover'].forEach(clear);
  target.dataset.profileAccent = 'default';
  target.dataset.profileTheme = selected;
  document.documentElement.dataset.theme = `${mode}-${selected}`;
  const set = (name, token) => { document.documentElement.style.setProperty(name, token); target.style.setProperty(name, token); };
  if (!palette) {
    Object.entries(defaultControlAliases[theme] || defaultControlAliases.dark).forEach(([name, token]) => set(name, token));
    return palettes;
  }
  Object.entries(palette.tokens).forEach(([name, token]) => set(name, token));
  Object.entries(paletteSurfaceAliases).forEach(([name, token]) => set(name, token));
  set('--tj-accent', 'var(--accent)');
  set('--tj-primary-muted', 'color-mix(in srgb, var(--accent) 14%, transparent)');
  set('--tj-accent-muted', 'color-mix(in srgb, var(--accent) 14%, transparent)');
  set('--tj-accent-border', 'color-mix(in srgb, var(--accent) 45%, transparent)');
  set('--tj-primary-hover', 'color-mix(in srgb, var(--accent) 82%, var(--bg))');
  set('--tj-scroll-thumb', 'color-mix(in srgb, var(--accent) 56%, var(--tj-scroll-track))');
  set('--tj-scroll-thumb-hover', 'var(--accent)');
  set('--tj-primary-contrast', 'var(--on-accent)');
  return palettes;
}
export const normaliseThemePreference = (value) => ['dark', 'light', 'system'].includes(value) ? value : 'dark';
const legacyAccents = { mint: 'mint-frost', blue: 'ocean-blue', violet: 'purple', teal: 'neon', amber: 'deep-yellow', rose: 'rose-gold' };
export const normaliseAccent = (value) => {
  const next = legacyAccents[value] || value;
  return next === 'default' || ACCENT_OPTIONS.some((accent) => accent.id === next) ? next : 'default';
};
function isThemePreference(value) { return ['light', 'dark', 'system'].includes(value); }
function readTheme(fallback, preferProfile = false) {
  // Once authenticated, the profile is the source of truth across devices.
  // Local storage remains useful only before that preference is available.
  if (preferProfile && isThemePreference(fallback)) return fallback;
  try { const value = localStorage.getItem(key); if (isThemePreference(value)) return value; } catch {}
  return normaliseThemePreference(fallback);
}
const systemTheme = () => window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
export function loadAccent() {
  let savedAccent = DEFAULT_ACCENT;
  let preference = 'dark';
  try {
    savedAccent = localStorage.getItem(accentKey) || DEFAULT_ACCENT;
    preference = normaliseThemePreference(localStorage.getItem(key));
  } catch {}
  const theme = preference === 'system' ? systemTheme() : preference;
  document.documentElement.dataset.theme = `${theme}-default`;
  document.documentElement.dataset.themePreference = preference;
  document.documentElement.style.colorScheme = preference === 'system' ? 'light dark' : theme;
  document.documentElement.classList.toggle('tj-theme-light', theme === 'light');
  let palettes = {};
  try { palettes = JSON.parse(localStorage.getItem(paletteKey) || '{}'); } catch {}
  // Theme palettes supersede legacy accent selections. Existing users without
  // a palette retain the current light or dark design unchanged.
  return applyProfilePalettes(palettes, theme);
}
export function applyAccent(accentId = DEFAULT_ACCENT, theme = document.documentElement.dataset.theme) {
  const selected = normaliseAccent(accentId);
  const accent = ACCENT_OPTIONS.find((item) => item.id === selected) || null;
  const target = document.querySelector('.tj-root') || document.documentElement;
  // A profile palette owns the workspace accent.  The saved legacy accent is
  // still reapplied when the root mounts, so without this guard it can replace
  // the palette's cursor/focus colour with the old default teal.
  if (target.dataset.profileTheme && target.dataset.profileTheme !== 'default') {
    return getComputedStyle(target).getPropertyValue('--accent').trim();
  }
  const color = selected === DEFAULT_ACCENT
    ? (theme === 'light' ? DEFAULT_ACCENT_OPTION.light : DEFAULT_ACCENT_OPTION.dark)
    : (theme === 'light' ? accent.light : accent.dark);
  const computed = getComputedStyle(target);
  let resolvedColor = color;
  for (let depth = 0; depth < 8 && /^var\(/.test(resolvedColor); depth++) {
    resolvedColor = computed.getPropertyValue(resolvedColor.slice(4, -1)).trim();
  }
  const set = (name, value) => { document.documentElement.style.setProperty(name, value); target.style.setProperty(name, value); };
  // Clear the old brand override: this token is reserved for wins and profit.
  document.documentElement.style.removeProperty('--tj-green');
  target.style.removeProperty('--tj-green');
  set('--accent', color);
  set('--tj-primary-muted', 'color-mix(in srgb, var(--accent) 14%, transparent)');
  set('--tj-accent-muted', 'color-mix(in srgb, var(--accent) 14%, transparent)');
  set('--tj-accent-border', 'color-mix(in srgb, var(--accent) 45%, transparent)');
  set('--on-accent', accentTextToken(resolvedColor, computed.getPropertyValue('--accent-text-dark'), computed.getPropertyValue('--accent-text-light')));
  set('--tj-primary-contrast', 'var(--on-accent)');
  if (selected === 'default') {
    const names = ['--tj-accent', '--tj-green', '--tj-primary-hover', '--tj-scroll-thumb', '--tj-scroll-thumb-hover'];
    names.forEach((name) => { document.documentElement.style.removeProperty(name); target.style.removeProperty(name); });
    target.dataset.profileAccent = 'default';
    return color;
  }
  // Set values on the app root as well as :root. The light-theme class owns
  // its own CSS variables, so this makes an accent selected in light mode win
  // over those defaults too.
  target.dataset.profileAccent = selected;
  set('--tj-accent', 'var(--accent)');
  set('--tj-primary-hover', `color-mix(in srgb, ${color} 82%, var(--color-ink-334))`);
  set('--tj-scroll-thumb', `color-mix(in srgb, ${color} 56%, var(--tj-scroll-track))`);
  set('--tj-scroll-thumb-hover', color);
  return color;
}
export function useSiteTheme(fallback) {
  const hasProfilePreference = isThemePreference(fallback);
  const defaultPreference = hasProfilePreference ? fallback : 'dark';
  const [preference, setPreference] = useState(() => readTheme(defaultPreference, hasProfilePreference));
  const [system, setSystem] = useState(() => systemTheme());
  const theme = preference === 'system' ? system : preference;
  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    const syncSystem = () => setSystem(media?.matches ? 'dark' : 'light');
    media?.addEventListener?.('change', syncSystem);
    const sync = event => setPreference(normaliseThemePreference(event.detail || readTheme(defaultPreference, hasProfilePreference)));
    // A storage event carries the other tab's new value. Re-reading the
    // profile fallback here silently discarded theme switches in other tabs.
    const storage = event => { if (event.key === key) setPreference(normaliseThemePreference(event.newValue)); };
    window.addEventListener(eventName, sync);
    window.addEventListener('storage', storage);
    return () => { media?.removeEventListener?.('change', syncSystem); window.removeEventListener(eventName, sync); window.removeEventListener('storage', storage); };
  }, [defaultPreference, hasProfilePreference]);
  useEffect(() => {
    if (hasProfilePreference) setPreference(fallback);
  }, [fallback, hasProfilePreference]);
  useEffect(() => {
    // Do not force a resolved color scheme while using System. Leaving both
    // schemes available lets Chromium/Safari continue to follow macOS changes.
    document.documentElement.style.colorScheme = preference === 'system' ? 'light dark' : theme;
    // The theme name is a stable token palette, while the resolved mode stays
    // available for components that only need light/dark behaviour.
    if (!document.documentElement.dataset.theme?.startsWith(`${theme}-`)) document.documentElement.dataset.theme = `${theme}-default`;
    document.documentElement.dataset.themeMode = theme;
    document.documentElement.dataset.themePreference = preference;
    // The document itself is visible in iPhone Safari's covered safe areas.
    // Mirroring the journal's existing theme class here lets its --tj-bg token
    // paint those areas without altering the app shell or its components.
    document.documentElement.classList.toggle('tj-theme-light', theme === 'light');
    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor) themeColor.content = getComputedStyle(document.querySelector('.tj-root') || document.documentElement).getPropertyValue('--tj-bg').trim();
    try { localStorage.setItem(key, preference); } catch {}
  }, [theme, preference]);
  const changeTheme = useCallback(value => {
    const next = normaliseThemePreference(value);
    const apply = () => flushSync(() => {
      try { localStorage.setItem(key, next); } catch {}
      setPreference(next);
      window.dispatchEvent(new CustomEvent(eventName, { detail: next }));
    });
    const resolved = next === 'system' ? systemTheme() : next;
    if (resolved !== theme) transitionTheme(apply);
    else apply();
  }, [theme]);
  return [theme, changeTheme, preference];
}

export function useProfileAccent(fallback = 'default', theme = 'dark') {
  const [accent, setAccent] = useState(() => { try { return normaliseAccent(localStorage.getItem(accentKey) || fallback); } catch { return normaliseAccent(fallback); } });
  // Reapply the saved/current selection whenever the resolved theme changes,
  // including System changes, before painting its light or dark accent shade.
  useLayoutEffect(() => { applyAccent(accent, theme); try { localStorage.setItem(accentKey, accent); } catch {} }, [accent, theme]);
  // The journal root mounts after asynchronous account loading. Reapply on
  // that mount even when the theme and saved accent have not changed.
  const mountAccentRoot = useCallback(node => { if (node) applyAccent(accent, theme); }, [accent, theme]);
  return [accent, useCallback((value) => setAccent(normaliseAccent(value)), []), mountAccentRoot];
}

export function useProfilePalettes(fallback, theme = 'dark') {
  const [palettes, setPalettes] = useState(() => {
    try { return normaliseProfilePalettes(fallback || JSON.parse(localStorage.getItem(paletteKey) || '{}')); } catch { return normaliseProfilePalettes(fallback); }
  });
  useLayoutEffect(() => {
    applyProfilePalettes(palettes, theme);
    try { localStorage.setItem(paletteKey, JSON.stringify(palettes)); } catch {}
  }, [palettes, theme]);
  const mountThemeRoot = useCallback(node => { if (node) applyProfilePalettes(palettes, theme); }, [palettes, theme]);
  return [palettes, setPalettes, mountThemeRoot];
}
