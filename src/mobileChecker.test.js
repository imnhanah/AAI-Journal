import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {auditMobile} from '../scripts/mobile-audit.js';
function audit({tag='DIV',text='',width=100,height=50,scroll=100,font='13px',transform='none',marked=false,pageWidth=390}={}) {
 const prior={document:globalThis.document,innerWidth:globalThis.innerWidth,innerHeight:globalThis.innerHeight,getComputedStyle:globalThis.getComputedStyle};
 const body={tagName:'BODY',classList:[],parentElement:null,getBoundingClientRect:()=>({left:0,right:390,width:390,height:844})};
 const node={tagName:tag,namespaceURI:'http://www.w3.org/1999/xhtml',classList:[],id:'probe',parentElement:body,childNodes:text?[{nodeType:3,textContent:text}]:[],clientWidth:width,scrollWidth:scroll,getBoundingClientRect:()=>({left:0,right:width,width,height}),closest:s=>s.includes('data-scroll-row')&&marked?node:null,matches:s=>tag==='BUTTON'&&s.includes('button')};
 body.querySelectorAll=()=>[node];
 globalThis.document={body,documentElement:{tagName:'HTML',id:'',classList:[],parentElement:null,scrollWidth:pageWidth},querySelector:s=>s==='.tj-page-title'?{textContent:'Dashboard'}:body};globalThis.innerWidth=390;globalThis.innerHeight=844;
 globalThis.getComputedStyle=e=>({display:'block',visibility:'visible',position:'static',fontSize:font,transform:e===node?transform:'none',filter:'none',backdropFilter:'none'});
 try{return auditMobile();}finally{Object.assign(globalThis,prior);}
}
test('checker catches page/element overflow, small text and small targets',()=>{
 assert.ok(audit({pageWidth:410}).issues.some(x=>x.kind==='page-scroll'&&x.amount===20));
 assert.ok(audit({scroll:180}).issues.some(x=>x.kind==='content-overflow'&&x.amount===80));
 assert.ok(audit({text:'Label',font:'11px'}).issues.some(x=>x.kind==='small-text'));
 assert.ok(audit({tag:'BUTTON',width:30,height:30,scroll:30}).issues.some(x=>x.kind==='small-target'));
});
test('only explicitly marked rails exempt horizontal overflow; their targets still count',()=>{
 assert.equal(audit({scroll:180,marked:true}).issues.length,0);
 assert.ok(audit({tag:'BUTTON',width:30,height:30,scroll:90,marked:true}).issues.some(x=>x.kind==='small-target'));
 assert.ok(audit({text:'Label',transform:'matrix(1,0,0,1,0,0)'}).issues.some(x=>x.kind==='transformed-text'));
});
test('global refinements are entirely phone scoped and the frame header is in normal flow',()=>{
 const css=readFileSync(new URL('./mobileRules.css',import.meta.url),'utf8');
 assert.match(css,/@media\(max-width:767px\)/);assert.match(css,/\.tj-topbar \{position:static/);
 assert.match(css,/min-height:44px!important/);assert.match(css,/min-height:48px!important/);
 assert.doesNotMatch(css,/100vh|#[0-9a-f]{3,8}\b/);
});
test('checker includes disabled controls, disclosure summaries and radio options',()=>{
 const source=readFileSync(new URL('../scripts/mobile-audit.js',import.meta.url),'utf8');
 assert.match(source,/a\[href\],summary/);
 assert.ok(source.includes('[role="radio"]'));
 assert.doesNotMatch(source,/&&!e.disabled/);
 assert.match(source,/b.width<43.9/);
});
test('daily-use checker opens all routine states and day sheets without saving records',()=>{
 const script=readFileSync(new URL('../scripts/check-mobile.js',import.meta.url),'utf8');
 for(const state of ['routine-open','routine-progress','routine-complete','routine-from-add','day-'])assert.ok(script.includes(state));
 assert.match(script,/Math.ceil\(count\*2\/3\)/);
 assert.match(script,/Closing the routine unexpectedly opened markup/);
 assert.doesNotMatch(script,/getByRole\('button',\{name:'Save & open markup/);
});
