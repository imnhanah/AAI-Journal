import React, {useState,useEffect,useId} from 'react';
import {Check,Layers,TriangleAlert,X} from 'lucide-react';
import {ThemeSelect} from './JournalControls';
import {CHALLENGE_LEVEL_OPTIONS, normaliseChallengeLevelCount, canUseLossStreak, challengeModeActivationRule} from './challengeModel';
export function ChallengeCompatibleDialog({recommendation,onClose,onApply}) {
  const recommendationValue=recommendation?.mode==='adaptive'
    ? 'Adaptive Balance'
    : `1:${recommendation?.reward} Risk-to-Reward  •  ${recommendation?.levelCount} Levels`;
  return <div className="tj-challenge-compatible-overlay" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)onClose();}}><section className="tj-challenge-compatible-dialog" role="dialog" aria-modal="true" aria-labelledby="challenge-compatible-title">
    <button type="button" className="tj-challenge-compatible-close" aria-label="Close" onClick={onClose}><X size={20}/></button>
    <span className="tj-challenge-compatible-warning"><TriangleAlert size={34}/></span>
    <h2 id="challenge-compatible-title">Use a <em>Compatible Challenge</em> Setup?</h2>
    <p>Your current selection isn’t allowed for this starting balance. Use a compatible setup to continue.</p>
    <section className="tj-challenge-compatible-choice" aria-label="Recommended setup"><Layers size={29}/><div><small>RECOMMENDED SETUP</small><strong>{recommendationValue}</strong></div><Check className="tj-challenge-compatible-check" size={24}/></section>
    <footer><button type="button" onClick={onClose}>Cancel</button><button type="button" className="tj-challenge-compatible-confirm" onClick={()=>onApply(recommendation)}><Check size={22}/>Use This Setup</button></footer>
  </section></div>;
}
export default function ChallengeModeSettings({challenge, enabled, liveBalance, referenceLayout=false}) {
  const {state,loading,saving,error,modesReady}=challenge;
  const mode=state.automation?.mode;
  const levelCount=normaliseChallengeLevelCount(state.automation?.levelCount);
  const disabled=!enabled || loading || saving || !modesReady || state.settingsLocked;
  // Adaptive configuration is chosen before the challenge begins. Its risk
  // and drawdown remain editable here; the entry level is always Level 1.
  const adaptiveInputDisabled=!enabled || loading || saving || !modesReady;
  const reward=state.automation?.rewardRatio ?? (mode==='streak'?3.1:'');
  const adaptiveRisk=state.automation?.adaptiveRiskPct ?? 1;
  const adaptiveDrawdown=state.automation?.adaptiveDrawdownPct ?? 10;
  const [rewardDraft,setRewardDraft]=useState(String(reward));
  const [pendingRecommendation,setPendingRecommendation]=useState(null);
  const rewardInputId=useId();
  useEffect(()=>setRewardDraft(String(reward)),[reward]);
  const modeOptions=[
    ['risk','MODE 1','Risk limit','Step back when the level’s risk limit is reached.'],
    ['streak','MODE 2','Two-loss streak','Step back after two consecutive losses.'],
    ['adaptive','MODE 3','Adaptive Balance','Use a custom balance, drawdown and percent risk.'],
  ];
  const saveReward=value=>{
    const next=Number(value);
    if(next>0 && Number.isFinite(next)) {
      setRewardDraft(String(next));
      challenge.setReward(next);
    } else setRewardDraft(String(reward));
  };
  const currentLevel=Math.min(Math.max(Number(state.activeLevel) || 1,1),levelCount);
  const activationRule=enabled && mode ? challengeModeActivationRule({mode,reward,balance:liveBalance,levelCount}) : null;
  const applyRecommendation=recommendation=>setPendingRecommendation(recommendation);
  const confirmRecommendation=()=>{
    const recommendation=pendingRecommendation;
    if (!recommendation) return;
    challenge.setLevelCount(recommendation.levelCount);
    if (recommendation.reward != null) challenge.setReward(recommendation.reward);
    if (recommendation.mode !== mode) challenge.setMode(recommendation.mode);
    setPendingRecommendation(null);
  };
  return <><div className={`tj-challenge-mode-settings ${referenceLayout ? 'tj-challenge-reference-layout' : ''}`}>
    <div className="tj-challenge-settings-layout">
      <div className="tj-challenge-mode-buttons" role="radiogroup" aria-label="Challenge mode">{modeOptions.map(([value,kicker,label,description])=><button key={value} type="button" role="radio" disabled={disabled || (value==='streak' && !canUseLossStreak(reward || 3.1))} aria-checked={mode===value} aria-pressed={mode===value} onClick={()=>challenge.setMode(mode===value ? null : value)}><span className="tj-challenge-mode-choice-dot" aria-hidden="true"/><span><small>{kicker}</small><strong>{label}</strong><em>{description}</em></span></button>)}</div>
      <div className="tj-challenge-settings-controls">
        <div className="tj-challenge-control-grid">
          <label className="tj-challenge-ratio-control" htmlFor={rewardInputId}><span>Risk-to-Reward</span><input id={rewardInputId} aria-label="Risk-to-Reward (1 : reward)" className="tj-input" type="number" min="0.01" step="0.01" placeholder="Original targets" value={rewardDraft} disabled={disabled} onChange={event=>setRewardDraft(event.target.value)} onBlur={()=>saveReward(rewardDraft)}/></label>
          <label className="tj-challenge-select-control"><span>Plan Length</span><ThemeSelect label="Challenge level count" disabled={disabled} value={levelCount} onChange={event=>challenge.setLevelCount(Number(event.target.value))}>{CHALLENGE_LEVEL_OPTIONS.map((count)=><option key={count} value={count}>{count} levels</option>)}</ThemeSelect></label>
        </div>
        {mode==='adaptive'&&<div className="tj-challenge-adaptive-controls"><label>Risk per trade (%)<input aria-label="Adaptive risk per trade" className="tj-input" type="number" min="0.01" max="100" step="0.01" value={adaptiveRisk} disabled={adaptiveInputDisabled} onChange={event=>challenge.setAdaptiveRisk?.(event.target.value)}/></label><label>Maximum drawdown (%)<input aria-label="Adaptive maximum drawdown" className="tj-input" type="number" min="0" max="99.99" step="0.01" value={adaptiveDrawdown} disabled={adaptiveInputDisabled} onChange={event=>challenge.setAdaptiveDrawdown?.(event.target.value)}/></label></div>}
        <section className="tj-challenge-plan-progress" aria-label={`${currentLevel} of ${levelCount} challenge levels`}><div><small>PLAN PROGRESS</small><span>{state.activeLevel===levelCount+1 ? 'Complete' : `Level ${mode==='adaptive' ? 1 : currentLevel} of ${levelCount}`}</span></div><ol style={{'--challenge-level-count':levelCount}}>{Array.from({length:levelCount},(_,index)=>{const level=index+1;return <li key={level} className={level<currentLevel?'is-passed':level===currentLevel?'is-current':''} aria-label={`Level ${level}${level<currentLevel?' passed':level===currentLevel?' current':''}`}/>;})}</ol></section>
      </div>
    </div>
    {activationRule ? <div className="tj-challenge-activation-message" role="alert"><TriangleAlert size={18}/><div><small>CHALLENGE SETUP NEEDS ATTENTION</small><p>{activationRule.message}</p>{activationRule.recommendations?.length>0&&<div className="tj-challenge-recommendations">{activationRule.recommendations.map(recommendation=><button type="button" key={`${recommendation.mode}:${recommendation.levelCount}:${recommendation.reward ?? ''}`} onClick={()=>applyRecommendation(recommendation)}><Layers size={14}/>{recommendation.label}</button>)}</div>}</div></div> : (!enabled || loading || !modesReady || mode) && <p>{!enabled ? 'Enable Challenge to choose a mode.' : loading ? 'Loading saved mode…' : !modesReady ? 'Apply challenge_modes_migration.sql to enable modes. Manual challenge controls remain available.' : mode==='risk' ? 'Gross P&L accumulates at each level. Reach the profit target to advance, or the risk limit to step back.' : mode==='streak' ? 'Reach the gross profit target to advance. Any two losses step back; wins reset the streak and breakevens leave it unchanged.' : 'Build a custom percentage-based ladder. Set its balance, drawdown, risk, and target in Challenge settings before logging trades.'}</p>}
    {saving && <p role="status">Saving challenge…</p>}
    {error && <p role="alert">{error} <button type="button" onClick={challenge.retry}>Retry</button></p>}
  </div>{pendingRecommendation&&<ChallengeCompatibleDialog recommendation={pendingRecommendation} onClose={()=>setPendingRecommendation(null)} onApply={confirmRecommendation}/>}</>;
}
