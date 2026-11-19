export const classificationWritingEnabled = import.meta.env?.VITE_WORKSPACE_CLASSIFICATION_WRITE === 'true' || (import.meta.env?.PROD === true && import.meta.env?.VITE_WORKSPACE_CLASSIFICATION_WRITE !== 'false');
export const classificationProtocol = 'workspace-classification-v1';
export const classificationConflict = 'Journal Setup changed on another device. Reload, then retry your edit.';

export const entryTypeKey = trade => trade?.entryType || trade?.confluenceSession || '';
export const confluenceKeys = trade => trade?.confluence ?? trade?.types ?? [];
const normalizeName = name => name.trim().toLowerCase();
const ungrouped = 'aai-category:ungrouped';

function legacyItems(values) {
  return [...new Set((values || []).filter(value => typeof value === 'string' && value.trim()))]
    .map(value => ({ id:value, name:value, description:'', archived:false }));
}

export function classificationSection(workspace, part) {
  const saved = workspace?.classification?.[part];
  if (saved) return saved;
  if (part === 'entryTypes') return { revision:0, items:legacyItems(workspace?.confluenceSessions) };
  if (part === 'confluences') {
    const tags = legacyItems(workspace?.typeTags);
    return { revision:0, categories:tags.length ? [{id:ungrouped,name:'Ungrouped',mode:'multi',archived:false,tags}] : [] };
  }
  return { revision:0, ids:orderedRules(workspace?.rules).map(rule => rule.id) };
}

export function orderedRules(rules = [], ids = []) {
  const ranked = new Map(ids.map((id, index) => [id,index]));
  return [...rules].sort((a,b) => (
    (ranked.get(a.id) ?? Infinity) - (ranked.get(b.id) ?? Infinity)
    || String(a.createdAt ?? '').localeCompare(String(b.createdAt ?? ''))
    || String(a.id).localeCompare(String(b.id))
  ));
}

export function moveClassificationItem(items, id, index) {
  const from = items.findIndex(item => (typeof item === 'string' ? item : item.id) === id);
  if (from < 0 || !Number.isInteger(index) || index < 0 || index >= items.length || from === index) return items;
  const next = [...items];
  next.splice(index,0,...next.splice(from,1));
  return next;
}

export function newClassificationItem(kind, name, description = '') {
  return { id:`aai-${kind}:${globalThis.crypto.randomUUID()}`, name:name.trim(), description:description.trim(), archived:false };
}

export function duplicateClassificationName(items, name, except) {
  return items.some(item => !item.archived && item.id !== except && normalizeName(item.name) === normalizeName(name));
}

export function entryTypeOptions(workspace, selected) {
  const {items} = classificationSection(workspace,'entryTypes');
  const active = items.filter(item => !item.archived);
  const historical = selected && !active.some(item => item.id === selected)
    ? items.find(item => item.id === selected) ?? {id:selected,name:unavailableLabel(selected),description:'',archived:true}
    : null;
  return historical ? [...active,historical] : active;
}

const opaqueIdentifier = /^aai-(entry|tag):[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const unavailableLabel = id => opaqueIdentifier.test(id) ? 'Definition unavailable' : id;

export function classificationLookup(workspace) {
  const entryItems = classificationSection(workspace,'entryTypes').items;
  const entryLabels = new Map(entryItems.map(item => [item.id,item.name]));
  const categories = classificationSection(workspace,'confluences').categories;
  const tags = categories.flatMap(category => category.tags.map(tag => ({...tag,category:category.name})));
  const occurrences = new Map();
  for (const tag of tags) {
    const key = normalizeName(tag.name);
    occurrences.set(key,(occurrences.get(key) || 0)+1);
  }
  const tagLabels = new Map(tags.map(tag => [tag.id,occurrences.get(normalizeName(tag.name)) > 1 ? `${tag.name} · ${tag.category}` : tag.name]));
  return {
    entry: id => entryLabels.get(id) ?? unavailableLabel(id),
    tag: id => tagLabels.get(id) ?? unavailableLabel(id),
  };
}

export function presentTradeClassification(trade, lookup) {
  const key = entryTypeKey(trade);
  const tags = confluenceKeys(trade);
  return {...trade, entryTypeLabel:key ? lookup.entry(key) : '', confluenceLabels:tags.map(lookup.tag)};
}

export const entryTypeLabel = trade => trade?.entryTypeLabel || entryTypeKey(trade);
export const confluenceLabels = trade => trade?.confluenceLabels ?? confluenceKeys(trade);
export const classifiedTags = trade => confluenceKeys(trade).map((id,index) => ({id,label:confluenceLabels(trade)[index] ?? id}));

export function rawTradeClassification(trade) {
  const {entryTypeLabel:displayEntryType, confluenceLabels:displayConfluences, ...raw} = trade;
  return raw;
}

export function toggleConfluence(category, selected, id) {
  if (selected.includes(id)) return selected.filter(key => key !== id);
  if (category.mode === 'multi') return [...selected,id];
  const own = new Set(category.tags.map(tag => tag.id));
  return [...selected.filter(key => !own.has(key)),id];
}

export function selectionConflicts(categories, selected) {
  const keys = new Set(selected);
  return categories.filter(category => category.mode === 'single' &&
    category.tags.filter(tag => keys.has(tag.id)).length > 1);
}

export function classificationSaveRequest(workspace, part, next) {
  const previous = classificationSection(workspace,part);
  const legacy = part === 'entryTypes' ? workspace.confluenceSessions ?? []
    : part === 'confluences' ? workspace.typeTags ?? []
    : orderedRules(workspace.rules).map(rule=>rule.id);
  return { workspace_id:workspace.id, section:part, expected_revision:previous.revision,
    expected_legacy:part === 'ruleOrder' || previous.revision === 0 ? legacy : null, value:next };
}

export function applyClassificationSave(workspace, request) {
  const previous = classificationSaveRequest(workspace,request.section,null);
  if (request.expected_revision !== previous.expected_revision ||
      JSON.stringify(request.expected_legacy) !== JSON.stringify(previous.expected_legacy)) {
    throw new Error(classificationConflict);
  }
  return { ...workspace.classification, [request.section]:{...request.value,revision:previous.expected_revision+1} };
}

function validRecoveryItem(item) {
  return typeof item?.id === 'string' && item.id.trim() && typeof item.name === 'string' && item.name.trim()
    && typeof item.description === 'string' && typeof item.archived === 'boolean';
}
const validRevision = section => Number.isSafeInteger(section?.revision) && section.revision > 0;
const validIds = ids => Array.isArray(ids) && ids.every(id=>typeof id === 'string' && id.trim()) && new Set(ids).size === ids.length;

export function assertClassificationRecovery(accounts) {
  for (const workspace of accounts || []) {
    const config=workspace.classification;
    if (config != null) {
      const badCatalog=typeof config!=='object' || Array.isArray(config) ||
        Object.keys(config).some(key=>!['entryTypes','confluences','ruleOrder'].includes(key));
      const entries=config.entryTypes;
      const confluences=config.confluences;
      const order=config.ruleOrder;
      const badEntries=entries && (!validRevision(entries) || !Array.isArray(entries.items)
        || !entries.items.every(validRecoveryItem) || !validIds(entries.items.map(item=>item.id)));
      const badConfluences=confluences && (!validRevision(confluences) || !Array.isArray(confluences.categories)
        || !confluences.categories.every(category=>typeof category?.id==='string' && category.id.trim() &&
          typeof category.name==='string' && category.name.trim() && typeof category.archived==='boolean' &&
          ['single','multi'].includes(category.mode) && Array.isArray(category.tags) && category.tags.every(validRecoveryItem))
        || !validIds(confluences.categories.map(category=>category.id))
        || !validIds(confluences.categories.flatMap(category=>category.tags.map(item=>item.id))));
      if (badCatalog || badEntries || badConfluences || (order && (!validRevision(order) || !validIds(order.ids)))) {
        throw new Error('This recovery copy has invalid workspace classification settings. Keep the original copy.');
      }
    }
    const entries = new Set(classificationSection(workspace,'entryTypes').items.map(item => item.id));
    const tags = new Set(classificationSection(workspace,'confluences').categories.flatMap(category => category.tags.map(tag => tag.id)));
    const missing = (workspace.trades || []).some(trade =>
      (opaqueIdentifier.test(entryTypeKey(trade)) && !entries.has(entryTypeKey(trade))) ||
      confluenceKeys(trade).some(id => opaqueIdentifier.test(id) && !tags.has(id)));
    if (missing) throw new Error('This recovery copy is missing Entry Type or Confluence definitions. Keep the original copy and restore with its complete workspace configuration.');
  }
}
