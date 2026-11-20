// Match broker positions the same way for device and cloud journals.
export function matchBrokerTrades(existingRows, trades, automation, hasEvidence) {
  const tradeKey = (trade) => {
    if (trade.importKey) return trade.importKey;
    const ticket = trade.context?.match(/Imported MetaTrader position #(\S+)/)?.[1];
    if (ticket) return `mt5-position:${ticket}`;
    const cTraderKey = trade.context?.match(/Imported cTrader position #(ctrader:[^[]+)/)?.[1]?.trim();
    return cTraderKey || [trade.date, trade.time || "", trade.closeDate || "", trade.closeTime || "", trade.asset, trade.direction, Number(trade.pnl || 0).toFixed(2)].join("|");
  };
  // Broker positions can be re-uploaded. Keep the richer copy and remove only
  // an exact duplicate that was imported from cTrader or MetaTrader; manually
  // logged trades are never candidates for this cleanup.
  const isImportedBrokerTrade = (trade) => /Imported (?:cTrader position #ctrader:|MetaTrader position #)/i.test(trade.context || "");
  const importDetailScore = (trade) => [
    trade.premarketMarkupId, trade.entryPrice !== "" && trade.entryPrice != null,
    trade.exitPrice !== "" && trade.exitPrice != null, hasEvidence(trade) ? 1 : 0,
    trade.ruleEvaluations?.length, trade.context?.includes("[opening-time:manual]"),
  ].filter(Boolean).length;
  const existingByKey = new Map();
  const duplicateCandidates = [];
  for (const candidate of existingRows) {
    const key = tradeKey(candidate);
    const known = existingByKey.get(key);
    if (!known) { existingByKey.set(key, candidate); continue; }
    if (!isImportedBrokerTrade(known) || !isImportedBrokerTrade(candidate)) continue;
    const candidateWins = importDetailScore(candidate) > importDetailScore(known)
      || (importDetailScore(candidate) === importDetailScore(known) && String(candidate.createdAt || "") < String(known.createdAt || ""));
    duplicateCandidates.push(candidateWins ? known : candidate);
    if (candidateWins) existingByKey.set(key, candidate);
  }
  const existingTrades = [...existingByKey.values()];
  const seen = new Set(existingByKey.keys());
  const importedTradeUpdates = [];
  const challengeStartedAt = Date.parse(automation?.startedAt || "");
  const challengeExistingTradeIds = [];
  const unique = trades.filter((trade) => {
    const key = tradeKey(trade);
    // Older cTrader imports used their opening timestamp in the import key.
    // Fall back to the immutable position details so re-uploading repairs
    // their close timing instead of adding another trade.
    const cTraderMatch = trade.importKey?.startsWith("ctrader:")
      ? existingTrades.find((item) => /Imported cTrader position #/i.test(item.context || "")
        && item.asset === trade.asset && item.direction === trade.direction
        && item.date === trade.date && (trade.openingTimestampMissing
          ? (item.closeDate === trade.closeDate && ((item.closeTime || "") === (trade.closeTime || "") || (item.time || "") === (trade.closeTime || "")))
          : (item.time || "") === (trade.time || ""))
        && Number(item.pnl || 0).toFixed(2) === Number(trade.pnl || 0).toFixed(2))
      : null;
    const existing = existingByKey.get(key) || (trade.legacyImportKey ? existingByKey.get(trade.legacyImportKey) : null) || cTraderMatch;
    if (existing) {
      if (automation?.mode && Number.isFinite(challengeStartedAt) && Date.parse(existing.createdAt || "") >= challengeStartedAt) challengeExistingTradeIds.push(existing.id);
      // Re-uploading a broker report also repairs old imports made before
      // close timestamps were mapped correctly. It never creates a duplicate.
      const needsCloseTiming = trade.closeDate && (existing.closeDate !== trade.closeDate || existing.closeTime !== trade.closeTime);
      const needsOpeningRepair = trade.openingTimestampMissing && !/\[opening-time:manual\]/i.test(existing.context || "") && !/\[close-only\]/i.test(existing.context || "") && !!existing.time;
      const needsEntryPriceRepair = trade.entryPrice !== "" && trade.entryPrice != null && (existing.entryPrice === "" || existing.entryPrice == null);
      const needsExitPriceRepair = trade.exitPrice !== "" && trade.exitPrice != null && (existing.exitPrice === "" || existing.exitPrice == null);
      if (needsCloseTiming || needsOpeningRepair || needsEntryPriceRepair || needsExitPriceRepair) {
        importedTradeUpdates.push({ ...existing, time: needsOpeningRepair ? "" : existing.time, closeDate: trade.closeDate || existing.closeDate, closeTime: trade.closeTime || existing.closeTime || "", entryPrice: needsEntryPriceRepair ? trade.entryPrice : existing.entryPrice, exitPrice: needsExitPriceRepair ? trade.exitPrice : existing.exitPrice, context: needsOpeningRepair ? trade.context : existing.context });
      }
      return false;
    }
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });

  // Only remove copies that have no unique saved evidence or dependent rows.
  // A retained duplicate can still match an incoming trade and prevent reinsertion.
  const included = new Set(automation?.includedIds || []);
  const duplicates = duplicateCandidates.flatMap(row => {
    const keep = existingByKey.get(tradeKey(row));
    if (hasEvidence(row) || row.importHasReview || included.has(row.id)) return [];
    if (row.premarketMarkupId || row.ruleEvaluations?.length
      || /\[opening-time:manual\]/i.test(row.context || '')) return [];
    if (row.brokerDuplicateDetails && (JSON.stringify(row.brokerDuplicateDetails)!==JSON.stringify(keep.brokerDuplicateDetails) ||
      ['entryPrice','exitPrice','time','closeDate','closeTime'].some(key =>
        row[key] !== '' && row[key] != null && row[key] !== keep[key]))) return [];
    if (row.importResultShape?.some(result => !keep.importResultShape?.some(
      other => JSON.stringify(result) === JSON.stringify(other)))) return [];
    return [{ ...row, keepId: keep.id }];
  });
  return {unique, importedTradeUpdates, duplicates, challengeExistingTradeIds};
}

export function brokerImportHasRows(plan) {
  return !!(Array.isArray(plan) ? plan.length : plan?.trades?.length || plan?.cashMovements?.length);
}
