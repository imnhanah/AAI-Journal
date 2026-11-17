import React, { useEffect, useRef } from 'react';

// A feature switched off by an administrator: records stay readable and navigable, change controls are disabled. No message.
// This only keeps the screen honest; the server refuses the writes either way.
const CHANGES = /\b(add|new|create|save|delete|remove|edit|upload|import|archive|restore|rename|duplicate|submit|log trade|transfer|confirm|pins?|unpins?|favou?rites?|unfavou?rites?|stars?|bookmarks?)\b/i;
const PINS = /\b(pins?|unpins?|pinned|favou?rites?|unfavou?rites?|stars?|starred|bookmarks?)\b/i;
const FIELDS = 'input, textarea, select, [contenteditable="true"]';

const labelOf = node => node.getAttribute('aria-label') || node.getAttribute('title') || node.textContent || '';
const isReading = node => node.matches('[role="tab"], [aria-selected], [aria-pressed], [aria-expanded], input[type="checkbox"], input[type="radio"]') && !node.closest('[role="dialog"], [aria-modal="true"]');
// Account-wide dialogs (profile, accounts, notifications) are never part of a switched-off feature.
const GLOBAL_DIALOG = '[class*="profile" i], [class*="account" i], .tj-bell-panel, .tj-wm, .tj-ma-modal';
const isGlobalDialog = node => { for (let el = node; el && el !== document.body && el !== document.documentElement; el = el.parentElement) if (el.matches(GLOBAL_DIALOG)) return true; return false; };
const isSearch = node => node.matches('input[type="search"]') || /search|filter/i.test(node.getAttribute('placeholder') || node.getAttribute('aria-label') || '');

export default function FeatureReadOnly({ off, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const root = ref.current;
    if (!off || !root) return undefined;
    const lock = node => { if (!node.disabled && !node.hasAttribute('data-fro')) { node.setAttribute('data-fro', ''); if (node.isContentEditable && !('disabled' in node)) node.setAttribute('contenteditable', 'false'); else node.disabled = true; } };
    const apply = () => {
      const scopes = [root, ...[...document.querySelectorAll('[role="dialog"], [aria-modal="true"]')].filter(dialog => !root.contains(dialog) && !isGlobalDialog(dialog))];
      scopes.forEach(scope => {
        scope.querySelectorAll(FIELDS).forEach(node => { if (!isSearch(node) && !isReading(node)) lock(node); });
        scope.querySelectorAll('button').forEach(node => { { const label = labelOf(node); if (PINS.test(label) || (!isReading(node) && CHANGES.test(label))) lock(node); } });
      });
    };
    apply();
    const watcher = new MutationObserver(apply);
    watcher.observe(root, { subtree: true, childList: true });
    watcher.observe(document.body, { childList: true, subtree: true, attributes: false });
    const block = event => event.preventDefault();
    root.addEventListener('submit', block, true);
    return () => {
      watcher.disconnect(); root.removeEventListener('submit', block, true);
      document.querySelectorAll('[data-fro]').forEach(node => { node.removeAttribute('data-fro'); if ('disabled' in node) node.disabled = false; else node.setAttribute('contenteditable', 'true'); });
    };
  }, [off]);
  return <div ref={ref} className={off ? 'tj-feature-off' : 'tj-feature-on'}>{children}</div>;
}
