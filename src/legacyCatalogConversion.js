import {canonicalWrite} from './journalWriteSafety.js';
// Conversion is explicit, workspace-scoped and lossless. No guessing between
// same-name tags or renamed historical aliases, and no changes to trade rows.
export function planLegacyCatalogConversion(workspace) {
 const source=workspace?.entryConfluenceLibrary;
 if(!source)return {needed:false};
 if(source.version!==1 || !Array.isArray(source.entries) || !Array.isArray(source.categories))throw new Error('Unknown legacy catalog. Keep the original; a reviewed mapping is required.');
 if(workspace.classification?.legacyCatalogSource && canonicalWrite(source)===canonicalWrite(workspace.classification.legacyCatalogSource))return {needed:false,converted:true};
 if(workspace.classification && Object.keys(workspace.classification).length)throw new Error('Both catalog versions exist. Review their differences before converting.');
 const entryValues=new Set([...(workspace.confluenceSessions||[]),...(workspace.trades||[]).map(trade=>trade.entryType||trade.confluenceSession).filter(Boolean)]);
 const tagValues=new Set([...(workspace.typeTags||[]),...(workspace.trades||[]).flatMap(trade=>trade.confluence??trade.types??[])]);
 const build=(items,values)=>{
  const used=new Set();
  const converted=items.map(item=>{
   if(typeof item?.label!=='string'||!item.label.trim()||typeof item.description!=='string'||typeof item.archived!=='boolean')throw new Error('Incomplete legacy definition. Keep the original catalog.');
   if(used.has(item.label))throw new Error('Ambiguous duplicate legacy names need an explicit mapping.');used.add(item.label);
   if((item.aliases||[]).some(alias=>alias!==item.label&&values.has(alias)))throw new Error('A historical alias needs an explicit mapping before conversion.');
   return {id:item.label,name:item.label,description:item.description,archived:item.archived};
  });
  for(const value of values)if(!used.has(value)){used.add(value);converted.push({id:value,name:value,description:'',archived:true});}
  return converted;
 };
 const items=build(source.entries,entryValues);
 const flat=build(source.categories.flatMap(category=>category.tags||[]),tagValues);
 const byLabel=new Map(flat.map(item=>[item.id,item]));const assigned=new Set();const categoryIds=new Set();
 const categories=source.categories.map(category=>{
  if(typeof category.id!=='string'||!category.id||categoryIds.has(category.id)||typeof category.label!=='string'||!category.label.trim()||!['single','multi'].includes(category.mode)||!Array.isArray(category.tags))throw new Error('Invalid legacy category. Keep the original catalog.');
  categoryIds.add(category.id);
  return {id:category.id,name:category.label,description:category.description||'',archived:category.archived===true,mode:category.mode,tags:category.tags.map(tag=>{assigned.add(tag.label);return byLabel.get(tag.label);})};
 });
 const missing=flat.filter(item=>!assigned.has(item.id));
 if(missing.length){let category=categories.find(item=>item.id==='category:ungrouped');if(!category){category={id:'category:ungrouped',name:'Ungrouped',description:'',archived:false,mode:'multi',tags:[]};categories.push(category);}category.tags.push(...missing);}
 return {needed:true,workspaceId:workspace.id,expectedCatalog:structuredClone(source),expectedClassification:workspace.classification??null,
  classification:{entryTypes:{revision:1,items},confluences:{revision:1,categories},legacyCatalogSource:structuredClone(source)},tradeRecordsChanged:false};
}
