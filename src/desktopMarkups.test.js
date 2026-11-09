import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const view = readFileSync(new URL('./MarkupsRedesign.jsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('./desktopMarkups.css', import.meta.url), 'utf8');

test('desktop Markups uses the v2 layout and keeps its actions', () => {
  assert.match(view, /import '\.\/desktopMarkups\.css';/);
  assert.match(view, /<section className="mk2" aria-label="Markups session planner">/);
  assert.match(view, /onClick=\{\(\)=>onTrade\?\.\(current\)\}/);
  assert.match(view, /if\(await confirm\(\{title:'Delete markup\?'/);
});

test('Markups sorts oldest first and Reset clears filters and sort', () => {
  assert.match(view, /sort==='Oldest'\?`\$\{a\.date\|\|''\} \$\{a\.time\|\|''\}`\.localeCompare/);
  assert.match(view, /onClick=\{\(\)=>\{resetFilters\(\);setFiltersOpen\(false\);setSortOpen\(false\);\}\}>Reset<\/button>/);
});

test('Markups v2 reflows by the page width and respects reduced motion', () => {
  assert.match(css, /@container journal-workspace \(max-width:1180px\) \{\n\s*\.tj-root \.mk2 :is\(\.mk2-layout,\.mk2-two,\.mk2-summary\) \{grid-template-columns:minmax\(0,1fr\);\}/);
  assert.match(css, /@media \(min-width:768px\) and \(prefers-reduced-motion:reduce\)/);
  assert.match(css, /\.mk2-layout \{display:grid;grid-template-columns:392px minmax\(0,1fr\);/);
});
