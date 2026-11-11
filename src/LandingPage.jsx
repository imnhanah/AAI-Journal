import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Check, ChevronDown, Menu, Minus, Plus, Search, X } from 'lucide-react';
import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import './landing.css';
import LanguageSelector, { useLanguage } from './LanguageSelector';
import { translate } from './localization';
import {
  ALSO_INSIDE, BREAKDOWNS, CHALLENGE, FAQS, IMPORT_FACTS, PLATFORMS, SAMPLE_END, SAMPLE_START, STATUS_LABEL, STEPS, STUDIES, TRADE_RECORD,
  challengeLevels, equityCurve, money, sampleCandles, signed,
} from './landingSample';

const t = translate;
const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Counts the hero balance up once, after the entrance animation has started. */
function useCountUp(from, to, delay = 600, duration = 1600) {
  const [value, setValue] = useState(() => (reducedMotion() ? to : from));
  useEffect(() => {
    if (reducedMotion()) { setValue(to); return undefined; }
    let frame = 0;
    const start = performance.now() + delay;
    const step = now => {
      const progress = Math.max(0, Math.min(1, (now - start) / duration));
      setValue(from + (to - from) * (1 - (1 - progress) ** 3));
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [from, to, delay, duration]);
  return value;
}

/** Sections rise into view once. Without IntersectionObserver nothing is hidden. */
function useReveal(root) {
  useEffect(() => {
    const node = root.current;
    if (!node || reducedMotion() || !('IntersectionObserver' in window)) return undefined;
    const elements = [...node.querySelectorAll('[data-reveal]')];
    const show = element => { element.classList.remove('lp-reveal-pending'); observer.unobserve(element); };
    const observer = new IntersectionObserver(entries => entries.forEach(entry => { if (entry.isIntersecting) show(entry.target); }), { threshold: 0.08 });
    elements.forEach(element => { element.classList.add('lp-reveal', 'lp-reveal-pending'); observer.observe(element); });
    const onFocus = event => { const target = event.target.closest?.('.lp-reveal-pending'); if (target) show(target); };
    node.addEventListener('focusin', onFocus);
    return () => { observer.disconnect(); node.removeEventListener('focusin', onFocus); elements.forEach(element => element.classList.remove('lp-reveal', 'lp-reveal-pending')); };
  }, [root]);
}

function Segmented({ label, options, value, onChange, className = '' }) {
  return <div className={`lp-seg ${className}`} role="group" aria-label={t(label)}>
    {options.map(option => <button key={option.id} type="button" aria-pressed={value === option.id} onClick={() => onChange(option.id)}>{t(option.label)}</button>)}
  </div>;
}

function SectionHead({ eyebrow, title, body, tone = 'mint' }) {
  return <div className="lp-head" data-reveal>
    <div><span className={`lp-eyebrow lp-eyebrow-${tone}`}>{t(eyebrow)}</span><h2>{t(title)}</h2></div>
    {body && <p>{t(body)}</p>}
  </div>;
}

function CandleChart({ shape, label, caption }) {
  const chart = useMemo(() => sampleCandles(shape), [shape]);
  return <figure className="lp-chart">
    <div className="lp-chart-box" role="img" aria-label={t(caption)}>
      <span className="lp-chart-level" style={{ top: `${chart.levelTop}%` }}><em>{t(label)}</em></span>
      {chart.candles.map((candle, index) => <React.Fragment key={index}>
        <i className={candle.up ? 'lp-up' : 'lp-down'} style={{ left: `calc(${candle.center}% - 0.5px)`, top: `${candle.wickTop}%`, height: `${candle.wickHeight}%`, width: '1px' }}/>
        <i className={candle.up ? 'lp-up' : 'lp-down'} style={{ left: `${candle.center - 0.75}%`, top: `${candle.bodyTop}%`, height: `${candle.bodyHeight}%`, width: '1.5%' }}/>
      </React.Fragment>)}
    </div>
    <figcaption>{t(caption)}</figcaption>
  </figure>;
}

function Analytics() {
  const [by, setBy] = useState('model');
  const curve = useMemo(equityCurve, []);
  const balance = useCountUp(SAMPLE_START, SAMPLE_END);
  const group = BREAKDOWNS.find(item => item.id === by);
  const largest = Math.max(...group.rows.map(row => Math.abs(row[3])));
  return <div className="lp-glass lp-analytics" data-product="analytics">
    <div className="lp-panel-top"><span className="lp-eyebrow lp-eyebrow-mint">{t('ACTIONABLE ANALYTICS')}</span><span className="lp-note">{t('Sample account, August to October 2026')}</span></div>
    <div className="lp-analytics-grid">
      <div className="lp-equity">
        <span className="lp-label">{t('Live balance')}</span>
        <strong className="lp-balance">{money(balance)}</strong>
        <div className="lp-balance-meta"><span className="lp-chip lp-chip-mint">{signed(SAMPLE_END - SAMPLE_START)} · +12.80%</span><span className="lp-note">{t('Started at $10,000.00')}</span></div>
        <svg className="lp-equity-chart" viewBox="0 0 1000 240" preserveAspectRatio="none" role="img" aria-label={t('Equity curve rising from 10,000 to 11,280 dollars across 48 trades')}>
          <path className="lp-grid-line" d="M0,60 L1000,60 M0,130 L1000,130 M0,200 L1000,200"/>
          <path className="lp-equity-area" d={curve.area}/>
          <path className="lp-equity-line" d={curve.line}/>
        </svg>
        <div className="lp-tiles">
          <div className="lp-tile"><span>{t('Win rate')}</span><b>50%</b><small>{t('24 wins from 48')}</small></div>
          <div className="lp-tile"><span>{t('Profit factor')}</span><b>2.28</b><small>{t('Gross profit vs loss')}</small></div>
          <div className="lp-tile"><span>{t('Average RR')}</span><b>1.90</b><small>{t('Reward per unit risked')}</small></div>
          <div className="lp-tile"><span>{t('Max drawdown')}</span><b className="lp-bad">{signed(-curve.drawdown)}</b><small>{t('Peak to low')}</small></div>
        </div>
      </div>
      <div className="lp-inner lp-breakdown">
        <h3>{t('Break the results down by')}</h3>
        <Segmented label="Break down by" options={BREAKDOWNS} value={by} onChange={setBy}/>
        <div className="lp-rows lp-swap" key={by}>
          {group.rows.map(([name, trades, winRate, net]) => <div className="lp-row" key={name}>
            <div><span>{t(name)}</span><b className={net < 0 ? 'lp-bad' : 'lp-good'}>{signed(net)}</b></div>
            <div className="lp-bar"><i className={net < 0 ? 'lp-bar-bad' : 'lp-bar-good'} style={{ width: `${Math.max(4, (Math.abs(net) / largest) * 100)}%` }}/></div>
            <small>{trades} {t('trades')} · {winRate}% {t('win rate')}</small>
          </div>)}
        </div>
        <div className="lp-insight lp-swap" key={`${by}-insight`}>
          <p><span className="lp-tag lp-tag-mint">{t('WORKING')}</span>{t(group.working)}</p>
          <p><span className="lp-tag lp-tag-amber">{t('ATTENTION')}</span>{t(group.attention)}</p>
        </div>
      </div>
    </div>
  </div>;
}

function Challenge() {
  const levels = useMemo(challengeLevels, []);
  const [selected, setSelected] = useState(CHALLENGE.current);
  const level = levels[selected - 1];
  return <div className="lp-glass lp-challenge" data-reveal>
    <div className="lp-chips"><strong>{t('Sample challenge')}</strong><span className="lp-chip">{t('2% risk per level')}</span><span className="lp-chip">1:2</span><span className="lp-chip">{t('10 levels')}</span></div>
    <div className="lp-challenge-summary">
      <div><span className="lp-label">{t('CHALLENGE PROGRESS')}</span><strong>{t('Level 5')} <small>{t('of 10')}</small></strong><div className="lp-segments" aria-hidden="true">{levels.map(item => <i key={item.number} className={`lp-s-${item.status}`}/>)}</div></div>
      <div><span className="lp-label">{t('AVAILABLE TRADING CAPITAL')}</span><strong className="lp-good">{money(levels[CHALLENGE.current - 1].start)}</strong><span className="lp-note">{t('Started at $10,000.00')}</span></div>
      <div><span className="lp-label">{t('FULL CHALLENGE TARGET')}</span><strong>{money(levels[levels.length - 1].target)}</strong><span className="lp-note">{t('Planned across 10 levels')}</span></div>
    </div>
    <p className="lp-hint">{t('Pick a level to see its numbers.')}</p>
    <div className="lp-ladder-scroll"><div className="lp-ladder" role="group" aria-label={t('Challenge levels')}>
      {levels.map(item => <button key={item.number} type="button" className={`lp-level lp-s-${item.status}`} aria-pressed={selected === item.number} aria-label={`${t('Level')} ${item.number}, ${t(STATUS_LABEL[item.status])}`} onClick={() => setSelected(item.number)}>{item.number}</button>)}
    </div></div>
    <div className="lp-legend"><span><i className="lp-s-passed"/>{t('Passed')}</span><span><i className="lp-s-progress"/>{t('In progress')}</span><span><i className="lp-s-todo"/>{t('Not started')}</span></div>
    <div className="lp-challenge-detail lp-swap" key={selected}>
      <div className="lp-inner">
        <div className="lp-level-head"><div><span className="lp-label">{t('SELECTED LEVEL')}</span><h3>{t('Level')} {level.number}</h3></div><span className={`lp-chip lp-status-${level.status}`}>{t(STATUS_LABEL[level.status])}</span></div>
        <div className="lp-level-range"><div><span>{t('Balance at start')}</span><b>{money(level.start)}</b></div><span className="lp-chip lp-chip-mint">×1.04</span><div><span>{t('Balance at target')}</span><b className="lp-good">{money(level.target)}</b></div></div>
        <div className="lp-tiles">
          <div className="lp-tile"><span>{t('Risk')}</span><b className="lp-bad">{money(level.risk)}</b><small>{t('2.00% of balance')}</small></div>
          <div className="lp-tile"><span>{t('Profit target')}</span><b className="lp-good">{money(level.reward)}</b><small>{t('2R reward')}</small></div>
          <div className="lp-tile"><span>{t('Growth this level')}</span><b>+4%</b><small>×1.04</small></div>
        </div>
      </div>
      <dl className="lp-inner lp-facts">
        <dt className="lp-label">{t('THE CHALLENGE SO FAR')}</dt>
        {[['Levels passed', '4 of 10'], ['Trades taken', '9'], ['Step-backs', '1'], ['Current loss streak', '0'], ['Reward to risk', '1:2']].map(([name, value]) => <div key={name}><span>{t(name)}</span><b>{t(value)}</b></div>)}
      </dl>
    </div>
  </div>;
}

function Journal() {
  const [tab, setTab] = useState('plan');
  const record = TRADE_RECORD.find(item => item.id === tab);
  return <div className="lp-glass lp-journal" data-reveal>
    <div className="lp-trade-head">
      <div><div className="lp-trade-pair"><strong>EUR/USD</strong><span className="lp-side">{t('SELL')}</span></div><span className="lp-note">14 Oct 2026 · {t('London')} · {t('Held 1h 06m')}</span></div>
      <div className="lp-trade-result"><strong>+$95.00</strong><span>+1.90R</span></div>
    </div>
    <Segmented label="Parts of the trade record" options={TRADE_RECORD} value={tab} onChange={setTab}/>
    <div className="lp-journal-grid">
      <div className="lp-inner lp-swap" key={tab}>
        <span className="lp-label">{t(record.heading)}</span>
        <dl className="lp-facts lp-facts-plain">{record.rows.map(([name, value, tone]) => <div key={name}><span>{t(name)}</span><b className={tone === 'good' ? 'lp-good' : ''}>{t(value)}</b></div>)}</dl>
        <p className="lp-quote">{t(record.note)}</p>
      </div>
      <div className="lp-inner">
        <div className="lp-panel-top"><span className="lp-label">{t('LINKED CHART MARKUP')}</span><span className="lp-chip lp-chip-mint">{t('Linked')}</span></div>
        <CandleChart shape="reversal" label="Prior-day high 1.0905" caption="EUR/USD · 15m · sample chart drawn for this page"/>
      </div>
    </div>
  </div>;
}

function CaseStudies() {
  const [selected, setSelected] = useState(0);
  const [query, setQuery] = useState('');
  const needle = query.trim().toLowerCase();
  const matches = STUDIES.map((study, index) => ({ study, index })).filter(({ study }) => !needle || `${t(study.title)} ${t(study.status)}`.toLowerCase().includes(needle));
  const study = STUDIES[selected];
  return <div className="lp-glass lp-studies" data-reveal>
    <div className="lp-library">
      <label className="lp-label" htmlFor="lp-library-search">{t('SEARCH THE LIBRARY')}</label>
      <div className="lp-search"><Search size={16} aria-hidden="true"/><input id="lp-library-search" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder={t('Try sweep, testing or range')}/></div>
      <div className="lp-study-list">
        {matches.map(({ study: item, index }) => <button key={item.title} type="button" aria-pressed={selected === index} onClick={() => setSelected(index)}>
          <strong><span className="lp-study-full">{t(item.title)}</span><span className="lp-study-short">{t(item.short)}</span></strong>
          <span><em className={`lp-chip lp-study-${item.status.toLowerCase()}`}>{t(item.status)}</em><small>{item.trades} {t('linked trades')}</small></span>
        </button>)}
        {!matches.length && <p className="lp-empty">{t('No study matches that search.')}</p>}
      </div>
    </div>
    <div className="lp-inner lp-study lp-swap" key={selected}>
      <div className="lp-level-head"><h3>{t(study.title)}</h3><span className={`lp-chip lp-study-${study.status.toLowerCase()}`}>{t(study.status)}</span></div>
      <div className="lp-tiles">
        <div className="lp-tile"><span>{t('Linked trades')}</span><b>{study.trades}</b></div>
        <div className="lp-tile"><span>{t('Win rate')}</span><b>{study.winRate}</b></div>
        <div className="lp-tile"><span>{t('Net result')}</span><b className={study.net < 0 ? 'lp-bad' : 'lp-good'}>{signed(study.net)}</b></div>
      </div>
      <div className="lp-study-body">
        <div className="lp-study-text">
          <div className="lp-study-objective"><span className="lp-label">01 · {t('RESEARCH OBJECTIVE')}</span><p>{t(study.objective)}</p></div>
          <div className="lp-study-hypothesis"><span className="lp-label">02 · {t('HYPOTHESIS')}</span><p>{t(study.hypothesis)}</p></div>
          <div><span className="lp-label">03 · {t('CONCLUSION')}</span><p>{t(study.conclusion)}</p></div>
        </div>
        <div><span className="lp-label">{t('CHART EVIDENCE')}</span><CandleChart shape={study.shape} label={study.level} caption="Sample chart drawn for this page"/></div>
      </div>
    </div>
  </div>;
}

function BrokerImport({ PlatformLogo }) {
  const [selected, setSelected] = useState('mt5');
  const platform = PLATFORMS.find(item => item.id === selected);
  return <div className="lp-import" data-reveal>
    <div className="lp-platforms" role="group" aria-label={t('Choose your platform')}>
      {PLATFORMS.map(item => <button key={item.id} type="button" aria-pressed={selected === item.id} onClick={() => setSelected(item.id)}>
        <span className="lp-platform-plate">{PlatformLogo && <PlatformLogo platform={item.id}/>}</span>
        <span><strong><span className="lp-platform-name">{item.name}</span><span className="lp-platform-short">{item.short}</span></strong><small>{t(item.format)}</small></span>
      </button>)}
    </div>
    <div className="lp-glass lp-import-steps">
      <h3>{t('Importing from')} {platform.name}</h3>
      <ol className="lp-swap" key={selected}>{platform.steps.map((step, index) => <li key={step}><span>{t('Step')} {index + 1}</span><p>{t(step)}</p></li>)}</ol>
      <ul>{IMPORT_FACTS.map(fact => <li key={fact}><Check size={18} aria-hidden="true"/><span>{t(fact)}</span></li>)}</ul>
    </div>
  </div>;
}

function AlsoInside({ onFeatures }) {
  const [open, setOpen] = useState(0);
  return <section id="also" className="lp-container lp-section">
    <div className="lp-head lp-head-action" data-reveal>
      <div><span className="lp-eyebrow lp-eyebrow-mint">{t('ALSO INSIDE')}</span><h2>{t('The rest of your trading day is covered too.')}</h2></div>
      {onFeatures && <button type="button" className="lp-btn lp-btn-ghost" onClick={onFeatures}>{t('See all features')}</button>}
    </div>
    <div className="lp-glass lp-also" data-reveal>
      {ALSO_INSIDE.map(([name, tools], index) => <div className="lp-also-group" key={name} data-open={open === index}>
        <button type="button" aria-expanded={open === index} onClick={() => setOpen(open === index ? -1 : index)}>
          <span><em>0{index + 1}</em><strong>{t(name)}</strong></span>
          <span className="lp-also-meta"><small>{tools.length} {t('tools')}</small>{open === index ? <Minus size={18} aria-hidden="true"/> : <Plus size={18} aria-hidden="true"/>}</span>
        </button>
        <ul>{tools.map(tool => <li key={tool}>{t(tool)}</li>)}</ul>
      </div>)}
    </div>
  </section>;
}

const SHOWCASE = [{ id: 'analytics', label: 'Analytics' }, { id: 'challenge', label: 'Challenge' }, { id: 'journal', label: 'Journal' }, { id: 'studies', label: 'Case Studies' }];

export default function LandingPage({ user, onNavigate, onFeatures, onDisclaimer, PlatformLogo }) {
  useLanguage(); // Re-render when the visitor switches language.
  const root = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showcase, setShowcase] = useState('analytics');
  useReveal(root);
  const go = path => event => { event.preventDefault(); setMenuOpen(false); onNavigate(path); };
  const scrollTo = id => { setMenuOpen(false); document.getElementById(id)?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' }); };
  const features = () => { setMenuOpen(false); (onFeatures || (() => scrollTo('also')))(); };
  const startHref = user ? '/dashboard' : '/signup';
  const start = user ? undefined : go('/signup');
  const startLabel = user ? 'Go to Dashboard' : 'Sign up free';

  return <div ref={root} className="lp" id="top">
    <header className="lp-nav lp-in" style={{ '--i': 0 }}>
      <div className="lp-nav-bar">
        <a className="lp-brand" href="/" aria-label={t('Reload AAICOREFX landing page')}><img src="/brand/logo-dark.png" width="44" height="44" alt=""/>AAICOREFX</a>
        <nav className="lp-nav-links" aria-label={t('Main navigation')}>
          <button type="button" onClick={features}>{t('Features')}</button>
          {user ? <a className="lp-btn lp-btn-primary lp-btn-small" href="/dashboard">{t('Go to Dashboard')}</a> : <>
            <a href="/login" onClick={go('/login')}>{t('Sign in')}</a>
            <a className="lp-btn lp-btn-primary lp-btn-small" href="/signup" onClick={go('/signup')}>{t('Sign up free')}</a>
          </>}
          <LanguageSelector publicSite/>
        </nav>
        <div className="lp-nav-phone">
          {user ? <a href="/dashboard">{t('Dashboard')}</a> : <a href="/login" onClick={go('/login')}>{t('Sign in')}</a>}
          <button type="button" className="lp-menu-button" aria-expanded={menuOpen} aria-controls="lp-menu" aria-label={t(menuOpen ? 'Close menu' : 'Open menu')} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={20}/> : <Menu size={20}/>}</button>
        </div>
      </div>
      {menuOpen && <nav id="lp-menu" className="lp-menu" aria-label={t('Menu')}>
        <button type="button" onClick={features}>{t('Features')}</button>
        <button type="button" onClick={() => scrollTo('faq')}>{t('Questions')}</button>
        {user ? <a href="/dashboard">{t('Go to Dashboard')}</a> : <a href="/login" onClick={go('/login')}>{t('Sign in')}</a>}
        <div className="lp-menu-language"><span>{t('Language')}</span><LanguageSelector publicSite/></div>
      </nav>}
    </header>

    <main>
      <div className="lp-stage">
        <div className="lp-backdrop" aria-hidden="true"><i className="lp-grid"/><i className="lp-glow"/></div>
        <section className="lp-container lp-hero">
          <span className="lp-badge lp-in" style={{ '--i': 1 }}><i aria-hidden="true"/>{t('TRADING JOURNAL AND GROWTH PLANNER')}</span>
          <h1 className="lp-in" style={{ '--i': 2 }}>{t('Find what works.')}<br/><span>{t('Grow it by rule.')}</span></h1>
          <p className="lp-in" style={{ '--i': 3 }}>{t('AAICOREFX links every trade to its plan, review and rules, shows you which models, sessions and days pay, and turns a starting balance into a level-by-level growth plan.')}</p>
          <div className="lp-hero-actions lp-in" style={{ '--i': 4 }}>
            <a className="lp-btn lp-btn-primary" href={startHref} onClick={start}>{t(startLabel)}</a>
            <button type="button" className="lp-btn lp-btn-ghost" onClick={() => scrollTo('showcase')}>{t('See it in action')}<ArrowDown size={16} aria-hidden="true"/></button>
          </div>
          <span className="lp-note lp-in" style={{ '--i': 5 }}>{t('Free to use. Everything below runs on sample data, so click around.')}</span>
        </section>

        <div id="showcase" className="lp-showcase" data-showcase={showcase}>
          <div className="lp-container lp-showcase-pills"><Segmented label="Choose a tool" options={SHOWCASE} value={showcase} onChange={setShowcase} className="lp-seg-solid"/></div>

          <section id="analytics" className="lp-container lp-product lp-in" style={{ '--i': 6 }} aria-label={t('Analytics')}><Analytics/></section>

          <section id="challenge" className="lp-container lp-section lp-product">
            <SectionHead tone="amber" eyebrow="GROWTH CHALLENGE" title="A starting balance, turned into a plan you can follow." body="Choose a balance, a risk and a number of levels. The challenge works out each level's target, risk, reward, deposits, step-backs and progress, so growth is intentional, measurable and rule-based."/>
            <Challenge/>
          </section>

          <section id="journal" className="lp-container lp-section lp-product">
            <SectionHead eyebrow="CONNECTED JOURNAL" title="One trade. Everything that explains it." body="The trade, its chart markup, the plan, the review, your psychology, your rules and the outcome live in one record. Open the tabs on this sample trade."/>
            <Journal/>
          </section>

          <section id="case-studies" className="lp-container lp-section lp-product">
            <SectionHead tone="amber" eyebrow="CASE STUDIES" title="Your personal trading research library." body="Document a setup or market idea with charts, evidence, notes and links to related trades. Over time it becomes a searchable playbook of what you tested, what worked, what failed and why."/>
            <CaseStudies/>
          </section>
        </div>
      </div>

      <section id="import" className="lp-container lp-section">
        <SectionHead eyebrow="BROKER IMPORT" title="Bring your trading history with you." body="Export a statement from your platform and upload it. Your past trades land in the same journal as the ones you log by hand, ready for markups, reviews and analytics."/>
        <BrokerImport PlatformLogo={PlatformLogo}/>
      </section>

      <section id="how" className="lp-section">
        <div className="lp-container"><div className="lp-head lp-head-single" data-reveal><div><span className="lp-eyebrow lp-eyebrow-mint">{t('HOW IT WORKS')}</span><h2>{t('Three habits, one workspace.')}</h2><span className="lp-note lp-swipe-hint">{t('Swipe through the steps.')}</span></div></div></div>
        <ol className="lp-steps" data-reveal>{STEPS.map(([title, body], index) => <li key={title}><em>0{index + 1}</em><strong>{t(title)}</strong><p>{t(body)}</p></li>)}</ol>
      </section>

      <AlsoInside onFeatures={onFeatures}/>

      <section id="faq" className="lp-container lp-section lp-faq">
        <div className="lp-head lp-head-single" data-reveal><div><span className="lp-eyebrow lp-eyebrow-mint">{t('QUESTIONS')}</span><h2>{t('Frequently asked questions')}</h2></div></div>
        <div className="lp-faq-list" data-reveal>{FAQS.map(([question, answer], index) => <details key={question} open={index === 0}><summary>{t(question)}<ChevronDown size={20} aria-hidden="true"/></summary><p>{t(answer)}</p></details>)}</div>
      </section>

      <section className="lp-container lp-section">
        <div className="lp-glass lp-cta" data-reveal>
          <h2>{t('Start your journal today.')}</h2>
          <p>{t('Free to use. Set up a challenge, log your first trade, and see what your own numbers say.')}</p>
          <div className="lp-hero-actions">
            <a className="lp-btn lp-btn-primary" href={startHref} onClick={start}>{t(startLabel)}</a>
            {onFeatures && <button type="button" className="lp-btn lp-btn-ghost" onClick={onFeatures}>{t('See all features')}</button>}
          </div>
        </div>
      </section>
    </main>

    <footer className="lp-container lp-footer">
      <div className="lp-footer-top">
        <div><a className="lp-brand" href="/" aria-label={t('Reload AAICOREFX landing page')}><img src="/brand/logo-dark.png" width="40" height="40" alt=""/>AAICOREFX</a><p>{t('Your trades. Your process. Your perspective.')}</p></div>
        <nav aria-label={t('Footer navigation')}>
          <button type="button" onClick={features}>{t('Features')}</button>
          <button type="button" onClick={() => scrollTo('faq')}>{t('Questions')}</button>
          <button type="button" onClick={onDisclaimer}>{t('Financial Disclaimer')}</button>
          {user ? <a href="/dashboard">{t('Go to Dashboard')}</a> : <a href="/login" onClick={go('/login')}>{t('Sign in')}</a>}
          <button type="button" onClick={() => scrollTo('top')}>{t('Back to top')} <ArrowUp size={14} aria-hidden="true"/></button>
        </nav>
      </div>
      <div className="lp-footer-legal"><p>{t('AAICOREFX is for educational and personal journaling purposes only and does not provide financial advice. All figures on this page are sample data.')}</p><small>© {new Date().getFullYear()} AAICOREFX.</small></div>
    </footer>

    <div className="lp-dock"><div><strong>{t('Free to use')}</strong><small>{t('Start in a minute')}</small></div><a className="lp-btn lp-btn-primary" href={startHref} onClick={start}>{t(startLabel)}</a></div>
  </div>;
}
