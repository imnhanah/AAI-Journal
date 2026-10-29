import React, {useRef,useState,useEffect} from 'react';
import {Trophy} from 'lucide-react';
import {playAlertSound,unlockAlertSounds} from './alertSounds';
const POPPER_PARTICLES = Array.from({ length: 76 }, (_, index) => {
  const fan = (index % 38) / 37;
  const radius = 310 + (index % 6) * 52;
  const angle = Math.PI * fan;
  return {
    origin: index % 2 === 0 ? -36 : 36,
    x: Math.round(Math.cos(angle) * radius),
    y: -Math.round(82 + Math.sin(angle) * (255 + (index % 5) * 34)),
    turn: `${index % 2 === 0 ? 1 : -1}turn`,
    delay: `${(index % 7) * 28}ms`,
  };
});

export function useCompletionCelebration(complete) {
  const wasComplete = useRef(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (complete && !wasComplete.current) setOpen(true);
    wasComplete.current = complete;
  }, [complete]);
  return [open, setOpen];
}

export default function ChallengeCompletionCelebration({ accountName, totalLevels, startingBalance, finalBalance, currency = 'USD', onViewJourney, onClose, soundEnabled = true }) {
  const [soundBlocked,setSoundBlocked]=useState(false);
  const started=useRef(false);
  const dialog=useRef(null);
  const continueButton=useRef(null);
  const formatMoney=value=>new Intl.NumberFormat(undefined,{style:'currency',currency,minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(value) || 0);
  const growth=Number(startingBalance)>0 ? Number(finalBalance)/Number(startingBalance) : null;
  useEffect(()=>{
    const previousFocus=document.activeElement;
    continueButton.current?.focus();
    return ()=>{if(previousFocus?.isConnected)previousFocus.focus?.();};
  },[]);
  useEffect(()=>{
    if(started.current||!soundEnabled)return;
    started.current=true;
    playAlertSound('challenge').then(played=>setSoundBlocked(!played));
  },[soundEnabled]);
  return <div ref={dialog} className="tj-challenge-celebration-overlay" role="dialog" aria-modal="true" aria-labelledby="challenge-complete-title" onMouseDown={event=>{if(event.target===event.currentTarget)onClose();}} onKeyDown={event=>{
    if(event.key==='Escape'){event.stopPropagation();onClose();}
    if(event.key==='Tab'){
      const buttons=dialog.current?.querySelectorAll('button:not(:disabled)');
      if(!buttons?.length)return;
      const first=buttons[0],last=buttons[buttons.length-1];
      if(event.shiftKey && document.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first.focus();}
    }
  }}>
    <div className="tj-challenge-confetti" aria-hidden="true">{POPPER_PARTICLES.map((particle, index) => <i key={index} style={{ "--origin": `${particle.origin}px`, "--burst-x": `${particle.x}px`, "--burst-y": `${particle.y}px`, "--turn": particle.turn, "--delay": particle.delay }} />)}</div>
    <section className="tj-challenge-completion-card">
      <div className="tj-challenge-card-confetti" aria-hidden="true">{Array.from({length:26},(_,index)=><i key={index} style={{left:`${7+(index*37)%86}%`,top:`${5+(index*19)%43}%`,transform:`rotate(${index*43}deg)`}}/>)}</div>
      <div className="tj-challenge-completion-trophy"><Trophy size={31} /></div>
      <span>CHALLENGE COMPLETE</span>
      <h2 id="challenge-complete-title">You did it.</h2>
      <p>{accountName} has completed {totalLevels ? `all ${totalLevels} levels` : 'the full challenge plan'}. Take a moment to celebrate the patience, courage, and discipline that brought you here.</p>
      <div className="tj-challenge-completion-progress" aria-label={`${totalLevels} of ${totalLevels} levels complete`}><div aria-hidden="true">{Array.from({length:totalLevels || 0},(_,index)=><i key={index}/>)}</div><strong>{totalLevels} / {totalLevels} levels</strong></div>
      <div className="tj-challenge-completion-stats">
        <div><small>STARTING BALANCE</small><strong>{formatMoney(startingBalance)}</strong></div>
        <div><small>FINAL BALANCE</small><strong>{formatMoney(finalBalance)}</strong></div>
        <div><small>GROWTH</small><strong>{growth===null?'—':`×${growth.toLocaleString(undefined,{minimumFractionDigits:1,maximumFractionDigits:1})}`}</strong></div>
      </div>
      {soundBlocked && <button type="button" className="tj-btn-outline" onClick={async()=>{const ready=await unlockAlertSounds();if(ready)setSoundBlocked(!await playAlertSound('challenge'));}}>Play celebration sound</button>}
      <div className="tj-challenge-completion-actions"><button type="button" className="tj-btn-outline" onClick={onViewJourney || onClose}>View journey</button><button ref={continueButton} type="button" className="tj-btn-primary" onClick={onClose}>Continue</button></div>
    </section>
  </div>;
}
