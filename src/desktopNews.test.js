import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const journal = readFileSync(new URL('./TradingJournal.jsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('./desktopNews.css', import.meta.url), 'utf8');

test('desktop News shows v2 after the phone branch and keeps the live alert controls', () => {
  assert.match(journal, /const NEWS_V2 = true;/);
  assert.match(journal, /import '\.\/desktopNews\.css';/);
  assert.ok(journal.indexOf('return <MobileNews ') < journal.indexOf('if (NEWS_V2) {'));
  assert.match(journal, /<div className="nw2-nx"><NewsAlertControls\/><\/div>/);
});

test('News v2 filters by search, the saved filters, categories and the holiday switch', () => {
  assert.match(journal, /const \[showHolidays, setShowHolidays\] = usePageState\('news', 'tj-nav-showHolidays', true\);/);
  assert.match(journal, /const showEvent = \(event\) => \(event\.impact === "holiday" \? showHolidays : matchesNewsFilters\(event, filters\) && newsCategories\.includes\(newsEventCategory\(event\)\)\) && matchesQuery\(event\);/);
  assert.match(journal, /\{open && <div className="nw2-dt"><NewsEventDropdown event=\{event\}/);
});

test('News v2 hides the duplicate banner, lets the alert menu overflow and reflows by page width', () => {
  assert.match(css, /\.tj-page-transition:has\(\.nw2\)>\.tj-signal-page-news \{display:none;\}/);
  assert.match(css, /\.nw2-hero \{z-index:6;display:grid;[^}]*overflow:visible;/);
  assert.match(css, /@container journal-workspace \(max-width:1000px\) \{\n\s*\.tj-root \.nw2 \.nw2-grid \{grid-template-columns:minmax\(0,1fr\);\}/);
});

const alerts = readFileSync(new URL('./NewsAlerts.jsx', import.meta.url), 'utf8');
const sounds = readFileSync(new URL('./alertSounds.js', import.meta.url), 'utf8');
const model = readFileSync(new URL('./newsAlertModel.js', import.meta.url), 'utf8');

test('desktop alert panel offers 5/15/30/60 minutes, two deliveries and four tones', () => {
  assert.match(model, /export const NEWS_ALERT_DESKTOP_MINUTES = \[5,15,30,60\];/);
  assert.match(model, /export const NEWS_ALERT_MINUTES = \[1,5,10,15,30\];/); // phone sheet unchanged
  assert.match(model, /export const NEWS_ALERT_TONES = \["app","soft","chime","pulse"\];/);
  assert.match(alerts, /\{open && !phone && <NewsAlertPanel alert=\{alert\} onClose=\{\(\)=>setOpen\(false\)\}\/>\}/);
  assert.match(alerts, /<b>In-app banner<\/b>/);
  assert.match(alerts, /<b>Browser notification<\/b>/);
});

test('alerts deliver by banner and/or browser notification and play the chosen tone', () => {
  assert.match(alerts, /if\(!inApp && !browser\)return;\n\s*const played=sound \? await playAlertTone\(tone\) : false;/);
  assert.match(alerts, /if\(permission!=="granted"\)\{setMessage\("Browser notifications are blocked/);
  assert.match(sounds, /export async function playAlertTone\(tone='app'\)\{\n\s*if\(!ALERT_TONE_NOTES\[tone\]\)return playAlertSound\('news'\);/);
});

test('desktop alert banner follows the mockup; phones keep their banner', () => {
  assert.match(alerts, /\{banner && phone && <aside className="tj-news-notifications"/);
  assert.match(alerts, /\{banner && !phone && <aside className="na2-toasts"/);
  assert.match(alerts, /<button type="button" onClick=\{\(\)=>viewEvent\(index\)\} disabled=\{!event\.isoDate\}>View event<\/button><button type="button" onClick=\{\(\)=>snoozeAlert\(index\)\}>Snooze 5 min<\/button>/);
  assert.match(alerts, /snoozeTimers\.current\.push\(setTimeout\(/);
  assert.match(journal, /<NewsAlertsProvider activePage=\{page\} onViewEvent=\{\(\) => setPage\("news"\)\} userId=\{user\.id\}>/);
  assert.match(journal, /const \[focusRequest, setFocusRequest\] = useState\(\(\) => \{ try \{ return JSON\.parse\(window\.sessionStorage\.getItem\(NEWS_FOCUS_EVENT_KEY\)/);
});
