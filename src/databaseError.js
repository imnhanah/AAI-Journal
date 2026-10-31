const detailFor = (error) => [error?.message, error?.details, error?.hint, error?.code]
  .filter(Boolean)
  .join(" · ");

// Keep implementation details out of customer-facing errors while still
// making the next action clear.
export function databaseErrorMessage(error, action) {
  const detail = detailFor(error);
  const lower = detail.toLowerCase();
  const code = String(error?.code || "");

  if (/workspace_balances_challenge_mode_check|challenge_mode/.test(detail) && /check constraint|violates/i.test(detail)) return "This challenge mode is not available in your database yet. Apply adaptive_balance_mode_migration.sql, then save again.";
  if (/risk_method|risk_preset|stop_loss_pips|take_profit_pips|exit_pips|stop_loss_price|take_profit_price|planned_rr|realized_rr/.test(detail) && /schema cache|does not exist|column/i.test(detail)) return "Calculated R values need a one-time database update before they can be saved.";
  if (/entry_price|exit_price/.test(detail) && /schema cache|does not exist|column/i.test(detail)) return "Entry and exit prices need a one-time database update before they can be saved.";
  if (/close_date|close_time/.test(detail) && /schema cache|does not exist|column/i.test(detail)) return "Close timing needs a one-time database update before it can be saved.";
  if (/schema cache|does not exist|column/i.test(detail)) return "This journal needs a required database update before trades can be saved.";
  if (code === "401" || /jwt expired|invalid jwt|session.*expired|not authenticated/.test(lower)) return "Your sign-in session has expired. Sign in again, then save the trade.";
  if (code === "42501" || /row-level security|permission denied|not authorized|forbidden/.test(lower)) return "You do not have permission to save a trade in this journal. Sign out and back in, then try again.";
  if (["23502", "23503", "23514", "22P02", "22003", "22007"].includes(code) || /violates .*constraint|invalid input syntax|not-null constraint/.test(lower)) return "Some trade details are invalid or incomplete. Review the required fields and timing, then try again.";
  if (/failed to fetch|network|timeout|abort/.test(lower)) return "The journal could not reach the server. Check your connection and try again.";
  return `We couldn't ${action}. Please try again.`;
}
