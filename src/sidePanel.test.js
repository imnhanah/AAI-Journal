import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normaliseEntryPanelBehavior, normaliseEntryPanelPosition} from './entryPanelPosition.js';

const read = name => readFileSync(new URL(`./${name}`, import.meta.url), 'utf8');
const shell = read('SidePanel.jsx'), css = read('sidePanel.css'), journal = read('TradingJournal.jsx');

// The width rules, restated from SidePanel.jsx so they run without a DOM.
const clamp = (width, viewport) => Math.round(Math.max(360, Math.min(Math.floor(viewport * .5), Number(width) || 880)));
const band = width => width < 480 ? 'Narrow' : width < 780 ? 'Medium' : 'Wide';

test('panel width: 880 by default, at least 360, at most half the window', () => {
  assert.match(shell, /export const clampPanelWidth = \(width, viewport\) => Math\.round\(Math\.max\(PANEL_MIN, Math\.min\(Math\.floor\(viewport \* \.5\), Number\(width\) \|\| PANEL_DEFAULT\)\)\);/);
  assert.match(shell, /export const PANEL_MIN = 360;\nexport const PANEL_DEFAULT = 880;\nexport const OVERLAY_BELOW = 1100;/);
  assert.equal(clamp(undefined, 1920), 880);
  assert.equal(clamp(880, 1440), 720);
  assert.equal(clamp(200, 1440), 360);
  assert.equal(clamp(528, 1440), 528);
});

test('the drag badge names the band the reflow uses', () => {
  assert.match(shell, /export const panelWidthBand = width => width < 480 \? 'Narrow' : width < 780 \? 'Medium' : 'Wide';/);
  assert.deepEqual([400, 479, 480, 779, 780].map(band), ['Narrow', 'Narrow', 'Medium', 'Medium', 'Wide']);
  assert.match(shell, /\{panelWidthBand\(shown\)\} · \{shown\}px/);
});

test('width is remembered per user', () => {
  assert.match(shell, /export const panelWidthKey = userId => `aai-side-panel-width:\$\{userId \|\| 'guest'\}`;/);
  assert.match(journal, /behavior=\{entryPanelBehavior\}\n\s*userId=\{user\.id\}/);
});

test('panel side and behavior settings default to right and push', () => {
  assert.equal(normaliseEntryPanelPosition('left'), 'left');
  assert.equal(normaliseEntryPanelPosition('nonsense'), 'right');
  assert.equal(normaliseEntryPanelBehavior('overlay'), 'overlay');
  assert.equal(normaliseEntryPanelBehavior(undefined), 'push');
  assert.match(read('auth.js'), /if \(trade_panel_behavior !== undefined\) displayData\.trade_panel_behavior = trade_panel_behavior === 'overlay' \? 'overlay' : 'push';/);
  assert.match(journal, /trade_panel_position: panelPosition, trade_panel_behavior: panelBehavior,/);
  assert.match(journal, /role="radiogroup" aria-label="Trade panel behavior"/);
});

test('push makes room beside the page; overlay and narrow windows dim it instead', () => {
  assert.match(shell, /const overlay = behavior === 'overlay' \|\| viewport < OVERLAY_BELOW;/);
  assert.match(shell, /root\.style\.setProperty\('--sp-push', open && !overlay \? `\$\{shown\}px` : '0px'\);/);
  assert.match(css, /\.sp-side-right \{padding-right:var\(--sp-push,0px\);transition:padding-right \.45s var\(--sp-ease\);\}/);
  assert.match(css, /\.sp-side-left>\.tj-main \{margin-left:var\(--sp-push,0px\);transition:margin-left \.45s var\(--sp-ease\);\}/);
  assert.match(css, /\.sp-dragging>\.tj-main \{transition:none;\}/);
  assert.match(shell, /aria-modal=\{open && overlay \? 'true' : undefined\}/);
});

test('the shell slides with transform, hides when closed, and respects reduced motion', () => {
  assert.match(css, /--sp-ease:cubic-bezier\(\.32,\.72,0,1\)/);
  assert.match(css, /visibility:hidden;transition:transform \.45s var\(--sp-ease\),visibility 0s linear \.45s;/);
  assert.match(css, /\.sp-panel\.is-dragging \{transition:none;\}/);
  assert.match(css, /@media \(prefers-reduced-motion:reduce\) \{\n\s*\.sp-panel,\.sp-panel\.is-open,\.sp-scrim,\.sp-handle::after \{transition:none;\}/);
  assert.match(css, /\.sp-body,\.sp-body \* \{scrollbar-width:none;\}/);
});

test('the left panel starts at the sidebar edge and the sidebar stays above it', () => {
  assert.match(shell, /left \? clientX - railRight : window\.innerWidth - clientX/);
  assert.match(css, /\.sp-left \{left:var\(--sp-left,0px\);border-right:1px solid var\(--border\);/);
  assert.match(css, /\.sp-right \{right:0;border-left:1px solid var\(--border\);/);
  assert.match(css, /\.sp-panel \{position:fixed;top:0;bottom:0;[^}]*border-radius:0;/);
  assert.doesNotMatch(css, /floating-shell/);
  assert.match(css, /\.sp-side-left>\.tj-sidebar \{z-index:12;\}/);
});

test('desktop panels use the shell; phones keep their sheet; opening no longer collapses the sidebar', () => {
  assert.match(journal, /if \(desktopPanel\) return \(\n\s*<SidePanel open=\{panelOpen && entryPanelOpen\}/);
  assert.match(journal, /const desktopPanel = entryPanel && !phone;/);
  assert.match(journal, /if \(entryPanel\) return \(\n\s*<aside className=\{`tj-entry-panel-outer/);
  assert.doesNotMatch(journal, /if \(entryPanelMode && window\.matchMedia\('\(min-width: 901px\)'\)\.matches\) setSidebarOpen\(false\);/);
});

const form = read('sidePanelForm.css');

test('Log trade: the new layout is desktop-only and reuses the same form state and save', () => {
  assert.match(journal, /const desk = \(embedded \|\| backtest\) && !phone;/);
  assert.match(journal, /if \(embedded\) return desk \? deskContent : content;/);
  assert.match(journal, /entryPanel=\{!phone\} entryPanelWidth=\{backtest \? 880 : undefined\}[\s\S]*?\{desk \? deskContent : content\}<\/Modal>/);
  assert.match(journal, /if \(!tradeValidation\.valid\) \{ if \(embedded && !phone\) onPanelStepChange\?\.\(0\); focusFirstValidationError\(\); return; \}/);
  assert.match(journal, /<button type="button" className="sp-btn is-primary" disabled=\{saving \|\| externalSaving\} onClick=\{save\}>/);
});

test('Log trade: header, live summary, numbered tabs with the rules badge', () => {
  assert.match(journal, /<h2>\{editing \? \(backtest \? `Edit \$\{testTradeLabel\} trade` : "Edit trade"\) : \(backtest \? `Log \$\{testTradeLabel\} trade` : "Log trade"\)\}<\/h2>/);
  assert.match(journal, /<b className=\{form\.direction === "SELL" \? "is-sell" : "is-buy"\}>\{form\.direction\}<\/b>/);
  assert.match(journal, /<b className=\{isRunning \? "is-running" : "is-closed"\}>\{isRunning \? "Running" : "Closed"\}<\/b>/);
  assert.match(journal, /\{index === 1 && <em>\{completedRules\}\/\{activeRules\.length\}<\/em>\}/);
});

test('Log trade: money at risk card only with the calculator on, using the existing sizing', () => {
  assert.match(journal, /\{account\?\.positionSizeEnabled && <section className="sp-card sp-position">/);
  assert.match(journal, /"Select an instrument and add a stop loss to calculate position size\."/);
  assert.match(journal, /positionSuggestion && !positionSuggestion\.spec \? \{ tone:"error", text:positionSuggestion\.error \}/);
  assert.match(journal, /fmtMoney\(riskAmount \* riskCalculation\.planned, riskCurrencyCode\)/);
  assert.match(journal, /const ringOffset = 263\.89 \* \(1 - Math\.min\(Math\.max\(deskRiskPct, 0\), 100\) \/ 100\);/);
  for (const token of ['--sp-risk-deep: #06110d;', '--sp-risk-light: #fff;', '--sp-risk-alert: #ef5a6f;']) assert.ok(read('themeTokens.css').includes(token), token);
});

test('Log trade: required marks follow the real validation', () => {
  assert.match(journal, /const entryStopRequired = positionSizeRequired \|\| \(!isRunning && form\.calculationMethod === "price"\);/);
  assert.match(journal, /<Field label="Close date" required=\{!isRunning\}>/);
  assert.match(journal, /<Field label="Open date" required>/);
  assert.match(journal, /\{required && <b className="sp-req" aria-hidden="true">\*<\/b>\}/);
});

test('Log trade: reflows by panel width, fields boxed, no visible scroll bar', () => {
  assert.match(form, /@container sp-panel \(max-width:779px\) \{[\s\S]*?\.sp-c4,\.sp-c3 \{grid-template-columns:repeat\(2,minmax\(0,1fr\)\);\}/);
  assert.match(form, /@container sp-panel \(max-width:479px\) \{[\s\S]*?\.sp-c2\.sp-keep,\.sp-c3\.sp-keep,\.sp-c4\.sp-keep \{grid-template-columns:repeat\(2,minmax\(0,1fr\)\);\}[\s\S]*?\.sp-foot-msg \{display:none;\}/);
  assert.match(form, /\.sp-form\.sp-form\.sp-form\.sp-form\.sp-form\.sp-form :is\(input\.tj-input,\.tj-picker-trigger,div\.tj-input,textarea\.tj-input\) \{[^}]*border:1px solid var\(--border\)!important;/);
  assert.match(form, /\.sp-scroll \{[^}]*scrollbar-width:none;\}\n\s*\.sp-scroll::-webkit-scrollbar \{display:none;\}/);
  assert.match(css, /\.tj-picker-portal \{z-index:400001;\}/);
});

test('New markup: desktop-only layout on the same fields and save; Time is the only required field', () => {
  assert.match(journal, /const desk = embedded && !phone;\n\s*const growWriting/);
  assert.match(journal, /if \(embedded\) return desk \? deskContent : content;\n\s*return <Modal title=\{editing \? "Edit Markup" : "New premarket markup"\}/);
  assert.match(journal, /if \(!f\.time\) \{ setDeskTab\(0\); requestAnimationFrame/);
  assert.match(journal, /<Field label="Time" required id="markup-field-time" error=\{deskTried && !f\.time \? "Choose a time\." : ""\}>/);
  assert.match(journal, /\{deskTried && !f\.time \? "1 required field is missing" : !f\.time \? "1 required field to go" : "Ready to save"\}/);
  assert.match(journal, /MARKUP_STATUSES\.map\(\(status\)=><option key=\{status\} value=\{status\}/);
});

test('New markup: bias toggles off, live summary, review counter, open writing', () => {
  assert.match(journal, /onClick=\{\(\) => set\("bias", f\.bias === bias \? "" : bias\)\}/);
  assert.match(journal, /<b className=\{f\.bias === "Bullish" \? "is-gain" : f\.bias === "Bearish" \? "is-sell" : f\.bias \? "" : "is-muted"\}>\{f\.bias \|\| "Not set"\}<\/b>/);
  assert.match(journal, /const reviewAnswers = \["marketOutcome", "waitedForConditions", "outsidePlanReason"\]\.filter/);
  assert.match(journal, /\{index === 1 && <em>\{reviewAnswers\}\/3<\/em>\}/);
  for (const slot of ['preHTF', 'preH4', 'preM15', 'postH4', 'postM15']) assert.match(journal, new RegExp(`chart\\("${slot}"`));
  assert.match(form, /textarea\.sp-writing \{padding:8px 2px 9px!important;border:0!important;border-bottom:1\.5px solid var\(--border\)!important;/);
  assert.match(form, /\.sp-seg-bias \{grid-template-columns:repeat\(3,minmax\(0,1fr\)\);\}/);
});
