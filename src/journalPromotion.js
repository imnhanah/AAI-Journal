import { supabase } from './supabaseClient.js';
import { accountInsertRows, balanceRow, markupRow, toTrade, tradeBalanceResultRow } from './db.js';
import { createPromotionSnapshot, exportLocalJournal } from './localJournalDb.js';
import { loadJournalImage, loadPeriodReviewContent } from './journalCloudCache.js';
import { resolveCurrentEntitlements } from './membership.js';
import { caseStudySharedImageId, caseStudySharedImageReference } from './caseStudySharedImageIntegration.js';
import { readEvidenceImageReference } from './caseStudyEvidenceImages.js';
import { readCaseStudyDocumentImage } from './caseStudyDocumentImages.js';
import { backtestSharedMediaId, backtestSharedMediaReference } from './backtestSharedMedia.js';
import { tradeJournalMediaId, tradeJournalMediaReference } from './tradeJournalSharedMedia.js';
import { caseStudyEvidenceCloudPath, caseStudyEvidenceCloudReference, uploadCaseStudyEvidenceImage } from './caseStudyEvidenceCloud.js';
import { calculateImageChecksum, createSharedImageStorage, IMAGE_STORAGE_STATES } from './sharedImageStorage.js';
import { normaliseCaseStudyWorkspace } from './caseStudyWorkspace.js';

const storage = createSharedImageStorage();
const sourceModule = 'journal-promotion';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function promotionId(userId, table, localId) {
  if (typeof localId !== 'string' || !localId.trim()) throw new Error('A device record is missing its identifier.');
  if (uuid.test(localId)) return localId.toLowerCase();
  const bytes = new TextEncoder().encode(JSON.stringify([userId, table, localId]));
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  hash[6] = (hash[6] & 15) | 80;
  hash[8] = (hash[8] & 63) | 128;
  const hex = Array.from(hash.slice(0, 16), byte => byte.toString(16).padStart(2, '0')).join('');
  return hex.replace(/^(........)(....)(....)(....)(............)$/, '$1-$2-$3-$4-$5');
}

const collections = ['studies', 'evidence', 'personalTemplates', 'connections', 'notebooks'];
const refFor = { journal: tradeJournalMediaReference, case: caseStudySharedImageReference, backtest: backtestSharedMediaReference };
const sourceKeys = ['src', 'url', 'dataUrl', 'source', 'data', 'image', 'preview', 'documentImageRef'];
const localImage = /^(data:image\/|blob:|tj-image:|tj-trade-media:|tj-shared-media:|tj-case-study-(?:media|evidence|image):)/;

async function planImage(userId, source, kind, cloudRef, assets, knownImages) {
  const retainedPath = caseStudyEvidenceCloudPath(source);
  if (retainedPath && !retainedPath.startsWith(`${userId}/`)) throw new Error('An image reference belongs to another account. Recover the original before publishing.');
  if (/^tj-/.test(source) && !localImage.test(source) && !retainedPath) throw new Error('An unsupported image reference needs recovery before publishing.');
  if (!localImage.test(source)) return null;
  const existing = caseStudySharedImageId(source) || backtestSharedMediaId(source) || tradeJournalMediaId(source);
  let metadata = existing ? await storage.getImageMetadata(existing, userId) : null;
  if (!metadata) {
    let pending = knownImages.get(source);
    if (!pending) {
      pending = (async () => {
        let blob;
        if (source.startsWith('tj-case-study-evidence:')) blob = await readEvidenceImageReference(source);
        else if (source.startsWith('tj-case-study-image:')) blob = await readCaseStudyDocumentImage(source);
        else if (source.startsWith('tj-image:') && !existing) {
          const resolved = await loadJournalImage(source);
          if (resolved?.startsWith('data:image/')) blob = await (await fetch(resolved)).blob();
        } else if (/^(data:image\/|blob:)/.test(source)) blob = await (await fetch(source)).blob();
        if (!blob?.size) return null;
        const checksum = await calculateImageChecksum(blob);
        const asset = (await storage.getImagesForRecord(userId, 'promotion:' + checksum))
          .find(value => value.sourceModule === sourceModule && value.checksum === checksum &&
            ![IMAGE_STORAGE_STATES.SOFT_DELETED, IMAGE_STORAGE_STATES.PURGED].includes(value.storageState));
        return asset || storage.saveImage({ userId, file: blob, sourceModule, sourceRecordId: 'promotion:' + checksum });
      })();
      knownImages.set(source, pending);
    }
    metadata = await pending;
  }
  if (!metadata) {
    const path = caseStudyEvidenceCloudPath(cloudRef);
    if (existing && path === `${userId}/${existing}`) {
      const { data, error } = await supabase.storage.from('case-study-evidence').createSignedUrl(path, 60);
      if (!error && data?.signedUrl) return { src: refFor[kind](existing), cloudRef };
    }
    throw new Error('An image could not be read from this device or recovered from cloud storage. Open the source device and retry.');
  }
  if ([IMAGE_STORAGE_STATES.SOFT_DELETED, IMAGE_STORAGE_STATES.PURGED].includes(metadata.storageState)) {
    throw new Error('A device image is unavailable. Restore the original image before publishing.');
  }
  const path = `${userId}/${metadata.id}`;
  assets.set(metadata.id, metadata);
  return { src: refFor[kind](metadata.id), cloudRef: caseStudyEvidenceCloudReference(path) };
}

async function prepareMedia(value, kind, resolveImage) {
  if (typeof value === 'string') {
    const image = await resolveImage(value, kind);
    return image ? (kind === 'case' ? image.src : image) : value;
  }
  if (Array.isArray(value)) {
    const result = [];
    for (const entry of value) result.push(await prepareMedia(entry, kind, resolveImage));
    return result;
  }
  if (!value || typeof value !== 'object') return value;
  const key = sourceKeys.find(name => typeof value[name] === 'string' && localImage.test(value[name]));
  if (key && kind !== 'case') {
    const { displaySrc, displayError, ...saved } = value;
    return { ...saved, [key]: undefined, ...await resolveImage(value[key], kind, value.cloudRef) };
  }
  const result = {};
  for (const [name, entry] of Object.entries(value)) {
    if (typeof entry === 'object') result[name] = await prepareMedia(entry, kind, resolveImage);
    else if (sourceKeys.includes(name) && typeof entry === 'string') {
      const image = await resolveImage(entry,kind,value.cloudRef);
      result[name] = image?.src || entry;
    } else result[name] = entry;
  }
  return result;
}

export async function buildPromotionRows(userId, data, media = async value => value) {
  const tables = {};
  const add = (table, row) => (tables[table] ||= []).push(row);
  const id = (table, value) => promotionId(userId, table, value);
  const optionalId = (table, value) => value ? id(table, value) : null;
  for (const account of data.accounts) {
    const accountId = await id('accounts', account.id);
    if (account.profileImage?.startsWith('blob:')) throw new Error('An account image is only available in the current session. Save it again before publishing.');
    add('accounts', { ...accountInsertRows(userId, { ...account, id:accountId }).modern, profile_image: account.profileImage || null });
    add('finance_settings', { account_id:accountId, enabled:!!account.finance?.enabled, trading_target:Number(account.finance?.tradingTarget || 0) });
    for (const balance of account.balances || []) add('workspace_balances', {
      ...balanceRow(userId, accountId, balance), id:await id('workspace_balances', balance.id),
    });
    for (const rule of account.rules || []) add('rules', {
      id:await id('rules',rule.id), account_id:accountId, rule_text:rule.text, active:rule.active !== false,
    });
    for (const [date, rules] of Object.entries(account.checkins || {})) {
      for (const [rule, checked] of Object.entries(rules)) add('journal_entries', {
        id:await id('journal_entries', JSON.stringify([accountId,date,rule])), account_id:accountId,
        rule_id:await id('rules',rule), entry_date:date, checked:!!checked,
      });
    }
    for (const trade of account.trades || []) {
      const tradeId = await id('trades', trade.id);
      add('trades', { ...toTrade(userId,accountId,{
        ...trade, screenshots:await media(trade.screenshots,'journal'),
        premarketMarkupId:await optionalId('premarket_markups',trade.premarketMarkupId),
      }), id:tradeId });
      for (const result of trade.balanceResults || []) {
        const balanceId = await id('workspace_balances',result.balanceId);
        add('trade_balance_results', tradeBalanceResultRow(userId,tradeId,{
          ...result, id:await id('trade_balance_results',result.id || JSON.stringify([tradeId,balanceId])), balanceId,
        }));
      }
    }
    for (const saving of account.savingsAccounts || []) add('savings_accounts',{
      id:await id('savings_accounts',saving.id), account_id:accountId, balance_id:await optionalId('workspace_balances',saving.balanceId),
      name:saving.name, target:Number(saving.target || 0), allocation_pct:Number(saving.allocationPct || 0),
      transfer_interval:saving.interval || 'Manual', reminder_minutes:Number(saving.reminderMinutes || 30),
    });
    for (const movement of account.financeMovements || []) add('finance_movements',{
      id:await id('finance_movements',movement.id), account_id:accountId, balance_id:await optionalId('workspace_balances',movement.balanceId),
      movement_type:movement.type, amount:movement.amount, movement_date:movement.date, note:movement.note || '',
      source:movement.source || 'trading', savings_account_id:await optionalId('savings_accounts',movement.savingsAccountId),
    });
  }
  for (const item of data.markups || []) add('premarket_markups',{
    ...markupRow({...item,screenshots:await media(item.screenshots,'journal')}), id:await id('premarket_markups',item.id),
    account_id:await id('accounts',item.accountId),
  });
  for (const item of data.reviews || []) add('trade_reviews',{
    id:await id('trade_reviews',item.id),account_id:await id('accounts',item.accountId),trade_id:await id('trades',item.tradeId),
    review_date:item.date, review_time:item.time || null, done_well:item.doneWell, went_wrong:item.wentWrong,
    execution_review:item.execution, rule_adherence:item.adherence, psychology:item.psychology,
    execution_score:Number(item.executionScore) || null, adherence_score:Number(item.adherenceScore) || null,
    psychology_score:Number(item.psychologyScore) || null, lessons:item.lessons, action_items:item.actions, notes:item.notes,
    screenshots:await media(item.screenshots || [],'journal'),
  });
  for (const item of data.periodReviews || []) {
    const originalContent=item.contentLoaded === false ? await loadPeriodReviewContent(item) : item.content || {};
    const content={...originalContent};
    if (originalContent.accountScopes && typeof originalContent.accountScopes==='object' && !Array.isArray(originalContent.accountScopes)) {
      content.accountScopes=Object.fromEntries(await Promise.all(Object.entries(originalContent.accountScopes).map(async([key,value])=>[await id('accounts',key),value])));
    }
    add('period_reviews',{
      id:await id('period_reviews',item.id),account_id:await id('accounts',item.accountId),period_type:item.type,period_key:item.key,
      content,completed:!!item.completed,
    });
  }
  for (const [scope, table, key, parent] of [
    ['account','challenge_progress','account_id','accounts'], ['balance','balance_challenge_progress','balance_id','workspace_balances'],
  ]) for (const item of Object.values(data.challengeProgress?.[scope] || {})) {
    add(table,{...item,[key]:await id(parent,item[key])});
  }
  for (const run of data.backtestWorkspace?.runs || []) {
    const {id:localId,updatedAt,...settings} = run;
    add('backtest_runs',{id:await id('backtest_runs',localId),settings});
  }
  for (const trade of data.backtestWorkspace?.trades || []) {
    const {id:localId,runId,updatedAt,screenshots,screenshotCount,_mediaLoaded,mediaEdited,...tradeData} = trade;
    add('backtest_trades',{id:await id('backtest_trades',localId),run_id:await id('backtest_runs',runId),
      trade_data:tradeData,screenshots:await media(screenshots || {},'backtest')});
  }
  const lists = {
    custom_type_tags:data.typeTags || [],custom_mistake_tags:data.mistakeTags || [],
    custom_confluence_sessions:data.confluenceSessions || [],custom_instruments:data.customInstruments || [],
  };
  if (Object.values(lists).some(items => items.length)) add('user_settings',{...lists,user_id:userId});
  return tables;
}

async function requireOwner(userId) {
  const { data, error } = await supabase.auth.getUser();
  if (error || data?.user?.id !== userId) throw new Error('Sign in again before publishing device data.');
  const membership = await resolveCurrentEntitlements({ authenticated:true });
  if (!membership.cloudWritesAllowed) throw new Error('This account needs Owner cloud-write permission.');
  return membership;
}

async function publishRequest(plan, preview) {
  const { data, error } = await supabase.rpc('tj_publish_device_journal',{
    rows_by_table:plan.rows, device_library:plan.library, preview,
  });
  if (error) throw new Error(error.message);
  if (!data || !Array.isArray(data.conflicts)) throw new Error('The server did not confirm the journal request.');
  return data;
}

export async function prepareJournalPromotion(userId) {
  await requireOwner(userId);
  const backup = await exportLocalJournal(userId);
  const assets = new Map();
  const knownImages = new Map();
  const resolve = (source,kind,ref) => planImage(userId,source,kind,ref,assets,knownImages);
  const rows = await buildPromotionRows(userId, backup.data, (value,kind) => prepareMedia(value,kind,resolve));
  const original = backup.data.profileCaseStudyLibrary;
  if (!original && backup.data.accounts.some(account => account.caseStudyWorkspace)) {
    throw new Error('This device still has a legacy Case Study Library. Review it in Case Studies before publishing.');
  }
  let library = null;
  if (original && collections.some(key => original[key]?.length)) {
    library = await prepareMedia(normaliseCaseStudyWorkspace(original),'case',resolve);
    for (const [index, item] of library.evidence.entries()) {
      const originalItem = original.evidence[index];
      const source = originalItem.url || originalItem.documentImageRef;
      const image = source && await resolve(source,'case',originalItem.cloudRef);
      if (image) Object.assign(item,{url:image.src,cloudRef:image.cloudRef});
    }
    for (const study of library.studies) {
      study.tradeIds = await Promise.all(study.tradeIds.map(value => promotionId(userId,'trades',value)));
      study.markupIds = await Promise.all(study.markupIds.map(value => promotionId(userId,'premarket_markups',value)));
    }
  }
  const count = Object.values(rows).reduce((sum, table) => sum + table.length, 0);
  const plan = { userId, rows, library, assets, count, source:JSON.stringify(backup.data) };
  return { ...plan, ...await publishRequest(plan,true) };
}

export async function publishJournalPromotion(plan, onProgress) {
  if (plan.conflicts.length) throw new Error('Resolve the cloud conflicts before publishing.');
  const membership = await requireOwner(plan.userId);
  const source = await exportLocalJournal(plan.userId);
  if (JSON.stringify(source.data) !== plan.source) throw new Error('Device data changed. Preview the new version before publishing.');
  const preview = await publishRequest(plan,true);
  if (preview.conflicts.length) throw new Error('Cloud data changed. Preview again before publishing.');

  if (!plan.snapshot) plan.snapshot = (await createPromotionSnapshot(plan.userId,source)).data;
  const queued = new Map();
  for (const asset of plan.assets.values()) {
    const current = await storage.getImageMetadata(asset.id,plan.userId);
    if (current?.storageState === IMAGE_STORAGE_STATES.CLOUD_VERIFIED && current.cloudPath === `${plan.userId}/${asset.id}`) continue;
    const group = queued.get(asset.sourceModule) || new Set();
    group.add(asset.id);
    queued.set(asset.sourceModule,group);
    await storage.queueCloudUpload(asset.id,{userId:plan.userId,membership});
  }
  onProgress('Uploading and verifying private images…');
  for (const [sourceModule,assetIds] of queued) {
    await storage.processUploadQueue({
      userId:plan.userId,membership,sourceModule,assetIds,
      getMembership:async () => (await supabase.auth.getUser()).data?.user?.id === plan.userId
        ? resolveCurrentEntitlements({ authenticated:true }) : null,
      uploader: async ({asset,blob}) => {
        const uploaded = await uploadCaseStudyEvidenceImage({userId:plan.userId,evidenceId:asset.id,blob});
        return uploaded.verified ? {...uploaded,cloudPath:caseStudyEvidenceCloudPath(uploaded.cloudRef)} : uploaded;
      },
    });
  }
  for (const asset of plan.assets.values()) {
    const current = await storage.getImageMetadata(asset.id,plan.userId);
    if (current?.storageState !== IMAGE_STORAGE_STATES.CLOUD_VERIFIED || current.cloudPath !== `${plan.userId}/${asset.id}`) {
      throw new Error('An image upload is pending or failed. The original is saved on this device. Retry publishing.');
    }
  }

  const latest = await exportLocalJournal(plan.userId);
  if (JSON.stringify(latest.data) !== plan.source) throw new Error('Device data changed during upload. Preview again to publish the new version.');
  onProgress('Saving device records to the cloud…');
  await requireOwner(plan.userId);
  return publishRequest(plan,false);
}
