import React, {useCallback, useEffect, useLayoutEffect, useRef, useState} from 'react';
import './sidePanel.css';
import './sidePanelForm.css';

// Desktop side panel shell for Log trade and New markup (sidePanel.css). Full height and
// flush: against the window's right edge, or against the sidebar's right edge on the left.
// It is --sp-w wide and slides in. In Push mode the page makes room (padding on .tj-root,
// or a margin on .tj-main for the left side); in Overlay mode it sits over a dimmed page.
// Below OVERLAY_BELOW window width it always overlays. Width is per user, 360px to half the
// window. Phones keep their own bottom sheet; this shell is never mounted there.

export const PANEL_MIN = 360;
export const PANEL_DEFAULT = 880;
export const OVERLAY_BELOW = 1100;

export const clampPanelWidth = (width, viewport) => Math.round(Math.max(PANEL_MIN, Math.min(Math.floor(viewport * .5), Number(width) || PANEL_DEFAULT)));
export const panelWidthBand = width => width < 480 ? 'Narrow' : width < 780 ? 'Medium' : 'Wide';
export const panelWidthKey = userId => `aai-side-panel-width:${userId || 'guest'}`;

const readWidth = (userId, fallback = PANEL_DEFAULT) => {
  try { return Number(window.localStorage.getItem(panelWidthKey(userId))) || fallback; } catch { return fallback; }
};

// defaultWidth: a panel's own starting width (Profile opens narrower than Log trade).
export default function SidePanel({open, side = 'right', behavior = 'push', userId, label, defaultWidth = PANEL_DEFAULT, children}) {
  const panel = useRef(null), opener = useRef(null), drag = useRef(null);
  const [width, setWidth] = useState(() => readWidth(userId, defaultWidth));
  const [viewport, setViewport] = useState(() => window.innerWidth);
  const [railRight, setRailRight] = useState(0);
  const [dragging, setDragging] = useState(false);
  const shown = clampPanelWidth(width, viewport);
  const overlay = behavior === 'overlay' || viewport < OVERLAY_BELOW;
  const left = side === 'left';

  useEffect(() => { setWidth(readWidth(userId, defaultWidth)); }, [userId, defaultWidth]);
  useEffect(() => {
    const resize = () => setViewport(window.innerWidth);
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // The left panel starts at the sidebar's right edge and follows it as it opens or collapses.
  useLayoutEffect(() => {
    const rail = panel.current?.closest('.tj-root')?.querySelector(':scope > .tj-sidebar');
    if (!rail) return undefined;
    const measure = () => { const box = rail.getBoundingClientRect(); setRailRight(box.width && getComputedStyle(rail).display !== 'none' ? box.right : 0); };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(rail);
    window.addEventListener('resize', measure);
    return () => { observer.disconnect(); window.removeEventListener('resize', measure); };
  }, []);

  // Push: the page gives up exactly the panel's width. Shared with the page through .tj-root.
  useLayoutEffect(() => {
    const root = panel.current?.closest('.tj-root');
    if (!root) return undefined;
    root.style.setProperty('--sp-push', open && !overlay ? `${shown}px` : '0px');
    root.classList.toggle('sp-side-left', left);
    root.classList.toggle('sp-side-right', !left);
    root.classList.toggle('sp-overlay-open', open && overlay);
    root.classList.toggle('sp-dragging', dragging);
    return undefined;
  }, [open, overlay, shown, left, dragging]);
  useEffect(() => () => {
    const root = panel.current?.closest('.tj-root') || document.querySelector('.tj-root');
    root?.style.removeProperty('--sp-push');
    root?.classList.remove('sp-side-left', 'sp-side-right', 'sp-overlay-open', 'sp-dragging');
  }, []);

  // Focus moves in on open and back to whatever opened it on close.
  useEffect(() => {
    const node = panel.current;
    if (!node) return undefined;
    if (open) {
      if (!node.contains(document.activeElement)) opener.current = document.activeElement;
      const frame = requestAnimationFrame(() => {
        const close = [...node.querySelectorAll('.tj-modal-close')].find(button => button.getClientRects().length);
        (close || node).focus({preventScroll:true});
      });
      return () => cancelAnimationFrame(frame);
    }
    const back = opener.current;
    opener.current = null;
    if (back?.isConnected && (node.contains(document.activeElement) || document.activeElement === document.body)) back.focus({preventScroll:true});
    return undefined;
  }, [open]);

  const widthAt = useCallback(clientX => clampPanelWidth(left ? clientX - railRight : window.innerWidth - clientX, window.innerWidth), [left, railRight]);
  const move = useCallback(event => {
    if (drag.current !== event.pointerId) return;
    setWidth(widthAt(event.clientX));
  }, [widthAt]);
  const end = useCallback(event => {
    if (drag.current === null || (event && drag.current !== event.pointerId)) return;
    drag.current = null;
    setDragging(false);
    setWidth(current => { try { window.localStorage.setItem(panelWidthKey(userId), String(current)); } catch {} return current; });
    document.removeEventListener('pointermove', move);
    document.removeEventListener('pointerup', end);
    document.removeEventListener('pointercancel', end);
  }, [move, userId]);
  const begin = event => {
    if (event.button !== 0 && event.pointerType !== 'touch') return;
    event.preventDefault();
    drag.current = event.pointerId;
    setWidth(shown);
    setDragging(true);
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', end);
    document.addEventListener('pointercancel', end);
  };
  useEffect(() => () => {
    document.removeEventListener('pointermove', move);
    document.removeEventListener('pointerup', end);
    document.removeEventListener('pointercancel', end);
  }, [move, end]);
  const nudge = event => {
    const grow = left ? 'ArrowRight' : 'ArrowLeft', shrink = left ? 'ArrowLeft' : 'ArrowRight';
    if (event.key !== grow && event.key !== shrink) return;
    event.preventDefault();
    const next = clampPanelWidth(shown + (event.key === grow ? 24 : -24), window.innerWidth);
    setWidth(next);
    try { window.localStorage.setItem(panelWidthKey(userId), String(next)); } catch {}
  };

  return <>
    {overlay && <div className={`sp-scrim ${open ? 'is-open' : ''}`} aria-hidden="true"/>}
    <aside ref={panel} className={`sp-panel sp-${left ? 'left' : 'right'} ${open ? 'is-open' : ''} ${overlay ? 'is-overlay' : 'is-push'} ${dragging ? 'is-dragging' : ''}`}
      style={{'--sp-w':`${shown}px`, '--sp-left':`${railRight}px`, '--tj-entry-panel-width':`${shown}px`}}
      role="dialog" aria-label={label} aria-modal={open && overlay ? 'true' : undefined} aria-hidden={open ? undefined : true} tabIndex={-1}>
      <div className="sp-handle" role="separator" aria-orientation="vertical" aria-label="Resize panel" aria-valuemin={PANEL_MIN} aria-valuemax={Math.floor(viewport * .5)} aria-valuenow={shown} tabIndex={open ? 0 : -1}
        onPointerDown={begin} onDoubleClick={() => { setWidth(defaultWidth); try { window.localStorage.setItem(panelWidthKey(userId), String(defaultWidth)); } catch {} }} onKeyDown={nudge}/>
      <div className="sp-badge" aria-hidden="true">{panelWidthBand(shown)} · {shown}px</div>
      <div className="sp-body">{children}</div>
    </aside>
  </>;
}
