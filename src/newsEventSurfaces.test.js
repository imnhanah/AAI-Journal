import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('high and medium News events retain impact-specific, restrained surfaces',()=>{
  const desktop=readFileSync(new URL('./entryComposer.css',import.meta.url),'utf8');
  const mobile=readFileSync(new URL('./mobileNews.css',import.meta.url),'utf8');
  for(const [impact,color] of [['high','red'],['medium','amber']]) {
    const pattern=new RegExp('\\.tj-event-row-'+impact+' \\{([^}]+)\\}');
    const d=desktop.match(pattern)[1],m=mobile.match(pattern)[1];
    for(const rule of [d,m]) assert.ok(rule.includes(`background:color-mix(in srgb,var(--tj-${color})`));
    assert.ok(d.includes(`box-shadow:inset 3px 0 0 var(--tj-${color})`));
    assert.ok(m.includes(`var(--tj-${color})`)&&m.includes('border-color'));
  }
  const theme=readFileSync(new URL('./themeTokens.css',import.meta.url),'utf8');
  assert.match(theme,/:is\(\.tj-event-row-high,\.tj-event-row-medium\) \{\s*background: color-mix\(in srgb, var\(--news-impact\) 3%, var\(--bg\)\)/);
  assert.match(theme,/button:is\(\.tj-event-row-high,\.tj-event-row-medium\):hover \{\s*background: color-mix\(in srgb, var\(--news-impact\) 6%, var\(--bg\)\)/);
});
