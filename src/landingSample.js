// Sample data for the public landing page. Every figure here is illustrative:
// a $10,000 account, 48 trades at 0.5% risk and 1.9R, ending on $11,280.
// Keep the breakdowns summing to the same totals so the page stays consistent.

export const SAMPLE_START = 10000;
export const SAMPLE_END = 11280;

const TRADE_SEQUENCE = 'WWLWWWLWLBLWLWLWWWBWLLLWWWLLWLWLLWLLWWLWWLBLBLWW';
const WIN = 95;
const LOSS = -50;

export function money(value) {
  return `$${Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function signed(value) {
  return `${value < 0 ? '−' : '+'}${money(value)}`;
}

/** Equity curve as SVG paths for a 1000 x 240 viewBox, plus the largest drawdown. */
export function equityCurve() {
  let balance = SAMPLE_START;
  let peak = balance;
  let drawdown = 0;
  const balances = [balance];
  for (const result of TRADE_SEQUENCE) {
    balance += result === 'W' ? WIN : result === 'L' ? LOSS : 0;
    peak = Math.max(peak, balance);
    drawdown = Math.max(drawdown, peak - balance);
    balances.push(balance);
  }
  const low = 9950;
  const high = 11350;
  const points = balances.map((value, index) => {
    const x = (index / (balances.length - 1)) * 1000;
    const y = 228 - ((value - low) / (high - low)) * 210;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const line = `M${points.join(' L')}`;
  return { line, area: `${line} L1000,240 L0,240 Z`, drawdown, end: balance };
}

export const BREAKDOWNS = [
  {
    id: 'model',
    label: 'Model',
    rows: [['Sweep reversal', 21, 62, 1045], ['Continuation', 17, 47, 380], ['Range fade', 10, 30, -145]],
    working: 'Sweep reversal is carrying the account: 62% wins and +$1,045 over 21 trades.',
    attention: 'Range fade has cost $145 over 10 trades. Test it in a Case Study or drop it.',
  },
  {
    id: 'session',
    label: 'Session',
    rows: [['London', 22, 59, 890], ['New York AM', 16, 50, 470], ['New York PM', 6, 33, -60], ['Asia', 4, 25, -20]],
    working: 'London is your best window: 22 trades, 59% wins and +$890.',
    attention: 'New York PM and Asia are both negative. Ten trades there cost $80.',
  },
  {
    id: 'day',
    label: 'Day',
    rows: [['Monday', 8, 38, 35], ['Tuesday', 12, 58, 465], ['Wednesday', 11, 64, 520], ['Thursday', 10, 50, 330], ['Friday', 7, 29, -70]],
    working: 'Tuesday and Wednesday produce most of the profit: $985 of $1,280.',
    attention: 'Monday and Friday win less than 40% of the time.',
  },
  {
    id: 'discipline',
    label: 'Discipline',
    rows: [['All rules followed', 34, 59, 1510], ['One rule broken', 10, 40, -90], ['Two or more broken', 4, 0, -140]],
    working: 'With every rule followed you win 59% of the time and made $1,510.',
    attention: 'The 14 trades with a broken rule lost $230 between them.',
  },
];

export const CHALLENGE = { levels: 10, current: 5, riskPercent: 2, growth: 1.04 };

/** Ten challenge levels: 2% risk for a 4% target (1:2), compounding from the sample start. */
export function challengeLevels() {
  return Array.from({ length: CHALLENGE.levels }, (_, index) => {
    const number = index + 1;
    const start = Math.round(SAMPLE_START * CHALLENGE.growth ** index * 100) / 100;
    return {
      number,
      start,
      target: start * CHALLENGE.growth,
      risk: start * 0.02,
      reward: start * 0.04,
      status: number < CHALLENGE.current ? 'passed' : number === CHALLENGE.current ? 'progress' : 'todo',
    };
  });
}

export const STATUS_LABEL = { passed: 'Passed', progress: 'In progress', todo: 'Not started' };

export const TRADE_RECORD = [
  {
    id: 'plan',
    label: 'Plan',
    heading: 'THE PLAN, WRITTEN BEFORE THE SESSION',
    rows: [['Bias', 'Bearish'], ['Key level', 'Prior-day high 1.0905'], ['Expectation', 'Sweep of the high, then displacement lower'], ['Linked markup', '14 Oct 2026 · EUR/USD · Bearish']],
    note: 'The trade links back to its markup, so what you planned and what you did sit side by side.',
  },
  {
    id: 'execution',
    label: 'Execution',
    heading: 'WHAT WAS ACTUALLY DONE',
    rows: [['Entry model', 'Sweep reversal'], ['Entry / stop / target', '1.0898 / 1.0908 / 1.0879'], ['Risk', '$50.00 · 0.50% of balance'], ['Position size', '0.50 lots'], ['Net P&L', '+$95.00', 'good']],
    note: 'Ten pips of risk for nineteen of reward. Position size comes from the risk you set, not from a guess.',
  },
  {
    id: 'review',
    label: 'Review',
    heading: 'THE REVIEW, WRITTEN AFTER THE CLOSE',
    rows: [['Rating', '4 of 5'], ['Plan followed', 'Yes'], ['Mistakes tagged', 'None']],
    note: 'Waited for the close back under the high before entering. Next time, take partials at the first internal low.',
  },
  {
    id: 'psychology',
    label: 'Psychology',
    heading: 'HOW YOU FELT',
    rows: [['Mood before', 'Calm'], ['Mood after', 'Confident']],
    note: 'No urge to chase after the first move. Sat on hands until the retest.',
  },
  {
    id: 'rules',
    label: 'Rules',
    heading: 'RULES CHECKED: 4 OF 4 FOLLOWED',
    rows: [['Trade London or New York AM only', 'Followed', 'good'], ['Risk 0.5% or less', 'Followed', 'good'], ['Wait for displacement after the sweep', 'Followed', 'good'], ['Minimum 1.9R target', 'Followed', 'good']],
    note: 'Rule results feed the Discipline view in Analytics, so you can see what breaking a rule costs.',
  },
];

export const STUDIES = [
  {
    title: 'Liquidity sweep reversal',
    short: 'Sweep reversal',
    status: 'Validated',
    trades: 21,
    winRate: '62%',
    net: 1045,
    shape: 'reversal',
    level: 'Prior-day high',
    objective: 'Test whether a raid of the prior-day high or low gives a repeatable intraday reversal when it is followed by displacement.',
    hypothesis: 'The sweep only matters when price closes back inside the range and breaks the last opposing swing. Entry is on the first retest, not at the sweep itself.',
    conclusion: 'Validated for London and New York AM. Keep collecting samples and re-test if volatility changes.',
  },
  {
    title: 'London continuation after the Asian range',
    short: 'London continuation',
    status: 'Testing',
    trades: 17,
    winRate: '47%',
    net: 380,
    shape: 'continuation',
    level: 'Asian range high',
    objective: 'Check whether a clean break of the Asian range in London continues far enough to pay 1.9R.',
    hypothesis: 'Continuation works when the higher timeframe agrees and the break closes outside the range, not on a wick.',
    conclusion: 'Still testing. Positive so far, but 17 trades is too few to call it.',
  },
  {
    title: 'Mid-range fade',
    short: 'Mid-range fade',
    status: 'Rejected',
    trades: 10,
    winRate: '30%',
    net: -145,
    shape: 'range',
    level: 'Range midpoint',
    objective: 'See whether fading moves in the middle of a range, away from any key level, has an edge.',
    hypothesis: 'Price in the middle of a range returns to the mean often enough to pay for the losers.',
    conclusion: 'Rejected. Three wins in ten trades and no clear level to lean on. Removed from the playbook.',
  },
];

export const PLATFORMS = [
  { id: 'mt4', short: 'MT4', name: 'MetaTrader 4', format: 'HTML report', steps: ['In the Terminal panel, open the Account History tab.', 'Right-click, choose the period you want, then Save as Report.', 'Upload the saved HTML file to AAICOREFX.'] },
  { id: 'mt5', short: 'MT5', name: 'MetaTrader 5', format: 'HTML report', steps: ['In the Toolbox, open the History tab.', 'Right-click, choose Report, then HTML.', 'Upload the saved HTML file to AAICOREFX.'] },
  { id: 'ctrader', short: 'cTrader', name: 'cTrader', format: 'HTML or CSV', steps: ['Open the History tab for your account.', 'Export the statement as HTML or CSV.', 'Upload the file to AAICOREFX.'] },
];

export const IMPORT_FACTS = [
  'Closed positions become normal journal trades, so you can add markups and reviews to them.',
  'Uploading the same statement again skips duplicates. Nothing is counted twice.',
  'Imported deposits set your account base. Net P&L stays trade-only.',
];

export const STEPS = [
  ['Grow by rule', 'Set a starting balance and a number of levels. The Growth Challenge gives every level its risk and its target.'],
  ['Record everything', 'Log trades by hand or import them from your platform. Each one carries its plan, review, mood and rules.'],
  ['Learn what repeats', 'Analytics shows which conditions pay. Case Studies keep the reasons, so the lesson outlasts the trade.'],
];

export const ALSO_INSIDE = [
  ['Plan', ['Start Day routine', 'Markups', 'Post-session review']],
  ['Record', ['Entry and exit screenshots', 'Multiple accounts']],
  ['Review', ['Trade reviews', 'Monthly, quarterly and yearly reviews', 'Psychology', 'Rules']],
  ['Understand', ['Dashboard', 'Calendar']],
  ['Grow', ['Goals and guardrails', 'Backtesting']],
  ['Workspace', ['Finance', 'Separate journals', 'Languages', 'Themes', 'Security and sync']],
];

export const FAQS = [
  ['What is AAICOREFX, and how does it work?', 'AAICOREFX is a trading journal and performance analysis platform designed to help traders track their trades, understand their performance, and improve their trading habits. It brings together your trading dashboard, advanced analytics, pre-trade markups, and strategy case studies in one organized workspace.'],
  ['Can I import trades from MT4, MT5, or cTrader?', 'Yes. AAICOREFX allows you to import your trading history from MetaTrader 4 (MT4), MetaTrader 5 (MT5), and cTrader using supported HTML or CSV files. This makes it easier to track and analyze your trading performance without manually entering every trade.'],
  ['What trading statistics can I track with AAICOREFX?', 'AAICOREFX provides a dashboard where you can monitor your profit and loss (P&L) and review your overall trading performance. Its analytics section goes deeper, helping you understand your trading behavior, recognize patterns, and identify areas for improvement.'],
  ['How is AAICOREFX different from a regular trading journal?', 'AAICOREFX goes beyond simply recording wins and losses. It combines trade tracking, performance analytics, pre-trade planning, and strategy research in one platform, giving you a more complete understanding of your trading journey.'],
  ['Can I plan my trades before entering the market?', 'Yes. AAICOREFX includes a dedicated Markup Space where you can prepare and document your trade ideas before executing them. This helps you organize your market analysis, plan potential setups, and approach your trades with greater structure and clarity.'],
  ['Can I study and develop new trading strategies with AAICOREFX?', 'Absolutely. The Case Study workspace allows you to research trading concepts, document new strategies, and organize your findings in one place. Whether you’re exploring a different trading approach or refining an existing strategy, AAICOREFX provides a dedicated space for your research and development.'],
  ['Does using AAICOREFX guarantee profitable trading?', 'No. AAICOREFX does not guarantee profits or trading success. It is designed to help you track your performance, analyze your trading behavior, and make more informed decisions through structured journaling and insights. Trading involves risk, and your results ultimately depend on your strategy, risk management, discipline, and market conditions.'],
];

const CANDLE_SHAPES = {
  reversal: { seed: 7, start: 1.0878, level: 1.0905, drift: index => (index < 22 ? 0.0001 : index < 24 ? 0.00045 : index === 24 ? -0.0013 : -0.00028) },
  continuation: { seed: 19, start: 1.085, level: 1.0856, drift: index => (index < 16 ? (index % 2 ? 0.00028 : -0.00028) : 0.00034) },
  range: { seed: 31, start: 1.087, level: 1.087, drift: index => Math.cos(index / 3.2) * 0.0004 },
};

/**
 * A deterministic sample candle chart. Returns positions as percentages of the
 * chart box so the same data fits any size.
 */
export function sampleCandles(shape = 'reversal', count = 40) {
  const config = CANDLE_SHAPES[shape] || CANDLE_SHAPES.reversal;
  let seed = config.seed;
  const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  let price = config.start;
  const bars = [];
  for (let index = 0; index < count; index += 1) {
    const open = price;
    const close = open + config.drift(index) + (random() - 0.5) * 0.0005;
    bars.push({ open, close, high: Math.max(open, close) + random() * 0.0003, low: Math.min(open, close) - random() * 0.0003 });
    price = close;
  }
  const max = Math.max(config.level, ...bars.map(bar => bar.high));
  const min = Math.min(config.level, ...bars.map(bar => bar.low));
  const y = value => 7 + ((max - value) / (max - min)) * 86;
  const slot = 100 / count;
  return {
    levelTop: y(config.level),
    candles: bars.map((bar, index) => {
      const top = y(Math.max(bar.open, bar.close));
      const bottom = y(Math.min(bar.open, bar.close));
      return {
        up: bar.close >= bar.open,
        center: index * slot + slot / 2,
        wickTop: y(bar.high),
        wickHeight: Math.max(0.6, y(bar.low) - y(bar.high)),
        bodyTop: top,
        bodyHeight: Math.max(1, bottom - top),
      };
    }),
  };
}
