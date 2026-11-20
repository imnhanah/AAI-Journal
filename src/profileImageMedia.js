import {createTradeJournalSharedMediaAdapter} from './tradeJournalSharedMedia.js';
import {resolveImageUploadAccess} from './imagePolicy.js';
const adapter=createTradeJournalSharedMediaAdapter();
export async function prepareProfileImage({userId,source,current,client,media=adapter}) {
 if(!source||source===current)return {avatar_url:source||null};
 if(!source.startsWith('data:image/'))return {avatar_url:source};
 const membership=await resolveImageUploadAccess({client,authenticated:true});
 const prepared=await media.prepareScreenshots({userId,membership,sourceRecordId:'profile-avatar',screenshots:[{src:source}]});
 const [saved]=await media.synchronizeScreenshots({userId,membership,getMembership:()=>resolveImageUploadAccess({client,authenticated:true}),screenshots:prepared});
 try{localStorage.setItem(`tj:profile-avatar:${userId}`,JSON.stringify(saved));}catch{/* Bytes are retained in IndexedDB. */}
 return {avatar_url:saved.src,avatar_cloud_ref:saved.cloudRef||'',avatar_local_only:saved.localOnly===true};
}
export async function resolveProfileImage(userId,source,cloudRef='',localOnly=false) {
 const [image]=await adapter.resolveScreenshots({userId,screenshots:[{src:source,cloudRef,localOnly}]});
 return image?.displaySrc||'';
}
