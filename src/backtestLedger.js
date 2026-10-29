import {isClosedTest, orderTestTrades} from './backtestModel.js';

// Build from the complete run before applying display filters or pagination.
export function backtestLedger(trades, startingBalance) {
  let balance = Number(startingBalance) || 0;
  return new Map(orderTestTrades(trades).map((trade, index) => {
    if (isClosedTest(trade)) balance += Number(trade.pnl);
    return [trade.id, {balance, number:index + 1}];
  }));
}
