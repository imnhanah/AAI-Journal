import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL(name,import.meta.url),'utf8');
test('active phone dashboard uses its dedicated responsive surface',()=>{
  const css=read('./mobileDashboardV6.css');
  assert.match(css,/@media \(max-width:767px\)/);
  assert.match(css,/\.tj-mobile-dashboard-v6\{display:grid/);
  assert.match(css,/\.tj-root \.tj-md6-hero\{padding:16px 18px 14px/);
  assert.match(css,/\.tj-md6-insights\{display:grid/);
  assert.ok([...css.matchAll(/font-size:\s*([\d.]+)px/g)].every(match=>Number(match[1])>=12));
});
test('DashboardSurface routes phone widths to the active V6 component',()=>{
  const source=read('./TradingJournal.jsx');
  assert.match(source,/function DashboardSurface\(props\)/);
  assert.match(source,/return phone \? <MobileDashboardV6 \{\.\.\.props\}\/> : <DesktopDashboardV2/);
  assert.match(source,/page === "dashboard" && \(financialValidation\.valid \? <DashboardSurface/);
  assert.match(source,/stats=\{dashboardStats\} liveBalance=\{financeTotals\(dashboardAccount\)\.tradingBalance\}/);
});
test('active phone dashboard keeps the live balance and P&L hero',()=>{
  const css=read('./mobileDashboardV6.css'),source=read('./MobileDashboardV6.jsx');
  assert.match(css,/\.tj-md6-hero-head\{display:flex/);
  assert.match(css,/\.tj-md6-hero footer\{display:flex/);
  assert.match(source,/All-time net P&amp;L/);
  assert.match(source,/<small>Live balance<\/small>/);
  assert.match(source,/<small>Realized P&amp;L<\/small>/);
});
test('active phone dashboard provides empty-state-safe performance cards',()=>{
  const source=read('./MobileDashboardV6.jsx');
  assert.match(source,/No closed trades for this balance yet/);
  assert.match(source,/Green and red daily closes/);
  assert.match(source,/const winCount=stats\.wins \?\? 0, lossCount=stats\.losses \?\? 0/);
});
