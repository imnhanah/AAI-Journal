import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {MOBILE_MEDIA} from './mobileNavigation.js';

const read = name => readFileSync(new URL(`./${name}`, import.meta.url), 'utf8');
const css = read('mobileMotion.css');
const block = start => {
  const open = css.indexOf('{', css.indexOf(start));
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++;
    if (css[i] === '}' && --depth === 0) return css.slice(open + 1, i);
  }
  return '';
};
const tokens = text => Object.fromEntries([...text.matchAll(/(--[\w-]+):([^;]+);/g)].map(match => [match[1], match[2].trim()]));
const motionBlock = block('@media (max-width:767px) {');
const reducedBlock = block('@media (max-width:767px) and (prefers-reduced-motion:reduce)');

test('motion tokens use the agreed curves and durations', () => {
  const values = tokens(motionBlock);
  assert.equal(values['--ease-out'], 'cubic-bezier(.32,.72,0,1)');
  assert.equal(values['--ease-spring'], 'cubic-bezier(.22,1.1,.36,1)');
  assert.equal(values['--dur-page'], '420ms');
  assert.equal(values['--dur-sheet'], '460ms');
  assert.equal(values['--dur-fade'], '280ms');
  assert.equal(values['--dur-press'], '180ms');
  assert.equal(values['--motion-stagger'], '45ms');
  assert.equal(values['--motion-parallax'], '-22%');
  assert.equal(values['--motion-dim'], '.5');
});

test('motion is phone only, at the same width as MOBILE_MEDIA', () => {
  const width = MOBILE_MEDIA.match(/max-width:\s*(\d+)px/)[1];
  // Walk the braces: every top-level block must be an @media for the phone width.
  const source = css.replace(/\/\*[\s\S]*?\*\//g, '');
  let depth = 0, start = 0;
  for (let i = 0; i < source.length; i++) {
    if (source[i] === '{' && depth++ === 0) {
      const head = source.slice(start, i).trim();
      assert.match(head, new RegExp(`^@media \\(max-width:${width}px\\)`), head);
    }
    if (source[i] === '}' && --depth === 0) start = i + 1;
  }
  assert.equal(source.slice(start).trim(), '');
});

test('reduced motion settles everything at once with no stagger, parallax or dimming', () => {
  const values = tokens(reducedBlock);
  for (const name of ['--dur-page', '--dur-sheet', '--dur-fade', '--dur-press']) assert.equal(values[name], '1ms');
  assert.equal(values['--motion-stagger'], '0ms');
  assert.equal(values['--motion-parallax'], '0%');
  assert.equal(values['--motion-dim'], '0');
  for (const rule of ['animation-duration:1ms !important', 'animation-delay:0s !important', 'animation-iteration-count:1 !important', 'transition-duration:1ms !important', 'transition-delay:0s !important']) assert.ok(reducedBlock.includes(rule), rule);
});

test('will-change is set only by the active-motion class', () => {
  assert.match(motionBlock, /\.tj-motion-active \{will-change:transform;\}/);
  for (const name of readdirSync(new URL('.', import.meta.url)).filter(file => /^mobile.*\.css$/.test(file) && file !== 'mobileMotion.css')) {
    assert.doesNotMatch(read(name), /will-change/, name);
  }
});

test('the shell loads the motion styles after the bottom bar styles', () => {
  const shell = read('MobileShell.jsx');
  assert.ok(shell.indexOf("import './mobileMotion.css';") > shell.indexOf("import './mobileBottomBar.css';"));
});

test('phone transitions animate transform and opacity, not layout', () => {
  // Known exceptions: pager dots that grow into a pill, the backtest
  // disclosure, and a progress bar the phone never shows.
  const allowed = new Set([
    'mobileCalendarV2.css|.tj-mcal-dots i', 'mobileChallengesV6.css|.tj-mc6-rail-dots i',
    'mobileAnalyticsPulse.css|.tj-pulse-dots i', 'mobilePsychologyLab.css|.tj-psy-dots i',
    'mobileBacktest.css|.bt-run-disclosure', 'mobileRoutine.css|.tj-routine-v1-progress i',
  ]);
  const layout = /\b(all|top|left|right|bottom|width|height|max-height|min-height|margin[\w-]*|padding[\w-]*|grid-template-rows|grid-template-columns|inset)\b/;
  const found = [];
  for (const name of readdirSync(new URL('.', import.meta.url)).filter(file => /^mobile.*\.css$/.test(file))) {
    for (const [, selector, body] of read(name).matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const transition = body.match(/(?:^|;)\s*transition:([^;]+)/)?.[1];
      if (!transition || !layout.test(transition)) continue;
      const key = [...allowed].find(entry => entry.startsWith(`${name}|`) && selector.includes(entry.split('|')[1]));
      if (!key) found.push(`${name}: ${selector.trim()} → ${transition}`);
    }
  }
  assert.deepEqual(found, []);
});

test('moving parts that used left or top now use transform', () => {
  assert.match(read('mobileBottomBar.css'), /\.tj-topbar \{[^}]*transition:transform \.22s ease;\}/);
  assert.match(read('mobileFinance.css'), /\.tj-phone-finance-tabs\[data-tab=savings\]>i \{transform:translateX\(100%\);\}/);
  assert.match(read('mobileStrategyTestingV6.css'), /\.tj-st6-tabs\[data-tab=history\]>i \{transform:translateX\(100%\);\}/);
  assert.match(read('mobilePsychologyLab.css'), /\.tj-psy-tabs>i \{[^}]*transform:translateX\(calc\(100% \* var\(--i,0\)\)\);transition:transform \.25s ease;\}/);
  assert.match(read('mobileNewsScreen.css'), /\.tj-nx-switch\[aria-checked=true\]>i::after\{transform:translateX\(20px\)\}/);
  assert.match(read('mobileSetup.css'), /\.tj-routine-status-chip\[aria-checked=true\]>i::after \{transform:translateX\(20px\);\}/);
});

test('page moves animate only translate and opacity', () => {
  const frames = [...css.matchAll(/@keyframes (tj-page-[\w-]+) \{((?:[^{}]*\{[^{}]*\})*)\s*\}/g)];
  assert.ok(frames.length >= 9, `${frames.length} page keyframes`);
  for (const [, name, body] of frames) {
    for (const [, declarations] of body.matchAll(/\{([^{}]*)\}/g)) {
      for (const property of declarations.split(';').map(part => part.split(':')[0].trim()).filter(Boolean)) assert.ok(['translate', 'opacity'].includes(property), `${name}: ${property}`);
    }
  }
});

test('push, pop and tab use the motion tokens', () => {
  assert.match(css, /\.tj-page-stage-moving>\.tj-page-live-push \{[^}]*animation:tj-page-from-right var\(--dur-page\) var\(--ease-out\) both;/);
  assert.match(css, /\.tj-page-ghost\[data-move=push\]>\.tj-page-ghost-sheet \{animation:tj-page-under var\(--dur-page\) var\(--ease-out\) forwards;/);
  assert.match(css, /\.tj-page-dim\[data-move=push\] \{[^}]*animation:tj-page-dim-in/);
  assert.match(css, /\.tj-page-ghost\[data-move=pop\]>\.tj-page-ghost-sheet \{[^}]*animation:tj-page-to-right var\(--dur-page\) var\(--ease-out\) forwards;/);
  assert.match(css, /\.tj-page-stage-moving>\.tj-page-live-pop \{[^}]*animation:tj-page-from-under/);
  assert.match(css, /@keyframes tj-page-under \{to \{translate:var\(--motion-parallax\) 0;\}\}/);
  assert.match(css, /@keyframes tj-page-dim-in \{to \{opacity:var\(--motion-dim\);\}\}/);
  assert.match(css, /@keyframes tj-page-settle \{from \{opacity:0;translate:0 10px;\}\}/);
  assert.doesNotMatch(css, /data-move=tab\][^{]*\{[^}]*translate:100%/, 'tabs never slide sideways');
  assert.match(css, /\.tj-page-dim \{background:var\(--motion-shade\);/);
  assert.match(read('themeTokens.css'), /--motion-shade: #000;/);
});

test('the page stage takes its direction from the back layer and adds nothing on desktop', () => {
  const stage = read('MobilePageStage.jsx'), journal = read('TradingJournal.jsx');
  assert.match(stage, /getBackNavigation\(\)\.takeMove\(\)/);
  assert.match(stage, /getSnapshotBeforeUpdate\(previous\)/);
  assert.match(stage, /componentDidUpdate\(previous, previousState, shot\)/);
  assert.match(stage, /prefers-reduced-motion: reduce\)'\)\.matches\) return null/);
  assert.match(stage, /if \(!this\.state\.phone\) return this\.props\.children;/);
  assert.match(stage, /addEventListener\('animationend', done\)/);
  assert.match(stage, /setTimeout\(\(\) => this\.finish\(\), pageMoveDuration\(kind\) \+ END_SLACK\)/);
  assert.match(stage, /querySelectorAll\('\[id\]'\)\.forEach\(node => node\.removeAttribute\('id'\)\)/);
  assert.match(stage, /removeAttribute\('name'\)/);
  assert.match(stage, /aria-hidden="true" inert=""/);
  assert.match(journal, /<MobilePageStage page=\{page\} account=\{account\.id\}>\n\s*<div className="tj-page-transition" key=\{`\$\{page\}-\$\{account\.id\}`\}>/);
});

test('one shared indicator slides under the active tab without widening the screen', () => {
  const bar = read('mobileBottomBar.css'), shell = read('MobileShell.jsx');
  assert.match(shell, /<i className="tj-mobile-tab-indicator" data-tab=\{activeTab \?\? undefined\} aria-hidden="true"\/>/);
  assert.match(bar, /\.tj-mobile-tab-indicator \{position:absolute;top:0;left:0;[^}]*width:28px;[^}]*transition:transform var\(--dur-page\) var\(--ease-out\),opacity var\(--dur-fade\) ease;\}/);
  for (const index of ['0', '1', '3', '4']) assert.match(bar, new RegExp(`tj-mobile-tab-indicator\\[data-tab="${index}"\\] \\{transform:translateX\\(calc\\([\\d.]+vw [+-] \\d+px\\)\\);\\}`));
  assert.doesNotMatch(bar, /button\[aria-current=page\]:not\(\.tj-mobile-add\)::before \{width:28px;\}/, 'tabs no longer draw their own bar');
});

test('steps inside pages push and pop through the page stage', () => {
  const stage = read('MobilePageStage.jsx');
  assert.match(stage, /export function useStepMotion\(depth\)/);
  assert.match(stage, /activeStage\?\.capture\(depth > last\.current \? 'push' : 'pop'\)/);
  assert.match(stage, /useLayoutEffect\(\(\) => \{\n\s*const taken = shot\.current;/);
  const sites = [
    ['MobileJournalTimeline.jsx', /useStepMotion\(position >= 0 \? 1 : 0\);/],
    ['MobileMarkupsV2.jsx', /useStepMotion\(selected \? 1 : 0\);/],
    ['ReviewPage.jsx', /useStepMotion\(showDetail \? 1 : 0\);/],
    ['MobileStrategyTestingV6.jsx', /useStepMotion\(activeRun \? 1 : 0\);/],
    ['CaseStudyLibrary.jsx', /useStepMotion\(screen !== 'library' \? 2 : \['evidence', 'connections'\]\.includes\(libraryView\) \? 1 : 0\);/],
    ['CaseStudyLibrary.jsx', /useStepMotion\(viewerId \? 1 : 0\);/],
    ['TradingJournal.jsx', /useStepMotion\(phoneListOpen \? 1 : 0\);/],
  ];
  for (const [file, pattern] of sites) assert.match(read(file), pattern, file);
});

test('screens on top slide over the page and wait for the slide before closing', () => {
  assert.match(css, /\.tj-root \.tj-modal-overlay:has\(>\.tj-ma-modal\) \{overflow:clip;background:transparent;animation:none;\}/);
  assert.match(css, /\.tj-root\.tj-root \.tj-modal-overlay>\.tj-ma-modal \{[^}]*animation:tj-page-from-right var\(--dur-page\) var\(--ease-out\) both;\}/);
  assert.match(css, /\.tj-modal-overlay\.tj-modal-closing>\.tj-ma-modal,\.tj-root\.tj-root \.tj-modal-overlay>\.tj-ma-modal\.is-closing \{animation:tj-page-to-right/);
  assert.match(css, /\.tj-root:has\(>\.tj-modal-overlay>\.tj-ma-modal\)>\.tj-main \{animation:tj-page-under/);
  assert.match(css, />\.tj-main \{animation:tj-page-from-under var\(--dur-page\) var\(--ease-out\) both;\}/);
  const journal = read('TradingJournal.jsx');
  assert.match(journal, /const phoneSlide = overlay\.querySelector\(":scope>\.tj-ma-modal"\) \? pageMoveDuration\("pop"\) : 0;\n\s*modalCloseTimer\.current = window\.setTimeout\(\(\) => setModalState\(null\), phoneSlide \|\| 230\);/);
  assert.match(journal, /className=\{`tj-ma-modal tj-mp-modal \$\{closing \? 'is-closing' : ''\}`\} centered wide onClose=\{leave\}/);
  assert.match(journal, /const phoneShowsIndex = phoneIndex \|\| \(phone && activeSection === "daily-routine"\);/);
});
