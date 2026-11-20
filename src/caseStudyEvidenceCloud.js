import {createCloudImageCache} from './cloudImageCache.js';
import {IMAGE_MAX_BYTES,IMAGE_LIMIT_MESSAGE} from './imagePolicy.js';
import { calculateImageChecksum, createSharedImageStorage, IMAGE_STORAGE_STATES } from './sharedImageStorage.js';

export const CASE_STUDY_EVIDENCE_BUCKET='case-study-evidence';
const PREFIX='tj-case-study-storage:';
export const isCaseStudyEvidenceCloudReference=value=>typeof value==='string'&&value.startsWith(PREFIX);
export const caseStudyEvidenceCloudReference=path=>`${PREFIX}${path}`;
export const caseStudyEvidenceCloudPath=reference=>isCaseStudyEvidenceCloudReference(reference)?reference.slice(PREFIX.length):'';
const imagePath=(userId,evidenceId)=>`${userId}/${evidenceId}`;
const storageClient=async()=> (await import('./supabaseClient.js')).supabase;
const SIGNED_URL_SECONDS = 600;
const URL_EXPIRY_MARGIN_MS = 30_000;
const IMAGE_CACHE_MS = 10 * 60_000;
const IMAGE_FETCH_TIMEOUT_MS = 25_000;
const imageStorage = createSharedImageStorage();
const clientResolvers = new WeakMap();

// Keep retrieval diagnostics actionable without leaking private object paths,
// signed URLs, or access tokens into the browser console.
export const classifyCaseStudyEvidenceCloudError=error=>{
  const message=String(error?.message||error||'').toLowerCase();
  if (/not found|does not exist|no such object/.test(message)) return 'cloud-object-missing';
  if (/permission|authoriz|forbidden|not allowed|row-level security|jwt/.test(message)) return 'signed-url-authorization-failed';
  if (/network|fetch|offline|timeout|abort/.test(message)) return 'cloud-network-failed';
  return 'signed-url-failed';
};

const failed = (code, error = 'The shared evidence image could not be opened.') => ({ error, code });
const unauthorized = () => failed('signed-url-authorization-failed');

export function createCaseStudyImageResolver({
  client, storage = imageStorage, fetchImage = globalThis.fetch.bind(globalThis),
  now = Date.now, maxEntries = 64, maxBytes = 24 * 1024 * 1024,
  persistentCache = createCloudImageCache({namespace:client?.supabaseUrl || "injected-client"}),
} = {}) {
  const signedUrls = new Map();
  const images = new Map();
  const signing = new Map();
  const downloading = new Map();
  let owner;
  let cacheBarrier = Promise.resolve();
  let imageBytes = 0;
  let session = new AbortController();

  function setOwner(nextOwner) {
    if (owner === nextOwner) return;
    const previousOwner = owner;
    owner = nextOwner;
    if (previousOwner) cacheBarrier = cacheBarrier.then(()=>persistentCache.clearOwner(previousOwner)).catch(()=>{});
    session.abort();
    session = new AbortController();
    signedUrls.clear();
    images.clear();
    imageBytes = 0;
    signing.clear();
    downloading.clear();
  }
  client.auth?.onAuthStateChange?.((_event, current) => setOwner(current?.user?.id || ''));

  const removeImage = path => {
    imageBytes -= images.get(path).blob.size;
    images.delete(path);
  };
  function readCached(cache, path, remove = key => cache.delete(key)) {
    const entry = cache.get(path);
    if (!entry) return undefined;
    if (entry.expiresAt <= now()) {
      remove(path);
      return undefined;
    }
    cache.delete(path);
    cache.set(path, entry);
    return entry;
  }
  function rememberImage(path, blob) {
    if (blob.size > maxBytes) return;
    for (const [key, entry] of images) if (entry.expiresAt <= now()) removeImage(key);
    images.set(path, { blob, expiresAt: now() + IMAGE_CACHE_MS });
    imageBytes += blob.size;
    while (images.size > maxEntries || imageBytes > maxBytes) removeImage(images.keys().next().value);
  }
  function share(pending, path, load) {
    if (pending.has(path)) return pending.get(path);
    const work = load().finally(() => {
      if (pending.get(path) === work) pending.delete(path);
    });
    pending.set(path, work);
    return work;
  }
  async function sign(path, signal) {
    const cached = readCached(signedUrls, path);
    if (cached) return { url: cached.url, code: 'ok' };
    return share(signing, path, async () => {
      const expiresAt = now() + SIGNED_URL_SECONDS * 1000 - URL_EXPIRY_MARGIN_MS;
      const { data, error } = await client.storage.from(CASE_STUDY_EVIDENCE_BUCKET).createSignedUrl(path, SIGNED_URL_SECONDS);
      if (signal.aborted) return unauthorized();
      if (error) return failed(classifyCaseStudyEvidenceCloudError(error), error.message);
      if (!data?.signedUrl) return failed('signed-url-missing', 'The shared evidence image did not receive a signed URL.');
      signedUrls.set(path, { url: data.signedUrl, expiresAt });
      if (signedUrls.size > maxEntries) signedUrls.delete(signedUrls.keys().next().value);
      return { url: data.signedUrl, code: 'ok' };
    });
  }
  async function fetchBlob(url, sessionSignal) {
    const request = new AbortController();
    const abort = () => request.abort();
    sessionSignal.addEventListener('abort', abort, { once: true });
    if (sessionSignal.aborted) abort();
    const timeout = setTimeout(abort, IMAGE_FETCH_TIMEOUT_MS);
    try {
      const response = await fetchImage(url, { signal: request.signal, cache: 'no-store' });
      return { status: response.status, blob: response.ok ? await response.blob() : null };
    } finally {
      clearTimeout(timeout);
      sessionSignal.removeEventListener('abort', abort);
    }
  }
  async function download(path, signal, version = 'immutable-v1') {
    const cacheKey=JSON.stringify([path,version]);
    const cached = readCached(images, cacheKey, removeImage);
    if (cached) return { blob: cached.blob, code: 'ok' };
    return share(downloading, cacheKey, async () => {
      await cacheBarrier;
      if(signal.aborted)return unauthorized();
      try { const blob=await persistentCache.read(owner,path,version);if(signal.aborted)return unauthorized();if(blob){rememberImage(cacheKey,blob);return {blob,code:"ok"};} } catch { /* A disposable download cache must not prevent cloud recovery. */ }
      const assetId = path.slice(owner.length + 1);
      if (assetId && !assetId.includes('/')) {
        try {
          const asset = await storage.getImageMetadata(assetId, owner);
          if (asset?.storageState === IMAGE_STORAGE_STATES.CLOUD_VERIFIED && asset.cloudPath === path && !signal.aborted) {
            const blob = await storage.getImage(assetId, owner);
            if (signal.aborted) return unauthorized();
            if (blob) return { blob, code: 'ok' };
          }
        } catch { /* Cloud retrieval also supports browsers with IndexedDB disabled. */ }
      }
      for (let attempt = 0; attempt < 2; attempt += 1) {
        if (signal.aborted) return unauthorized();
        const signed = await sign(path, signal);
        if (!signed.url || signal.aborted) return signal.aborted ? unauthorized() : signed;
        const { status, blob } = await fetchBlob(signed.url, signal);
        if (signal.aborted) return unauthorized();
        if ([401, 403].includes(status)) {
          if (signedUrls.get(path)?.url === signed.url) signedUrls.delete(path);
          if (attempt === 0) continue;
          return unauthorized();
        }
        if (!blob) return failed(status === 404 ? 'cloud-object-missing' : 'cloud-network-failed');
        if (!blob.size) return failed('cloud-image-empty');
        await persistentCache.write(owner,path,blob,{version,isCurrent:()=>!signal.aborted}).catch(()=>{});
        if(signal.aborted)return unauthorized();
        rememberImage(cacheKey, blob);
        return { blob, code: 'ok' };
      }
    });
  }
  async function resolve(reference, { userId = '', bytes = false, version = 'immutable-v1' } = {}) {
    const path = caseStudyEvidenceCloudPath(reference);
    const pathOwner = path.split('/')[0];
    if (!pathOwner || !path.slice(pathOwner.length + 1)) return failed('invalid-cloud-reference');
    try {
      const previousSession = session;
      // The injected Storage-only clients used by tests have no Auth API.
      const current = client.auth ? (await client.auth.getSession()).data?.session?.user?.id || '' : userId || pathOwner;
      if (previousSession !== session && owner !== current) return unauthorized();
      setOwner(current);
      if (pathOwner !== current || (userId && userId !== current)) return unauthorized();
      const { signal } = session;
      const result = await (bytes ? download(path, signal, version) : sign(path, signal));
      return signal.aborted ? unauthorized() : result;
    } catch (error) {
      return failed(classifyCaseStudyEvidenceCloudError(error));
    }
  }
  resolve.peekBlob = (reference, userId) => {
    const path = caseStudyEvidenceCloudPath(reference);
    if (!userId || userId !== owner || !path.startsWith(`${userId}/`)) return undefined;
    return readCached(images, JSON.stringify([path,'immutable-v1']), removeImage)?.blob;
  };
  resolve.invalidate=async(reference,userId)=>{const path=caseStudyEvidenceCloudPath(reference);if(owner!==userId||!path.startsWith(userId+'/'))return false;for(const key of images.keys())if(JSON.parse(key)[0]===path)removeImage(key);signedUrls.delete(path);await persistentCache.invalidate(userId,path);return true;};
  return resolve;
}

let defaultResolver;
async function resolveCloudImage(reference, { client, userId, bytes, version } = {}) {
  try {
    const supabase = client || await storageClient();
    if (!clientResolvers.has(supabase)) clientResolvers.set(supabase, createCaseStudyImageResolver({ client: supabase }));
    const resolve = clientResolvers.get(supabase);
    if (!client) defaultResolver = resolve;
    return await resolve(reference, { userId, bytes, version });
  } catch (error) {
    return failed(classifyCaseStudyEvidenceCloudError(error));
  }
}

export const resolveCaseStudyEvidenceCloudUrl = (reference, options) => resolveCloudImage(reference, options);
export const resolveCaseStudyEvidenceCloudBlob = (reference, options) => resolveCloudImage(reference, { ...options, bytes: true });
export const peekCaseStudyEvidenceCloudBlob = (reference, userId) => defaultResolver?.peekBlob(reference, userId);
export async function uploadCaseStudyEvidenceImage({userId,evidenceId,blob,cloudRef='',client}={}) {
  if (!userId||!evidenceId||!blob) return {error:'The evidence image is incomplete.'};
  if(blob.size>IMAGE_MAX_BYTES)return {error:IMAGE_LIMIT_MESSAGE};
  const path=caseStudyEvidenceCloudPath(cloudRef)||imagePath(userId,evidenceId); const supabase=client||await storageClient();
  const bucket=supabase.storage.from(CASE_STUDY_EVIDENCE_BUCKET);
  // storage-js wraps Blobs in multipart FormData. Safari's IndexedDB-backed
  // files can lose their upload body on that path, even when locally readable.
  const bytes=await blob.arrayBuffer();
  const {error:uploadError}=await bucket.upload(path,bytes,{upsert:false,contentType:blob.type||'application/octet-stream'});
  if (uploadError && !/already exists|duplicate/i.test(uploadError.message||'')) return {error:uploadError.message||'The evidence image could not be uploaded.'};
  // A metadata response alone is not enough: read the private object back
  // before publishing its durable reference into the synchronized library.
  const {data:verified,error:verifyError}=await bucket.download(path);
  if (verifyError||!verified||verified.size!==blob.size) return {error:verifyError?.message||'The evidence image upload could not be verified.'};
  // Supabase Storage does not expose a trustworthy content checksum in this
  // client response. Reading back is therefore required before the shared
  // queue can publish a durable cloud reference.
  const [expectedChecksum,verifiedChecksum]=await Promise.all([calculateImageChecksum(blob),calculateImageChecksum(verified)]);
  if (expectedChecksum!==verifiedChecksum) return {error:'The uploaded evidence image did not match the local image.'};
  return {cloudRef:caseStudyEvidenceCloudReference(path),checksum:verifiedChecksum,verified:true};
}

const displayCopies=new WeakMap();
export async function resolveCaseStudyEvidenceDisplayUrl(reference,options) {
 const result=await resolveCaseStudyEvidenceCloudBlob(reference,options);if(!result.blob)return result;
 if(!displayCopies.has(result.blob))displayCopies.set(result.blob,(async()=>{const bytes=new Uint8Array(await result.blob.arrayBuffer());let body='';for(let i=0;i<bytes.length;i+=8192)body+=String.fromCharCode(...bytes.subarray(i,i+8192));return `data:${result.blob.type||'image/png'};base64,${btoa(body)}`;})());
 return {...result,url:await displayCopies.get(result.blob)};
}
