import {imageReference} from './journalDelta.js';

// One metadata refresh can recover a stale revision, never a different record.
export async function loadRevisionedImage(source, {readImage, refreshMetadata}) {
  const ref = imageReference(source);
  if (!ref) return source;
  let data = await readImage(ref);
  if (typeof data === 'string' && data) return data;
  const snapshot = await refreshMetadata(ref.user);
  const row = snapshot?.[ref.table]?.find(item => String(item.id) === String(ref.id));
  let current = row?.screenshots;
  for (const key of ref.path) current = current != null && Object.hasOwn(Object(current), key) ? current[key] : undefined;
  const latest = imageReference(current);
  if (!latest || latest.user !== ref.user || latest.table !== ref.table || latest.id !== ref.id
    || JSON.stringify(latest.path) !== JSON.stringify(ref.path) || latest.version === ref.version) {
    throw new Error('Screenshot is unavailable. Sync your journal and reopen the markup.');
  }
  data = await readImage(latest);
  if (typeof data !== 'string' || !data) throw new Error('Screenshot is unavailable. Sync your journal and reopen the markup.');
  return data;
}
