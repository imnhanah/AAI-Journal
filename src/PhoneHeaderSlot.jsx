import React, {useLayoutEffect, useState} from 'react';
import {createPortal} from 'react-dom';
import {MOBILE_MEDIA} from './mobileNavigation.js';

export const PHONE_HEADER_SLOT_ID = 'tj-phone-header-slot';

// On phones a page's top controls sit in the header, in place of the workspace
// switcher (mobileApp.css hides it while this slot has content). Elsewhere they
// render where they are written, so desktop layouts stay as they were.
export default function PhoneHeaderSlot({children}) {
  const [phone,setPhone] = useState(() => window.matchMedia(MOBILE_MEDIA).matches);
  const [target,setTarget] = useState(null);
  useLayoutEffect(() => {
    const media = window.matchMedia(MOBILE_MEDIA), change = () => setPhone(media.matches);
    media.addEventListener('change', change);
    setTarget(document.getElementById(PHONE_HEADER_SLOT_ID));
    return () => media.removeEventListener('change', change);
  }, []);
  if(!phone) return children;
  return target ? createPortal(children, target) : null;
}
