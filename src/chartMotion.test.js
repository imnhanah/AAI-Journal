import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from '@babel/parser';
import { getChartAnimation } from './chartMotion.js';

test('line and bar motion is quick, finite and respects reduced motion', () => {
  assert.deepEqual(getChartAnimation('line',false), {isAnimationActive:true,animationBegin:0,animationDuration:700,animationEasing:'ease-out'});
  assert.equal(getChartAnimation('bar',false).animationDuration,500);
  assert.equal(getChartAnimation('line',true).isAnimationActive,false);
  assert.equal(getChartAnimation('bar',true).isAnimationActive,false);
});

test('every journal line/bar and percentage fill uses the shared entry motion', () => {
  const source=readFileSync(new URL('./TradingJournal.jsx',import.meta.url),'utf8');
  let chartCount=0, fillCount=0;
  function visit(node) {
    if(!node||typeof node!=='object')return;
    if(node.type==='JSXOpeningElement') {
      const tag=node.name.name;
      if(['Area','Bar'].includes(tag)) {
        const opening=source.slice(node.start,node.end);chartCount++;
        assert.match(opening,/getChartAnimation\("(?:line|bar)"\)/);
        assert.doesNotMatch(opening,/isAnimationActive=\{false\}/);
      }
      const style=node.attributes.find(a=>a.name?.name==='style')?.value?.expression;
      const width=style?.properties?.find(p=>p.key?.name==='width')?.value;
      if(width?.type==='TemplateLiteral'&&width.quasis.at(-1)?.value?.cooked?.endsWith('%')) {
        fillCount++;assert.equal(node.attributes.find(a=>a.name?.name==='data-chart-fill')?.value?.value,'horizontal');
      }
    }
    for(const[key,value]of Object.entries(node)) {
      if(key==='loc')continue;
      if(Array.isArray(value))value.forEach(visit);else if(value&&typeof value==='object')visit(value);
    }
  }
  visit(parse(source,{sourceType:'module',plugins:['jsx']}));
  // Savings goal progress now lives in the shared Orbit card, not this page's width fills.
  // Review period cards use reviewed counts instead of decorative progress fills.
  assert.equal(chartCount,15);assert.equal(fillCount,55);
  assert.match(source,/key=\{`\$\{page\}-\$\{account.id\}`\}/);
});

test('donut turns only its ring, preserves summary labels and themes, and stops for reduced motion', () => {
  const source=readFileSync(new URL('./TradingJournal.jsx',import.meta.url),'utf8');
  const css=readFileSync(new URL('./chartMotion.css',import.meta.url),'utf8');
  assert.doesNotMatch(source,/in rotation/);
  assert.match(source,/<strong>\{stats.total\}<\/strong><span>LIVE SPLIT<\/span>/);
  assert.match(css,/\.tj-live-donut::after/);assert.match(css,/background: var\(--tj-allocation-gradient\)/);
  assert.match(css,/rotate\(-360deg\)/);assert.match(css,/@keyframes tj-chart-ring-turn \{[^}]+\}[^}]*to \{ transform: none;/);
  assert.match(css,/prefers-reduced-motion: reduce/);
  assert.match(css,/\.recharts-area/);
  assert.match(css,/clip-path: inset\(0 100% 0 0\)/);
  assert.match(css,/clip-path: inset\(0 0 0 0\)/);
  assert.match(css,/transform-origin: left center/);
  assert.match(css,/scaleX\(0\)/);assert.match(css,/@keyframes tj-chart-fill-x \{[^}]+\}[^}]*to \{ transform: none;/);
  assert.match(css,/progress::-webkit-progress-value/);assert.match(css,/progress::-moz-progress-bar/);
});
