import {MOBILE_MEDIA} from './mobileNavigation.js';

// Safari collapses its browser chrome only for document scrolling. Installed
// homescreen apps retain the contained scrolling surface they already require.
export function usesDocumentPhoneScroll() {
  return typeof window !== 'undefined' && window.matchMedia(MOBILE_MEDIA).matches
    && document.documentElement.dataset.tjDisplayMode === 'browser';
}

export function phoneScrollTarget(element) {
  if (usesDocumentPhoneScroll()) return document.scrollingElement;
  return element?.closest?.('.tj-content') || document.querySelector('.tj-content');
}

export function scrollPhoneTo(element, options) {
  const target=phoneScrollTarget(element);
  if (!target) return;
  if (target===document.scrollingElement) window.scrollTo(typeof options==='number'?{top:options}:options);
  else target.scrollTo(typeof options==='number'?{top:options}:options);
}
