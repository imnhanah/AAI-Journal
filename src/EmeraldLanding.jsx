import React, { useState } from 'react';
import { BarChart3, BookOpen, Bookmark, Check, ClipboardCheck, Brain, FlaskConical, Landmark, ShieldCheck, MonitorSmartphone, Newspaper } from 'lucide-react';
import { translate } from './localization';
import './emerald-landing.css';

const views = [
  ['dashboard', 'Dashboard', 'Your performance, in perspective.', 'Bring your calendar, recent trades, equity curve, and core metrics together. See the bigger picture without losing sight of the details.'],
  ['trades', 'Trade Logs', 'The execution and the decisions behind it.', 'Log prices, risk, commission, and screenshots in Execution. Use Process to check your rules, record confluences and mistakes, and leave notes for your next review.'],
  ['markups', 'Markups', 'Save the setup before you take the trade.', 'Keep your setup and analysis together, with the date, time, session, and chart screenshots. Link a trade to its markup to compare what you planned with what you did.'],
  ['review', 'Review', 'Turn your history into learning.', 'Review individual trades, then step back for monthly, quarterly, and yearly reflections. Keep the lessons alongside the numbers.'],
  ['finance', 'Finance', 'Keep the balance plan visible.', 'Finance separates cash movements from trading performance.'],
  ['analytics', 'Analytics', 'Analytics with the full context.', 'Explore equity growth, results by instrument, and the entry models behind your performance. Find patterns in your own trading history.'],
  ['routine', 'Routine', 'Prepare before the first trade.', 'A daily checklist for a more intentional session.'],
  ['backtest', 'Backtest', 'Practice without changing your live results.', 'Create a separate test account with its own starting balance and risk per trade. Log simulated trades and follow the equity curve as the test develops.'],
  ['psychology', 'Psychology', 'Make room for your mindset.', 'Record emotional states and mistakes alongside your trades. Look for patterns in behavior and build a more deliberate trading routine.'],
  ['news', 'News', 'Know the high-impact windows.', 'Use the calendar to identify high-impact releases and bank holidays before choosing a session or placing risk.'],
];

export default function EmeraldLanding({ user, navigate, scrollToSection, renderImage, Brand, faqs }) {
  const [active, setActive] = useState('dashboard');
  const selected = views.find(([id]) => id === active);
  const start = () => user ? window.location.assign('/dashboard') : navigate('/signup');
  const tabKey = (event, index) => {
    let next;
    if (event.key === 'ArrowRight') next = (index + 1) % views.length;
    if (event.key === 'ArrowLeft') next = (index + views.length - 1) % views.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = views.length - 1;
    if (next == null) return;
    event.preventDefault();
    setActive(views[next][0]);
    event.currentTarget.parentElement.querySelectorAll('[role="tab"]')[next].focus();
  };
  return <>
    <main id="pub-elm-top" className="emerald-landing">
      <section className="elm-hero pub-container" aria-labelledby="pub-elm-hero-title">
        <span className="pub-eyebrow"><span className="elm-live-dot" aria-hidden="true"/>AAICOREFX TRADING JOURNAL</span>
        <h1 id="pub-elm-hero-title">Less noise.<br/><span>More progress.</span></h1>
        <p>From the first idea to the final review, keep every part of your trading process connected.</p>
        <div className="elm-actions"><button className="elm-primary" onClick={start}>{user ? 'Go to Dashboard' : 'Get Started Free'}</button><button className="elm-secondary" onClick={() => scrollToSection('features')}>See what’s inside</button></div>
        <div className="elm-assurance"><span><Check size={15}/>Free to get started</span><span><MonitorSmartphone size={16}/>Desktop and mobile web</span><span><Check size={15}/>Light and dark themes</span></div>
        <figure className="elm-hero-product">{renderImage('dashboard', 'Dashboard', true)}<figcaption><span>THE COMPLETE PICTURE</span><span>Demo workspace · sample data</span></figcaption></figure>
      </section>
      <section className="elm-principles" aria-label="Journal workflow"><div className="pub-container">{[[BookOpen,'Connected journal'],[Bookmark,'Markups'],[BarChart3,'Performance metrics'],[ClipboardCheck,'Daily routine']].map(([Icon,label]) => <div key={label}><Icon size={21}/><span>{translate(label)}</span></div>)}</div></section>

      <section id="features" className="elm-showcase pub-container" aria-labelledby="pub-elm-features-title">
        <div className="elm-section-heading"><div><span className="pub-eyebrow">ONE CONNECTED WORKSPACE</span><h2 id="pub-elm-features-title">Your journal and analytics.<br/><span>Working together.</span></h2></div><p>Prepare your charts, log your trades, test your setups, and review the results. Your accounts and trading notes stay together.</p></div>
        <div className="elm-workspace-tabs" role="tablist" aria-label="Journal screenshots">{views.map(([id,label],index) => <button key={id} id={`pub-elm-tab-${id}`} role="tab" aria-selected={id === active} aria-controls="pub-elm-product-panel" tabIndex={id === active ? 0 : -1} onKeyDown={event => tabKey(event,index)} onClick={() => setActive(id)}>{translate(label)}</button>)}</div>
        <section id="pub-elm-product-panel" role="tabpanel" aria-labelledby={`pub-elm-tab-${active}`} className="elm-product-panel"><header><h3>{translate(selected[2])}</h3><span>Demo workspace · sample data</span></header>{renderImage(active, selected[1])}<p>{translate(selected[3])}</p></section>
      </section>

      <section className="elm-toolkit pub-container" aria-labelledby="pub-elm-toolkit-title"><div className="elm-section-heading"><div><span className="pub-eyebrow">BUILT AROUND YOUR PROCESS</span><h2 id="pub-elm-toolkit-title">More than a record.<br/>A repeatable process.</h2></div><p>Record the decision, not just the outcome.</p></div><div className="elm-bento">
        <article className="elm-bento-lead"><span className="elm-icon"><BookOpen size={22}/></span><span className="pub-eyebrow">TRADE LOG</span><h3>The execution and the decisions behind it.</h3><p>Log prices, risk, commission, and screenshots in Execution. Use Process to check your rules, record confluences and mistakes, and leave notes for your next review.</p><div className="elm-detail-lines"><span><Check size={16}/>Rule evaluation alongside each trade</span><span><Check size={16}/>Sessions determined from entry time</span><span><Check size={16}/>Account, instrument, session, and result filters</span></div><button className="elm-text-link" onClick={() => {setActive('trades');scrollToSection('features');}}>Trade Logs</button></article>
        <article><span className="elm-icon"><Bookmark size={22}/></span><span className="pub-eyebrow">MARKUPS</span><h3>Save the setup before you take the trade.</h3><p>Keep your setup and analysis together, with the date, time, session, and chart screenshots.</p><button className="elm-text-link" onClick={() => {setActive('markups');scrollToSection('features');}}>Markups</button></article>
        <article><span className="elm-icon"><ClipboardCheck size={22}/></span><span className="pub-eyebrow">DAILY ROUTINE</span><h3>Prepare before the first trade.</h3><p>A daily checklist for a more intentional session.</p><div className="elm-routine-example" aria-label="Daily routine"><span><Check size={15}/>Read the news</span><span><Check size={15}/>Checked my accounts</span><span><span className="elm-open-circle" aria-hidden="true"/>Looked at the chart</span></div><button className="elm-text-link" onClick={() => {setActive('routine');scrollToSection('features');}}>Daily routine</button></article>
        <article><span className="elm-icon"><Landmark size={22}/></span><span className="pub-eyebrow">FINANCE</span><h3>Capital, without distorting P&amp;L.</h3><p>Track cash movements and savings without mixing them into your trading statistics.</p><button className="elm-text-link" onClick={() => {setActive('finance');scrollToSection('features');}}>Finance</button></article>
        <article><span className="elm-icon"><FlaskConical size={22}/></span><span className="pub-eyebrow">BACKTESTING</span><h3>Practice without changing your live results.</h3><p>Create a separate test account with its own starting balance and risk per trade. Log simulated trades and follow the equity curve as the test develops.</p><button className="elm-text-link" onClick={() => {setActive('backtest');scrollToSection('features');}}>Backtest</button></article>
        <article><span className="elm-icon"><Brain size={22}/></span><span className="pub-eyebrow">Psychology</span><h3>Make room for your mindset.</h3><p>Record emotional states and mistakes alongside your trades. Look for patterns in behavior and build a more deliberate trading routine.</p><button className="elm-text-link" onClick={() => {setActive('psychology');scrollToSection('features');}}>Psychology</button></article>
        <article className="elm-news-feature"><span className="elm-icon"><Newspaper size={22}/></span><span className="pub-eyebrow">News</span><h3>Know the high-impact windows.</h3><p>Use the calendar to identify high-impact releases and bank holidays before choosing a session or placing risk.</p><button className="elm-text-link" onClick={() => {setActive('news');scrollToSection('features');}}>News</button></article>
      </div></section>

      <section id="how-it-helps" className="elm-workflow"><div className="pub-container"><span className="pub-eyebrow">A REPEATABLE PROCESS</span><h2>Prepare. Execute. Reflect.</h2><div className="elm-steps">{[
        ['01',ClipboardCheck,'Prepare your charts.','Keep your setup and analysis together, with the date, time, session, and chart screenshots.'],
        ['02',BookOpen,'Make Every Trade Count','Record the decision, not just the outcome.'],
        ['03',Brain,'Turn Reflection into Progress','Every honest review is a step toward a stronger process.'],
      ].map(([number,Icon,title,body]) => <article key={number}><div><span>{number}</span><Icon size={20}/></div><h3>{translate(title)}</h3><p>{translate(body)}</p></article>)}</div></div></section>

      <section className="elm-review-story pub-container"><div><span className="pub-eyebrow">Make reflection a routine.</span><h2>Turn your history into learning.</h2><p>Review individual trades, then step back for monthly, quarterly, and yearly reflections. Keep the lessons alongside the numbers.</p><div className="elm-detail-lines"><span><ShieldCheck size={17}/>Monthly and quarterly reviews</span><span><BarChart3 size={17}/>A full-year perspective</span></div></div>{renderImage('review','Review')}</section>

      <section id="faq" className="elm-faq pub-container"><div className="elm-section-heading"><div><span className="pub-eyebrow">A LITTLE MORE CLARITY</span><h2>Frequently asked questions</h2></div><p>Get to know your journal before you begin.</p></div><div className="pub-faq-list">{faqs.slice(0,6).map(([question,answer]) => <details key={question}><summary>{translate(question)}</summary><p>{translate(answer)}</p></details>)}</div></section>
      <section className="elm-closing"><div className="pub-container"><span className="pub-eyebrow">BUILT AROUND YOUR PROCESS</span><h2>A clearer journal.<br/><span>A more intentional trader.</span></h2><p>Your trades. Your process. Your perspective.</p><button className="elm-primary" onClick={start}>{user ? 'Go to Dashboard' : 'Get Started Free'}</button></div></section>
    </main>
    <footer className="pub-footer pub-container elm-footer"><div><a href="/" aria-label="Reload AAICOREFX landing page"><Brand/></a><p>Your trades. Your process. Your perspective.</p></div><nav aria-label="Footer navigation"><button onClick={() => scrollToSection('features')}>Features</button><button onClick={() => navigate('/pricing')}>Pricing</button><button onClick={() => scrollToSection('faq')}>FAQ</button><button onClick={() => scrollToSection('pub-elm-top')}>Back to top</button></nav><small>© {new Date().getFullYear()} AAICOREFX. <span>Trading involves risk. A journal does not guarantee results.</span></small></footer>
  </>;
}
