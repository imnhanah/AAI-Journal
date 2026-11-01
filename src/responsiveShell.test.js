import test from 'node:test';
import assert from 'node:assert/strict';
import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import {JSDOM} from 'jsdom';
import {createServer} from 'vite';

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

function installDom(width) {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {url:'http://localhost/'});
  const keys = ['window','document','navigator','HTMLElement','Node','Event','EventTarget','getComputedStyle','requestAnimationFrame','cancelAnimationFrame','IS_REACT_ACT_ENVIRONMENT'];
  const previous = new Map(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const media = new Map();
  let currentWidth = width;
  const queryMatches = query => /max-width\s*:\s*767px/.test(query) ? currentWidth <= 767 : false;
  dom.window.matchMedia = query => {
    if (!media.has(query)) {
      const listeners = new Set();
      media.set(query, {
        media:query,
        get matches() { return queryMatches(query); },
        addEventListener(type, listener) { if (type === 'change') listeners.add(listener); },
        removeEventListener(type, listener) { if (type === 'change') listeners.delete(listener); },
        addListener(listener) { listeners.add(listener); },
        removeListener(listener) { listeners.delete(listener); },
        dispatchEvent() { return true; },
        _listeners:listeners,
      });
    }
    return media.get(query);
  };
  const globals = {
    window:dom.window, document:dom.window.document, navigator:dom.window.navigator,
    HTMLElement:dom.window.HTMLElement, Node:dom.window.Node, Event:dom.window.Event,
    EventTarget:dom.window.EventTarget, getComputedStyle:dom.window.getComputedStyle.bind(dom.window),
    requestAnimationFrame:callback => setTimeout(callback, 0), cancelAnimationFrame:clearTimeout,
    IS_REACT_ACT_ENVIRONMENT:true,
  };
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, {configurable:true, writable:true, value});
  return {
    container:dom.window.document.getElementById('root'),
    resize(nextWidth) {
      currentWidth = nextWidth;
      for (const item of media.values()) {
        const event = {matches:item.matches, media:item.media};
        item._listeners.forEach(listener => listener(event));
      }
    },
    restore() {
      for (const [key, descriptor] of previous) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else delete globalThis[key];
      }
      dom.window.close();
    },
  };
}

test('actual MobileShell mounts and unmounts cleanly across repeated desktop/phone transitions', async () => {
  const harness = installDom(1024);
  const vite = await createServer({root:process.cwd(), server:{middlewareMode:true}, appType:'custom'});
  let root;
  try {
    const {default:MobileShell} = await vite.ssrLoadModule('/src/MobileShell.jsx');
    const props = {
      page:'dashboard', sheet:null, onSheet:() => {}, nav:[{id:'dashboard',label:'Dashboard'}], onNavigate:() => {},
      displayName:'Tester', avatar:'', initials:'T', verified:false,
      account:{id:'account',name:'Primary'}, accounts:[{id:'account',name:'Primary'}], onSelectAccount:() => {}, onAddAccount:() => {},
      routine:{enabled:false}, busy:false, tradeLocked:false, challengeEnabled:false, financeEnabled:false,
      theme:'dark', onTheme:() => {}, onProfile:() => {}, onAccount:() => {}, onLogout:() => {}, onStartDay:() => {}, onNewMarkup:() => {}, onLogTrade:() => {}, search:null,
    };
    root = createRoot(harness.container);
    await act(async () => { root.render(React.createElement(MobileShell, props)); await flush(); });
    assert.equal(harness.container.querySelector('.tj-mobile-bottom'), null, 'desktop starts without mobile navigation');

    for (const width of [768,600,430,390,375,320,1024,1440,1920,390,1024]) {
      await act(async () => { harness.resize(width); await flush(); });
      const phone = width <= 767;
      assert.equal(Boolean(harness.container.querySelector('.tj-mobile-bottom')), phone, `navigation state at ${width}px`);
      if (phone) {
        assert.ok(harness.container.querySelector('[aria-label="Phone navigation"]'));
        assert.ok(harness.container.querySelector('[aria-label="Add to your day"]'));
      }
    }
  } finally {
    await act(async () => { root?.unmount(); await flush(); });
    await vite.close();
    harness.restore();
  }
});
