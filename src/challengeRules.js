// Plain-language rules shown in the Rules popover (desktop) and Rules sheet (phone).
// One source for both layouts. Adaptive Balance describes whichever step-back
// rule the trader picked at setup.
export const ADAPTIVE_STEP_BACK_RULES = ['one', 'two', 'net'];
export const normaliseAdaptiveStepBack = value => ADAPTIVE_STEP_BACK_RULES.includes(value) ? value : 'one';

const SHARED = {
  floor: ['Balance floor', 'The challenge is paused if live trading capital falls below the original Level 1 balance.'],
  funding: ['Funding and deposits', 'Deposits count toward your total deposited and can fund forward progress. They never count as growth. Withdrawals and transfers can move the challenge back.'],
  completion: ['Completing the challenge', 'The challenge is complete when the last level is passed by a trade profit and the balance has reached the planned final target. Reaching the target early does not complete it. If the last level is passed while the balance is still below the target, the final level stays active until the balance catches up.'],
  planned: ['Planned and live balance', 'The planned balances are the clean-path targets. After a step-back, re-passing levels adds to realised equity again, so live balance can finish above the plan.'],
  lock: ['Lock process', 'Once a trade is linked to this challenge, its mode, plan length, reward and setup rules are locked.'],
};

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
        ['Progress', 'Each level risks the selected percentage of its starting balance and targets the selected reward multiple.'],
        ['Reward', 'Any reward from 1R upward. You choose it at setup.'],
        ADAPTIVE_STEP_BACK_TEXT[normaliseAdaptiveStepBack(stepBack)],
        ['Balance floor', 'The challenge is paused when live trading capital falls below its starting balance by the selected maximum drawdown.'],
        SHARED.funding,
        SHARED.completion,
        SHARED.planned,
        ['Lock process', 'The challenge always starts at Level 1. Once a trade is linked, its adaptive settings and plan rules are locked.'],
      ],
    };
  }
  if (mode === 'streak') {
    return {
      title: 'Mode 2 · Two-Loss Streak rules',
      items: [
        ['Progress', 'Closed challenge trades add toward this level’s profit target.'],
        ['Reward', 'Any reward from 2.8R to 5R. The default is 2.8R.'],
        ['Two-loss rule', 'Two losses on the same level trigger a step-back. A win that does not pass the level, or a breakeven, does not clear the count. Only passing the level does.'],
        SHARED.floor, SHARED.funding, SHARED.completion, SHARED.planned, SHARED.lock,
      ],
    };
  }
  return {
    title: 'Mode 1 · Risk Limit rules',
    items: [
      ['Progress', 'Closed challenge trades add toward this level’s profit target.'],
      ['Reward', 'Any reward from 1.5R to 2R. The default is 1.5R.'],
      ['Step-back', 'Wins and losses on the level are added together. When the net loss reaches the level’s planned risk amount, the challenge steps back one level.'],
      SHARED.floor, SHARED.funding, SHARED.completion, SHARED.planned, SHARED.lock,
    ],
  };
}
