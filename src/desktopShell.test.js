import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const journal = readFileSync(new URL('./TradingJournal.jsx', import.meta.url), 'utf8');
const shell = readFileSync(new URL('./SidebarShell.jsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('./desktopShell.css', import.meta.url), 'utf8');
const sidebarCss = readFileSync(new URL('./sidebarV2.css', import.meta.url), 'utf8');

test('desktop shell v2 is one flag on the journal root and the sidebar', () => {
  assert.match(journal, /const SHELL_V2 = true;/);
  assert.match(journal, /\$\{SHELL_V2 \? "tj-shell-v2" : ""\}/);
  assert.match(journal, /<SidebarShell open=\{sidebarOpen\} page=\{page\} v2=\{SHELL_V2\}>/);
  assert.doesNotMatch(journal, /tj-sidebar-profile-sub|tj-ws-label/);
  assert.match(journal, /<div className="tj-page-heading" key=\{page\}>/);
});

test('the v2 sidebar keeps collapse motion to the reference rail transition', () => {
  assert.doesNotMatch(shell, /tj-sb-mark|tj-sb-edge|tj-sb-tip/);
  assert.match(shell, /tj-sidebar-tooltip/);
  assert.match(shell, /onPointerOverCapture=\{showTip\}/);
  assert.match(css, /transition:width \.3s cubic-bezier\(\.32,\.72,0,1\),min-width \.3s cubic-bezier\(\.32,\.72,0,1\),flex-basis \.3s cubic-bezier\(\.32,\.72,0,1\),padding \.3s cubic-bezier\(\.32,\.72,0,1\);/);
  assert.match(css, /\.tj-sidebar-v2 \.tj-nav-item>span \{display:block;opacity:1;transition:opacity \.2s ease;\}/);
  assert.match(css, /\.tj-sidebar-tooltip \{position:fixed;/);
  assert.match(css, /\.tj-sidebar-nav-group \{width:auto;margin:0;padding:0;border:0!important;border-bottom:0!important;\}/);
  assert.match(css, /tj-sidebar-collapsed \.tj-nav-label::before \{content:none!important;display:none!important;\}/);
  assert.match(css, /tj-sidebar-v2 \.tj-nav-active::before \{content:none!important;display:none!important;\}/);
  assert.doesNotMatch(journal, /tj-nav-active \{[^}]*box-shadow: inset 3px 0 0/);
  assert.match(css, /tj-sidebar-collapsed \.tj-sidebar-scroll \.tj-nav::before \{content:"";position:absolute;z-index:2;top:-8px;left:26px;width:20px;height:1\.5px/);
  assert.doesNotMatch(sidebarCss, /tj-sidebar-nav-group \{width:64px;padding:2px 0;border-bottom:1px/);
});

test('shell v2 styles stay off phones, use tokens and keep text at 12px or more', () => {
  assert.doesNotMatch(css, /tj-ws-label|tj-sidebar-profile-sub/);
  assert.match(css, /^@media \(min-width:768px\) \{/m);
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgba?\(/i);
  assert.doesNotMatch(css, /font-size:(?:[0-9]|1[01])(?:\.\d+)?px/);
  assert.match(css, /@media \(min-width:768px\) and \(prefers-reduced-motion:reduce\)/);
});

test('the v2 workspace switcher keeps its handlers, says workspace and shows each balance', () => {
  assert.match(journal, /showAccountMenu && !phoneViewport && <div className="tj-account-menu">/);
  assert.match(journal, /\{SHELL_V2 \? "Switch workspace" : "Switch journal"\}/);
  assert.match(journal, /\{SHELL_V2 && <small>\{fmtMoneyShort\(financeTotals\(a\)\.tradingBalance, a\.baseCurrency\)\} balance<\/small>\}/);
  assert.match(journal, /\{SHELL_V2 \? "Add workspace" : "Add account"\}/);
  assert.match(css, /\.tj-shell-v2 \.tj-account-menu \{/);
  assert.match(css, /@keyframes tj-ws-pop/);
});

test('Log trade panel fields stay boxed and empty screenshot zones are centred with their icon', () => {
  const fields = readFileSync(new URL('./writingFields.css', import.meta.url), 'utf8');
  const form = readFileSync(new URL('./sidePanelForm.css', import.meta.url), 'utf8');
  assert.equal((fields.match(/:not\(\.sp-form input\)/g) || []).length, 3);
  assert.match(form, /\.sp-shots \.tj-dropzone\.tj-dropzone\.tj-dropzone \{display:grid!important;place-items:center!important;/);
  assert.match(form, /\.sp-shots \.tj-dropzone \.tj-trade-add-image \.tj-phone-image-icon \{display:block!important;/);
});

test('desktop Profile opens in the side panel with its own width and keeps the profile handlers', () => {
  const panel = readFileSync(new URL('./DesktopProfilePanel.jsx', import.meta.url), 'utf8');
  const side = readFileSync(new URL('./SidePanel.jsx', import.meta.url), 'utf8');
  assert.match(journal, /if \(SHELL_V2 && !phone\) \{\n    const closePassword/);
  assert.match(journal, /<Modal entryPanel entryPanelOpen=\{profilePanelOpen\} entryPanelPosition=\{panelPosition\} entryPanelBehavior=\{panelBehavior\} entryPanelUserId=\{`\$\{user\.id\}:profile`\} entryPanelWidth=\{600\}/);
  assert.match(journal, /if \(deleteOpen\) \{ cancelDelete\(\); return; \}/);
  assert.match(journal, /aria-pressed=\{SHELL_V2 \? modal === "profile" : undefined\}/);
  assert.match(side, /defaultWidth = PANEL_DEFAULT, children\}\) \{/);
  assert.match(panel, /onMouseEnter=\{\(\) => appearance\.onPreview\(id\)\}/);
  assert.match(panel, /data-theme=\{theme\.id\}/);
});

test('desktop Account settings opens in the side panel and keeps its settings logic', () => {
  const account = readFileSync(new URL('./desktopAccount.css', import.meta.url), 'utf8');
  const fields = readFileSync(new URL('./writingFields.css', import.meta.url), 'utf8');
  assert.match(journal, /const deskPanel = SHELL_V2 && !phone;/);
  assert.match(journal, /entryPanel=\{deskPanel\} entryPanelOpen=\{accountPanelOpen\} entryPanelPosition=\{tradePanelPosition\} entryPanelBehavior=\{tradePanelBehavior\} entryPanelUserId=\{`\$\{userId\}:account`\} entryPanelWidth=\{680\} onClose=\{closeAccount\}/);
  assert.match(journal, /<AccountSettingsModal tradePanelPosition=\{entryPanelPosition\} tradePanelBehavior=\{entryPanelBehavior\}/);
  assert.match(journal, /onClick=\{closeAccount\}>Cancel<\/button>/);
  assert.match(account, /^@media \(min-width:768px\) \{/m);
  assert.doesNotMatch(account, /#[0-9a-f]{3,8}\b|rgba?\(/i);
  assert.doesNotMatch(account, /font-size:(?:[0-9]|1[01])(?:\.\d+)?px/);
  assert.equal((fields.match(/:not\(\.tj-account-panel-modal input\)/g) || []).length, 3);
});

test('desktop savings reminder and challenge celebration use the new popups and sounds', () => {
  const finance = journal.slice(journal.indexOf('export function FinanceReminderModal('));
  const lifecycle = readFileSync(new URL('./ChallengeLifecyclePage.jsx', import.meta.url), 'utf8');
  const popups = readFileSync(new URL('./desktopPopups.css', import.meta.url), 'utf8');
  const savings = readFileSync(new URL('./SavingsReminderPopup.jsx', import.meta.url), 'utf8');
  assert.match(finance, /const \[desk\] = useState\(\(\) => SHELL_V2 && !window\.matchMedia\(MOBILE_MEDIA\)\.matches\);/);
  assert.match(finance, /if \(desk\) \{[\s\S]*?return <SavingsReminderPopup /);
  assert.match(savings, /playSynthSound\(sound, 'savings'\)/);
  assert.match(lifecycle, /<DesktopChallengeCard \{\.\.\.viewProps\}[^>]*\/>\{celebrating&&<ChallengeCompletePopup facts=\{celebrationFacts\(\)\}/);
  assert.match(journal, /<TraderNameContext\.Provider value=\{displayName\}><ChallengePage /);
  assert.doesNotMatch(popups, /#[0-9a-f]{3,8}\b|rgba?\(|:\s*(?:white|black)\b/i);
  assert.doesNotMatch(popups, /font-size:(?:[0-9]|1[01])(?:\.\d+)?px/);
});

test('desktop trade review opens in the side panel and saves through the same form', () => {
  const review = journal.slice(journal.indexOf('function TradeReviewEditorModal('), journal.indexOf('const PERIOD_REVIEW_FIELDS'));
  const css = readFileSync(new URL('./desktopTradeReview.css', import.meta.url), 'utf8');
  const fields = readFileSync(new URL('./writingFields.css', import.meta.url), 'utf8');
  assert.match(review, /const \[deskReview\] = useState\(\(\) => SHELL_V2 && !window\.matchMedia\(MOBILE_MEDIA\)\.matches\);/);
  assert.match(review, /<Modal entryPanel entryPanelOpen=\{reviewPanelOpen\} entryPanelPosition=\{panelPrefs\.position\} entryPanelBehavior=\{panelPrefs\.behavior\}[^>]*entryPanelWidth=\{720\}/);
  assert.match(review, /disabled=\{savingReview\} onClick=\{save\}>\{savingReview \? "Saving…" : "Save review"\}/);
  assert.match(review, /executionScore: saved\?\.executionScore \|\| 0/);
  assert.match(review, /aria-label=\{`\$\{label\} score`\}/);
  assert.match(review, /\[1,2,3,4,5\]\.map/);
  assert.match(review, /Score each area from 1 to 5, then add a short note\./);
  assert.match(review, /const assessmentAverage = scoredAreas\.length/);
  assert.match(css, /\.tr2-average \{/);
  assert.match(journal, /<PanelPrefsContext\.Provider value=\{panelPrefs\}>/);
  assert.match(css, /^@media \(min-width:768px\) \{/m);
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgba?\(/i);
  assert.doesNotMatch(css, /font-size:(?:[0-9]|1[01])(?:\.\d+)?px/);
  assert.equal((fields.match(/:not\(\.tr2 textarea\)/g) || []).length, 3);
});

test('desktop simulated trades use the same side-panel composer as live trades', () => {
  assert.doesNotMatch(journal, /if \(embedded \|\| \(backtest && !phone\)\) return/);
  assert.match(journal, /if \(embedded\) return desk \? deskContent : content;/);
  assert.match(journal, /entryPanel=\{!phone\} entryPanelWidth=\{backtest \? 880 : undefined\}/);
  assert.match(journal, /tj-simulated-trade-panel[\s\S]*?\}>\{desk \? deskContent : content\}<\/Modal>/);
  assert.match(journal, /tj-simulated-trade-panel/);
  assert.match(journal, /Simulated · Fields marked \* are required/);
});
