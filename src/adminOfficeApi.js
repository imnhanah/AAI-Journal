// Administration Office data layer. The screens only talk to `officeApi`.
// Names and shapes follow the build contract (v2.2) and Codex's staging handoff.
// On the STAGING project (tenktwvkxjqsnamlfhcp) this talks to the `admin-office` Edge function.
// Anywhere else it uses a local mock, chosen once by the project address, so a failed live call is never replaced by a fake success.
// Turn it on in dev with ?adminoffice=1 (dev server only; ?adminoffice=mock forces the mock) or VITE_ADMIN_OFFICE_UI=true.

export const adminOfficeUiEnabled = (() => {
  try {
    if (import.meta.env?.VITE_ADMIN_OFFICE_UI === 'true') return true;
    return !!import.meta.env?.DEV && ['1', 'mock'].includes(new URLSearchParams(window.location.search).get('adminoffice'));
  } catch { return false; }
})();

export const FEATURES = [
  ['trade_logs', 'Trade Logs'], ['finance', 'Finance'], ['challenge', 'Challenge'],
  ['case_studies', 'Case Studies'], ['strategy_testing', 'Strategy Testing'],
];
export const PLAN_DEFAULTS = {
  free: { account_limit: 1, multiple_accounts_allowed: false, features: { trade_logs: true, finance: true, challenge: false, case_studies: false, strategy_testing: false } },
  premium: { account_limit: 5, multiple_accounts_allowed: true, features: { trade_logs: true, finance: true, challenge: true, case_studies: true, strategy_testing: true } },
};
const ALL_ON = { trade_logs: true, finance: true, challenge: true, case_studies: true, strategy_testing: true };
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const fail = (code, extra = {}) => Object.assign(new Error(code), { code }, extra);

// off_count = features off + Multiple off + over the account limit (contract section 3).
export const offCount = row => FEATURES.filter(([key]) => !row.features[key]).length
  + (row.multiple_accounts_allowed === false ? 1 : 0)
  + (row.account_limit != null && row.accounts_used > row.account_limit ? 1 : 0);
export const offReasons = row => [
  ...FEATURES.filter(([key]) => !row.features[key]).map(([, name]) => `${name} off`),
  ...(row.multiple_accounts_allowed === false ? ['Single accounts only'] : []),
  ...(row.account_limit != null && row.accounts_used > row.account_limit ? ['Over account limit'] : []),
];
export const isRestricted = row => row.status !== 'active' || offCount(row) > 0;

const mockRows = () => [
  { user_id: 'u1', email: 'aaicorefx@gmail.com', plan: 'owner', status: 'active', journal_sync: true, image_access: true, features: { ...ALL_ON }, multiple_accounts_allowed: true, account_limit: null, accounts_used: 3, revision: 1 },
  { user_id: 'u2', email: 'imnhanah@gmail.com', plan: 'owner', status: 'active', journal_sync: true, image_access: true, features: { ...ALL_ON }, multiple_accounts_allowed: true, account_limit: null, accounts_used: 2, revision: 1 },
  { user_id: 'u3', email: 'andahjo@gmail.com', plan: 'free', status: 'active', journal_sync: false, image_access: false, features: { ...PLAN_DEFAULTS.free.features }, multiple_accounts_allowed: false, account_limit: 1, accounts_used: 1, revision: 1 },
  { user_id: 'u4', email: 'enochatsu11@gmail.com', plan: 'premium', status: 'active', journal_sync: true, image_access: true, features: { ...ALL_ON }, multiple_accounts_allowed: true, account_limit: 5, accounts_used: 2, revision: 1 },
  { user_id: 'u5', email: 'dkbetrew6@gmail.com', plan: 'premium', status: 'active', journal_sync: true, image_access: false, features: { ...ALL_ON, challenge: false }, multiple_accounts_allowed: true, account_limit: 2, accounts_used: 5, revision: 1 },
  { user_id: 'u6', email: 'millsedmund0631@gmail.com', plan: 'free', status: 'active', journal_sync: false, image_access: false, features: { ...ALL_ON, finance: false, strategy_testing: false }, multiple_accounts_allowed: true, account_limit: 1, accounts_used: 1, revision: 1 },
];

const checkPin = pin => {
  if (!/^\d{6}$/.test(pin || '')) throw fail('wrong_pin', { triesLeft: 5 });
  if (pin === '000000') throw fail('wrong_pin', { triesLeft: 4 });
};

const ago = ms => ms < 60000 ? 'Just now' : ms < 3600000 ? `${Math.floor(ms / 60000)} min ago` : ms < 86400000 ? `${Math.floor(ms / 3600000)} h ago` : `${Math.floor(ms / 86400000)} d ago`;
export const ANNOUNCE_LIMITS = { title: 40, body: 120 };

const seedLog = () => {
  const H = 3600000, D = 24 * H, now = Date.now();
  const e = (ago, who, a, tg, ok, cat) => ({ at: now - ago, who, a, tg, ok, cat });
  return [
    e(2 * H, 'aaicorefx', 'Changed plan to Premium', 'enochatsu11@gmail.com', true, 'mem'),
    e(3 * H, 'aaicorefx', 'Wrong PIN at the door', 'Office session', false, 'sec'),
    e(5 * H, 'imnhanah', 'Unlocked the office', 'Office session', true, 'sec'),
    e(1 * D + 2 * H, 'aaicorefx', 'Sent “Scheduled maintenance”', 'all users (5)', true, 'ann'),
    e(1 * D + 4 * H, 'aaicorefx', 'Switched Challenge off', 'dkbetrew6@gmail.com', true, 'mem'),
    e(1 * D + 6 * H, 'imnhanah', 'Set account limit to 2', 'dkbetrew6@gmail.com', true, 'mem'),
    e(2 * D + 1 * H, 'aaicorefx', 'Wrong authenticator code', 'Office session', false, 'sec'),
    e(2 * D + 3 * H, 'aaicorefx', 'Suspended a member', 'millsedmund0631@gmail.com', true, 'mem'),
    e(2 * D + 4 * H, 'aaicorefx', 'Reactivated a member', 'millsedmund0631@gmail.com', true, 'mem'),
    e(5 * D, 'imnhanah', 'Sent “New Challenge screens”', 'Premium (2)', true, 'ann'),
    e(6 * D, 'aaicorefx', 'Unlocked the office', 'Office session', true, 'sec'),
    e(8 * D, 'aaicorefx', 'Changed their own PIN', 'Owner vault', true, 'sec'),
  ].map((x, i, all) => ({ ...x, id: all.length - i }));
};
const dayLabel = at => {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const diff = Math.floor((start.getTime() - new Date(at).setHours(0, 0, 0, 0)) / 86400000);
  return diff <= 0 ? 'Today' : diff === 1 ? 'Yesterday' : new Date(at).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
};

const mock = (() => {
  let rows = mockRows();
  let log = seedLog();
  let nextLog = 100;
  const note = (a, target, ok, cat, who = 'aaicorefx') => { log = [{ id: nextLog++, at: Date.now(), who, a, tg: target, ok, cat }, ...log]; };
  let backup = { on: false, codes: [] };
  const makeCodes = () => Array.from({ length: 8 }, () => { const c = () => Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join(''); return `${c()}-${c()}`; });
  const guardPin = (pin, a, target, cat) => { try { checkPin(pin); } catch (problem) { note(`Wrong PIN: ${a}`, target, false, 'sec'); throw problem; } };
  let announcements = [
    { id: 'a2', title: 'Scheduled maintenance', body: 'The journal will be read-only for 20 minutes on Friday at 02:00 UTC.', to: 'all users', at: Date.now() - 2 * 86400000, read: 4, total: 5 },
    { id: 'a1', title: 'New Challenge screens', body: 'Challenge now shows your phase progress at a glance.', to: 'Premium', at: Date.now() - 9 * 86400000, read: 2, total: 2 },
  ];
  let fails = 0;
  let lockedUntil = 0;
  return {
    async unlock({ code, pin }) {
      await wait(250);
      if (Date.now() < lockedUntil) throw fail('locked', { until: lockedUntil });
      if (!/^\d{6}$/.test(code || '')) { note('Wrong authenticator code', 'Office session', false, 'sec'); throw fail('wrong_code'); }
      if (pin === '000000') {
        fails += 1;
        note('Wrong PIN at the door', 'Office session', false, 'sec');
        if (fails >= 5) { lockedUntil = Date.now() + 10 * 60 * 1000; fails = 0; throw fail('locked', { until: lockedUntil }); }
        throw fail('wrong_pin', { triesLeft: 5 - fails });
      }
      fails = 0;
      note('Unlocked the office', 'Office session', true, 'sec');
      return { expiresAt: Date.now() + 15 * 60 * 1000 };
    },
    async lock() { return true; },
    async updateMember({ user_id, plan, journal_sync, image_access, features, multiple_accounts_allowed, account_limit, apply_plan_defaults = false, expected_revision, pin }) {
      await wait(250);
      const who0 = rows.find(r => r.user_id === user_id);
      guardPin(pin, 'member change', who0?.email || 'member', 'mem');
      const row = who0;
      if (!row || row.plan === 'owner') throw fail('not_allowed');
      if (row.revision !== expected_revision) throw fail('stale');
      const was = row.plan;
      const base = apply_plan_defaults ? PLAN_DEFAULTS[plan] : null;
      Object.assign(row, {
        plan, journal_sync, image_access,
        features: { ...(base ? base.features : features) },
        multiple_accounts_allowed: base ? base.multiple_accounts_allowed : multiple_accounts_allowed,
        account_limit: base ? base.account_limit : account_limit,
        revision: row.revision + 1,
      });
      note(plan !== was ? `Changed plan to ${plan === 'premium' ? 'Premium' : 'Free'}${apply_plan_defaults ? ' and applied its settings' : ''}` : 'Changed settings and limits', row.email, true, 'mem');
      return { ...row, off_count: offCount(row) };
    },
    async setStatus({ user_id, action, reason, expected_revision, pin }) {
      await wait(250);
      const row = rows.find(r => r.user_id === user_id);
      guardPin(pin, action, row?.email || 'member', 'mem');
      if (!row || row.plan === 'owner') throw fail('not_allowed');
      if (row.revision !== expected_revision) throw fail('stale');
      const next = { suspend: 'suspended', ban: 'banned', delete: 'deleting', reactivate: 'active', unban: 'active', cancel_delete: 'active' }[action];
      if (!next) throw fail('bad_action');
      row.status = next;
      row.status_reason = reason || '';
      row.deletion_at = next === 'deleting' ? Date.now() + 14 * 24 * 3600 * 1000 : null;
      row.revision += 1;
      note({ suspend: 'Suspended a member', ban: 'Banned a member', delete: 'Started the 14-day deletion countdown', reactivate: 'Reactivated a member', unban: 'Unbanned a member', cancel_delete: 'Cancelled a deletion' }[action] + (reason ? ` · ${reason}` : ''), row.email, true, 'mem');
      return { ...row, off_count: offCount(row) };
    },
    async sendAnnouncement({ title, body, audience, pin }) {
      await wait(250);
      guardPin(pin, 'announcement', 'Mailroom', 'ann');
      const t = (title || '').trim(), b = (body || '').trim();
      if (!t || !b || t.length > ANNOUNCE_LIMITS.title || b.length > ANNOUNCE_LIMITS.body) throw fail('invalid');
      const active = rows.filter(r => r.status === 'active');
      const picked = audience.mode === 'all' ? active
        : audience.mode === 'group' ? active.filter(r => audience.groups.includes(r.plan))
          : active.filter(r => (audience.user_ids || []).includes(r.user_id));
      if (!picked.length) throw fail('no_recipients');
      const to = audience.mode === 'all' ? 'all users' : audience.mode === 'group' ? audience.groups.join(' + ') : `${picked.length} selected`;
      const made = { id: `a${Date.now()}`, title: t, body: b, to, at: Date.now(), read: 0, total: picked.length };
      announcements = [made, ...announcements];
      note(`Sent “${t}”`, `${to} (${picked.length})`, true, 'ann');
      return { id: made.id, recipients: picked.length };
    },
    async getSecurity() {
      await wait(100);
      return { backup_codes: backup.on, authenticator: 'linked', idle_minutes: 15, owners: rows.filter(r => r.plan === 'owner').length };
    },
    async changePin({ current_pin, new_pin }) {
      await wait(250);
      guardPin(current_pin, 'PIN change', 'Owner vault', 'sec');
      if (!/^\d{6}$/.test(new_pin || '')) throw fail('invalid');
      if (new_pin === current_pin) throw fail('same_pin');
      note('Changed their own PIN', 'Owner vault', true, 'sec');
      return { relock: true };
    },
    async backupCodesEnable({ pin }) {
      await wait(250);
      guardPin(pin, 'backup codes', 'Owner vault', 'sec');
      backup = { on: true, codes: makeCodes() };
      note('Backup codes turned on', 'Owner vault', true, 'sec');
      return { codes: [...backup.codes], relock: true };
    },
    async backupCodesDisable({ code, pin }) {
      await wait(250);
      guardPin(pin, 'backup codes', 'Owner vault', 'sec');
      const clean = (code || '').trim().toUpperCase();
      if (!backup.codes.includes(clean)) { note('Wrong backup code', 'Owner vault', false, 'sec'); throw fail('bad_code'); }
      backup = { on: false, codes: [] };
      note('Backup codes turned off', 'Owner vault', true, 'sec');
      return { ok: true, relock: true };
    },
    async listLog({ category = 'all', search = '', before_id = null, page_size = 50 } = {}) {
      await wait(120);
      const q = search.trim().toLowerCase();
      const size = Math.min(page_size, 50);
      const all = log.filter(x => (category === 'all' || x.cat === category) && (!q || `${x.a} ${x.tg} ${x.who}`.toLowerCase().includes(q)) && (before_id == null || x.id < before_id));
      const page = all.slice(0, size);
      return { rows: page.map(x => ({ ...x, day: dayLabel(x.at), time: new Date(x.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) })), hasMore: all.length > size };
    },
    async listAnnouncements() {
      await wait(120);
      return announcements.slice(0, 50).map(a => ({ ...a, sent: ago(Date.now() - a.at) }));
    },
    async listMembers({ search = '', filter = 'all' } = {}) {
      await wait(150);
      const q = search.trim().toLowerCase();
      const withCounts = rows.map(row => ({ ...row, off_count: offCount(row) }));
      const counts = {
        all: withCounts.length,
        owner: withCounts.filter(r => r.plan === 'owner').length,
        premium: withCounts.filter(r => r.plan === 'premium').length,
        free: withCounts.filter(r => r.plan === 'free').length,
        restricted: withCounts.filter(isRestricted).length,
      };
      const shown = withCounts
        .filter(r => !q || r.email.toLowerCase().includes(q))
        .filter(r => filter === 'all' || (filter === 'restricted' ? isRestricted(r) : r.plan === filter))
        .sort((a, b) => Number(b.plan === 'owner') - Number(a.plan === 'owner'));
      return { rows: shown, counts, hasMore: false };
    },
  };
})();

// ---- Live staging client -------------------------------------------------------------------
const STAGING_HOST = 'tenktwvkxjqsnamlfhcp.supabase.co';
let lockHandler = () => {};
export const setOfficeLockHandler = handler => { lockHandler = typeof handler === 'function' ? handler : () => {}; };
const emails = new Map();
const remember = rows => (Array.isArray(rows) ? rows : [rows]).forEach(row => { if (row?.user_id && row?.email) emails.set(row.user_id, row.email); });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACTION_LABELS = {
  admin_unlock: 'Unlocked the office', admin_lock: 'Locked the office', admin_list_members: 'Opened the register',
  admin_update_member: 'Changed a member’s settings', admin_set_status: 'Changed a member’s access',
  admin_change_pin: 'Changed their own PIN', admin_backup_codes_enable: 'Backup codes turned on', admin_backup_codes_disable: 'Backup codes turned off',
  admin_send_announcement: 'Sent an announcement', suspend: 'Suspended a member', ban: 'Banned a member', delete: 'Started the 14-day deletion countdown',
  reactivate: 'Reactivated a member', unban: 'Unbanned a member', cancel_delete: 'Cancelled a deletion',
};
const prettify = text => { const clean = String(text || '').replace(/^admin_/, '').replace(/_/g, ' ').trim(); return clean ? clean[0].toUpperCase() + clean.slice(1) : 'Action'; };
const audienceLabel = (audience, total) => !audience ? 'members' : audience.mode === 'all' ? 'all users' : audience.mode === 'group' ? (audience.groups || []).map(g => (g === 'premium' ? 'Premium' : 'Free')).join(' + ') : `${total ?? (audience.user_ids || []).length} selected`;

const createLiveApi = () => {
  let clientPromise;
  const client = () => clientPromise || (clientPromise = import('./supabaseClient.js').then(module => {
    const supabase = module.supabase;
    if (String(supabase?.supabaseUrl || '').replace(/\/$/, '') !== `https://${STAGING_HOST}`) throw fail('office_unavailable');
    return supabase;
  }));
  const call = async (operation, fields = {}) => {
    const supabase = await client();
    const { data, error } = await supabase.functions.invoke('admin-office', { body: { operation, request_id: crypto.randomUUID(), ...fields } });
    let value = data;
    if (error?.context instanceof Response) { try { value = await error.context.clone().json(); } catch { /* keep value */ } }
    if (error || value?.ok !== true) {
      const code = value?.error || 'office_unavailable';
      const problem = fail(code, { triesLeft: value?.tries_left, until: value?.until ? Date.parse(value.until) : undefined });
      if (['office_locked', 'session_unavailable', 'not_allowed', 'locked'].includes(code) && operation !== 'admin_unlock') lockHandler(code);
      throw problem;
    }
    return value;
  };
  return {
    async unlock({ code, pin }) { const result = await call('admin_unlock', { totp_code: code, pin }); return { expiresAt: Date.parse(result.expires_at) }; },
    async lock() { try { await call('admin_lock'); } catch { /* already locked */ } return true; },
    async listMembers({ search = '', filter = 'all', after = null } = {}) {
      const result = await call('admin_list_members', { search, filter, after: after || undefined, page_size: 50 });
      remember(result.rows);
      return { rows: result.rows, counts: result.counts, hasMore: !!result.next_after, nextAfter: result.next_after };
    },
    async updateMember(fields) { const result = await call('admin_update_member', fields); remember(result.member); return result.member; },
    async setStatus(fields) { const result = await call('admin_set_status', fields); remember(result.member); return result.member; },
    async sendAnnouncement(fields) { const result = await call('admin_send_announcement', fields); return { id: result.id, recipients: result.recipient_count }; },
    async listAnnouncements() {
      const result = await call('admin_list_announcements', { page_size: 50 });
      return [...result.rows].reverse().map(row => ({ id: row.id, title: row.title, body: '', to: audienceLabel(row.audience, row.total), at: Date.parse(row.created_at), sent: ago(Date.now() - Date.parse(row.created_at)), read: Number(row.read_count), total: Number(row.total) }));
    },
    async listLog({ category = 'all', search = '', before_id = null } = {}) {
      const result = await call('admin_list_log', { category: category === 'all' ? '' : category, search, before_id: before_id ?? undefined, page_size: 50 });
      const rows = result.rows.map(row => {
        const at = Date.parse(row.at);
        const target = row.target && UUID.test(row.target) ? (emails.get(row.target) || `Member ${row.target.slice(0, 8)}`) : (row.target || '');
        return { id: row.id, at, who: row.actor_label || 'Owner', a: ACTION_LABELS[row.action] || prettify(row.action), tg: target, ok: row.ok !== false, cat: row.category, day: dayLabel(at), time: new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) };
      });
      return { rows, hasMore: rows.length >= 50 };
    },
    // There is no status endpoint yet, so whether backup codes are on is reported as unknown (null).
    async getSecurity() { return { backup_codes: null, authenticator: 'linked', idle_minutes: 15, owners: null }; },
    async changePin({ current_pin, new_pin }) { await call('admin_change_pin', { current_pin, new_pin }); return { relock: true }; },
    async backupCodesEnable({ pin }) { const result = await call('admin_backup_codes_enable', { pin }); return { codes: result.codes, relock: true }; },
    async backupCodesDisable({ code, pin }) { await call('admin_backup_codes_disable', { code, pin }); return { ok: true, relock: true }; },
  };
};

let stagingApp = false;
try { stagingApp = new URL(import.meta.env?.VITE_SUPABASE_URL || '').host === STAGING_HOST && new URLSearchParams(window.location.search).get('adminoffice') !== 'mock'; } catch { stagingApp = false; }
export const officeIsLive = stagingApp;
export const officeApi = stagingApp ? createLiveApi() : mock;
