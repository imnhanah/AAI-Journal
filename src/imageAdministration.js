import {supabase} from './supabaseClient.js';
export async function listImageAccess(users) {
 const {data,error}=await supabase.rpc('tj_list_image_access',{target_users:users});if(error)throw error;
 if(!Array.isArray(data))throw Error('Image access response was not confirmed.');return data;
}
export async function setImageAccess(account,enabled) {
 const {data,error}=await supabase.rpc('tj_set_image_access',{target_user:account.user_id,expected_revision:account.revision,next_enabled:enabled}).single();if(error)throw error;
 if(data?.user_id!==account.user_id||data.enabled!==enabled||!Number.isSafeInteger(Number(data.revision)))throw Error('The server did not confirm image access.');return data;
}
