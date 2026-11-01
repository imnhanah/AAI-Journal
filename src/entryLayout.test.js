import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {displayMetadata, normaliseDisplayPreferences} from './displayPreferences.js';

const journal = readFileSync(new URL('./TradingJournal.jsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('./entryComposer.css', import.meta.url), 'utf8');

test('trade entry keeps display preferences independent of panel layout', () => {
  assert.deepEqual(normaliseDisplayPreferences(), {weekStart:'monday',startPage:'dashboard',hideBalances:false});
  assert.deepEqual(displayMetadata({weekStart:'monday',startPage:'dashboard',hideBalances:false}), {week_start:'monday',start_page:'dashboard',hide_balances:false});
});

test('static contract: trade and markup forms share one persistent panel shell', () => {
  assert.match(journal, /function PersistentEntryPanel\(/);
  assert.match(journal, /entryPanelMode/);
  assert.match(journal, /<NewTradeModal \{\.\.\.tradeProps\} embedded/);
  assert.match(journal, /<MarkupModal \{\.\.\.markupProps\} embedded/);
  assert.match(journal, /const entryPanel = <PersistentEntryPanel/);
  assert.match(journal, /mode=\{entryPanelMode \|\| 'trade'\}/);
  assert.match(journal, /open=\{Boolean\(entryPanelMode\)\}/);
  assert.match(journal, /entryPanelOpen=\{open && !closing\}/);
});

test('markup uses one continuous panel form while trade retains its own steps', () => {
  assert.match(journal, /tj-markup-continuous-form/);
  assert.match(journal, /markup-setup-heading/);
  assert.match(journal, /markup-review-heading/);
  assert.doesNotMatch(journal, /const \[markupPanelStep, setMarkupPanelStep\]/);
  assert.match(styles, /tj-markup-continuous-section \+ \.tj-markup-continuous-section/);
});

test('entry panels keep draft data on failures and ask before discarding changes', () => {
  assert.match(journal, /You have unsaved trade changes\. Closing now will discard them\./);
  assert.match(journal, /You have unsaved markup changes\. Closing now will discard them\./);
  assert.match(journal, /if \(res\.error\).*return false/);
  assert.match(journal, /setModal\(null\); setEditingTrade\(null\); setNewTradeDraft\(null\);[\s\S]*return true/);
});

test('modal focus lifecycle does not restart when a draft recreates its close callback', () => {
  assert.match(journal, /const onCloseRef = useRef\(onClose\);/);
  assert.match(journal, /onCloseRef\.current = onClose;/);
  assert.match(journal, /onCloseRef\.current\(\);/);
  assert.doesNotMatch(journal, /useEffect\(\(\) => \{[\s\S]{0,500}closeWithEscape[\s\S]{0,500}\}, \[onClose\]\);/);
});

test('entry panel uses one CSS width reveal and a fixed-width form sibling', () => {
  assert.doesNotMatch(journal, /motion\/react/);
  assert.doesNotMatch(journal, /tj-entry-panel-rail/);
  assert.match(journal, /tj-entry-panel-outer/);
  assert.match(styles, /flex:0 0 auto; width:0;[\s\S]*transition:width 240ms cubic-bezier\(\.2,\.8,\.2,1\)/);
  assert.match(styles, /tj-entry-panel-open \{ width:var\(--tj-entry-panel-width\); \}/);
  assert.match(styles, /width:var\(--tj-entry-panel-width\); min-width:var\(--tj-entry-panel-width\)/);
  assert.doesNotMatch(styles, /transition:margin-right/);
  assert.doesNotMatch(styles, /translateX\(calc\(var\(--tj-entry-panel-content-width/);
});

test('the shared panel remains the right-side flex sibling after the workspace', () => {
  assert.match(journal, /\n      \{entryPanel\}\n      \{modal === "backtesttrade"/);
  assert.doesNotMatch(journal, /entryPanelPosition|entryPanelSide|tradePanelPosition/);
  assert.doesNotMatch(styles, /entry-panel-side-left|entry-panel-left/);
  assert.match(styles, /\.tj-root \.tj-entry-panel-outer \{ flex:0 0 auto; width:0;/);
});

test('static contract: visibility, rather than side, owns the reveal lifecycle', () => {
  assert.match(journal, /if \(!entryPanelOpen\) \{\s*setPanelOpen\(false\);/);
  assert.match(journal, /setPanelOpen\(false\);\s*const frame = requestAnimationFrame\(\(\) => setPanelOpen\(true\)\)/);
  assert.match(journal, /\[entryPanel, entryPanelOpen\]\);/);
  assert.doesNotMatch(journal, /\[entryPanel, entryPanelOpen, entryPanelSide\]\);/);
  assert.match(styles, /width:0;[\s\S]*transition:width 240ms cubic-bezier\(\.2,\.8,\.2,1\)/);
  assert.match(styles, /tj-entry-panel-open \{ width:var\(--tj-entry-panel-width\); \}/);
});
