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
  const source = fileURLToPath(new URL('./useBackNavigation.js', import.meta.url));
  const output = buildSync({entryPoints:[source], bundle:true, platform:'node', format:'cjs', write:false, external:['react']}).outputFiles[0].text;
  const Module = require('module');
  const compiled = new Module(source);
  compiled.filename = source;
  compiled.paths = Module._nodeModulePaths(fileURLToPath(new URL('.', import.meta.url)));
  compiled._compile(output, source);
  return compiled.exports;
}

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

async function withPage(run) {
  const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', {url:'http://localhost/finance', pretendToBeVisual:true});
  const keys = ['window', 'document', 'IS_REACT_ACT_ENVIRONMENT'];
  const previous = new Map(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  Object.defineProperties(globalThis, {window:{configurable:true, writable:true, value:dom.window}, document:{configurable:true, writable:true, value:dom.window.document}, IS_REACT_ACT_ENVIRONMENT:{configurable:true, writable:true, value:true}});
  const root = createRoot(dom.window.document.getElementById('app'));
  try {
    const {getBackNavigation, useNavStep} = loadHook();
    const nav = getBackNavigation('/dashboard');
    nav.start({topLevel:false});
    dom.window.addEventListener('popstate', () => nav.handlePop());
    await run({dom, nav, root, useNavStep});
  } finally {
    await act(async () => root.unmount());
    for (const [key, value] of previous) { if (value) Object.defineProperty(globalThis, key, value); else delete globalThis[key]; }
    dom.window.close();
  }
}

test('StrictMode running effects twice leaves exactly one history step', async () => {
  await withPage(async ({dom, nav, root, useNavStep}) => {
    const before = dom.window.history.length;
    let closed = 0;
    function Page() { useNavStep('detail', true, () => { closed += 1; }); return null; }
    await act(async () => { root.render(React.createElement(React.StrictMode, null, React.createElement(Page))); });
    await wait(60);
    assert.equal(nav.depth, 2);
    assert.equal(dom.window.history.length, before + 1, 'only one entry was added');
    assert.equal(dom.window.history.state.tjNav.step, 'detail');
    assert.equal(closed, 0, 'mounting does not close the step');
    await act(async () => { nav.back(); await wait(60); });
    assert.equal(closed, 1, 'Back closes it once');
    assert.equal(nav.depth, 1);
    assert.equal(dom.window.location.pathname, '/finance');
  });
});

test('StrictMode: a step opened after mount adds one entry and closing it removes it', async () => {
  await withPage(async ({dom, nav, root, useNavStep}) => {
    const before = dom.window.history.length;
    function Page({open}) { useNavStep('sheet', open, () => {}); return null; }
    const render = open => act(async () => { root.render(React.createElement(React.StrictMode, null, React.createElement(Page, {open}))); });
    await render(false);
    await wait(20);
    assert.equal(nav.depth, 1);
    await render(true);
    await wait(20);
    assert.equal(nav.depth, 2);
    assert.equal(dom.window.history.length, before + 1);
    await render(false);
    await wait(60);
    assert.equal(nav.depth, 1);
    assert.equal(dom.window.location.pathname, '/finance');
  });
});
