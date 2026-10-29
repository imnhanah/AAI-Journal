import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { parse } from '@babel/parser';

test('active journal choice fields use the shared picker; native selects remain limited to utility imports', () => {
  const source=readFileSync(new URL('./TradingJournal.jsx',import.meta.url),'utf8');
  const nativeSelects=[];
  const visit=node=>{
    if(!node||typeof node!=='object')return;
    if(node.type==='JSXOpeningElement'&&node.name.name==='select')nativeSelects.push(node);
    for(const [key,value] of Object.entries(node)) {
      if(key==='loc')continue;
      if(Array.isArray(value))value.forEach(visit);
      else if(value&&typeof value==='object')visit(value);
    }
  };
  visit(parse(source,{sourceType:'module',plugins:['jsx']}));
  assert.equal(nativeSelects.length,2);
  assert.match(source,/ThemeSelect compact label="Trade log account"/);
  assert.match(source,/ThemeSelect compact label="Trade log year"/);
});

test('shared controls retain selection, keyboard access and date/time constraints', () => {
  const source=readFileSync(new URL('./JournalControls.jsx',import.meta.url),'utf8');
  const journal=readFileSync(new URL('./TradingJournal.jsx',import.meta.url),'utf8');
  assert.match(source,/role="radio" aria-checked=/);
  assert.match(source,/ArrowDown.*ArrowRight.*ArrowUp.*ArrowLeft.*Home.*End/);
  assert.match(source,/event.key === 'Escape'/);
  assert.match(source,/variant=\{variant \|\| 'select'\}/);
  assert.match(source,/variant="date"/);
  assert.match(source,/variant="time"/);
  assert.match(source,/format === '24'/);
  assert.match(source,/disabled=\{disabled\} required=\{required\}/);
  assert.match(source,/!min\|\|next>=min/);
  assert.match(source,/!max\|\|next<=max/);
  assert.doesNotMatch(journal,/if \(!themed \|\|/);
  assert.match(journal,/format=\{activeRegionalPreferences.timeFormat\}/);
});

test('all picker lists share the radio indicator and selected checkmark styling', () => {
  const css=readFileSync(new URL('./themeTokens.css',import.meta.url),'utf8');
  assert.match(css,/\.tj-floating-picker \.tj-picker-options button::before/);
  assert.match(css,/\.tj-floating-picker \.tj-picker-options button\[aria-checked=true\]::after/);
  assert.match(css,/content:'✓'/);
  assert.match(css,/\.tj-date-days button\[aria-pressed=true\]/);
});

test('compact account cards exclude trade-log filters', () => {
  const journal=readFileSync(new URL('./TradingJournal.jsx',import.meta.url),'utf8');
  const controls=readFileSync(new URL('./JournalControls.jsx',import.meta.url),'utf8');
  const css=readFileSync(new URL('./entryComposer.css',import.meta.url),'utf8');
  assert.match(journal,/<ThemeSelect variant="account-card" label="Review account"/);
  assert.match(journal,/label="Movement account"/);
  assert.match(journal,/<ThemeSelect variant="account-card" label="Finance account"/);
  assert.match(journal,/<ThemeSelect compact label="Trade log account"/);
  assert.doesNotMatch(journal,/<ThemeSelect[^>]*variant="account-card"[^>]*label="Trade log account"/);
  assert.match(controls,/\['account-card', 'analytics-account', 'calendar-account'\]/);
  assert.match(css,/min-width: 134px;[^\n]*min-height: 28px/);
});
