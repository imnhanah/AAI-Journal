import {useEffect, useLayoutEffect, useRef} from 'react';

export const DISCLOSURE_DURATION = 320;

// Animate the card's full height, including the compact header. Hold page
// height during the animation, then reserve only enough space to avoid clamping.
export function useDisclosureScroll(state, {waitForTransition = false} = {}) {
  const pending = useRef(null);
  const reserve = useRef(null);
  const running = useRef(null);
  const release = () => {
    const saved = reserve.current;
    if (!saved) return;
    saved.scroller.removeEventListener('scroll', saved.onScroll);
    saved.surface.style.paddingBottom = saved.padding;
    reserve.current = null;
  };
  useEffect(() => () => {
    running.current?.cancel();
    release();
    const saved = pending.current;
    if (saved) saved.surface.style.minHeight = saved.minimum;
  }, []);
  useLayoutEffect(() => {
    running.current?.cancel();
    const saved = pending.current;
    if (!saved) return;
    pending.current = null;
    const {element, scroller, surface, minimum, top, scrollTop} = saved;
    const animations = [];
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    for (const {card, height} of saved.cards) {
      if (!card.isConnected) continue;
      const style = getComputedStyle(card);
      const target = card.firstElementChild.getBoundingClientRect().height +
        (parseFloat(style.borderTopWidth) || 0) + (parseFloat(style.borderBottomWidth) || 0) +
        (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0);
      if (!reducedMotion) animations.push(card.animate(
        [{height:`${height}px`}, {height:`${target}px`}],
        {duration:DISCLOSURE_DURATION, easing:'cubic-bezier(.22,1,.36,1)', fill:'both'}
      ));
    }
    let finished = false;
    let transitionTimer;
    const finish = () => {
      if (finished) return;
      finished = true;
      window.clearTimeout(transitionTimer);
      animations.forEach(animation => animation.cancel());
      running.current = null;
      // Read before releasing min-height, which can synchronously clamp scrollTop.
      const currentScroll = scroller.scrollTop;
      const shift = element.isConnected ? element.getBoundingClientRect().top - top + currentScroll - scrollTop : 0;
      const desired = Math.max(0, currentScroll + shift);
      surface.style.minHeight = minimum;
      const extra = Math.max(0, desired + scroller.clientHeight - scroller.scrollHeight);
      if (extra > 0) {
        const padding = surface.style.paddingBottom;
        const base = parseFloat(getComputedStyle(surface).paddingBottom) || 0;
        surface.style.paddingBottom = `${base + extra}px`;
        const onScroll = () => {
          const needed = Math.max(0, scroller.scrollTop - (desired - extra));
          surface.style.paddingBottom = `${base + Math.min(extra, needed)}px`;
          if (!needed) release();
        };
        reserve.current = {scroller, surface, padding, onScroll};
        // Attach after the programmatic correction's queued scroll event.
        requestAnimationFrame(() => {
          if (reserve.current?.onScroll === onScroll) scroller.addEventListener('scroll', onScroll, {passive:true});
        });
      }
      scroller.scrollTo({top:desired, behavior:'instant'});
    };
    running.current = {cancel:finish};
    // CSS transitions start on the next painted frame; allow two frames before
    // removing the page-height guard used by the inline backtest disclosure.
    if (!animations.length && waitForTransition && !reducedMotion) transitionTimer = window.setTimeout(finish, DISCLOSURE_DURATION + 34);
    else if (!animations.length) finish();
    else Promise.all(animations.map(animation => animation.finished)).then(finish, finish);
  }, [state]);
  return element => {
    if (pending.current) return;
    if (!element) return;
    const scroller = element.closest('.tj-content');
    if (!scroller) return;
    running.current?.cancel();
    const top = element.getBoundingClientRect().top;
    release();
    const surface = scroller.querySelector('.tj-content-inner') || scroller;
    const minimum = surface.style.minHeight;
    const cards = [...element.parentElement.children].map(shell => shell.firstElementChild)
      .filter(card => card?.matches('.tj-reference-tradelog-expanded, .tj-reference-markup-expanded'))
      .map(card => ({card, height:card.getBoundingClientRect().height}));
    surface.style.minHeight = `${surface.getBoundingClientRect().height}px`;
    pending.current = {element, scroller, surface, minimum, top, cards, scrollTop:scroller.scrollTop};
  };
}
