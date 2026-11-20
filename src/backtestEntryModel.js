export const backtestCloudModelLinksEnabled = (cloudAdapter,env=import.meta.env) => cloudAdapter===true && env?.VITE_JOURNAL_WRITE_SAFETY==='true' && env?.VITE_BACKTEST_MODEL_LINKS_CLOUD==='true';
import {classificationSection} from './workspaceClassification.js';

export function backtestModelLinksEnabled(localOnly, env=import.meta.env, hostname=globalThis.location?.hostname) {
  return localOnly === true && env?.DEV === true && env?.VITE_BACKTEST_MODEL_LINKS_PREVIEW === 'true'
    && ['localhost','127.0.0.1','[::1]'].includes(hostname);
}

export function rawBacktestEntryModel(trade) {
  if (!trade) return trade;
  const {_entryModelStored, _entryModelKey, ...raw}=trade;
  if (!_entryModelStored || typeof _entryModelStored!=='object' || Array.isArray(_entryModelStored)) return raw;
  for (const key of ['strategy','entryType','confluenceSession','backtestModelSnapshot']) delete raw[key];
  return {...raw,...Object.fromEntries(['strategy','entryType','confluenceSession','backtestModelSnapshot'].filter(key=>Object.hasOwn(_entryModelStored,key)).map(key=>[key,_entryModelStored[key]]))};
}

export function validBacktestModelRef(trade) {
  const raw=rawBacktestEntryModel(trade),ref=raw?.entryModelRef;
  return !!ref && ref.version===1
    && ['workspaceId','entryTypeId','labelAtSelection'].every(key=>typeof ref[key]==='string' && ref[key].trim())
    && (!raw.strategy || raw.strategy===ref.labelAtSelection)
    && (!raw.entryType || raw.entryType===ref.labelAtSelection);
}

export function backtestModelWorkspace(trade,workspaces=[],fallback=null) {
  const raw=rawBacktestEntryModel(trade);
  if (!raw?.entryModelRef) return fallback;
  return workspaces.find(workspace=>workspace.id===raw.entryModelRef.workspaceId) || null;
}

export function backtestModelLabel(trade,workspaces=[]) {
  const raw=rawBacktestEntryModel(trade);
  if (validBacktestModelRef(raw)) {
    const workspace=backtestModelWorkspace(raw,workspaces);
    const item=workspace && classificationSection(workspace,'entryTypes').items.find(item=>item.id===raw.entryModelRef.entryTypeId);
    if (item) return item.name;
  }
  return raw?.strategy || raw?.entryType || '';
}

export function selectBacktestModel(trade,workspace,value,choice) {
  const raw=rawBacktestEntryModel(trade);
  if (!value) return {...raw,strategy:'',entryType:'',entryModelRef:null};
  // A historical text option does not establish an identity. Preserve it as-is.
  if (!choice) {
    if (raw.entryModelRef) {
      if (validBacktestModelRef(raw) && value===backtestModelLabel(raw,[workspace].filter(Boolean))) return raw;
      throw new Error('Choose the intended current model before changing this association.');
    }
    return {...raw,strategy:value,entryType:value};
  }
  const item=workspace && classificationSection(workspace,'entryTypes').items.find(item=>item.id===choice.id);
  if (!workspace?.id || !item || item.archived || item.name!==value) {
    throw new Error('The model definition changed. Keep this draft and reopen the model choices.');
  }
  return {...raw,strategy:value,entryType:value,entryModelRef:{version:1,workspaceId:workspace.id,entryTypeId:item.id,labelAtSelection:value}};
}

export function presentBacktestEntryModel(trade,workspaces=[]) {
  const raw=rawBacktestEntryModel(trade);
  if (!validBacktestModelRef(raw)) return raw;
  const label=backtestModelLabel(raw,workspaces),ref=raw.entryModelRef;
  return {...raw,
    _entryModelStored:Object.fromEntries(['strategy','entryType','confluenceSession','backtestModelSnapshot'].filter(key=>Object.hasOwn(raw,key)).map(key=>[key,raw[key]])),
    _entryModelKey:JSON.stringify([ref.workspaceId,ref.entryTypeId]),
    strategy:label,entryType:label,confluenceSession:label,
    ...(raw.backtestModelSnapshot ? {backtestModelSnapshot:{...raw.backtestModelSnapshot,name:label}} : {}),
  };
}

export function assertBacktestModelWrite(current,next) {
  const raw=rawBacktestEntryModel(next);
  if (current?.entryModelRef && !Object.hasOwn(raw,'entryModelRef')) {
    throw new Error('This editor cannot preserve the linked model. Keep your draft and update the preview.');
  }
  if (raw.entryModelRef && !validBacktestModelRef(raw)) {
    throw new Error('The saved model association is inconsistent. Choose the intended model again before saving.');
  }
}
