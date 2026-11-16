import {useEffect,useState} from 'react';
import {isTradeJournalMediaReference} from './tradeJournalSharedMedia.js';
import {resolveProfileImage} from './profileImageMedia.js';
export function useProfileImage(source,userId,cloudRef='',localOnly=false) {
 const [resolved,setResolved]=useState(null);
 useEffect(()=>{
  let live=true,ownedUrl='';
  if(isTradeJournalMediaReference(source))void resolveProfileImage(userId,source,cloudRef,localOnly).then(url=>{
   if(url?.startsWith('blob:'))ownedUrl=url;
   if(live)setResolved({source,userId,url});else if(ownedUrl)URL.revokeObjectURL(ownedUrl);
  }).catch(()=>{});
  return()=>{live=false;if(ownedUrl)URL.revokeObjectURL(ownedUrl);};
 },[source,userId,cloudRef,localOnly]);
 return isTradeJournalMediaReference(source)?(resolved?.source===source&&resolved?.userId===userId?resolved.url:''):source||'';
}
