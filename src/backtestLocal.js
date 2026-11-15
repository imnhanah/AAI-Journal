import { protectTestTrade } from './backtestModel.js';
import { changeBacktestWorkspace, readBacktestWorkspace } from './localJournalDb.js';

const find = (rows, id) => rows.find(row => row.id === id);
const versionAfter = current => new Date(Math.max(Date.now(), (Date.parse(current?.updatedAt) || 0) + 1)).toISOString();
const save = (rows, current, next) => {
  if (current) rows[rows.indexOf(current)] = next;
  else rows.push(next);
  return next;
};

function checkVersion(current, expected, remove) {
  if ((!current && (expected || remove)) || (current && current.updatedAt !== expected)) {
    throw new Error('This Strategy Testing record changed. Reopen it before saving.');
  }
}

// Match the cloud adapter's contract so the editor can use the same paths.
export function createLocalBacktestApi(userId) {
  const read = owner => {
    if (owner !== userId) throw new Error('This Strategy Testing workspace belongs to another user.');
    return readBacktestWorkspace(userId);
  };
  return {
    readBacktestCache: read,
    syncBacktests: read,
    refreshTestCache: read,
    loadTestMedia: async (owner, trade) => {
      const current = find((await read(owner)).trades, trade.id);
      checkVersion(current, trade.updatedAt, false);
      return current?.screenshots || {};
    },
    saveTestRun: (run, remove = false) => changeBacktestWorkspace(userId, workspace => {
      const current = find(workspace.runs, run.id);
      checkVersion(current, run.updatedAt, remove);
      if (remove) {
        workspace.runs = workspace.runs.filter(row => row.id !== run.id);
        workspace.trades = workspace.trades.filter(row => row.runId !== run.id);
        return { deleted: run.id };
      }
      return save(workspace.runs, current, { ...run, updatedAt: versionAfter(current) });
    }),
    saveTestTrade: (run, trade, remove = false) => changeBacktestWorkspace(userId, workspace => {
      const parent = find(workspace.runs, run.id);
      if (!parent) throw new Error('This test is unavailable on this device.');
      const current = find(workspace.trades, trade.id);
      if (current && current.runId !== parent.id) throw new Error('This trade belongs to another test.');
      checkVersion(current, trade.updatedAt, remove);
      if (remove) {
        workspace.trades = workspace.trades.filter(row => row.id !== trade.id);
        return { deleted: trade.id };
      }
      const { metadata, screenshots } = protectTestTrade(parent, trade);
      return save(workspace.trades, current, {
        ...metadata, runId: parent.id, updatedAt: versionAfter(current),
        screenshots: screenshots ?? current?.screenshots ?? {},
      });
    }),
  };
}
