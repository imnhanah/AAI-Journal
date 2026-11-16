// Image access is independent of journal mode, membership and administrator roles.
export const IMAGE_MAX_BYTES = 3 * 1024 * 1024;
export const IMAGE_LIMIT_MESSAGE = 'Images must be 3 MiB (3,145,728 bytes) or smaller.';
export const LOCAL_IMAGE_WARNING = 'Local-only images are saved in this browser. Clearing browser data or changing devices can lose them unless you have a verified portable backup.';
export const IMAGE_TYPES = Object.freeze(['image/png','image/jpeg','image/webp']);
export function imageSizeError(file) { return !file ? 'Choose an image first.' : file.size > IMAGE_MAX_BYTES ? IMAGE_LIMIT_MESSAGE : ''; }
export async function resolveImageUploadAccess({client,authenticated=false}={}) {
  if(!authenticated) return {imageUploadsAllowed:false,imageAccessStatus:'unauthenticated'};
  try {
    if(!client) ({supabase:client}=await import('./supabaseClient.js'));
    const {data,error}=await client.rpc('tj_can_upload_images');
    if(error||typeof data!=='boolean')return {imageUploadsAllowed:false,imageAccessStatus:'unavailable'};
    return {imageUploadsAllowed:data,imageAccessStatus:'ready'};
  } catch {return {imageUploadsAllowed:false,imageAccessStatus:'unavailable'};}
}
