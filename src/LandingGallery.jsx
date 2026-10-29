import React, { useEffect, useRef, useState } from 'react';
import { BarChart3, BookOpen, TrendingUp, Trophy, LayoutDashboard } from 'lucide-react';

const captions = {
  dashboard: [LayoutDashboard, 'See the Bigger Picture', 'Let a clear view of your progress guide your next step.'],
  trades: [TrendingUp, 'Make Every Trade Count', 'Record the decision, not just the outcome.'],
  analytics: [BarChart3, 'Discover Your Edge', 'Study the patterns. Build on what your own results teach you.'],
  review: [BookOpen, 'Turn Reflection into Progress', 'Every honest review is a step toward a stronger process.'],
  backtest: [Trophy, 'Test a Setup Before It Counts', 'Practice the process without changing your live journal.'],
};

const showcaseLabels = {
  dashboard: 'Dashboard',
  trades: 'Trade Logs',
  analytics: 'Analytics',
  review: 'Review',
  backtest: 'Backtest',
};

export default function LandingGallery({ files, title, renderImage, stacked = false, showcase = false }) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const root = useRef(null);
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(preference.matches);
    preference.addEventListener('change', update);
    const observer = new IntersectionObserver(entries => setVisible(entries[0].isIntersecting), { threshold: .1 });
    observer.observe(root.current);
    return () => { observer.disconnect(); preference.removeEventListener('change', update); };
  }, []);
  const playing = !showcase && visible && !paused && !focused && !reduced;
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      if (!document.hidden && !document.querySelector('.pub-lightbox[open]')) setActive(value => (value + 1) % files.length);
    }, 4500);
    return () => window.clearInterval(timer);
  }, [playing, files.length, active]);
  const [Icon, heading, quote] = captions[files[active]] || captions.analytics;
  return <div ref={root} className={`pub-gallery ${stacked ? 'pub-gallery-stacked' : ''} ${showcase ? 'pub-gallery-showcase' : ''}`} data-playing={playing} role="region" aria-roledescription="carousel" aria-label={`${title} screenshots`} onFocus={event => { if (event.target.matches(':focus-visible')) setFocused(true); }} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}>
    {!showcase && <button className="pub-gallery-pause" onClick={() => setPaused(!paused)}>{paused ? 'Resume slideshow' : 'Pause slideshow'}</button>}
    {showcase && <div className="pub-gallery-tabs" role="tablist" aria-label="Journal screenshots">{files.map((file, index) => <button key={file} role="tab" aria-selected={active === index} aria-controls={`product-screen-${file}`} id={`product-tab-${file}`} onClick={() => setActive(index)}>{showcaseLabels[file] || file}</button>)}</div>}
    <div className="pub-gallery-stage">
      {files.map((file, index) => <div key={file} className="pub-gallery-slide" data-position={(index - active + files.length) % files.length} aria-hidden={index !== active} inert={index !== active ? '' : undefined} role={showcase ? 'tabpanel' : undefined} id={showcase ? `product-screen-${file}` : undefined} aria-labelledby={showcase ? `product-tab-${file}` : undefined}>{renderImage(file, `${title} — ${index + 1}`, stacked && index === 0)}</div>)}
      {stacked && <div className="pub-gallery-caption" key={files[active]}><Icon aria-hidden="true"/><h3>{heading}</h3><p>{quote}</p></div>}
    </div>
    {!showcase && <div className="pub-gallery-controls">
      {files.map((file, index) => <button key={file} className="pub-gallery-dot" aria-label={`Show ${title} screenshot ${index + 1}`} aria-current={active === index ? 'true' : undefined} onClick={() => setActive(index)}><span key={active === index ? `active-${active}` : 'idle'}/></button>)}
    </div>}
  </div>;
}
