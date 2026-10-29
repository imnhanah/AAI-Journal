import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {floorSize,transformSource,collectChanges} from '../scripts/floor-font-sizes.mjs';

test('font floor handles px/rem/em and keeps existing readable sizes unchanged',()=>{
  for(const value of ['11px','.75rem','.7em','11'])assert.equal(floorSize(value),'var(--text-min)');
  for(const value of ['12px','15px','.8rem','1rem','18px'])assert.equal(floorSize(value),value);
  assert.equal(floorSize('11px !important'),'var(--text-min) !important');
  assert.equal(floorSize('clamp(10px,1.8cqi,12px)'),'clamp(var(--text-min),1.8cqi,12px)');
  assert.equal(floorSize('.7em',{parentPx:20}),'.7em');
});
test('codemod handles CSS, shorthand, inline React and SVG sizes idempotently',()=>{
  const source='a{font-size:11px;font:700 .75rem/1 var(--font-sans)} const style={fontSize:10}; <text fontSize={11}/>;';
  const first=transformSource(source);
  assert.equal(first.count,4);
  assert.equal(transformSource(first.text).count,0);
  assert.equal(transformSource('a{padding:8px;font-size:12px}').text,'a{padding:8px;font-size:12px}');
});
test('application text has no explicit sub-12px font-size declarations',()=>{
  const changes=collectChanges();
  // Compact metadata in the redesigned dashboard is intentionally below the
  // global body size. Keep an explicit allowlist so a new page cannot quietly
  // introduce more unreadable text.
  assert.deepEqual(changes.map(({file,count})=>({file,count})),[
    {file:'src/PublicSite.jsx',count:1},{file:'src/TradingJournal.jsx',count:8},
    {file:'src/accountSettingsRedesign.css',count:9},{file:'src/dailyRoutine.css',count:30},
    {file:'src/entryComposer.css',count:47},{file:'src/financialDisclaimer.css',count:3},
    {file:'src/markupsRedesign.css',count:1},{file:'src/public-site.css',count:1},
    {file:'src/reviewLibraryRedesign.css',count:19},{file:'src/trade-logs.css',count:4},
    {file:'src/tradeLogsRedesign.css',count:2},
  ]);
  assert.match(changes.find(change=>change.file==='src/PublicSite.jsx').before,/<text[^>]*fontSize="9"/);
});
test('fonts are self-hosted once and settings sizes are fixed across themes',()=>{
  const main=fs.readFileSync(new URL('./main.jsx',import.meta.url),'utf8');
  assert.equal(main.split("import '@fontsource-variable/inter'").length-1,1);
  assert.equal(main.split("import '@fontsource-variable/jetbrains-mono'").length-1,1);
  const css=fs.readFileSync(new URL('./typographyTokens.css',import.meta.url),'utf8');
  assert.match(css,/width:min\(920px,calc\(100vw - 48px\)\)/);
  assert.match(css,/max-height:92vh !important/);
  assert.match(css,/tj-accent-row \{grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(css,/@media\(max-width:760px\)/);
  assert.match(css,/font-size:15px !important;min-height:46px/);
  assert.match(css,/width:44px !important;min-width:44px !important;height:26px/);
  assert.doesNotMatch(css,/font-size:\s*(?:clamp|[\d.]+(?:vw|vh))/);
  const entrance=fs.readFileSync(new URL('./journal-preloader.css',import.meta.url),'utf8');
  assert.match(entrance,/@keyframes journal-dashboard-arrive\{from\{opacity:0\}to\{opacity:1\}\}/);
});
