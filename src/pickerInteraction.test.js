import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {buildSync} from 'esbuild';
import {JSDOM} from 'jsdom';

const require = createRequire(import.meta.url);
const React = require('react');
const {createRoot} = require('react-dom/client');
const {act} = require('react');
let controls;

function loadControls() {
  if (controls) return controls;
  const source = fileURLToPath(new URL('./JournalControls.jsx', import.meta.url));
  const output = buildSync({entryPoints:[source],bundle:true,platform:'node',format:'cjs',write:false,loader:{'.css':'text'},external:['react','react-dom','react-dom/client','react-dom/test-utils','lucide-react']}).outputFiles[0].text;
  const Module = require('module');
  const compiled = new Module(source);
  compiled.filename = source;
  compiled.paths = Module._nodeModulePaths(fileURLToPath(new URL('.', import.meta.url)));
  compiled._compile(output, source);
  controls = compiled.exports;
  return controls;
}

async function withDom(run) {
  const dom = new JSDOM('<!doctype html><html data-theme="light"><body><div id="app"></div></body></html>', {url:'http://localhost'});
  const previous = {window:global.window,document:global.document,navigator:Object.getOwnPropertyDescriptor(global,'navigator'),HTMLElement:global.HTMLElement,Event:global.Event,MouseEvent:global.MouseEvent,PointerEvent:global.PointerEvent};
  Object.assign(global, {window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,Event:dom.window.Event,MouseEvent:dom.window.MouseEvent,PointerEvent:dom.window.PointerEvent || dom.window.MouseEvent});
  Object.defineProperty(global,'navigator',{value:dom.window.navigator,configurable:true});
  // React's legacy input polyfill probes these IE hooks in jsdom.
  dom.window.HTMLElement.prototype.attachEvent ||= () => {};
  dom.window.HTMLElement.prototype.detachEvent ||= () => {};
  window.matchMedia ||= () => ({matches:false,addEventListener(){},removeEventListener(){}});
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  try { await run(dom.window.document); } finally { Object.assign(global,{window:previous.window,document:previous.document,HTMLElement:previous.HTMLElement,Event:previous.Event,MouseEvent:previous.MouseEvent,PointerEvent:previous.PointerEvent}); Object.defineProperty(global,'navigator',previous.navigator); dom.window.close(); }
}

const click = async (node) => act(async () => node.dispatchEvent(new window.MouseEvent('click',{bubbles:true})));
const pointerDown = async (node) => act(async () => node.dispatchEvent(new window.MouseEvent('pointerdown',{bubbles:true})));

test('portalled date and time pickers commit selections without Safari-style blur dismissal', async () => {
  await withDom(async document => {
    const {ThemeDate,ThemeTime} = loadControls();
    const values = {date:'',time:''};
    function Harness() {
      const [date,setDate] = React.useState('');
      const [time,setTime] = React.useState('');
      values.date=date; values.time=time;
      return React.createElement(React.Fragment,null,
        React.createElement(ThemeDate,{label:'Open date',value:date,onChange:event=>setDate(event.target.value)}),
        React.createElement(ThemeTime,{label:'Open time',value:time,onChange:event=>setTime(event.target.value),format:'12'})
      );
    }
    const root = createRoot(document.querySelector('#app'));
    await act(async () => root.render(React.createElement(Harness)));

    await click(document.querySelector('[aria-label="Open date"]'));
    const day = [...document.querySelectorAll('.tj-picker-date button[aria-label]')].find(button => button.getAttribute('aria-label')?.match(/^\d{4}-\d{2}-\d{2}$/));
    assert.ok(day, 'calendar day is rendered in the portalled picker');
    await pointerDown(day);
    await click(day);
    assert.equal(values.date, day.getAttribute('aria-label'));
    assert.equal(document.querySelector('.tj-picker-date'), null, 'date picker closes after a committed day');

    await click(document.querySelector('[aria-label="Open time"]'));
    const hour = [...document.querySelectorAll('.tj-picker-time [role="radio"]')].find(button => button.textContent === '09');
    assert.ok(hour, 'hour option is rendered in the portalled picker');
    await pointerDown(hour);
    await click(hour);
    assert.equal(values.time, '', 'time stays local until Done so parent rerenders cannot discard a partial choice');
    const minuteGroups = [...document.querySelectorAll('.tj-picker-time [role="radiogroup"]')];
    const minute = [...minuteGroups[1].querySelectorAll('[role="radio"]')].find(button => button.textContent === '30');
    await click(minute);
    const pm = [...minuteGroups[2].querySelectorAll('[role="radio"]')].find(button => button.textContent === 'PM');
    await click(pm);
    await click([...document.querySelectorAll('.tj-picker-time button')].find(button => button.textContent === 'Done'));
    assert.equal(values.time, '21:30');
    assert.equal(document.querySelector('.tj-picker-time'), null, 'Done closes after committing the complete value');
    await act(async () => root.unmount());
  });
});

test('picker outside pointer dismissal does not intercept portalled option interactions', async () => {
  await withDom(async document => {
    const {ThemeTime} = loadControls();
    const root = createRoot(document.querySelector('#app'));
    await act(async () => root.render(React.createElement(ThemeTime,{label:'Time',value:'',onChange(){}})));
    await click(document.querySelector('[aria-label="Time"]'));
    const option = document.querySelector('.tj-picker-time [role="radio"]');
    await pointerDown(option);
    assert.ok(document.querySelector('.tj-picker-time'), 'pointerdown inside the portal keeps the picker mounted');
    await pointerDown(document.body);
    assert.equal(document.querySelector('.tj-picker-time'), null, 'outside pointer dismisses the picker');
    await act(async () => root.unmount());
  });
});

test('a picker portal is fixed, zero-sized, and does not change shell scroll state', async () => {
  await withDom(async document => {
    const {ThemeDate} = loadControls();
    const shell = document.createElement('div');
    shell.style.cssText = 'height:100px;overflow:auto';
    document.body.append(shell);
    const root = createRoot(document.querySelector('#app'));
    await act(async () => root.render(React.createElement(ThemeDate,{label:'Close date',value:'',onChange(){}})));
    shell.scrollTop = 48;
    await click(document.querySelector('[aria-label="Close date"]'));
    const portal = document.querySelector('.tj-picker-portal');
    assert.equal(portal.parentElement, document.body, 'popup is mounted outside the application shell');
    assert.equal(portal.style.position, 'fixed');
    assert.equal(portal.style.height, '0px');
    assert.equal(portal.style.pointerEvents, 'none');
    assert.equal(shell.scrollTop, 48, 'opening the portal leaves an unrelated scroll owner unchanged');
    await act(async () => root.unmount());
  });
});
