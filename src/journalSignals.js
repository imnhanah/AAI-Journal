const signal = (title, subtitle, detail) => ({ title, subtitle, detail });
export function journalSignal({page, trades = [], markups = [], reviews = [], guardrails = {}, monthCursor = new Date(), challenge = {}}) {
  const n = trades.length;
  const reviewed = new Set(reviews.map(r => r.tradeId));
  const pending = trades.filter(t => !reviewed.has(t.id)).length;
  if (page === 'challenge') {
    if (challenge.loading) return signal('Reading your progress.', 'One level at a time.', 'Your saved challenge is loading.');
    if (challenge.error) return signal('Progress needs attention.', 'Check the saved record.', 'Resolve the loading or saving error below before relying on these levels.');
    const statuses = challenge.statuses || {};
    const passed = Object.values(statuses).filter(s => s === 'Pass').length;
    const setbacks = Object.values(statuses).filter(s => s === 'Step back').length;
    const totalLevels = [10, 15, 20, 30].includes(Number(challenge.automation?.levelCount)) ? Number(challenge.automation.levelCount) : 30;
    if (passed === totalLevels) return signal('Every level is recorded.', 'Review the journey.', 'All challenge levels are marked passed. Reflect on the decisions behind your progress.');
    if (setbacks) return signal('A setback is recorded.', 'Learn before moving on.', 'Some levels are marked Step back while others are passed. Add notes on what changed and review your plan.');
    return signal(passed ? 'Progress is building.' : 'Start with a plan.', 'Respect each level.', 'Progress is recorded across the challenge. Planned balances are targets, not guaranteed outcomes.');
  }
  if (page === 'markups') {
    if (!markups.length) return signal('Start with context.', 'Build the plan.', 'Create a markup before your next session so setup, levels, and expectations are visible before execution.');
    const incomplete = markups.filter(m => !m.structure?.trim() || !m.levels?.trim() || !m.notes?.trim()).length;
    const linked = trades.filter(t => markups.some(m => m.id === t.premarketMarkupId)).length;
    if (incomplete) return signal('Capture the thesis.', 'Finish the record.', 'Complete the missing plan notes or chart captures first. A complete markup makes the later review more useful.');
    return signal(linked ? 'Context is connected.' : 'Your plans are captured.', linked ? 'Keep refining.' : 'Connect the execution.', 'Review the plan beside the trade to compare your intended context with what actually happened.');
  }
  if (page === 'calendar') {
    const date = new Date(monthCursor);
    const key = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;
    const rows = trades.filter(t => t.date?.startsWith(key));
    const days = new Set(rows.map(t => t.date)).size;
    if (!rows.length) return signal('A clear month ahead.', 'Let the record grow.', 'No trades are logged for the selected month. Dates will reveal your rhythm as you record decisions.');
    const net = rows.reduce((sum,t) => sum + Number(t.pnl || 0),0);
    return signal('Your rhythm is taking shape.', net < 0 ? 'Review the difficult days.' : 'Study the pattern.', `The selected month includes recorded trades, and net P&L is ${net < 0 ? 'negative' : net > 0 ? 'positive' : 'flat'}. Calendar placement uses the open date.`);
  }
  if (page === 'backtest') {
    if (!n) return signal('Build the test sample.', 'Start with one setup.', 'Add historical examples before judging whether a strategy has an edge.');
    const losses = trades.filter(t => Number(t.pnl || 0) < 0).length;
    const net = trades.reduce((sum, trade) => sum + Number(trade.pnl || 0), 0);
    return signal(net >= 0 ? 'The test has an edge to inspect.' : 'The test needs a closer look.', losses ? 'Review the losing pattern.' : 'Protect the repeatable setup.', 'Use the screenshots and notes to check whether the setup rules were followed, especially where outcomes closed negative.');
  }
  if (page === 'analytics') {
    if (!n) return signal('Analytics needs evidence.', 'Log the first trades.', 'Performance signals will become useful after you record enough completed decisions.');
    const incomplete = trades.filter(t => !t.closeDate || !t.closeTime || !t.time).length;
    const mistakes = trades.filter(t => t.mistakes?.length).length;
    if (incomplete) return signal('The data needs completing.', 'Fix the missing timing.', 'Some trades are missing open or close timing, which limits holding-time analysis.');
    return signal(mistakes ? 'A behaviour pattern needs attention.' : 'Your analytics are ready to read.', mistakes ? 'Inspect the repeated mistakes.' : 'Compare the strongest conditions.', mistakes ? 'Some trades carry mistake tags; review them before changing the plan.' : 'Use the performance views to identify the conditions worth repeating.');
  }
  if (page === 'finance') {
    const net = trades.reduce((sum, trade) => sum + Number(trade.pnl || 0), 0);
    return signal(n ? 'Keep cash flow intentional.' : 'Start with the account base.', net < 0 ? 'Protect the next decision.' : 'Keep the balance plan visible.', n ? 'Logged trades contribute to your account result. Separate cash movements from trade performance before judging growth.' : 'Record deposits, withdrawals, and savings goals separately from trading results.');
  }
  if (page === 'psychology') {
    const taggedMistakes = trades.filter(t => t.mistakes?.length).length;
    const moodTracked = trades.filter(t => t.moodBefore || t.moodAfter).length;
    if (!n) return signal('Mindset needs a record.', 'Log the first decision.', 'Add trades with mood and mistake notes before looking for behavioural patterns.');
    return signal(taggedMistakes ? 'Your behaviour needs attention.' : 'Your mindset record is forming.', taggedMistakes ? 'Review the repeated triggers.' : 'Keep tracking the emotional context.', 'Look for the conditions where mistake tags or mood records change your decision quality.');
  }
  if (page === 'insights') {
    if (guardrails.tradeEntryLocked) return signal('Risk limits are protecting the account.', 'Pause before the next trade.', 'The active loss guardrail needs time and review before trading resumes.');
    const mistakes = trades.filter(t => t.mistakes?.length).length;
    return signal(mistakes ? 'Risk behaviour needs attention.' : 'Your risk picture is clear.', mistakes ? 'Tighten the repeatable rule.' : 'Keep the plan consistent.', mistakes ? 'Logged trades contain mistake tags. Use the risk views to decide which rule needs more protection.' : 'Review drawdown, risk-to-reward, and consistency before increasing size.');
  }
  if (page === 'news') {
    return signal('Plan around market events.', 'Know the high-impact windows.', 'Use the calendar to identify high-impact releases and bank holidays before choosing a session or placing risk.');
  }
  if (!n) return signal(page === 'reviews' ? 'Nothing to review yet.' : page === 'tradelog' ? 'Start with one trade.' : 'Start with one decision.', 'Build the record.', 'Log a trade with its context first. Your journal needs evidence before it can identify patterns.');
  if (page === 'reviews') return pending ? signal('Turn records into lessons.', 'Close the review gap.', 'Some trades have no saved review. Capture the decision, not just the result.') : signal('Your reviews are up to date.', 'Look for repeat patterns.', 'Every logged trade has a saved review. Compare recurring setups and mistakes across your monthly and annual reflections.');
  if (page === 'tradelog') {
    const missing = trades.filter(t => !t.closeDate || !t.closeTime || !t.time).length;
    if (missing) return signal('Complete the trade story.', 'Make timing visible.', 'Some trades lack full open or close timing. Add optional exit details to unlock holding-time comparisons.');
    return signal('The trade record is connected.', 'Review the decisions.', pending ? 'Some trades still need a saved review; compare execution and outcomes together.' : 'Full trade timing and saved reviews make execution and outcomes easier to compare.');
  }
  if (guardrails.tradeEntryLocked) return signal('Your loss limit is active.', 'Pause and review.', 'Trade entry is paused by an account guardrail. Use this time to review your decisions and prepare your next plan.');
  const mistakes = trades.filter(t => t.mistakes?.length).length;
  if (mistakes) return signal('A pattern needs attention.', 'Review the process.', 'Trade records carry mistake tags. Check which behaviors recur before drawing conclusions from P&L.');
  if (n < 10) return signal('Your record is growing.', 'Keep the context clear.', 'This is an early sample, not proof of an edge. Record plans, timing, and reviews consistently.');
  if (pending) return signal('There is more to learn.', 'Finish the reflections.', 'Some trades still need a review. Fill the gaps before judging the process by results alone.');
  const net = trades.reduce((sum,t) => sum + Number(t.pnl || 0),0);
  return signal(net > 0 ? 'Results are positive.' : 'Results need a closer look.', net > 0 ? 'Protect the process.' : 'Study the decisions.', `Recorded net P&L is ${net > 0 ? 'positive' : net < 0 ? 'negative' : 'flat'}. Compare repeatable decisions, risk, and outcomes; results alone do not prove an edge.`);
}
