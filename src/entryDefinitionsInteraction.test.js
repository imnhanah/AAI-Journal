import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {buildSync} from 'esbuild';
import {JSDOM} from 'jsdom';

const require=createRequire(import.meta.url),React=require('react');
const {createRoot}=require('react-dom/client'),{act}=React;
const source=fileURLToPath(new URL('./EntryConfluenceControls.jsx',import.meta.url));
const output=buildSync({entryPoints:[source],bundle:true,platform:'node',format:'cjs',write:false,loader:{'.css':'text'},external:['react','react-dom','react-dom/client','lucide-react']}).outputFiles[0].text;
const Module=require('module'),compiled=new Module(source);
compiled.filename=source;compiled.paths=Module._nodeModulePaths(fileURLToPath(new URL('.',import.meta.url)));compiled._compile(output,source);
const {EntryTypeControl}=compiled.exports;

async function withControl(library,value,run){
  const dom=new JSDOM('<!doctype html><html><body><div id="app" style="overflow:hidden"></div><button id="outside">Outside</button></body></html>',{url:'http://localhost'});
  const keys=['window','document','HTMLElement','getComputedStyle','IS_REACT_ACT_ENVIRONMENT'];
  const previous=Object.fromEntries(keys.map(key=>[key,globalThis[key]]));
  Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,getComputedStyle:dom.window.getComputedStyle,IS_REACT_ACT_ENVIRONMENT:true});
  window.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
  const root=createRoot(document.getElementById('app'));let changes=0;
  try{await act(async()=>root.render(React.createElement(EntryTypeControl,{library,value,onChange:()=>changes++})));await run({document,changes:()=>changes});}
  finally{await act(async()=>root.unmount());Object.assign(globalThis,previous);dom.window.close();}
}
const event=async(node,type)=>act(async()=>node.dispatchEvent(new window.MouseEvent(type,{bubbles:true})));
const library={entries:[{id:'trend',label:'Pro Trend',description:'Saved description',archived:false},{id:'plain',label:'No description',description:'',archived:false},{id:'old',label:'Archived model',description:'Historical definition',archived:true}],categories:[]};

test('definitions escape the clipping parent and internal pointer events preserve the open panel and selection',async()=>{
  await withControl(library,'old',async({document,changes})=>{
    const trigger=document.querySelector('[aria-label="Entry Type description"]');
    await event(trigger,'click');const panel=document.querySelector('[role="dialog"]');
    assert.ok(panel);assert.equal(document.getElementById('app').contains(panel),false);
    assert.equal(panel.style.position,'fixed');assert.equal(panel.style.width,'400px');
    assert.match(panel.textContent,/Historical definition/);assert.match(panel.textContent,/No description has been added/);
    await event(panel.querySelector('p'),'pointerdown');assert.ok(document.querySelector('[role="dialog"]'));
    await act(async()=>document.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Escape',bubbles:true})));
    assert.equal(document.querySelector('[role="dialog"]'),null);assert.equal(document.activeElement,trigger);assert.equal(changes(),0);
  });
});
test('close and outside click dismiss definitions without changing the Entry Type',async()=>{
  await withControl(library,'trend',async({document,changes})=>{
    const trigger=document.querySelector('[aria-label="Entry Type description"]');
    await event(trigger,'click');await event(document.querySelector('[aria-label="Close definitions"]'),'pointerdown');await event(document.querySelector('[aria-label="Close definitions"]'),'click');
    assert.equal(document.querySelector('[role="dialog"]'),null);assert.equal(document.activeElement,trigger);
    await event(trigger,'click');await event(document.getElementById('outside'),'pointerdown');
    assert.equal(document.querySelector('[role="dialog"]'),null);assert.equal(changes(),0);
  });
});
test('empty catalogs show guidance and scrolling the definitions does not dismiss them',async()=>{
  await withControl({entries:[],categories:[]},'',async({document})=>{
    await event(document.querySelector('[aria-label="Entry Type description"]'),'click');
    const panel=document.querySelector('[role="dialog"]');assert.match(panel.textContent,/No Entry Types configured yet/);
    await act(async()=>panel.dispatchEvent(new window.Event('scroll',{bubbles:true})));
    assert.ok(document.querySelector('[role="dialog"]'));
  });
});
