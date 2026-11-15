import { supabase } from './supabaseClient.js';
import { createChallengeStorage } from './challengeStorage.js';
import { fetchAllUserData } from './db.js';
import { loadJournalImage, loadPeriodReviewContent } from './journalCloudCache.js';
import { loadProfileCaseStudyLibrary } from './caseStudyCloud.js';
import { caseStudyEvidenceCloudReference, isCaseStudyEvidenceCloudReference, resolveCaseStudyEvidenceCloudBlob } from './caseStudyEvidenceCloud.js';
import { isEvidenceImageReference, readEvidenceImageReference } from './caseStudyEvidenceImages.js';
import { isDocumentImageReference, readCaseStudyDocumentImage } from './caseStudyDocumentImages.js';
import { caseStudySharedImageId, caseStudySharedImageIntegration } from './caseStudySharedImageIntegration.js';
import { loadTestMedia, preloadBacktests } from './backtestCloud.js';
import { backtestSharedMedia, isBacktestSharedMediaReference } from './backtestSharedMedia.js';
import { isTradeJournalMediaReference } from './tradeJournalSharedMedia.js';
import { privateCache } from './privateCacheRuntime.js';
import { loadRecoveryAccountMedia } from './cloudRecoveryAccountMedia.js';
import { isLegacyImageSource } from './legacyScreenshotMedia.js';

const cloudChallenge = createChallengeStorage({ isLocal: () => false, cloud: supabase });

function dataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function rewriteImages(value, resolveImage) {
  if (Array.isArray(value)) {
    const items = [];
    for (const item of value) items.push(await rewriteImages(item, resolveImage));
    return items;
  }
  if (typeof value === 'string') return resolveImage(value, null);
  if (!value || typeof value !== 'object') return value;
  const result = {};
  for (const [key, item] of Object.entries(value)) {
    result[key] = typeof item === 'string' && ((key!=='cloudRef' && isLegacyImageSource(item)) || ['src', 'url', 'dataUrl', 'source', 'data', 'image', 'preview', 'documentImageRef'].includes(key))
      ? await resolveImage(item, value)
      : typeof item === 'object' ? await rewriteImages(item, resolveImage) : item;
  }
  return result;
}

// Only use the current account's existing read paths. Export a separate file;
// do not install it over a device workspace or mutate any cloud records.
export async function readCloudJournalRecovery(userId, routine, { deviceBackup } = {}) {
  const session = privateCache.token();
  const requireSession = () => {
    if (session.owner !== userId || !privateCache.valid(session)) throw new Error('Account changed during recovery. Sign in again.');
  };
  requireSession();
  const [journal, library, backtests, challenge] = deviceBackup
    ? [{data:deviceBackup.data}, {data:deviceBackup.data.profileCaseStudyLibrary},
      deviceBackup.data.backtestWorkspace || {runs:[],trades:[]}, deviceBackup.data.challengeProgress]
    : await Promise.all([
      fetchAllUserData(userId), loadProfileCaseStudyLibrary(userId), preloadBacktests(userId), cloudChallenge.snapshot(userId),
    ]);
  if (journal.error || library.error || (!deviceBackup && (!journal.data?.financeReady || !journal.data?.balancesReady))) {
    throw new Error('Could not read a complete journal. Retry before relying on a recovery export.');
  }

  const unresolvedImages = new Set();
  const recoverImage = async (reference, read, ownedBlobUrl = false) => {
    requireSession();
    try {
      const source = await read();
      if (source instanceof Blob && source.size) return await dataUrl(source);
      if (typeof source === 'string' && source.startsWith('data:image/')) return source;
      if (typeof source === 'string' && /^(blob:|https?:)/.test(source)) {
        try {
          const response = await fetch(source);
          if (response.ok) {
            const blob = await response.blob();
            if (blob.size && blob.type.startsWith('image/')) return await dataUrl(blob);
          }
        } finally {
          if (ownedBlobUrl && source.startsWith('blob:')) URL.revokeObjectURL(source);
        }
      }
    } catch {
      // Keep unresolved references available for future recovery.
    }
    // Keep private paths and signed tokens out of the report.
    unresolvedImages.add(reference);
    return reference;
  };
  const resolveJournalImage = (source, parent) => {
    if (/^(tj-image:|tj-trade-media:|blob:)/.test(source)) return recoverImage(source, () => loadJournalImage(isTradeJournalMediaReference(source) && parent ? { ...parent, src: source } : source), source.startsWith('tj-trade-media:'));
    if (/^tj-case-study-/.test(source)) return resolveCaseImage(source,parent);
    if (isBacktestSharedMediaReference(source)) return resolveBacktestImage(source,parent);
    // Preserve unsupported references and report them; never fetch arbitrary URLs.
    if (/^(tj-|https?:)/.test(source)) return recoverImage(source,async()=>null);
    return source;
  };
  const caseImageCopies = new Map();
  const resolveCaseImage = (source, parent) => {
    const assetId = caseStudySharedImageId(source);
    const cloudRef = parent?.cloudRef || (isCaseStudyEvidenceCloudReference(source) ? source : '');
    const legacyReader = isEvidenceImageReference(source) ? readEvidenceImageReference
      : isDocumentImageReference(source) ? readCaseStudyDocumentImage : null;
    if (source.startsWith('blob:')) return recoverImage(source, () => source);
    if (!assetId && !legacyReader && !isCaseStudyEvidenceCloudReference(source)) {
      return /^(tj-|https?:)/.test(source) ? recoverImage(source,async()=>null) : source;
    }
    const key = assetId || cloudRef || source;
    if (caseImageCopies.has(key)) return caseImageCopies.get(key);
    const pending = recoverImage(source, async () => {
      const local = assetId ? await caseStudySharedImageIntegration.storage.getImage(assetId, userId)
        : await legacyReader?.(source);
      if (local) return local;
      const ref = cloudRef || (assetId ? caseStudyEvidenceCloudReference(`${userId}/${assetId}`) : '');
      if (!ref.startsWith(caseStudyEvidenceCloudReference(`${userId}/`))) return null;
      return (await resolveCaseStudyEvidenceCloudBlob(ref, { userId })).blob;
    });
    caseImageCopies.set(key, pending);
    return pending.then(result => {
      if (result === source) caseImageCopies.delete(key);
      return result;
    });
  };
  const resolveBacktestImage = (source, parent) => source.startsWith('blob:') ? recoverImage(source, () => source)
    : isBacktestSharedMediaReference(source)
    ? recoverImage(source, async () => {
      const [item] = await backtestSharedMedia.resolveScreenshots({ userId, screenshots: [{ ...parent, src: source }] });
      return item?.displaySrc;
    }, true)
    : source;

  const data = journal.data;
  const withScreenshots = async (rows, resolver) => {
    const recovered = [];
    for (const row of rows) recovered.push({ ...row, screenshots: await rewriteImages(row.screenshots, resolver) });
    return recovered;
  };
  const accounts = [];
  const metadata = deviceBackup ? null : await privateCache.read(`journal:${userId}`);
  const sourceAccounts = deviceBackup ? data.accounts : await loadRecoveryAccountMedia({
    cloud:supabase,userId,accounts:data.accounts,versions:metadata?.accounts,assertSession:requireSession,
  });
  for (const account of sourceAccounts) {
    const source = account.profileImage;
    const profileImage = !source ? '' : source.startsWith('tj-case-study-') ? await resolveCaseImage(source,null)
      : /^(tj-image:|tj-trade-media:)/.test(source) ? await resolveJournalImage(source,null)
      : await recoverImage(source,() => source);
    accounts.push({ ...account, profileImage, trades: await withScreenshots(account.trades, resolveJournalImage) });
  }
  const trades = [];
  for (const trade of backtests.trades) {
    const screenshots = !deviceBackup && trade.screenshotCount > 0 ? await loadTestMedia(userId, trade) : trade.screenshots;
    trades.push({ ...trade, screenshots: await rewriteImages(screenshots || {}, resolveBacktestImage) });
  }
  const profileCaseStudyLibrary = await rewriteImages(library.data, resolveCaseImage);
  const originalEvidence = library.data?.evidence || [];
  for (const [index, evidence] of (profileCaseStudyLibrary?.evidence || []).entries()) {
    const original = originalEvidence[index];
    if (evidence.url === original.url && evidence.cloudRef && !original.url?.startsWith('tj-')) {
      const portable = await resolveCaseImage(evidence.cloudRef, evidence);
      if (portable.startsWith('data:image/')) evidence.url = portable;
    }
    if (evidence.url?.startsWith('data:image/')) delete evidence.cloudRef;
  }
  const markups = await withScreenshots(data.markups, resolveJournalImage);
  const reviews = await withScreenshots(data.reviews, resolveJournalImage);
  const periodReviews = [];
  for (const review of data.periodReviews || []) {
    requireSession();
    const content = review.contentLoaded === false ? await loadPeriodReviewContent(review) : review.content;
    periodReviews.push({ ...review, content, contentLoaded: true });
  }
  requireSession();
  return {
    version: 1, exportedAt: new Date().toISOString(), routine, unavailableImages: unresolvedImages.size, recoveryOwnerId: userId,
    data: {
      ...data, accounts, markups, reviews, periodReviews, profileCaseStudyLibrary, challengeProgress: challenge,
      backtestWorkspace: { runs: backtests.runs, trades },
    },
  };
}
