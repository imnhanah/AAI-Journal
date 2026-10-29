import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {NEWS_ALERT_MINUTES,readAlertSettings,dueNewsAlerts} from './newsAlertModel.js';
const read=name=>readFileSync(new URL(name,import.meta.url),'utf8');
test('all five phone release-alert lead times persist and fire at the correct threshold',()=>{
 assert.deepEqual(NEWS_ALERT_MINUTES,[1,5,10,15,30]);
 const release=Date.parse('2026-10-15T12:00:00Z'),event={isoDate:new Date(release).toISOString(),title:'Release',currency:'USD',impact:'high'};
 for(const minute of NEWS_ALERT_MINUTES){const settings=readAlertSettings({getItem:()=>JSON.stringify({enabled:true,minutes:[minute,999]})});assert.deepEqual(settings.minutes,[minute]);const time=release-minute*60000;assert.equal(dueNewsAlerts([event],time,time-1000,new Set(),settings.minutes)[0].minute,minute);}
});
test('phone News has a scrolling currency rail with dynamic edge cues and stacked impact cards',()=>{
 const rail=read('./NewsCurrencyRail.jsx'),css=read('./mobileNews.css');
 assert.match(rail,/new ResizeObserver\(check\)/);assert.match(rail,/edges.before&&/);assert.match(rail,/edges.after&&/);
 assert.match(css,/\.tj-news-event-board \{display:grid;grid-template-columns:minmax\(0,1fr\)!important/);
 assert.match(css,/\.tj-event-row-high \{background:color-mix\(in srgb,var\(--tj-red\)/);
 assert.match(css,/\.tj-event-row-medium \{background:color-mix\(in srgb,var\(--tj-amber\)/);
 assert.ok([...css.matchAll(/font-size:\s*([\d.]+)px/g)].every(match=>Number(match[1])>=12));
});
test('release sheet separates the blur layer, traps focus and restores its opener',()=>{
 const source=read('./PhoneNewsAlertSheet.jsx'),controls=read('./NewsAlerts.jsx');
 assert.match(source,/createPortal/);assert.match(source,/aria-modal="true"/);
 assert.match(source,/e.key==='Escape'/);assert.match(source,/e.key==='Tab'/);
 assert.match(source,/prior\?\.isConnected&&prior.focus\(\)/);
 assert.match(source,/targets.forEach\(\(\[e,inert\]\)=>\{e.inert=inert;/);
 assert.match(controls,/open && phone && <PhoneNewsAlertSheet/);
 assert.match(controls,/open && !phone && <div className="tj-news-alert-menu"/);
});
