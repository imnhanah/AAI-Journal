// Plain-language rules shown in the Rules popover (desktop) and Rules sheet (phone).
// One source for both layouts. Adaptive Balance describes whichever step-back
// rule the trader picked at setup.
export const ADAPTIVE_STEP_BACK_RULES = ['one', 'two', 'net'];
export const normaliseAdaptiveStepBack = value => ADAPTIVE_STEP_BACK_RULES.includes(value) ? value : 'one';

const SHARED = {
  balance: ['Balance and deposits', 'Your available balance must meet the current level’s planned starting balance. If it falls below that minimum, you step back to the highest level it still funds, in every mode. The challenge pauses below the Level 1 balance. Deposits can fund progress but never count as growth.'],
  completion: ['Completing the challenge', 'It completes when a trade passes the last level and the balance has reached the planned final target. Planned balances are the clean path, so your live balance can finish above them.'],
  lock: ['Locked after trades', 'Once a trade is linked, the mode, plan length, reward and setup rules are locked.'],
};
const PASS = ['How you pass', 'One closed trade must meet or exceed the level’s full profit target, and the account balance after that same trade, fees and commissions must meet or exceed the level’s planned ending balance. Both are required on the same trade; otherwise you stay on the level. Small wins do not add up or unlock an earlier attempt.'];

const ADAPTIVE_STEP_BACK_TEXT = {
  one: ['Step-back · One loss', 'A losing trade from Level 2 onward steps the challenge back one level. A Level 1 loss stays at Level 1.'],
  two: ['Step-back · Two losses', 'Two losing trades on the same level step the challenge back one level. A win that does not pass the level, or a breakeven, does not clear the count. Only passing the level does. A Level 1 loss stays at Level 1.'],
  net: ['Step-back · Net loss', 'Wins and losses on the level are added together. When the net loss reaches the level’s risk amount, the challenge steps back one level. A Level 1 loss stays at Level 1.'],
};

export function challengeRulesFor(mode = 'risk', stepBack) {
  if (mode === 'adaptive') {
    return {
      title: 'Mode 3 · Adaptive Balance rules',
      items: [
        PASS,
        ADAPTIVE_STEP_BACK_TEXT[normaliseAdaptiveStepBack(stepBack)],
        ['Balance and deposits', 'Adaptive trades keep your chosen live-balance risk percentage and reward multiple. Your available balance must also meet the current level’s planned starting balance; below it, you step back to the highest level still funded. The challenge pauses at your maximum drawdown. Deposits can fund progress but never count as growth.'],
        SHARED.completion,
        ['Locked after trades', 'The challenge always starts at Level 1. Once a trade is linked, its adaptive settings and plan rules are locked.'],
      ],
    };
  }
  if (mode === 'streak') {
    return {
      title: 'Mode 2 · Two-Loss Streak rules',
      items: [
        PASS,
        ['How you step back', 'Two losses on the same level step you back one level. A win that does not pass the level, or a breakeven, does not clear the count. A Level 1 loss stays on Level 1.'],
        SHARED.balance, SHARED.completion, SHARED.lock,
      ],
    };
  }
  return {
    title: 'Mode 1 · Risk Limit rules',
    items: [
      PASS,
      ['How you step back', 'One trade that hits its stop loss, losing the level’s planned risk, steps you back one level. A Level 1 loss stays on Level 1.'],
      SHARED.balance, SHARED.completion, SHARED.lock,
    ],
  };
}
