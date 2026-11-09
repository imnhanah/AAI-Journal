import React from 'react';
import {ArrowUpRight, Bookmark, ChevronRight, ClipboardCheck, FlaskConical, Trophy} from 'lucide-react';
import {mobileRoutineStatus} from './mobileNavigation.js';

const flowCards = [
  {id:'markups', title:'Markups', description:'Plan your setups with clarity.', icon:Bookmark, tone:'markup'},
  {id:'tradelog', title:'Trade Logs', description:'Capture every execution.', icon:ArrowUpRight, tone:'trades'},
];

export default function MobileJournalHubV2({routine, routineBusy = false, challengeEnabled = false, markupCount = 0, tradeCount = 0, onOpenRoutine, onNavigate}) {
  const routineStatus = mobileRoutineStatus(routine);
  const routineTitle = routineStatus.completed ? 'Routine complete' : routineStatus.started ? 'Continue your routine' : 'Get session-ready';
  const routineCopy = routineStatus.completed
    ? 'Your session checklist is complete. Reopen it any time to review today’s plan.'
    : routineStatus.started
      ? `${routineStatus.ticked} of ${routineStatus.total} checks complete. Keep your process intentional.`
      : 'A clear mind. A clear plan. Your routine comes first.';

  return <main className="tj-jh2" aria-label="Journal">
    <header className="tj-jh2-heading">
      <small>Your trading workspace</small>
      <h1>Trade with<br/>intention<span>.</span></h1>
      <p>Everything you need to prepare, execute, learn and grow. In one place.</p>
    </header>

    <button type="button" className="tj-jh2-routine" disabled={routineBusy} onClick={onOpenRoutine} aria-label={routineStatus.total ? `Open daily routine, ${routineStatus.ticked} of ${routineStatus.total} tasks completed` : 'Open daily routine'}>
      <span className="tj-jh2-routine-kicker">Before the market</span>
      <span className="tj-jh2-routine-title">{routineTitle}</span>
      <span className="tj-jh2-routine-copy">{routineCopy}</span>
      {!routineStatus.skipped && <span className="tj-jh2-routine-progress">{routineStatus.ticked}/{routineStatus.total} checks</span>}
      <ClipboardCheck className="tj-jh2-routine-icon" aria-hidden="true"/>
    </button>

    <section className="tj-jh2-section" aria-labelledby="journal-flow-title">
      <header><h2 id="journal-flow-title">Your trading flow</h2><span>Tap a section</span></header>
      <div className="tj-jh2-flow-grid">
        {flowCards.map(({id,title,description,icon:Icon,tone}) => <button type="button" key={id} className={`tj-jh2-flow-card is-${tone}`} onClick={() => onNavigate(id)}>
          <span className="tj-jh2-card-icon"><Icon aria-hidden="true"/></span>
          <span className="tj-jh2-card-copy"><strong>{title}</strong><small>{description}</small></span>
          <em>{id === 'markups' ? `${markupCount} saved` : `${tradeCount} logged`}</em>
        </button>)}
        <button type="button" className="tj-jh2-flow-card tj-jh2-challenge-card is-challenge" disabled={!challengeEnabled} aria-disabled={!challengeEnabled} onClick={() => onNavigate('challenge')}>
          <span className="tj-jh2-card-icon"><Trophy aria-hidden="true"/></span>
          <span className="tj-jh2-card-copy"><strong>Challenges</strong><small>{challengeEnabled ? 'Progress toward your targets.' : 'Enable a challenge in Account Settings.'}</small></span>
          <ChevronRight aria-hidden="true"/>
        </button>
      </div>
    </section>

    <section className="tj-jh2-section" aria-labelledby="journal-deeper-title">
      <header><h2 id="journal-deeper-title">Go deeper</h2></header>
      <button type="button" className="tj-jh2-deeper-card" onClick={() => onNavigate('backtest')}>
        <span className="tj-jh2-card-icon"><FlaskConical aria-hidden="true"/></span>
        <span className="tj-jh2-card-copy"><strong>Strategy Testing</strong><small>Build conviction with evidence.</small></span>
        <ChevronRight aria-hidden="true"/>
      </button>
    </section>
  </main>;
}
