import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {buildSync} from 'esbuild';
import {JSDOM} from 'jsdom';

const require = createRequire(import.meta.url);
const React = require('react');
const {act} = require('react');
const {createRoot} = require('react-dom/client');

function loadHook() {
  const source = fileURLToPath(new URL('./usePhoneTradeDialog.js', import.meta.url));
  const output = buildSync({entryPoints:[source],bundle:true,platform:'node',format:'cjs',write:false,external:['react']}).outputFiles[0].text;
  const Module = require('module');
  const compiled = new Module(source);
  compiled.filename = source;
  compiled.paths = Module._nodeModulePaths(fileURLToPath(new URL('.', import.meta.url)));
  compiled._compile(output, source);
  return compiled.exports.usePhoneTradeDialog;
}

test('phone dialog initialization does not crash before an embedded dialog supplies its focus anchor', async () => {
  const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', {url:'http://localhost'});
  const previous = new Map(['window','document','navigator','HTMLElement','requestAnimationFrame','cancelAnimationFrame','IS_REACT_ACT_ENVIRONMENT'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis,key)]));
  const media = {matches:true,addEventListener(){},removeEventListener(){}};
  Object.defineProperties(globalThis, {
    window:{configurable:true,writable:true,value:dom.window},
    document:{configurable:true,writable:true,value:dom.window.document},
    navigator:{configurable:true,writable:true,value:dom.window.navigator},
    HTMLElement:{configurable:true,writable:true,value:dom.window.HTMLElement},
    requestAnimationFrame:{configurable:true,writable:true,value:callback => setTimeout(callback,0)},
    cancelAnimationFrame:{configurable:true,writable:true,value:clearTimeout},
    IS_REACT_ACT_ENVIRONMENT:{configurable:true,writable:true,value:true},
  });
  dom.window.matchMedia = () => media;
  dom.window.HTMLElement.prototype.attachEvent ||= () => {};
  dom.window.HTMLElement.prototype.detachEvent ||= () => {};
  const usePhoneTradeDialog = loadHook();
  const errors = [];
  const originalError = console.error;
  console.error = (...args) => errors.push(args);
  let root;
  try {
    function EmbeddedMarkupHarness() {
      usePhoneTradeDialog(() => {});
      // This intentionally mirrors the pre-fix embedded Markup panel: it has no anchor ref.
      return React.createElement('div', {className:'tj-entry-panel-form'});
    }
    root = createRoot(dom.window.document.querySelector('#app'));
    await act(async () => root.render(React.createElement(EmbeddedMarkupHarness)));
    assert.equal(errors.length, 0, 'a temporarily missing focus anchor must not throw during phone initialization');
  } finally {
    await act(async () => root?.unmount());
    console.error = originalError;
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis,key,descriptor);
      else delete globalThis[key];
    }
    dom.window.close();
  }
});

test('a closed persistent phone entry panel never leaves the page scroll owner inert', async () => {
  const dom = new JSDOM('<!doctype html><html><body><main class="tj-content"></main><header class="tj-topbar"></header><nav class="tj-mobile-bottom"></nav><div id="app"></div></body></html>', {url:'http://localhost'});
  const previous = new Map(['window','document','navigator','HTMLElement','requestAnimationFrame','cancelAnimationFrame','IS_REACT_ACT_ENVIRONMENT'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis,key)]));
  const media = {matches:true,addEventListener(){},removeEventListener(){}};
  Object.defineProperties(globalThis, {
    window:{configurable:true,writable:true,value:dom.window}, document:{configurable:true,writable:true,value:dom.window.document}, navigator:{configurable:true,writable:true,value:dom.window.navigator}, HTMLElement:{configurable:true,writable:true,value:dom.window.HTMLElement}, requestAnimationFrame:{configurable:true,writable:true,value:callback => setTimeout(callback,0)}, cancelAnimationFrame:{configurable:true,writable:true,value:clearTimeout}, IS_REACT_ACT_ENVIRONMENT:{configurable:true,writable:true,value:true},
  });
  dom.window.matchMedia = () => media;
  const usePhoneTradeDialog = loadHook();
  let root;
  try {
    function PanelHarness({active}) {
      const {summary} = usePhoneTradeDialog(() => {}, active);
      return React.createElement('div', {className:'tj-modal'}, React.createElement('div', {className:'tj-modal-title'}, 'Log trade'), React.createElement('button', {className:'tj-modal-close'}), React.createElement('div', {ref:summary}));
    }
    root = createRoot(dom.window.document.querySelector('#app'));
    await act(async () => root.render(React.createElement(PanelHarness, {active:true})));
    assert.equal(dom.window.document.querySelector('.tj-content').inert, true, 'an open dialog blocks background interaction');
    await act(async () => root.render(React.createElement(PanelHarness, {active:false})));
    assert.notEqual(dom.window.document.querySelector('.tj-content').inert, true, 'closing the persistent panel restores the scroll owner');
  } finally {
    await act(async () => root?.unmount());
    for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis,key,descriptor); else delete globalThis[key]; }
    dom.window.close();
  }
});

test('trade and markup forms mounted together do not leave the app frozen after closing', async () => {
  const dom = new JSDOM('<!doctype html><html><body><main class="tj-content"></main><header class="tj-topbar"></header><nav class="tj-mobile-bottom"></nav><div id="app"></div></body></html>', {url:'http://localhost'});
  const previous = new Map(['window','document','navigator','HTMLElement','requestAnimationFrame','cancelAnimationFrame','IS_REACT_ACT_ENVIRONMENT'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis,key)]));
  const media = {matches:true,addEventListener(){},removeEventListener(){}};
  Object.defineProperties(globalThis, {
    window:{configurable:true,writable:true,value:dom.window}, document:{configurable:true,writable:true,value:dom.window.document}, navigator:{configurable:true,writable:true,value:dom.window.navigator}, HTMLElement:{configurable:true,writable:true,value:dom.window.HTMLElement}, requestAnimationFrame:{configurable:true,writable:true,value:callback => setTimeout(callback,0)}, cancelAnimationFrame:{configurable:true,writable:true,value:clearTimeout}, IS_REACT_ACT_ENVIRONMENT:{configurable:true,writable:true,value:true},
  });
  dom.window.matchMedia = () => media;
  const usePhoneTradeDialog = loadHook();
  let root;
  try {
    function OneForm({active}) {
      const {summary} = usePhoneTradeDialog(() => {}, active);
      return React.createElement('div', {className:'tj-modal'}, React.createElement('div', {className:'tj-modal-title'}, 'Log trade'), React.createElement('button', {className:'tj-modal-close'}), React.createElement('div', {ref:summary}));
    }
    function PanelHarness({active}) {
      return React.createElement(React.Fragment, null, React.createElement(OneForm, {active}), React.createElement(OneForm, {active}));
    }
    root = createRoot(dom.window.document.querySelector('#app'));
    await act(async () => root.render(React.createElement(PanelHarness, {active:true})));
    assert.equal(dom.window.document.querySelector('.tj-content').inert, true, 'an open dialog blocks background interaction');
    await act(async () => root.render(React.createElement(PanelHarness, {active:false})));
    for (const selector of ['.tj-content','.tj-topbar','.tj-mobile-bottom']) assert.notEqual(dom.window.document.querySelector(selector).inert, true, `${selector} stays usable after both forms close`);
  } finally {
    await act(async () => root?.unmount());
    for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis,key,descriptor); else delete globalThis[key]; }
    dom.window.close();
  }
});
