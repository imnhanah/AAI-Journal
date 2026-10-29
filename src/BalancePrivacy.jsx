import {useLayoutEffect} from 'react';
import {maskMoneyText} from './displayPreferences';
import './balancePrivacy.css';

// Mask only the rendered presentation, never account data, form values, export
// payloads or calculation formatters. Portalled dialogs inside the root and
// dynamically inserted chart tooltips are included by the observer.
export function installBalancePrivacy(root) {
  const originals = new Map();
  const attributes = new Map();
  const fields = new Map();
  const maskNode = node => {
    if (node.nodeType === 3 && !node.parentElement?.closest('script,style,textarea,select,option')) {
      const masked = maskMoneyText(node.nodeValue);
      if (masked !== node.nodeValue) { originals.set(node, {original: node.nodeValue, masked}); node.nodeValue = masked; }
    }
    if (node.nodeType !== 1) return;
    for (const name of ['title', 'aria-label', 'alt']) {
      const value = node.getAttribute(name); if (!value) continue;
      const masked = maskMoneyText(value);
      if (masked !== value) {
        const saved = attributes.get(node) || new Map(); saved.set(name, {original: value, masked}); attributes.set(node, saved); node.setAttribute(name, masked);
      }
    }
    const label = node.getAttribute('aria-label') || node.closest('.tj-field')?.querySelector('.tj-field-label')?.textContent || node.closest('label')?.textContent || '';
    const monetaryInput = node.matches('input') && (node.closest('.tj-settings-unit-prefix') || (!/%|percentage|allocation|pips/i.test(label) && /balance|capital|commission|swap|amount|savings target|breakeven cap|loss cap|profit target|P&L|PnL|gross profit|net profit|\((USD|EUR|GBP|GHS)\)/i.test(label)));
    if (monetaryInput) {
      if (!fields.has(node)) fields.set(node, {hidden: node.getAttribute('aria-hidden'), tab: node.getAttribute('tabindex')});
      node.classList.add('tj-private-money-input'); node.setAttribute('aria-hidden', 'true'); node.setAttribute('tabindex', '-1');
    }
  };
  const scan = node => { maskNode(node); for (const child of node.childNodes || []) scan(child); };
  root.classList.add('tj-money-private'); scan(root);
  const observer = new MutationObserver(records => {
    observer.disconnect();
    for (const record of records) {
      if (record.type === 'childList') { record.addedNodes.forEach(scan); scan(record.target); }
      else maskNode(record.target);
    }
    observer.observe(root, {subtree:true, childList:true, characterData:true, attributes:true, attributeFilter:['title','aria-label','alt','value']});
  });
  observer.observe(root, {subtree:true, childList:true, characterData:true, attributes:true, attributeFilter:['title','aria-label','alt','value']});
  return () => {
    observer.disconnect(); root.classList.remove('tj-money-private');
    originals.forEach(({original,masked}, node) => { if (node.nodeValue === masked) node.nodeValue = original; });
    attributes.forEach((values, node) => values.forEach(({original,masked}, name) => { if (node.getAttribute(name) === masked) node.setAttribute(name, original); }));
    fields.forEach(({hidden,tab}, node) => { node.classList.remove('tj-private-money-input'); if (hidden === null) node.removeAttribute('aria-hidden'); else node.setAttribute('aria-hidden',hidden); if (tab === null) node.removeAttribute('tabindex'); else node.setAttribute('tabindex',tab); });
  };
}
export function useBalancePrivacy(enabled, rootRef) {
  // Run in the owning component, after its host ref has attached. Reinstall on
  // render so replacing the loading screen/root cannot leave an unmasked view.
  useLayoutEffect(() => { if (enabled && rootRef.current) return installBalancePrivacy(rootRef.current); });
}
