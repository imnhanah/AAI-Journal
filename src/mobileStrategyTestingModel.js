// Display helpers for the phone Strategy testing screen. Nothing here changes a stored value.
import {isClosedTest} from './backtestModel.js';

// Number and running balance for each closed trade, from stats already worked out by backtestStats.
export function strategyTradeMeta(stats) {
  const meta = new Map();
  stats.closed.forEach((trade,index) => meta.set(trade.id,{number:index + 1,balance:stats.equity[index + 1]?.balance}));
  return meta;
}

export function strategyResult(trade) {
  if (!isClosedTest(trade)) return 'running';
  const pnl = Number(trade.pnl);
  return pnl > 0 ? 'win' : pnl < 0 ? 'loss' : 'flat';
}

export function strategyTotals(trades) {
  const closed = trades.filter(isClosedTest);
  return {
    pnl:closed.reduce((sum,trade) => sum + Number(trade.pnl || 0),0),
    r:closed.reduce((sum,trade) => sum + (Number.isFinite(Number(trade.rr)) && trade.rr !== '' && trade.rr != null ? Number(trade.rr) : 0),0),
  };
}

export function strategyStreakTitle(stats) {
  if (stats.streak < 2) return 'No streak';
  return `${stats.streak} ${stats.streakType === 'flat' ? 'break-even' : stats.streakType} streak`;
}

// Turns a balance series into chart coordinates, keeping steps so each trade reads as its own move.
export function strategyEquityPath(points,width = 340,height = 170,pad = 12) {
  if (!points.length) return {line:'',area:'',baseline:height / 2,x:() => 0};
  const low = Math.min(...points), high = Math.max(...points), spare = (high - low || Math.abs(high) || 100) * .15;
  const min = low - spare, max = high + spare;
  const x = index => 6 + (points.length > 1 ? index / (points.length - 1) : 0) * (width - 12);
  const y = value => pad + (1 - (value - min) / (max - min)) * (height - pad * 2);
  let line = `M${x(0)} ${y(points[0])}`;
  for (let index = 1; index < points.length; index++) line += ` H${x(index)} V${y(points[index])}`;
  return {line,area:`${line} V${height - pad} H${x(0)} Z`,baseline:y(points[0]),x};
}
