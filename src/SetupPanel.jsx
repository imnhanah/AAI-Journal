import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import SidePanel from './SidePanel.jsx';
import { PanelPrefsContext } from './panelPrefsContext.js';

// Shell shared by the challenge setup and savings accounts windows. On desktop and tablet
// (768px and up) it is the app's own SidePanel, so it follows the user's panel side,
// push/overlay choice and remembered width, like Log trade, Profile and Review. Phones keep
// the centred bottom sheet. children can be a function that receives close(), which slides
// the panel out and then calls onClose.
const PHONE = '(max-width:767px)';
export default function SetupPanel({ label, panelKey, defaultWidth = 880, busy = false, onClose, children }) {
  const prefs = useContext(PanelPrefsContext);
  const [phone, setPhone] = useState(() => window.matchMedia(PHONE).matches);
  const [open, setOpen] = useState(false);
  const closing = useRef(false);
  const host = useRef(null);
  const timer = useRef(0);
  useEffect(() => {
    const media = window.matchMedia(PHONE), update = () => setPhone(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setOpen(true));
    return () => { cancelAnimationFrame(frame); clearTimeout(timer.current); };
  }, []);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const close = useCallback(() => {
    if (busy || closing.current) return;
    if (phone || window.matchMedia('(prefers-reduced-motion:reduce)').matches) { onCloseRef.current?.(); return; }
    closing.current = true;
    setOpen(false);
    timer.current = setTimeout(() => { closing.current = false; onCloseRef.current?.(); }, 380);
  }, [busy, phone]);
  // One panel at a time: opening this one closes any other open side panel (Profile, Account
  // settings, Log trade, Review, the other setup panel), and a panel that opens later closes this one.
  const mine = () => host.current?.closest('.sp-panel');
  const closeOthers = () => [...document.querySelectorAll('.sp-panel.is-open')].filter((node) => node !== mine())
    .forEach((node) => node.querySelector('.tj-modal-close, .csw2-xb')?.click());
  useEffect(() => { if (!phone) closeOthers(); }, [phone]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (phone || !open) return undefined;
    const watch = new MutationObserver((records) => {
      const me = mine();
      if (records.some((r) => r.target !== me && r.target.classList?.contains('sp-panel') && r.target.classList.contains('is-open') && !(r.oldValue || '').includes('is-open'))) close();
    });
    watch.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'], attributeOldValue: true });
    return () => watch.disconnect();
  }, [phone, open, close]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (event) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      if (document.querySelector('.csw2-pov')) return; // the compatible setups dialog closes first
      event.preventDefault();
      close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [close]);

  const body = typeof children === 'function' ? children(close) : children;
  if (phone) return <div className="csw2-ov" role="presentation"><div className="csw2-bk" onClick={close} />{body}</div>;
  return <SidePanel open={open} side={prefs.position} behavior={prefs.behavior} userId={`${prefs.userId || 'guest'}:${panelKey}`} defaultWidth={defaultWidth} label={label}>
    <div ref={host} className="csw2-ov csw2-panel" role="presentation">{body}</div>
  </SidePanel>;
}
