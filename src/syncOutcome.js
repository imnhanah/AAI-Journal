// A truthy return, legacy boolean, or fulfilled Promise is not a save receipt.
export const OUTCOME_VERSION = 1;
const text = value => typeof value === 'string' && value.trim().length > 0;
const revision = value => text(value) || Number.isSafeInteger(value) && value > 0;
const message = value => typeof value === 'string' ? value : value?.message || 'Save was not confirmed.';

export function savedOutcome({target, operationId = null, revision: version, parts = ['record']} = {}) {
  if (!['local', 'cloud'].includes(target) || !revision(version) || target === 'cloud' && (!text(operationId) || !text(version)) ||
      !Array.isArray(parts) || !parts.length || parts.some(part => !text(part)) || new Set(parts).size !== parts.length) {
    throw new TypeError('A saved outcome requires an explicit target, revision and complete receipt fields.');
  }
  return Object.freeze({outcomeVersion:OUTCOME_VERSION, status:'saved', target, operationId, revision:version, parts:Object.freeze([...parts])});
}
export function failedOutcome({error, retryable = false, definite = false} = {}) {
  return Object.freeze({outcomeVersion:OUTCOME_VERSION, status:'failed', error:message(error), retryable:retryable === true, definite:definite === true});
}
export function conflictOutcome(error = 'The base revision changed.') {
  return Object.freeze({outcomeVersion:OUTCOME_VERSION, status:'conflict', error:message(error)});
}
export function unknownOutcome(error = 'The save result needs reconciliation.') {
  return Object.freeze({outcomeVersion:OUTCOME_VERSION, status:'unknown', error:message(error)});
}
export function normalizeSaveOutcome(value) {
  if (value === false) return failedOutcome({error:'The save callback reported failure.'});
  if (!value || typeof value !== 'object') return unknownOutcome();
  if (value.error != null && value.status === 'saved') return failedOutcome({error:value.error});
  if (value.outcomeVersion !== OUTCOME_VERSION) {
    return value.error != null ? failedOutcome({error:value.error}) : unknownOutcome();
  }
  if (value.status === 'saved') {
    try { return savedOutcome(value); } catch { return unknownOutcome('The save receipt is incomplete.'); }
  }
  if (value.status === 'failed') return failedOutcome(value);
  if (value.status === 'conflict') return conflictOutcome(value.error);
  return unknownOutcome(value.error);
}
export function saveSucceeded(value, target) {
  const result = normalizeSaveOutcome(value);
  return result.status === 'saved' && (!target || result.target === target);
}
export async function captureSave(action) {
  try { return normalizeSaveOutcome(await action()); }
  // A rejected request may have committed remotely. Do not mark it safely retryable.
  catch (error) { return unknownOutcome(message(error)); }
}
