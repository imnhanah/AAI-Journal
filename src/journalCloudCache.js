import { supabase } from './supabaseClient';
import { journalManifest, mergeJournalDelta, imageReference, resolveImageReferences } from './journalDelta';
import { privateCache } from './privateCacheRuntime';
import { loadRevisionedImage } from './journalImageLoader.js';
import { isTradeJournalMediaReference, tradeJournalSharedMedia } from './tradeJournalSharedMedia.js';

export async function fetchSlimJournal(userId) {
  const { data: session } = await supabase.auth.getSession();
  if (session?.session?.user?.id !== userId) throw new Error('Sign in again to sync your journal.');
  if (privateCache.token().owner !== userId) throw new Error('Session changed before journal sync.');
  const previous = await privateCache.read(`journal:${userId}`) || {};
  return privateCache.get(`journal:${userId}`, async () => {
    const { data, error } = await supabase.rpc('tj_sync_journal', { known: journalManifest(previous) });
    if (error) {
      if (error.code === 'PGRST202' || /tj_sync_journal.*schema cache|function.*tj_sync_journal.*does not exist/i.test(error.message)) throw new Error('Apply supabase/journal_low_egress_migration.sql in the Supabase SQL Editor to enable low-egress sync. Your cached journal is unchanged.');
      throw new Error(error.message || 'Journal sync failed. Your cached journal is unchanged.');
    }
    const next = mergeJournalDelta(previous, data);
    const { data: current } = await supabase.auth.getSession();
    if (current?.session?.user?.id !== userId) throw new Error('Session changed during sync.');
    return next;
  }, { refresh: true });
}

export async function loadJournalImage(source) {
  const sourceValue = typeof source === 'string' ? source : source?.src || '';
  if (isTradeJournalMediaReference(sourceValue)) {
    const { data: session } = await supabase.auth.getSession();
    const userId = session?.session?.user?.id || '';
    if (!userId) throw new Error('Sign in to view this screenshot.');
    if (privateCache.token().owner !== userId) throw new Error('Session changed before loading screenshot.');
    const [resolved] = await tradeJournalSharedMedia.resolveScreenshots({ userId, screenshots:[typeof source === 'string' ? {src:source} : source] });
    if (resolved?.displaySrc) return resolved.displaySrc;
    throw new Error(resolved?.displayError === 'missing-cloud-reference' ? 'This image is not available on this device yet.' : 'Could not load screenshot. Check your connection and retry.');
  }
  const ref = imageReference(sourceValue);
  if (!ref) return sourceValue;
  const { data: session } = await supabase.auth.getSession();
  if (session?.session?.user?.id !== ref.user) throw new Error('Sign in to view this screenshot.');
  if (privateCache.token().owner !== ref.user) throw new Error('Session changed before loading screenshot.');
  return privateCache.get(sourceValue, async () => {
    const data = await loadRevisionedImage(sourceValue, {
      readImage: async currentRef => {
        const {data, error} = await supabase.rpc('tj_journal_image', {source_table:currentRef.table, row_id:currentRef.id, image_path:currentRef.path, image_version:currentRef.version});
        if (error) throw new Error(error.message || 'Could not load screenshot. Check your connection and retry.');
        return data;
      },
      refreshMetadata: fetchSlimJournal,
    });
    const { data: current } = await supabase.auth.getSession();
    if (current?.session?.user?.id !== ref.user) throw new Error('Session changed while loading screenshot.');
    return data;
  });
}

export const materializeScreenshots = value => resolveImageReferences(value, loadJournalImage);
export async function cachedMediaMetadata(table, id) {
  const user = privateCache.token().owner;
  if (!user) return undefined;
  const snapshot = await privateCache.read(`journal:${user}`);
  return snapshot?.[table]?.find(row => row.id === id)?.screenshots;
}

export async function loadPeriodReviewContent(record) {
  const user = privateCache.token().owner;
  if (!user) throw new Error('Sign in before opening a review.');
  return privateCache.get(`journal:${user}:period_reviews:${record.id}:${record.updatedAt}`, async () => {
    const {data,error} = await supabase.from('period_reviews').select('content,updated_at').eq('id',record.id).eq('user_id',user).single();
    if (error || !data) throw new Error(error?.message || 'Review unavailable.');
    if (record.updatedAt && data.updated_at !== record.updatedAt) throw new Error('Review changed in another tab. Sync and reopen it.');
    return data.content || {};
  });
}
