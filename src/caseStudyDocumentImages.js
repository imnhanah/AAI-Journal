const DATABASE = 'tj-case-study-document-images';
const STORE = 'images';
export const CASE_STUDY_DOCUMENT_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
export const CASE_STUDY_DOCUMENT_IMAGE_MAX_BYTES = 3 * 1024 * 1024;
const prefix = 'tj-case-study-image:';

const id = () => globalThis.crypto?.randomUUID?.() || `document-image-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const requestResult = request => new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
const transactionDone = transaction => new Promise((resolve,reject)=>{transaction.oncomplete=resolve;transaction.onerror=()=>reject(transaction.error);transaction.onabort=()=>reject(transaction.error);});
const open = () => new Promise((resolve,reject)=>{
  if (!globalThis.indexedDB) return reject(new Error('Image storage is unavailable in this browser.'));
  const request=globalThis.indexedDB.open(DATABASE,1);
  request.onupgradeneeded=()=>request.result.createObjectStore(STORE);
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(request.error);
});

export const isDocumentImageReference = value => typeof value === 'string' && value.startsWith(prefix);
export const validateCaseStudyDocumentImage = file => {
  if (!file) return 'Choose an image first.';
  if (!CASE_STUDY_DOCUMENT_IMAGE_TYPES.includes(file.type)) return 'Use a PNG, JPEG, or WebP image.';
  if (file.size > CASE_STUDY_DOCUMENT_IMAGE_MAX_BYTES) return 'Images must be 3 MB or smaller.';
  return null;
};

export async function saveCaseStudyDocumentImage(file) {
  const error=validateCaseStudyDocumentImage(file); if (error) throw new Error(error);
  const ref=`${prefix}${id()}`;
  const database=await open();
  try { const transaction=database.transaction(STORE,'readwrite'); transaction.objectStore(STORE).put({blob:file,type:file.type,name:file.name||'Research image',savedAt:new Date().toISOString()},ref); await transactionDone(transaction); return ref; }
  finally { database.close(); }
}

export async function readCaseStudyDocumentImage(ref) {
  if (!isDocumentImageReference(ref)) return null;
  const database=await open();
  try { const transaction=database.transaction(STORE,'readonly'); return (await requestResult(transaction.objectStore(STORE).get(ref)))?.blob || null; }
  finally { database.close(); }
}
