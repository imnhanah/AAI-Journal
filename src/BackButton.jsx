import React, {useEffect, useState} from 'react';
import {ArrowLeft} from 'lucide-react';
import {MOBILE_MEDIA} from './mobileNavigation.js';
import {useBackNavigation} from './useBackNavigation.js';
import './mobileBackButton.css';

// The one Back button for phone pages. A page can pass onBack to handle a step of its own first;
// returning true means it handled the press, so the page is not left. Steps added with useNavStep
// do not need this: going back through history closes them on its own.
export default function BackButton({onBack}) {
  const nav = useBackNavigation();
  const [phone, setPhone] = useState(() => window.matchMedia(MOBILE_MEDIA).matches);
  useEffect(() => {
    const media = window.matchMedia(MOBILE_MEDIA), change = () => setPhone(media.matches);
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);
  if (!phone) return null;
  const press = async () => {
    if (await onBack?.() === true) return;
    nav.back();
  };
  return <button type="button" className="tj-back" aria-label="Back" onClick={press}><ArrowLeft size={22} strokeWidth={2} aria-hidden="true"/></button>;
}
