// An installed iPhone app can lay its page out shorter than the screen, and fixed items stop at
// that shorter edge even though normal page content draws to the very bottom. This measures the
// shortfall so the app can be made that much taller. A browser is left alone: its toolbar sits
// there, so the gap is always zero.
const MAX_GAP = 80; // Larger differences are the keyboard or a split view, not this problem.

// fixedBottom is where a fixed item actually lands. The page's height readings can disagree with it.
export function viewportGap({standalone, innerWidth, innerHeight, fixedBottom = innerHeight, screenWidth, screenHeight}) {
  if (!standalone) return 0;
  const portrait = innerHeight >= innerWidth;
  const screenSide = portrait ? Math.max(screenWidth, screenHeight) : Math.min(screenWidth, screenHeight);
  const gap = Math.round(screenSide - fixedBottom);
  return gap > 0 && gap <= MAX_GAP ? gap : 0;
}

// iOS blurs the page around the status bar in an installed app and offers no way to turn it off,
// so headings sit just below it there.
export const TOP_CLEARANCE = 26;

// The installed app's height comes straight from the screen. The page's own height readings can
// disagree with each other from one moment to the next, which would push the bottom bar off screen.
export function installedAppHeight({standalone, innerWidth, innerHeight, screenWidth, screenHeight}) {
  if (!standalone) return null;
  return innerHeight >= innerWidth ? Math.max(screenWidth, screenHeight) : Math.min(screenWidth, screenHeight);
}

const isTyping = () => /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '');

export function installPhoneViewport() {
  const standalone = () => window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
  let gap = 0;
  const probe = document.createElement('div');
  probe.setAttribute('aria-hidden', 'true');
  probe.style.cssText = 'position:fixed;left:0;bottom:0;width:0;height:0;pointer-events:none;visibility:hidden';
  document.body.appendChild(probe);
  const apply = () => {
    const size = {standalone:standalone(), innerWidth:window.innerWidth, innerHeight:window.innerHeight, fixedBottom:probe.getBoundingClientRect().bottom, screenWidth:window.screen.width, screenHeight:window.screen.height};
    gap = viewportGap(size);
    const height = installedAppHeight(size);
    if (height) document.documentElement.style.setProperty('--tj-app-height', `${height}px`);
    else document.documentElement.style.removeProperty('--tj-app-height');
    document.documentElement.style.setProperty('--tj-viewport-gap', `${gap}px`);
    document.documentElement.style.setProperty('--tj-top-clearance', height ? `${TOP_CLEARANCE}px` : '0px');
  };
  // The taller app makes the page itself scrollable by that small amount, so keep it at the top.
  // While typing the iPhone needs to move the page to keep the field in view.
  const holdPage = () => { if (gap && window.scrollY && !isTyping()) window.scrollTo(0, 0); };
  apply();
  window.addEventListener('resize', apply);
  window.addEventListener('orientationchange', apply);
  window.addEventListener('scroll', holdPage, {passive:true});
  window.addEventListener('pageshow', apply);
  document.addEventListener('visibilitychange', apply);
  return () => { probe.remove(); window.removeEventListener('pageshow', apply); document.removeEventListener('visibilitychange', apply); window.removeEventListener('resize', apply); window.removeEventListener('orientationchange', apply); window.removeEventListener('scroll', holdPage); };
}
