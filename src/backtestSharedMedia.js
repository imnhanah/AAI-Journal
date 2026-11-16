import { calculateImageChecksum, createSharedImageStorage } from './sharedImageStorage.js';
import { caseStudyEvidenceCloudPath, caseStudyEvidenceCloudReference, resolveCaseStudyEvidenceCloudUrl, resolveCaseStudyEvidenceDisplayUrl, uploadCaseStudyEvidenceImage } from './caseStudyEvidenceCloud.js';

// Deliberately distinct from the Case Study tj-image: reference. It identifies
// a generic private-media asset, not a legacy Case Study local reference.
export const BACKTEST_SHARED_MEDIA_PREFIX = 'tj-shared-media:';
export const BACKTEST_SHARED_MEDIA_MODULE = 'strategy-testing';
export const backtestSharedMediaReference = id => `${BACKTEST_SHARED_MEDIA_PREFIX}${id}`;
export const backtestSharedMediaId = value => typeof value === 'string' && value.startsWith(BACKTEST_SHARED_MEDIA_PREFIX) ? value.slice(BACKTEST_SHARED_MEDIA_PREFIX.length) : '';
export const isBacktestSharedMediaReference = value => !!backtestSharedMediaId(value);

const sourceOf = item => typeof item === 'string' ? item : item?.src || item?.url || item?.dataUrl || item?.source || item?.data || '';
const dataUrlBlob = async value => {
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(value || '');
  if (!match) return null;
  const body = match[3] || ''; const bytes = match[2] ? Uint8Array.from(atob(body), char => char.charCodeAt(0)) : new TextEncoder().encode(decodeURIComponent(body));
  return new Blob([bytes], { type: match[1] || 'application/octet-stream' });
};
const cleanDisplayFields = item => {
  if (typeof item === 'string') return item;
  const { displaySrc, displayError, ...clean } = item || {};
  return clean;
};
const mapMedia = async (value, mapper) => {
  if (Array.isArray(value)) return Promise.all(value.map(item => mapMedia(item, mapper)));
  if (!value || typeof value !== 'object') return mapper(value);
  if (sourceOf(value)) return mapper(value);
  return Object.fromEntries(await Promise.all(Object.entries(value).map(async ([key, item]) => [key, await mapMedia(item, mapper)])));
};
const knownSources = value => {
  const values = new Set(); const visit = item => {
    if (Array.isArray(item)) return item.forEach(visit);
    if (!item || typeof item !== 'object') { if (typeof item === 'string') values.add(item); return; }
    const source = sourceOf(item); if (source) values.add(source); else Object.values(item).forEach(visit);
  }; visit(value); return values;
};

// Trade-list synchronization deliberately leaves screenshot JSON out of the
// normal payload. A detail view uses this to decide when it must fetch the
// versioned media payload, including after a full browser reload.
export const shouldLoadBacktestMedia = trade => {
  if (Number(trade?.screenshotCount) > 0) return true;
  return knownSources(trade?.screenshots).size > 0;
};

export const backtestMediaVersion = trade => [trade?.id || '', trade?.updatedAt || '', Number(trade?.screenshotCount) || 0].join(':');

export function createBacktestSharedMediaAdapter({ storage = createSharedImageStorage(), upload = uploadCaseStudyEvidenceImage, resolveCloud = resolveCaseStudyEvidenceDisplayUrl } = {}) {
  const assetFor = async (userId, id) => storage.getImageMetadata(id, userId);
  return {
    storage,
    async prepareScreenshots({ userId, membership, screenshots, sourceRecordId, existingScreenshots = {} } = {}) {
      const existing = knownSources(existingScreenshots);
      const reusable = new Map((await storage.getImagesForRecord(userId, sourceRecordId)).map(asset => [asset.checksum, asset]));
      return mapMedia(screenshots || {}, async item => {
        const source = sourceOf(item);
        if (!source || isBacktestSharedMediaReference(source) || existing.has(source) || !source.startsWith('data:image/')) return cleanDisplayFields(item);
        const blob = await dataUrlBlob(source); if (!blob) return cleanDisplayFields(item);
        const checksum = await calculateImageChecksum(blob);
        let asset = reusable.get(checksum);
        if (!asset) { asset = await storage.saveImage({ userId, membership, file: blob, fileName: item?.fileName || 'backtest-screenshot', sourceModule: BACKTEST_SHARED_MEDIA_MODULE, sourceRecordId }); reusable.set(checksum, asset); }
        const base = typeof item === 'string' ? {} : cleanDisplayFields(item);
        for(const key of ['url','dataUrl','source','data','preview','image'])if(base[key]===source)base[key]=backtestSharedMediaReference(asset.id);
        return { ...base, src: backtestSharedMediaReference(asset.id), cloudRef: asset.cloudPath ? caseStudyEvidenceCloudReference(asset.cloudPath) : '', localOnly: !asset.cloudPath };
      });
    },
    async synchronizeScreenshots({ userId, membership, getMembership, screenshots } = {}) {
      const collect = new Set(); await mapMedia(screenshots || {}, item => { const id = backtestSharedMediaId(sourceOf(item)); if (id) collect.add(id); return item; });
      const latestAccess=getMembership ? await getMembership() : membership;
      for (const id of collect) await storage.retryFailedUpload(id, { userId, membership:latestAccess });
      await storage.processUploadQueue({ userId, membership, getMembership, sourceModule: BACKTEST_SHARED_MEDIA_MODULE, uploader: async ({ asset, blob }) => {
        const result = await upload({ userId, evidenceId: asset.id, blob, cloudRef: asset.cloudPath ? caseStudyEvidenceCloudReference(asset.cloudPath) : '' });
        return result?.verified ? { verified: true, cloudPath: caseStudyEvidenceCloudPath(result.cloudRef), checksum: result.checksum } : result;
      } });
      return mapMedia(screenshots || {}, async item => {
        const id = backtestSharedMediaId(sourceOf(item)); if (!id) return cleanDisplayFields(item);
        const asset = await assetFor(userId, id); const base = typeof item === 'string' ? {} : cleanDisplayFields(item);
        return { ...base, src: backtestSharedMediaReference(id), cloudRef: asset?.cloudPath ? caseStudyEvidenceCloudReference(asset.cloudPath) : (base.cloudRef || ''), localOnly: !(asset?.cloudPath || base.cloudRef) };
      });
    },
    async resolveScreenshots({ userId, screenshots } = {}) {
      return mapMedia(screenshots || {}, async item => {
        const source = sourceOf(item); const id = backtestSharedMediaId(source);
        if (!id) return cleanDisplayFields(item);
        const base = typeof item === 'string' ? {} : cleanDisplayFields(item);
        const localUrl = await storage.getLocalImageUrl(id, userId);
        if (localUrl) return { ...base, src: source, displaySrc: localUrl };
        const asset = await assetFor(userId, id);
        if(!base.cloudRef&&!asset?.cloudPath&&(base.localOnly||asset?.storageState==='local-only'))return {...base,src:source,displayError:'local-only'};
        // The private object path is immutable and owner-scoped. A receiving
        // browser may not yet have local metadata or a published cloudRef.
        const cloudRef = base.cloudRef || (asset?.cloudPath ? caseStudyEvidenceCloudReference(asset.cloudPath) : caseStudyEvidenceCloudReference(`${userId}/${id}`));
        // Do not even request a signed URL for an object outside the active
        // authenticated owner's namespace. Storage RLS is the final guard.
        if (!cloudRef || !caseStudyEvidenceCloudPath(cloudRef).startsWith(`${userId}/`)) return { ...base, src: source, displayError: 'missing-cloud-reference' };
        const result = await resolveCloud(cloudRef);
        return result?.url ? { ...base, src: source, cloudRef, displaySrc: result.url } : { ...base, src: source, cloudRef, displayError: result?.code || 'cloud-image-unavailable' };
      });
    },
    serializeScreenshots(screenshots = {}) { return mapMedia(screenshots, item => cleanDisplayFields(item)); },
  };
}

export const backtestSharedMedia = createBacktestSharedMediaAdapter();
