// Additive read normalization. Source records and image references are never mutated.
export const isLegacyImageSource = value => typeof value === 'string' && /^(data:image\/|blob:|tj-[\w-]+:)/.test(value);
const sourceKeys = ['src', 'url', 'dataUrl', 'source', 'data', 'image', 'preview'];
function imageSource(value) {
  if (isLegacyImageSource(value)) return value;
  if (!value || typeof value !== 'object') return '';
  for (const key of [...sourceKeys, 'file']) {
    const source = imageSource(value[key]);
    if (source) return source;
  }
  return '';
}
const list = value => Array.isArray(value) ? value : imageSource(value) ? [value] : [];
const object = value => value && typeof value === 'object' && !Array.isArray(value);
function originals(value, groups) {
  const result = object(value) ? {...value} : {};
  if (object(value) && groups.some(key => value[key] != null && !Array.isArray(value[key]))) result.legacyOriginal = value;
  if (isLegacyImageSource(value)) result.legacyAttachments = [value];
  return result;
}
export function preserveTradeScreenshots(value) {
  if (Array.isArray(value)) return {entry:value.slice(0,2),exit:value.slice(2,4),...(value.length>4?{legacyAttachments:value.slice(4)}:{})};
  return {...originals(value,['entry','exit']),entry:list(value?.entry),exit:list(value?.exit)};
}
export function preserveMarkupScreenshots(value) {
  return {...originals(value,['preHTF','preM15','preH4','postH4','postM15']),
    preHTF:list(value?.preHTF || value?.postD1),preM15:list(value?.preM15 || value?.pre || (Array.isArray(value)?value:[])),
    preH4:list(value?.preH4),postH4:list(value?.postH4),postM15:list(value?.postM15)};
}
export function additionalScreenshotImages(value, knownGroups) {
  const seen = new Set();
  const collect = (item, output, path) => {
    const source = imageSource(item);
    if (source) {
      if (!seen.has(source)) {seen.add(source);output?.push({...(object(item)?item:{}),src:source,recoveryPath:path});}
      return;
    }
    if (Array.isArray(item)) item.forEach((entry,index)=>collect(entry,output,[...path,index]));
    else if (object(item)) Object.entries(item).forEach(([key,entry])=>collect(entry,output,[...path,key]));
  };
  for (const key of knownGroups) collect(value?.[key],null,[key]);
  const output=[];
  for (const [key,item] of Object.entries(value||{})) if (!knownGroups.includes(key)) collect(item,output,[key]);
  return output;
}
