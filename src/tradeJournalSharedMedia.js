import { calculateImageChecksum, createSharedImageStorage } from './sharedImageStorage.js';
import { caseStudyEvidenceCloudPath, caseStudyEvidenceCloudReference, resolveCaseStudyEvidenceCloudUrl, resolveCaseStudyEvidenceDisplayUrl, uploadCaseStudyEvidenceImage } from './caseStudyEvidenceCloud.js';

// This deliberately does not reuse tj-image: (legacy Case Study) or
// tj-shared-media: (Strategy Testing). Trade Journal media has its own durable
// namespace so old references retain their original meaning forever.
export const TRADE_JOURNAL_MEDIA_PREFIX = 'tj-trade-media:';
export const TRADE_JOURNAL_MEDIA_MODULE = 'trade-journal';
export const tradeJournalMediaReference = id => `${TRADE_JOURNAL_MEDIA_PREFIX}${id}`;
export const tradeJournalMediaId = value => typeof value === 'string' && value.startsWith(TRADE_JOURNAL_MEDIA_PREFIX) ? value.slice(TRADE_JOURNAL_MEDIA_PREFIX.length) : '';
export const isTradeJournalMediaReference = value => !!tradeJournalMediaId(value);

const sourceOf = item => typeof item === 'string' ? item : item?.src || item?.url || item?.dataUrl || item?.source || item?.data || '';
const dataUrlBlob = async value => {
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(value || '');
  if (!match) return null;
  const body = match[3] || '';
  const bytes = match[2] ? Uint8Array.from(atob(body), character => character.charCodeAt(0)) : new TextEncoder().encode(decodeURIComponent(body));
  return new Blob([bytes], { type: match[1] || 'application/octet-stream' });
};
const cleanDisplayFields = item => {
  if (typeof item === 'string') return item;
  const { displaySrc, displayError, ...clean } = item || {};
  return clean;
};
const mapMedia = async (value, mapper) => {
  // Preparation mutates the reusable checksum map. Preserve source order here
  // so selecting the same file twice cannot race into two local assets.
  if (Array.isArray(value)) {
    const mapped = [];
    for (const item of value) mapped.push(await mapMedia(item, mapper));
    return mapped;
  }
  if (!value || typeof value !== 'object') return mapper(value);
  if (sourceOf(value)) return mapper(value);
  const mapped = {};
  for (const [key, item] of Object.entries(value)) mapped[key] = await mapMedia(item, mapper);
  return mapped;
};
const knownSources = value => {
  const values = new Set();
  const visit = item => {
    if (Array.isArray(item)) return item.forEach(visit);
    if (!item || typeof item !== 'object') { if (typeof item === 'string') values.add(item); return; }
    const source = sourceOf(item);
    if (source) values.add(source); else Object.values(item).forEach(visit);
  };
  visit(value);
  return values;
};

export function createTradeJournalSharedMediaAdapter({ storage = createSharedImageStorage(), upload = uploadCaseStudyEvidenceImage, resolveCloud = resolveCaseStudyEvidenceDisplayUrl } = {}) {
  const assetFor = async (userId, id) => storage.getImageMetadata(id, userId);
  return {
    storage,
    async prepareScreenshots({ userId, membership, screenshots, sourceRecordId, existingScreenshots = {} } = {}) {
      const existing = knownSources(existingScreenshots);
      const reusable = new Map((await storage.getImagesForRecord(userId, sourceRecordId)).map(asset => [asset.checksum, asset]));
      return mapMedia(screenshots || {}, async item => {
        const source = sourceOf(item);
        if (!source || isTradeJournalMediaReference(source) || existing.has(source) || !source.startsWith('data:image/')) return cleanDisplayFields(item);
        const blob = await dataUrlBlob(source);
        if (!blob) return cleanDisplayFields(item);
        const checksum = await calculateImageChecksum(blob);
        let asset = reusable.get(checksum);
        if (!asset) {
          asset = await storage.saveImage({ userId, membership, file: blob, fileName: item?.fileName || 'trade-screenshot', sourceModule: TRADE_JOURNAL_MEDIA_MODULE, sourceRecordId });
          reusable.set(checksum, asset);
        }
        const base = typeof item === 'string' ? {} : cleanDisplayFields(item);
        for(const key of ['url','dataUrl','source','data','preview','image'])if(base[key]===source)base[key]=tradeJournalMediaReference(asset.id);
        return { ...base, src: tradeJournalMediaReference(asset.id), cloudRef: asset.cloudPath ? caseStudyEvidenceCloudReference(asset.cloudPath) : '', localOnly: !asset.cloudPath };
      });
    },
    async synchronizeScreenshots({ userId, membership, getMembership, screenshots } = {}) {
      const ids = new Set();
      await mapMedia(screenshots || {}, item => { const id = tradeJournalMediaId(sourceOf(item)); if (id) ids.add(id); return item; });
      const latestAccess=getMembership ? await getMembership() : membership;
      for (const id of ids) await storage.retryFailedUpload(id, { userId, membership:latestAccess });
      await storage.processUploadQueue({ userId, membership, getMembership, sourceModule: TRADE_JOURNAL_MEDIA_MODULE, uploader: async ({ asset, blob }) => {
        const result = await upload({ userId, evidenceId: asset.id, blob, cloudRef: asset.cloudPath ? caseStudyEvidenceCloudReference(asset.cloudPath) : '' });
        return result?.verified ? { verified: true, cloudPath: caseStudyEvidenceCloudPath(result.cloudRef), checksum: result.checksum } : result;
      } });
      return mapMedia(screenshots || {}, async item => {
        const id = tradeJournalMediaId(sourceOf(item));
        if (!id) return cleanDisplayFields(item);
        const asset = await assetFor(userId, id);
        const base = typeof item === 'string' ? {} : cleanDisplayFields(item);
        return { ...base, src: tradeJournalMediaReference(id), cloudRef: asset?.cloudPath ? caseStudyEvidenceCloudReference(asset.cloudPath) : (base.cloudRef || ''), localOnly: !(asset?.cloudPath || base.cloudRef) };
      });
    },
    async resolveScreenshots({ userId, screenshots } = {}) {
      return mapMedia(screenshots || {}, async item => {
        const source = sourceOf(item);
        const id = tradeJournalMediaId(source);
        if (!id) return cleanDisplayFields(item);
        const base = typeof item === 'string' ? {} : cleanDisplayFields(item);
        const localUrl = await storage.getLocalImageUrl(id, userId);
        if (localUrl) return { ...base, src: source, displaySrc: localUrl };
        const asset = await assetFor(userId, id);
        if(!base.cloudRef&&!asset?.cloudPath&&(base.localOnly||asset?.storageState==='local-only'))return {...base,src:source,displayError:'local-only'};
        // A second authenticated browser has no local asset metadata. The
        // fallback path remains constrained below to this owner's namespace.
        const cloudRef = base.cloudRef || (asset?.cloudPath ? caseStudyEvidenceCloudReference(asset.cloudPath) : caseStudyEvidenceCloudReference(`${userId}/${id}`));
        if (!cloudRef || !caseStudyEvidenceCloudPath(cloudRef).startsWith(`${userId}/`)) return { ...base, src: source, displayError: 'missing-cloud-reference' };
        const result = await resolveCloud(cloudRef);
        return result?.url ? { ...base, src: source, cloudRef, displaySrc: result.url } : { ...base, src: source, cloudRef, displayError: result?.code || 'cloud-image-unavailable' };
      });
    },
    serializeScreenshots(screenshots = {}) { return mapMedia(screenshots, item => cleanDisplayFields(item)); },
  };
}

export const tradeJournalSharedMedia = createTradeJournalSharedMediaAdapter();
