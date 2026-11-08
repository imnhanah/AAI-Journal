import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {buildSync} from 'esbuild';
import {JSDOM} from 'jsdom';

const require=createRequire(import.meta.url);
const React=require('react');
const {createRoot}=require('react-dom/client');
const {act}=require('react');
const {Simulate}=require('react-dom/test-utils');
let editor;

function loadEditor(){
  if(editor)return editor;
  const source=fileURLToPath(new URL('./CaseStudyLibrary.jsx',import.meta.url));
  const output=buildSync({entryPoints:[source],bundle:true,platform:'node',format:'cjs',jsx:'automatic',write:false,loader:{'.css':'text'},external:['react','react-dom','react-dom/client','react-dom/test-utils','lucide-react']}).outputFiles[0].text;
  const Module=require('module');
  const compiled=new Module(source);
  compiled.filename=source;
  compiled.paths=Module._nodeModulePaths(fileURLToPath(new URL('.',import.meta.url)));
  compiled._compile(output,source);
  editor=compiled.exports;
  return editor;
}

async function withDom(run){
  const dom=new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>',{url:'http://localhost'});
  const previous={window:global.window,document:global.document,navigator:Object.getOwnPropertyDescriptor(global,'navigator'),HTMLElement:global.HTMLElement,Event:global.Event,MouseEvent:global.MouseEvent,InputEvent:global.InputEvent};
  Object.assign(global,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,Event:dom.window.Event,MouseEvent:dom.window.MouseEvent,InputEvent:dom.window.InputEvent});
  Object.defineProperty(global,'navigator',{value:dom.window.navigator,configurable:true});
  dom.window.HTMLElement.prototype.attachEvent||=()=>{};
  dom.window.HTMLElement.prototype.detachEvent||=()=>{};
  globalThis.IS_REACT_ACT_ENVIRONMENT=true;
  try { await run(dom.window.document); } finally { Object.assign(global,{window:previous.window,document:previous.document,HTMLElement:previous.HTMLElement,Event:previous.Event,MouseEvent:previous.MouseEvent,InputEvent:previous.InputEvent});Object.defineProperty(global,'navigator',previous.navigator);dom.window.close(); }
}

const click=async node=>act(async()=>node.dispatchEvent(new window.MouseEvent('click',{bubbles:true})));
const change=async(node,value)=>act(async()=>{
  node.value=value;
  Simulate.change(node,{target:{value}});
});

test('personal template sections keep DOM identity and focus while typing, then save and reopen',async()=>{
  await withDom(async document=>{
    const {PersonalTemplateDialog}=loadEditor();
    let saved;
    const root=createRoot(document.querySelector('#app'));
    const render=template=>act(async()=>root.render(React.createElement(PersonalTemplateDialog,{template,onClose(){},onSave:value=>{saved=value;}})));
    await render({id:'personal-1',name:'Existing',description:'',sections:['Overview'],guidance:{Overview:'Keep context'}});
    const add=[...document.querySelectorAll('button')].find(button=>button.textContent.includes('Add section'));
    await click(add);
    const newSection=document.querySelector('[aria-label="Section 2"]');
    assert.equal(document.activeElement,newSection,'the new section receives focus once');
    for (const character of 'Market structure') {
      await change(newSection,`${newSection.value}${character}`);
      assert.equal(document.activeElement,newSection,`focus remains in the new section after ${character}`);
    }
    assert.equal(newSection.value,'Market structure');
    const existing=document.querySelector('[aria-label="Section 1"]');
    existing.focus();
    await change(existing,'Research overview');
    assert.equal(document.activeElement,existing,'editing an existing title does not remount its input');
    const guidance=[...document.querySelectorAll('input[placeholder="Optional guidance"]')][1];
    guidance.focus();
    await change(guidance,'Mark liquidity and structure.');
    assert.equal(document.activeElement,guidance,'guidance input retains focus while controlled state updates');
    await click([...document.querySelectorAll('button')].find(button=>button.textContent==='Save template'));
    assert.deepEqual(saved.sections,['Research overview','Market structure']);
    assert.equal(saved.guidance['Market structure'],'Mark liquidity and structure.');
    await render({id:'personal-1',name:'Existing',description:'',sections:saved.sections,guidance:saved.guidance});
    assert.equal(document.querySelector('[aria-label="Section 2"]').value,'Market structure','saved section reopens with its complete title');
    await act(async()=>root.unmount());
  });
});
