import React, { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, BarChart3, CalendarDays, BookOpen, ShieldCheck, Sun, Moon, X, Maximize2, ArrowUp, ChevronDown, Landmark, Upload, RefreshCw } from 'lucide-react';
import AuthPage from './AuthPage';
import './public-site.css';
import LandingGallery from './LandingGallery';
import PricingDialog from './PricingDialog';
import { useSiteTheme } from './siteTheme';
import LanguageSelector from './LanguageSelector';
import { translate } from './localization';
import { LANDING_SCREENSHOTS, landingScreenshotUrl } from './landingScreenshots';
import { FinancialDisclaimerDialog } from './FinancialDisclaimer.jsx';

const features = [
  ['dashboard', 'Your performance, in perspective.', 'A clear view of every trading day.', 'Bring your calendar, recent trades, equity curve, and core metrics together. See the bigger picture without losing sight of the details.', ['Daily P&L calendar', 'Performance flow', 'Equity and consistency']],
  ['trades', 'TRADE LOG', 'The execution and the decisions behind it.', 'Log prices, risk, commission, and screenshots in Execution. Use Process to check your rules, record confluences and mistakes, and leave notes for your next review.', ['Rule evaluation alongside each trade', 'Sessions determined from entry time', 'Account, instrument, session, and result filters']],
  ['markups', 'MARKUPS', 'Save the setup before you take the trade.', 'Keep your setup and analysis together, with the date, time, session, and chart screenshots. Link a trade to its markup to compare what you planned with what you did.', ['Setup and analysis in one form', 'Year, month, and week filters', 'Linked plans, results, and capture coverage']],
  ['reviews', 'Make reflection a routine.', 'Turn your history into learning.', 'Review individual trades, then step back for monthly, quarterly, and yearly reflections. Keep the lessons alongside the numbers.', ['Trade-by-trade reflection', 'Monthly and quarterly reviews', 'A full-year perspective']],
  ['analytics', 'Understand your edge.', 'Analytics with the full context.', 'Explore equity growth, results by instrument, and the entry models behind your performance. Find patterns in your own trading history.', ['Equity growth', 'Entry model breakdowns', 'Instrument performance']],
];
features.push(
  ['guardrails', 'Give your goals boundaries.', 'Stay aware of your limits.', 'Keep monthly and yearly goals alongside daily and monthly loss limits. See your remaining buffer before your next decision.', ['Goal progress', 'Daily loss buffer', 'Monthly loss limits']],
);
const faqs = [
  ['Does backtesting change my live journal?', 'No. Backtest accounts and their simulated trades are separate from live accounts. You can review the simulated balance, equity curve, profit factor, win rate, and trade outcomes without changing your live journal.'],
  ['Can I change the language and appearance?', 'Yes. Profile settings includes Personalization for language, timezone, date and time formats, theme, and accent colors. English is the default, with 13 other languages including Arabic. Manual journal sync is in Security.'],
  ['Which instruments can I journal?', 'AAICOREFX starts with widely traded forex pairs, gold, silver, selected US indices, Bitcoin, and Ethereum. You can also manage the instrument list in the journal settings, so your trade form stays focused on the markets you actually trade. Each trade remains searchable and analysable by instrument, helping you compare results across pairs, indices, metals, and crypto without mixing them together.'],
  ['How is net P&L calculated?', 'Net P&L is the completed trade result after costs: gross P&L minus commission and swap. You can enter those values manually for every trade, or use account defaults where appropriate. The journal uses net P&L for performance totals, win rate, account balance, and analytics, while gross return and costs remain visible in the expanded trade record so you can see exactly where the final number came from.'],
  ['Can I keep separate trading accounts?', 'Yes. Create separate workspaces for prop-firm challenges, personal accounts, broker accounts, or different strategies, then switch from the account center. Every workspace keeps its own trades, starting balance, currency, rules, risk defaults, goals, loss limits, challenge settings, and analytics. This keeps one account’s performance and guardrails from changing another account’s journal.'],
  ['Can I import trades from my broker?', 'Yes. You can create an import account or add history through Account Settings. The journal supports MetaTrader 4/5 HTML reports and cTrader HTML or CSV statements, then maps completed BUY and SELL trades into the same journal used for manual entries. Re-importing the same report is protected against duplicate trades, and imports remain separate from your manually recorded notes, screenshots, markups, and reviews.'],
  ['How does Finance work?', 'Finance separates cash movements from trading performance. Deposits, withdrawals, and transfers to savings can update the live capital available to trade, while net trading P&L continues to measure the result of executed trades only. This makes it easier to understand whether account growth came from trading, new funding, or cash management—and lets goals and loss caps use the correct live balance.'],
  ['Can I attach charts and review my trades?', 'Yes. Add screenshots to both premarket markups and completed trades, then link the execution back to the original plan. Trade reviews let you record what went well, what failed, execution quality, psychology, lessons, and next actions. Monthly, quarterly, and annual reviews then bring those trade-level notes together with the underlying P&L, win rate, sessions, and setup performance.'],
];
const LEGACY_LANDING_PATH = `/${['l', 'a', 'n', 'd', 'i', 'n', 'g'].join('')}`;
const productShowcase = ['dashboard', 'trades', 'analytics', 'review', 'backtest'];
const productFeatureScreens = Object.freeze({
  dashboard: 'dashboard',
  trades: 'trades',
  markups: 'markups',
  reviews: 'review',
  analytics: 'analytics',
  guardrails: 'guardrails',
});

function PlatformLogo({ platform }) {
  if (platform === 'ctrader') return <svg className="pub-platform-logo pub-platform-logo-ctrader" viewBox="0 0 40 40" role="img" aria-label="cTrader"><circle cx="20" cy="20" r="19" fill="var(--pub-platform-red)"/><path d="M28.5 13.8a10.3 10.3 0 1 0 0 12.4l-4.3-3.1a5 5 0 1 1 0-6.2z" fill="var(--pub-platform-mark)"/></svg>;
  const version = platform === 'mt4' ? '4' : '5';
  return <svg className="pub-platform-logo" viewBox="0 0 40 40" role="img" aria-label={`MetaTrader ${version}`}><circle cx="20" cy="11" r="8.5" fill="var(--pub-platform-green)"/><circle cx="11.6" cy="25.4" r="8.5" fill="var(--pub-platform-blue)"/><circle cx="28.4" cy="25.4" r="8.5" fill="var(--pub-platform-gold)"/><path d="M20 14.6 14.8 23m10.4 0L20 14.6M16.4 25.4h7.2" fill="none" stroke="var(--pub-platform-mark)" strokeWidth="2.7" strokeLinecap="round"/><text x="20" y="29.2" textAnchor="middle" fill="var(--pub-platform-mark)" fontSize="9" fontWeight="800">{version}</text></svg>;
}

export function Brand() { return <span className="pub-brand"><span className="pub-brand-mark"><img className="pub-logo-dark" src="/brand/logo-dark.png" width="48" height="48" alt=""/><img className="pub-logo-light" src="/brand/logo-light.png" width="48" height="48" alt=""/></span>AAICOREFX</span>; }

export default function PublicSite({ onAuthed, user }) {
  const [path, setPath] = useState(window.location.pathname);
  const [theme, setTheme] = useSiteTheme();
  const light = theme === 'light';
  const [preview, setPreview] = useState(null);
  const [financialDisclaimerOpen, setFinancialDisclaimerOpen] = useState(false);
  const dialog = useRef(null);
  const site = useRef(null);
  useEffect(() => {
    if (window.location.pathname !== LEGACY_LANDING_PATH) return;
    window.history.replaceState({}, '', '/');
    setPath('/');
  }, []);
  useEffect(() => {
    const root = site.current;
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!root || !('IntersectionObserver' in window)) return;
    const elements = [...root.querySelectorAll('.pub-section-heading, .pub-overview > .pub-gallery, .pub-benefits article, .pub-integrations .pub-integration-grid, .pub-feature-copy, .pub-feature > .pub-screen, .pub-feature > .pub-gallery, .pub-faq-list')];
    const reveal = element => { element.classList.remove('pub-reveal-pending'); observer.unobserve(element); };
    const observer = new IntersectionObserver(entries => entries.forEach(entry => { if (entry.isIntersecting) reveal(entry.target); }), { threshold: 0.08 });
    if (!preference.matches) elements.forEach(element => { element.classList.add('pub-reveal', 'pub-reveal-pending'); observer.observe(element); });
    const onFocus = event => { const target = event.target.closest('.pub-reveal'); if (target) reveal(target); };
    const onPreference = () => { if (preference.matches) elements.forEach(reveal); };
    root.addEventListener('focusin', onFocus);
    preference.addEventListener('change', onPreference);
    return () => { observer.disconnect(); elements.forEach(element => element.classList.remove('pub-reveal', 'pub-reveal-pending')); root.removeEventListener('focusin', onFocus); preference.removeEventListener('change', onPreference); };
  }, [path]);
  useEffect(() => { const sync = () => setPath(window.location.pathname); window.addEventListener('popstate', sync); return () => window.removeEventListener('popstate', sync); }, []);
  useEffect(() => { if (preview) dialog.current?.showModal(); }, [preview]);
  const navigate = (next) => { window.history.pushState({}, '', next); setPath(next); window.scrollTo(0, 0); };
  const scrollToSection = (id) => {
    const scroll = () => document.getElementById(id)?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    if (path === '/') return scroll();
    navigate('/');
    window.requestAnimationFrame(scroll);
  };
  const authMode = path === '/signup' ? 'signup' : path === '/login' ? 'login' : null;
  const pricingRoute = path === '/pricing';
  const moveImage = event => {
    if (event.pointerType !== 'mouse' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const element = event.currentTarget;
    const rect = element.getBoundingClientRect();
    element.style.setProperty('--image-x', `${((event.clientX - rect.left) / rect.width - .5) * 8}px`);
    element.style.setProperty('--image-y', `${((event.clientY - rect.top) / rect.height - .5) * 8}px`);
  };
  const screenButton = (src, title, eager = false, width = 1920, height = 1080) => <button className="pub-screen" onPointerMove={moveImage} onPointerLeave={event => { event.currentTarget.style.removeProperty('--image-x'); event.currentTarget.style.removeProperty('--image-y'); }} onClick={() => setPreview({ src, title })} aria-label={`Enlarge ${title}`}><img src={src} alt={title} width={width} height={height} loading={eager ? 'eager' : 'lazy'} decoding="async"/><span className="pub-enlarge"><Maximize2 size={16}/> Enlarge</span></button>;
  const productScreenshotButton = (id, title, eager = false) => {
    const { width, height } = LANDING_SCREENSHOTS[id];
    return screenButton(landingScreenshotUrl(id, theme), title, eager, width, height);
  };
  return <div ref={site} className={`public-site ${light ? 'public-light' : ''}`}>
    <header className="pub-header"><a href="/" aria-label="Reload AAICOREFX landing page"><Brand/></a><nav aria-label="Main navigation"><button onClick={() => scrollToSection('features')}>Features</button><button onClick={() => navigate('/pricing')}>Pricing</button>{user ? <a className="pub-signup" href="/dashboard">Go to Dashboard <ArrowUpRight size={16}/></a> : <><button onClick={() => navigate('/login')}>Sign In</button><button className="pub-signup" onClick={() => navigate('/signup')}>Sign Up</button></>}<LanguageSelector publicSite/><button className="pub-theme" aria-label={light ? 'Switch to dark theme' : 'Switch to light theme'} onClick={() => setTheme(light ? 'dark' : 'light')}>{light ? <Moon size={18}/> : <Sun size={18}/>}</button></nav></header>
    {pricingRoute && <PricingDialog hasActiveFreePlan={!!user} onClose={() => navigate('/')} onSignup={() => { if (user) window.location.assign('/dashboard'); else navigate('/signup'); }}/>} 
    {authMode ? <AuthPage key={authMode} initialMode={authMode} onModeChange={(mode) => navigate(mode === 'signup' ? '/signup' : '/login')} onBack={() => navigate('/')} onAuthed={onAuthed}/> : <>
      <main id="top">
        <section className="pub-hero"><span className="pub-eyebrow">AAICOREFX TRADING JOURNAL</span><h1>Keep a record.<br/><span>Know what happened.</span></h1><p>Prepare your charts, log your trades, test your setups, and review the results. Your accounts and trading notes stay together.</p><a className="pub-explore" href="#features">See what’s inside <ArrowUpRight size={17}/></a></section>
        <section id="features" className="pub-overview pub-container"><div className="pub-showcase-intro"><div><span className="pub-eyebrow">THE COMPLETE PICTURE</span><h2>Professional trading journal &amp; <span>analytics.</span></h2></div><p>Track every trade, spot what’s working, and build consistency — with professional analytics, journaling, and performance tools. <strong>Free to get started</strong></p></div><LandingGallery showcase files={productShowcase} title="Journal and analytics" renderImage={productScreenshotButton}/><div className="pub-benefits">{[[BarChart3, 'Performance metrics', 'Follow net P&L, win rate, and your equity curve.'], [BookOpen, 'Connected journal', 'Keep trades, markups, and reviews together.'], [CalendarDays, 'Visual calendar', 'See winning, losing, and breakeven days.'], [ShieldCheck, 'Risk awareness', 'Track your goals and account guardrails.']].map(([Icon, title, body]) => <article key={title}><span><Icon size={21}/></span><h3>{title}</h3><p>{body}</p></article>)}</div></section>
        <section id="integrations" className="pub-integrations pub-container"><div className="pub-section-heading"><span className="pub-eyebrow">IMPORTS &amp; FINANCE</span><h2>Bring in your history.<br/><span>Keep your capital clear.</span></h2><p>Import broker statements into the same journal you use for manual trades, then keep capital movements separate from trading performance.</p></div><div className="pub-integration-grid"><article className="pub-finance-card"><span className="pub-integration-icon"><Landmark size={22}/></span><div><small>FINANCE WORKSPACE</small><h3>Capital, without distorting P&amp;L.</h3><p>Record deposits, withdrawals, and savings transfers independently from your trade results. Imported deposits can establish your account base while net P&amp;L remains trade-only.</p></div><ul><li>Deposit and withdrawal ledger</li><li>Savings allocations from profit</li><li>Transfer reminders and cash history</li></ul></article><article className="pub-broker-card"><div className="pub-broker-card-head"><span className="pub-integration-icon"><Upload size={22}/></span><div><small>BROKER HISTORY IMPORT</small><h3>One journal, every execution.</h3></div></div><div className="pub-platform-list"><span><PlatformLogo platform="mt4"/><span><b>MT4</b><em>MetaTrader 4</em><i>HTML reports</i></span></span><span><PlatformLogo platform="mt5"/><span><b>MT5</b><em>MetaTrader 5</em><i>HTML reports</i></span></span><span><PlatformLogo platform="ctrader"/><span><b>cTrader</b><em>cTrader</em><i>HTML &amp; CSV</i></span></span></div><p><RefreshCw size={15}/> Closed positions import as normal journal trades. Re-uploading the same statement skips duplicates.</p></article></div></section>
        <div className="pub-container pub-features">{features.map(([id, eyebrow, title, body, bullets], i) => <section id={id} className={`pub-feature ${i % 2 ? 'pub-feature-reverse' : ''}`} key={id}><div className="pub-feature-copy"><span className="pub-eyebrow">{translate(eyebrow)}</span><h2>{translate(title)}</h2><p>{translate(body)}</p><ul>{bullets.map(text => <li key={text}>{translate(text)}</li>)}</ul></div>{productScreenshotButton(productFeatureScreens[id], title)}</section>)}</div>
        <section className="pub-container pub-product-updates" aria-labelledby="pub-updates-title">
          <div className="pub-section-heading"><span className="pub-eyebrow">ALSO IN YOUR JOURNAL</span><h2 id="pub-updates-title">Test a setup. Make the workspace yours.</h2></div>
          <div className="pub-updates-grid">
            <article id="backtesting"><span className="pub-eyebrow">BACKTESTING</span><h3>Practice without changing your live results.</h3><p>Create a separate test account with its own starting balance and risk per trade. Log simulated trades and follow the equity curve as the test develops.</p><dl><div><dt>Results</dt><dd>Profit factor, win rate, average R:R, and trade outcomes.</dd></div><div><dt>Trade history</dt><dd>Filter the log and review ten trades at a time.</dd></div><div><dt>Separate records</dt><dd>Simulated trades stay out of your live balance and journal.</dd></div></dl></article>
            <article id="personalization"><span className="pub-eyebrow">PROFILE SETTINGS</span><h3>Use the journal the way you read it.</h3><p>Choose your language, timezone, and date and time formats in Personalization. Keep the same workspace in a light or dark theme, with your choice of accent color.</p><dl><div><dt>Language</dt><dd>English and 13 other languages, including Arabic with right-to-left layout.</dd></div><div><dt>Appearance</dt><dd>Light, dark, or system theme with a quick left-to-right theme switch.</dd></div><div><dt>Security</dt><dd>Password settings and manual journal sync, together in one tab.</dd></div></dl></article>
          </div>
        </section>
        <section id="faq" className="pub-faq pub-container"><div className="pub-section-heading"><span className="pub-eyebrow">A LITTLE MORE CLARITY</span><h2>Frequently asked questions</h2><p>Get to know your journal before you begin.</p></div><div className="pub-faq-list">{faqs.map(([q, a]) => <details key={q}><summary>{translate(q)}<ChevronDown aria-hidden="true" size={20}/></summary><p>{translate(a)}</p></details>)}</div></section>
      </main>
      <footer className="pub-footer pub-container"><div><a href="/" aria-label="Reload AAICOREFX landing page"><Brand/></a><p>Your trades. Your process. Your perspective.</p></div><nav aria-label="Footer navigation"><button onClick={() => scrollToSection('features')}>Features</button><button onClick={() => scrollToSection('integrations')}>Integrations</button><button onClick={() => scrollToSection('faq')}>FAQ</button><button onClick={() => setFinancialDisclaimerOpen(true)}>Financial Disclaimer</button>{user ? <a href="/dashboard">Go to Dashboard</a> : <button onClick={() => navigate('/login')}>Sign In</button>}<button onClick={() => scrollToSection(['t', 'o', 'p'].join(''))}>Back to top <ArrowUp size={14}/></button></nav><small>© {new Date().getFullYear()} AAICOREFX.</small></footer>
      {financialDisclaimerOpen && <FinancialDisclaimerDialog onClose={() => setFinancialDisclaimerOpen(false)}/>} 
      <dialog ref={dialog} className="pub-lightbox" aria-label={preview?.title || 'Journal screenshot'} onCancel={() => setPreview(null)} onClick={(e) => { if (e.target === e.currentTarget) { dialog.current.close(); setPreview(null); } }}>{preview && <><button className="pub-close" autoFocus aria-label="Close screenshot" onClick={() => { dialog.current.close(); setPreview(null); }}><X/></button><img src={preview.src} alt={preview.title}/></>}</dialog>
    </>}
  </div>;
}
