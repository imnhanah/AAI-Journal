import { normaliseBalance, WORKSPACE_TYPES } from './balanceModel.js';
import { buildDemoHistory } from './demoData.js';

const DATABASE = 'aaicorefx-local-journal';
const STORE = 'journals';
let localUserId = null;

const id = () => globalThis.crypto?.randomUUID?.() || `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const now = () => new Date().toISOString();
const clone = value => typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value));

function open() {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) return reject(new Error('IndexedDB is unavailable in this browser.'));
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
function requestValue(request) {
  return new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
}
async function read(userId = localUserId) {
  if (!userId) return null;
  const database = await open();
  const result = await requestValue(database.transaction(STORE, 'readonly').objectStore(STORE).get(userId));
  database.close();
  return result || null;
}
async function write(data, userId = localUserId) {
  if (!userId) throw new Error('Local journal has no signed-in user.');
  const database = await open();
  const transaction = database.transaction(STORE, 'readwrite');
  transaction.objectStore(STORE).put({ ...clone(data), savedAt: now(), version: 1 }, userId);
  await new Promise((resolve, reject) => { transaction.oncomplete = resolve; transaction.onerror = () => reject(transaction.error); });
  database.close();
}
function demo(userId) {
  const accountId = id();
  const balance = normaliseBalance({ id:id(), workspaceId:accountId, name:'Primary balance', startingBalance:1000, baseCurrency:'USD' }, { baseCurrency:'USD', balance:1000 });
  const history = buildDemoHistory();
  const trades = history.trades.map((trade) => ({ ...trade, id:id(), accountId, grossPnl:trade.pnl, commission:0, swap:0, entrySession:trade.session, confluence:trade.types || [], mistakes:[], rating:0, screenshots:{entry:[],exit:[]}, balanceResults:[], createdAt:now(), updatedAt:now() }));
  const periodReviews = history.periods.map((review) => ({ ...review, id:id(), accountId, updatedAt:now() }));
  return {
    accounts: [{ id:accountId, name:'Demo', icon:'USD', profileImage:'', balance:1000, breakevenCap:0, ratingStyle:'stars', theme:'dark', defaultCommission:0, monthlyGoalPct:0, yearlyGoalPct:0, monthlyGoalAmount:0, yearlyGoalAmount:0, monthlyGoalSource:'percentage', yearlyGoalSource:'percentage', dailyLossLimitPct:0, monthlyLossLimitPct:0, positionSizeEnabled:false, baseCurrency:'USD', platform:'Manual', defaultRiskPct:1, defaultStopLossPips:20, workspaceType:WORKSPACE_TYPES.STANDARD, challengeEnabled:false, challengeStartingBalance:0, financeEnabled:false, typeTags:[], mistakeTags:[], confluenceSessions:[], rewardPresets:[3.1,3.2], trades, rules:[], checkins:{}, balances:[balance], finance:{enabled:false,tradingTarget:0}, savingsAccounts:[], financeMovements:[], createdAt:now(), userId }],
    typeTags: [], mistakeTags: [], confluenceSessions: [], customInstruments: [], markups: [], reviews: [], periodReviews, financeReady:true, balancesReady:true,
  };
}
async function dataFor(userId = localUserId) {
  let data = await read(userId);
  if (!data || !data.accounts?.length || (Number(data.version || 0) < 2 && data.accounts?.length === 1 && data.accounts[0]?.name === 'Demo' && !(data.accounts[0]?.trades || []).length)) { data = demo(userId); await write(data, userId); }
  return data;
}
const pendingChanges = new Map();
function change(mutator) {
  const userId = localUserId;
  if (!userId) return Promise.reject(new Error('Local journal has no signed-in user.'));
  // Serialize read/modify/write operations so a trade update cannot overwrite
  // a challenge save (or another concurrent trade update).
  const task = (pendingChanges.get(userId) || Promise.resolve()).catch(() => {}).then(async () => {
    const data = await dataFor(userId);
    const result = await mutator(data);
    await write(data, userId);
    return result;
  });
  pendingChanges.set(userId, task);
  task.finally(() => { if (pendingChanges.get(userId) === task) pendingChanges.delete(userId); }).catch(() => {});
  return task;
}
const okay = data => ({ data });
const findAccount = (data, accountId) => data.accounts.find(item => item.id === accountId);
const findTrade = (data, tradeId) => data.accounts.flatMap(account => account.trades || []).find(item => item.id === tradeId);
const findMarkup = (data, markupId) => data.markups.find(item => item.id === markupId);
const touch = item => ({ ...item, updatedAt:now() });

export function configureLocalJournal(userId, enabled) { localUserId = enabled ? userId : null; }
export const isLocalJournal = () => !!localUserId;
export async function hasLocalJournal(userId) { return !!(await read(userId)); }
export async function fetchAllUserData(userId) { try { return okay(await dataFor(userId)); } catch (error) { return { error:error.message || 'Could not load the journal stored on this device.' }; } }
export async function readProfileCaseStudyLibrary(userId) { const data=await dataFor(userId); return okay(data.profileCaseStudyLibrary || null); }
// Unlike readProfileCaseStudyLibrary this never creates a demo journal. It is
// used to protect an existing device copy before a Cloud Sync mode handoff.
export async function peekProfileCaseStudyLibrary(userId) { const data=await read(userId); return okay(data?.profileCaseStudyLibrary || null); }
export async function saveProfileCaseStudyLibrary(userId, library) { return change(data => { data.profileCaseStudyLibrary=clone(library); return okay(data.profileCaseStudyLibrary); }); }
export async function exportLocalJournal(userId) { await pendingChanges.get(userId); const data = await dataFor(userId); return { version:1, exportedAt:now(), data:clone(data) }; }
export async function importLocalJournal(userId, backup) {
  if (!backup || backup.version !== 1 || !backup.data || !Array.isArray(backup.data.accounts)) return { error:'This backup is not an AAICOREFX journal backup.' };
  await pendingChanges.get(userId);
  const data = { ...clone(backup.data), financeReady:true, balancesReady:true };
  // Backups may be restored into another login. Keep ownership scoped to the
  // signed-in user rather than trusting IDs from the exported file.
  for (const scope of ['account', 'balance']) {
    for (const row of Object.values(data.challengeProgress?.[scope] || {})) row.user_id = userId;
  }
  await write(data, userId);
  return { data };
}

const challengeColumn = scope => scope === 'balance' ? 'balance_id' : 'account_id';
function challengeOwner(data, scope, targetId) {
  return scope === 'balance'
    ? data.accounts.some(account => (account.balances || []).some(balance => balance.id === targetId))
    : data.accounts.some(account => account.id === targetId);
}
export async function readChallengeProgress(scope, targetId, userId) {
  if (userId !== localUserId) return { error: { message:'Local challenge user does not match the signed-in user.' } };
  await pendingChanges.get(userId);
  const data = await dataFor(userId);
  return { data:clone(data.challengeProgress?.[scope]?.[targetId] || null), error:null };
}
export async function saveChallengeProgress(scope, payload) {
  if (payload.user_id !== localUserId) return { error: { message:'Local challenge user does not match the signed-in user.' } };
  return change(data => {
    const targetId = payload[challengeColumn(scope)];
    if (!challengeOwner(data, scope, targetId)) return { error: { message:'Challenge account not found on this device.' } };
    data.challengeProgress ||= { account:{}, balance:{} };
    data.challengeProgress[scope] ||= {};
    data.challengeProgress[scope][targetId] = { ...clone(payload), updated_at:now() };
    return { error:null };
  });
}
export async function deleteChallengeProgress(scope, targetId, userId) {
  if (userId !== localUserId) return { error: { message:'Local challenge user does not match the signed-in user.' } };
  return change(data => { if (data.challengeProgress?.[scope]) delete data.challengeProgress[scope][targetId]; return { error:null }; });
}

export async function createAccount(userId, fields) { return change(data => { const accountId = fields.id || id(); const account = { ...fields, id:accountId, icon:fields.baseCurrency || 'USD', profileImage:'', balance:Number(fields.balance) || 0, workspaceType:fields.workspaceType || WORKSPACE_TYPES.STANDARD, trades:[], rules:[], checkins:{}, balances:[], finance:{enabled:!!fields.financeEnabled,tradingTarget:0}, savingsAccounts:[], financeMovements:[], createdAt:now(), updatedAt:now() }; data.accounts.push(account); return okay(account); }); }
export async function updateAccount(accountId, fields) { return change(data => { const account=findAccount(data,accountId); if (!account) return { error:'Account not found on this device.' }; Object.assign(account, touch({ ...fields, id:accountId })); return {}; }); }
export async function deleteAccount(accountId) { return change(data => { data.accounts=data.accounts.filter(item=>item.id!==accountId); data.markups=data.markups.filter(item=>item.accountId!==accountId); data.reviews=data.reviews.filter(item=>item.accountId!==accountId); data.periodReviews=data.periodReviews.filter(item=>item.accountId!==accountId); return {}; }); }
export async function resetAccountData(accountId) { return change(data => { const account=findAccount(data,accountId); if (!account) return { error:'Account not found on this device.' }; account.trades=[]; account.checkins={}; return {}; }); }

export async function createWorkspaceBalance(userId, accountId, balance) { return change(data => { const account=findAccount(data,accountId); if (!account) return { error:'Account not found on this device.' }; const item=normaliseBalance({ ...balance, id:balance.id || id(), workspaceId:accountId }, account); account.balances=[...(account.balances||[]),item]; return okay(item); }); }
export async function updateWorkspaceBalance(userId, accountId, balance) { return change(data => { const account=findAccount(data,accountId); if (!account) return { error:'Account not found on this device.' }; const item=normaliseBalance({ ...balance, workspaceId:accountId }, account); account.balances=(account.balances||[]).map(current=>current.id===item.id?item:current); return okay(item); }); }
export async function deleteWorkspaceBalance(balanceId) { return change(data => { data.accounts.forEach(account => { account.balances=(account.balances||[]).filter(item=>item.id!==balanceId); account.trades=(account.trades||[]).map(trade=>({...trade,balanceResults:(trade.balanceResults||[]).filter(result=>result.balanceId!==balanceId)})); }); return {}; }); }

export async function saveFinanceSettings(userId, accountId, settings) { return change(data => { const account=findAccount(data,accountId); if (!account) return { error:'Account not found on this device.' }; account.finance={ enabled:!!settings.enabled, tradingTarget:Number(settings.tradingTarget)||0 }; return {}; }); }
export async function createSavingsAccount(userId, accountId, value) { return change(data => { const account=findAccount(data,accountId); if (!account) return { error:'Account not found on this device.' }; const item={id:id(),accountId,balanceId:value.balanceId||null,name:value.name||'Savings',target:Number(value.target)||0,allocationPct:Number(value.allocationPct)||0,interval:value.interval||'Manual',reminderMinutes:Number(value.reminderMinutes)||30,createdAt:now()}; account.savingsAccounts=[...(account.savingsAccounts||[]),item]; return okay(item); }); }
export async function updateSavingsAccount(savingsId, value) { return change(data => { for (const account of data.accounts) { const current=(account.savingsAccounts||[]).find(item=>item.id===savingsId); if (current) { Object.assign(current,{balanceId:value.balanceId||null,name:value.name||'Savings',target:Number(value.target)||0,allocationPct:Number(value.allocationPct)||0,interval:value.interval||'Manual',reminderMinutes:Number(value.reminderMinutes)||30}); return okay(current); } } return { error:'Savings account not found on this device.' }; }); }
export async function deleteSavingsAccount(savingsId) { return change(data => { data.accounts.forEach(account=>{account.savingsAccounts=(account.savingsAccounts||[]).filter(item=>item.id!==savingsId);}); return {}; }); }
export async function createFinanceMovement(userId, accountId, value) { return change(data => { const account=findAccount(data,accountId); const amount=Number(value.amount); if (!account) return { error:'Account not found on this device.' }; if (!(amount>0)) return { error:'Enter a cash-movement amount greater than zero.' }; const item={id:id(),accountId,balanceId:value.balanceId||null,type:value.type,amount,date:value.date,note:value.note||'',source:value.source||'trading',savingsAccountId:value.savingsAccountId||null,createdAt:now()}; account.financeMovements=[item,...(account.financeMovements||[])]; return okay(item); }); }
export async function updateFinanceMovement(movementId, value) { return change(data => { for (const account of data.accounts) { const current=(account.financeMovements||[]).find(item=>item.id===movementId); if (current) { Object.assign(current,{...value,id:movementId}); return okay(current); } } return {error:'Cash movement not found on this device.'}; }); }
export async function deleteFinanceMovement(movementId) { return change(data=>{data.accounts.forEach(account=>{account.financeMovements=(account.financeMovements||[]).filter(item=>item.id!==movementId);});return {};}); }

export async function createTrade(userId, accountId, value) { return change(data => { const account=findAccount(data,accountId); if (!account) return {error:'Account not found on this device.'}; const item=touch({...value,id:value.id||id(),accountId,createdAt:now(),screenshots:value.screenshots||{entry:[],exit:[]},balanceResults:value.balanceResults||[]}); account.trades=[...(account.trades||[]),item]; return okay(item); }); }
export async function updateTrade(tradeId, value) { return change(data => { const trade=findTrade(data,tradeId); if (!trade) return {error:'Trade not found on this device.'}; Object.assign(trade,touch({...value,id:tradeId,accountId:trade.accountId})); return okay(trade); }); }
export async function deleteTrade(tradeId) { return change(data=>{data.accounts.forEach(account=>{account.trades=(account.trades||[]).filter(item=>item.id!==tradeId);});data.reviews=data.reviews.filter(item=>item.tradeId!==tradeId);return {};}); }
export async function saveTradeBalanceResults(userId, tradeId, results) { return change(data=>{const trade=findTrade(data,tradeId);if(!trade)return {error:'Trade not found on this device.'};trade.balanceResults=(results||[]).filter(item=>item?.balanceId).map(item=>({...item,id:item.id||id(),tradeId}));return okay(trade.balanceResults);}); }
export async function deleteTradeBalanceResultsNotIn(userId, tradeId, balanceIds) { return change(data=>{const trade=findTrade(data,tradeId);if(!trade)return {error:'Trade not found on this device.'};trade.balanceResults=(trade.balanceResults||[]).filter(item=>(balanceIds||[]).includes(item.balanceId));return {};}); }

export async function createRule(userId, accountId, text) { return change(data=>{const account=findAccount(data,accountId);if(!account)return {error:'Account not found on this device.'};const item={id:id(),text,active:true};account.rules=[...(account.rules||[]),item];return okay(item);}); }
export async function updateRule(ruleId, text) { return change(data=>{for(const account of data.accounts){const item=(account.rules||[]).find(rule=>rule.id===ruleId);if(item){item.text=text;return okay(item);}}return {error:'Rule not found on this device.'};}); }
export async function deleteRule(ruleId) { return change(data=>{data.accounts.forEach(account=>{account.rules=(account.rules||[]).filter(rule=>rule.id!==ruleId);Object.values(account.checkins||{}).forEach(day=>delete day[ruleId]);});return {};}); }
export async function setCheckin(userId, accountId, ruleId, date, checked) { return change(data=>{const account=findAccount(data,accountId);if(!account)return {error:'Account not found on this device.'};account.checkins={...(account.checkins||{}),[date]:{...(account.checkins?.[date]||{}),[ruleId]:!!checked}};return {};}); }
export async function saveManagedLists(userId, patch) { return change(data=>{if(patch.typeTags!==undefined)data.typeTags=patch.typeTags;if(patch.mistakeTags!==undefined)data.mistakeTags=patch.mistakeTags;if(patch.confluenceSessions!==undefined)data.confluenceSessions=patch.confluenceSessions;if(patch.instruments!==undefined)data.customInstruments=patch.instruments;return {};}); }
export async function saveTypeTags(userId,tags) { return saveManagedLists(userId,{typeTags:tags}); }

export async function createMarkup(userId, accountId, value) { return change(data=>{const item=touch({...value,id:value.id||id(),accountId,createdAt:now(),screenshots:value.screenshots||{}});data.markups=[item,...data.markups];return okay(item);}); }
export async function updateMarkup(markupId, value) { return change(data=>{const item=findMarkup(data,markupId);if(!item)return {error:'Markup not found on this device.'};Object.assign(item,touch({...value,id:markupId,accountId:item.accountId}));return okay(item);}); }
export async function deleteMarkup(markupId) { return change(data=>{data.markups=data.markups.filter(item=>item.id!==markupId);return {};}); }
export async function saveTradeReview(userId, accountId, value) { return change(data=>{const existing=value.id&&data.reviews.find(item=>item.id===value.id);const item=touch({...value,id:existing?.id||id(),accountId});data.reviews=existing?data.reviews.map(current=>current.id===item.id?item:current):[item,...data.reviews];return okay(item);}); }
export async function savePeriodReview(userId, accountId, value) { return change(data=>{const existing=data.periodReviews.find(item=>item.accountId===accountId&&item.type===value.type&&item.key===value.key);const item=touch({...value,id:existing?.id||id(),accountId});data.periodReviews=existing?data.periodReviews.map(current=>current.id===item.id?item:current):[item,...data.periodReviews];return okay(item);}); }
export async function hasMigratedLocalData() { return true; }
export async function markLocalDataMigrated() { return {}; }
export async function importLegacyAccount(userId, value) { const account=await createAccount(userId,value); if(account.error)return account; for(const trade of value.trades||[])await createTrade(userId,account.data.id,trade); for(const rule of value.rules||[])await createRule(userId,account.data.id,rule.text); return okay({accountId:account.data.id}); }
