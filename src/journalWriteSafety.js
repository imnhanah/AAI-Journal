// Paired server rollout stays opt-in. No new cloud protocol is activated by
// merely including these files in a build.
export const journalWriteSafetyEnabled = import.meta.env?.VITE_JOURNAL_WRITE_SAFETY === 'true';
export const journalWriteProtocol = 'journal-write-v1';
export const revisionConflict = 'This record changed elsewhere. Keep your draft, reload the saved record, then retry.';

export function requireBaseRevision(value) {
  if (typeof value !== 'string' || !value.trim() || !Number.isFinite(Date.parse(value))) {
    throw new Error('Load the saved record before updating it. Your draft has been kept.');
  }
  return value;
}

export function canonicalWrite(value) {
  if (value === undefined) throw new Error('Incomplete save request.');
  if (Array.isArray(value)) return `[${value.map(canonicalWrite).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().filter(key=>value[key]!==undefined).map(key=>`${JSON.stringify(key)}:${canonicalWrite(value[key])}`).join(',')}}`;
  if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('Invalid numeric save value.');
  return JSON.stringify(value);
}

// The base revision and the whole intent are part of the receipt key. Retrying
// an ambiguous response uses the same key, even after a reload. A later edit
// with a newer base is a different operation. This is not used for arbitrary
// repeated cash deposits, which require their own distinct intent IDs.
export async function writeOperationKey(kind, userId, request) {
  const bytes = new TextEncoder().encode(canonicalWrite({kind,userId,request}));
  const digest = await globalThis.crypto.subtle.digest('SHA-256',bytes);
  return [...new Uint8Array(digest)].map(value=>value.toString(16).padStart(2,'0')).join('');
}

export function savingsBase(list = []) {
  return list.map(item=>({id:item.id,updatedAt:item.updatedAt??null})).sort((a,b)=>a.id.localeCompare(b.id));
}

export function savingsValues(list) {
  if (!Array.isArray(list)) throw new Error('Invalid savings list.');
  const ids = new Set();
  return list.map(item=>{
    const reminderMinutes = Number(item.reminderMinutes ?? 30);
    const target = Number(item.target ?? 0), allocationPct = Number(item.allocationPct ?? 0);
    if (typeof item.id !== 'string' || !item.id || ids.has(item.id) || !String(item.name??'').trim()
      || !Number.isInteger(reminderMinutes) || reminderMinutes<1 || reminderMinutes>10080
      || !Number.isFinite(target) || target<0 || !Number.isFinite(allocationPct) || allocationPct<0 || allocationPct>100) {
      throw new Error('Check each savings name, amount, allocation and reminder.');
    }
    ids.add(item.id);
    return {id:item.id,name:item.name.trim(),balanceId:item.balanceId||null,target,allocationPct,
      interval:item.interval||'Manual',reminderMinutes};
  });
}
