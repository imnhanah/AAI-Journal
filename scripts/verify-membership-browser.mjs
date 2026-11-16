import assert from 'node:assert/strict';
import { chromium, webkit } from 'playwright';
import { createServer } from 'vite';
import configure from '../vite.config.js';

const userId = '11111111-1111-4111-8111-111111111111';
const secondId = '22222222-2222-4222-8222-222222222222';
const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jQLsAAAAASUVORK5CYII=';
const screenshot = 'data:image/png;base64,' + png;
const port = 43891;
const origin = `http://127.0.0.1:${port}`;
process.env.VITE_SUPABASE_URL = origin + '/mock';
process.env.VITE_SUPABASE_ANON_KEY = 'synthetic-membership-browser-test';
const engine = process.env.AAI_MEMBERSHIP_BROWSER === 'webkit' ? webkit : chromium;
const browser = await engine.launch();

try {
  for (const enabled of [false, true]) {
    process.env.VITE_MEMBERSHIP_ENTITLEMENTS_PREVIEW = String(enabled);
    process.env.VITE_MEMBERSHIP_ADMIN_UI = String(!enabled);
    const settings = configure({mode:'development'});
    const entry = {
      name:'membership-test-entry',
      resolveId(id) { if (id === 'virtual:membership-test-entry') return id; },
      load(id) {
        if (id !== 'virtual:membership-test-entry') return;
        return `
          import React from 'react';
          import {createRoot} from 'react-dom/client';
          import {ConfirmationProvider} from '/src/ConfirmationDialog.jsx';
          import MembershipManagement from '/src/MembershipManagement.jsx';
          import JournalPromotion from '/src/JournalPromotion.jsx';
          const root = createRoot(document.getElementById('membership-root'));
          export function renderMembership(userId) {
            root.render(React.createElement(
              ConfirmationProvider, null, React.createElement(MembershipManagement, {userId,onAccessLost:()=>{}})));
          }
          export function renderPromotion(userId) {
            root.render(React.createElement(
              ConfirmationProvider, null, React.createElement(JournalPromotion, {userId})));
          }
        `;
      },
    };
    const server = await createServer({
      ...settings, plugins:[...settings.plugins,entry], configFile:false, optimizeDeps:{include:['react','react-dom/client']}, cacheDir:'/private/tmp/aai-membership-browser-vite',
      server:{host:'127.0.0.1',port,strictPort:true,hmr:false,fs:{allow:[process.cwd(),'/private/tmp/aai-membership-browser-vite']}},
    });
    try {
      await server.listen();
      const context = await browser.newContext({ acceptDownloads: true });
      const page = await context.newPage();
      page.setDefaultTimeout(12000);
      const calls = [];
      let membership = 'free';
      let cloudFlag = true;
      let assignment = 'free';
      let promotionConflict = true;
      let failUpload = true;
      let writes = 0;
      let publishedEvidence;
      const images = new Map();
      const workspace = {
        id:'33333333-3333-4333-8333-333333333333', user_id:userId, name:'Cloud recovery workspace',
        icon:'USD', base_currency:'USD', balance:10000, created_at:'2026-10-12', updated_at:'2026-10-12', profile_image:screenshot,
      };
      const library = {version:1, studies:[{id:'recovery-study',title:'Cloud recovery study'}], evidence:[
        {id:'recovery-evidence',title:'Private cloud evidence',url:`tj-case-study-storage:${userId}/sample.png`},
      ]};
      const runId = '44444444-4444-4444-8444-444444444444';
      const tradeId = '55555555-5555-4555-8555-555555555555';
      const testDate = '2026-10-12T00:00:00Z';
      const tables = ['accounts','trades','rules','journal_entries','user_settings','premarket_markups','trade_reviews','period_reviews','finance_settings','savings_accounts','finance_movements','workspace_balances','trade_balance_results'];

      await context.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (url.protocol === 'data:' || url.protocol === 'blob:') return route.continue();
        if (url.origin !== origin) return route.abort();
        if (url.pathname === '/membership-browser-test') {
          const body = await server.transformIndexHtml('/membership-browser-test', '<!doctype html><html><head></head><body><div id="membership-root"></div></body></html>');
          return route.fulfill({contentType:'text/html',body});
        }
        if (!url.pathname.startsWith('/mock/')) return route.continue();
        const endpoint = url.pathname.split('/').at(-1);
        const send = data => route.fulfill({json:data});
        if (url.pathname.includes('/storage/v1/object/case-study-evidence/') && endpoint !== 'sample.png') {
          if (route.request().method() === 'POST') {
            writes += 1;
            if (failUpload) {
              failUpload = false;
              return route.fulfill({ status:503, json:{message:'Synthetic temporary upload failure'} });
            }
            images.set(endpoint,route.request().postDataBuffer());
            return send({Key:'case-study-evidence/' + endpoint});
          }
          return route.fulfill({contentType:'image/png',body:images.get(endpoint)});
        }
        calls.push({endpoint,method:route.request().method()});
        switch (endpoint) {
          case 'tj_publish_device_journal': {
            const request = route.request().postDataJSON();
            if (request.preview) return send({conflicts:promotionConflict ? [{table:'Case Studies',revision:2}] : []});
            assert.equal(images.size,2);
            assert.equal(request.rows_by_table.trades.length,1);
            assert.equal(request.rows_by_table.backtest_trades.length,1);
            assert.match(request.device_library.evidence[0].cloudRef,/tj-case-study-storage:/);
            publishedEvidence = request.device_library.evidence[0];
            return send({conflicts:[]});
          }
          case 'tj_current_entitlements': return send([{membership,cloud_writes_allowed:membership === 'owner' && cloudFlag}]);
          case 'tj_current_membership': return send(membership);
          case 'profiles': return send({cloud_sync_enabled:cloudFlag});
          case 'tj_is_membership_admin': return send(true);
          case 'tj_list_membership_accounts': return send([{
            user_id:secondId,email:'synthetic-free@example.test',membership:assignment,
            cloud_flag:assignment === 'owner',cloud_writes_allowed:assignment === 'owner',
          }]);
          case 'tj_change_membership': {
            const request = route.request().postDataJSON();
            assert.equal(request.target_user,secondId);
            assert.equal(request.expected_membership,assignment);
            assignment = request.next_membership;
            return send({user_id:secondId,email:'synthetic-free@example.test',membership:assignment,cloud_flag:request.next_cloud_flag,cloud_writes_allowed:request.next_cloud_flag});
          }
          case 'tj_sync_journal':
            return send({protocol:3,tables:Object.fromEntries(tables.map(table=>[table,{rows:table === 'accounts' ? [{...workspace,profile_image:undefined}] : [],deleted:[]}]))});
          case 'accounts':
            assert.equal(route.request().method(),'GET');
            assert.equal(url.searchParams.get('user_id'),'eq.'+userId);
            assert.equal(url.searchParams.get('select'),'id,profile_image,updated_at');
            return send(url.searchParams.has('id') ? [] : [{id:workspace.id,profile_image:workspace.profile_image,updated_at:workspace.updated_at}]);
          case 'profile_case_study_libraries': return send({library,revision:1,updated_at:testDate});
          case 'tj_sync_backtests': return send({
            runVersions:[{id:runId,updatedAt:testDate}],tradeVersions:[{id:tradeId,updatedAt:testDate}],
            runs:[{id:runId,name:'Cloud recovery test',instrument:'EUR/USD',updatedAt:testDate}],
            trades:[{id:tradeId,runId,asset:'EUR/USD',updatedAt:testDate,screenshotCount:1}],
          });
          case 'tj_backtest_media': return send({entry:[{src:screenshot}]});
          case 'challenge_progress':
          case 'balance_challenge_progress': return send([]);
          case 'sample.png':
            if (url.pathname.includes('/object/sign/')) return send({signedURL:'/object/recovery.png'});
            return route.abort();
          case 'recovery.png': return route.fulfill({contentType:'image/png',body:Buffer.from(png,'base64')});
          default: return route.fulfill({status:400,json:{message:'Unexpected synthetic request for ' + endpoint}});
        }
      });
      page.on('console', message => { if (message.type() === 'error') console.error('Browser console:', message.text()); });
      page.on('pageerror', error => console.error('Browser error:',error.message));
      await page.goto(origin + '/membership-browser-test');
      await page.evaluate(async ({userId,screenshot}) => {
        const base = '/src/';
        const client = (await import(base+'supabaseClient.js')).supabase;
        const user = {id:userId,email:'synthetic@example.test',user_metadata:{}};
        // Keep session reads and Auth events on the same synthetic source. The
        // real client's INITIAL_SESSION(null) must not sign this fixture out
        // halfway through private-image recovery on a slower browser.
        const makeSession = currentUser => currentUser ? {user:currentUser,access_token:'synthetic-access-token',token_type:'bearer'} : null;
        let session = makeSession(user);
        const listeners = new Set();
        client.auth.getSession = async () => ({data:{session},error:null});
        client.auth.getUser = async () => ({data:{user:session?.user ?? null},error:null});
        client.auth.onAuthStateChange = callback => {
          listeners.add(callback);
          queueMicrotask(() => { if (listeners.has(callback)) callback('INITIAL_SESSION',session); });
          return {data:{subscription:{unsubscribe:() => listeners.delete(callback)}}};
        };
        const auth = {
          transition(nextUser) {
            session = makeSession(nextUser);
            for (const callback of listeners) callback(nextUser ? 'SIGNED_IN' : 'SIGNED_OUT',session);
          },
        };
        await (await import(base+'privateCacheRuntime.js')).activatePrivateUser(userId);
        const local = await import(base+'localJournalDb.js');
        local.configureLocalJournal(userId,true);
        const account = (await local.createAccount(userId,{id:'device-workspace',name:'Device workspace',balance:1000,baseCurrency:'USD'})).data;
        await local.createTrade(userId,account.id,{id:'device-trade',asset:'EUR/USD',date:'2026-10-12',direction:'BUY',pnl:0,screenshots:{entry:[{src:screenshot}]}});
        await local.createMarkup(userId,account.id,{id:'device-markup',instrument:'EUR/USD',date:'2026-10-12',screenshots:{entry:[{src:screenshot}]}});
        await local.saveManagedLists(userId,{customInstruments:['EUR/USD']});
        const imageStore=(await import(base+'caseStudySharedImageIntegration.js')).caseStudySharedImageIntegration;
        const file = new Blob([Uint8Array.from(atob(screenshot.split(',')[1]),c=>c.charCodeAt(0))],{type:'image/png'});
        const saved = await imageStore.saveEvidenceImage({userId,file});
        await local.saveProfileCaseStudyLibrary(userId,{studies:[{id:'device-study',title:'Device study'}],evidence:[{id:'device-evidence',url:saved.reference}],personalTemplates:[{id:'device-template',name:'Device template'}]});
        const backtest = (await import(base+'backtestLocal.js')).createLocalBacktestApi(userId);
        const run = await backtest.saveTestRun({id:'device-test',name:'Device test',instrument:'EUR/USD'});
        await backtest.saveTestTrade(run,{id:'device-test-trade',asset:'EUR/USD',screenshots:{entry:[{src:screenshot}]},mediaEdited:true});
        window.membershipFixture = { local, imageStore, saved, user, backtest, auth };
      },{userId,screenshot});
      const localState = await page.evaluate(async ({userId}) => {
        const { local, imageStore, saved, backtest } = window.membershipFixture;
        const data = (await local.exportLocalJournal(userId)).data;
        const blob = await imageStore.storage.getImage(saved.asset.id,userId);
        const workspace = await backtest.syncBacktests(userId);
        return [data.accounts[0].trades[0].id,data.markups[0].id,data.profileCaseStudyLibrary.personalTemplates[0].id,blob.size,workspace.trades[0].screenshots.entry[0].src];
      },{userId});
      assert.deepEqual(localState,['device-trade','device-markup','device-template',Buffer.from(png,'base64').length,screenshot]);

      const rpc = await page.evaluate(async () => {
        const access = await import('/src/membership.js');
        return access.resolveJournalMembership({authenticated:true});
      });
      assert.equal(rpc.membership,'free');
      assert.equal(rpc.cloudWritesAllowed,enabled ? false : undefined);

      const recovery = await page.evaluate(async userId => {
          const {readCloudJournalRecovery} = await import('/src/journalCloudRecovery.js');
          const {local} = window.membershipFixture;
          const before = await local.exportLocalJournal(userId);
          local.configureLocalJournal(userId,false);
          const exported = await readCloudJournalRecovery(userId,{});
          local.configureLocalJournal(userId,true);
          const after = await local.exportLocalJournal(userId);
          const preserved = JSON.stringify(before.data) === JSON.stringify(after.data);
          // Import into a separate synthetic device key to check the file.
          const restored = await local.importLocalJournal('clean-device',JSON.parse(JSON.stringify(exported)));
          return {preserved,unavailable:exported.unavailableImages,account:restored.data.accounts[0].name,accountImage:restored.data.accounts[0].profileImage,
            evidence:restored.data.profileCaseStudyLibrary.evidence[0].url,
            screenshot:restored.data.backtestWorkspace.trades[0].screenshots.entry[0].src};
        },userId);
      assert.deepEqual(recovery,{preserved:true,unavailable:0,account:'Cloud recovery workspace',accountImage:screenshot,evidence:screenshot,screenshot});

      if (enabled) {
        await page.evaluate(async userId => {
          const { renderMembership } = await import('/@id/virtual:membership-test-entry');
          renderMembership(userId);
        },userId);
        await page.getByRole('button',{name:'Edit membership for synthetic-free@example.test'}).click();
        await page.getByLabel('Membership',{exact:true}).selectOption('owner');
        const permissionLabel = enabled ? 'Allow cloud writes' : 'Enable cloud sync';
        const statusLabel = enabled ? 'Cloud writes' : 'Cloud sync';
        assert.equal(await page.evaluate(async () => {
          const { membershipAdminUiEnabled } = await import('/src/membershipAdmin.js');
          return membershipAdminUiEnabled;
        }), !enabled);
        await page.getByLabel(permissionLabel).check();
        await page.getByRole('button',{name:'Review change'}).click();
        await page.getByRole('button',{name:'Save membership'}).click();
        await page.getByRole('status').filter({hasText:`Saved Owner. ${statusLabel} enabled.`}).waitFor();
        await page.getByRole('button',{name:'Edit membership for synthetic-free@example.test'}).click();
        await page.getByLabel('Membership',{exact:true}).selectOption('free');
        assert.equal(await page.getByLabel(permissionLabel).count(),0);
        await page.getByRole('button',{name:'Review change'}).click();
        await page.getByRole('button',{name:'Save membership'}).click();
        await page.getByRole('status').filter({hasText:`Saved Free. ${statusLabel} disabled.`}).waitFor();

        membership = 'owner';
        const prepare = () => page.evaluate(async userId => {
          const service = await import('/src/journalPromotion.js');
          window.promotionPlan = await service.prepareJournalPromotion(userId);
          return window.promotionPlan.conflicts;
        },userId);
        assert.deepEqual(await prepare(),[{table:'Case Studies',revision:2}]);
        assert.equal(writes,0);
        promotionConflict = false;
        assert.deepEqual(await prepare(),[]);
        const publish = () => page.evaluate(async () => {
          const service = await import('/src/journalPromotion.js');
          return service.publishJournalPromotion(window.promotionPlan,()=>{});
        });
        await assert.rejects(publish,/pending or failed/);
        assert.deepEqual(await prepare(),[]);
        await publish();
        const verifiedWrites = writes;
        assert.deepEqual(await prepare(),[]);
        await publish();
        assert.equal(writes,verifiedWrites);
        await page.evaluate(async userId => {
          const { renderPromotion } = await import('/@id/virtual:membership-test-entry');
          renderPromotion(userId);
        },userId);
        await page.getByRole('button',{name:'Preview cloud publish'}).click();
        await page.getByRole('button',{name:'Review and publish'}).click();
        await page.getByRole('button',{name:'Publish device data',exact:true}).click();
        await page.getByRole('status').filter({hasText:'Cloud save confirmed.'}).waitFor();
        assert.equal(writes,verifiedWrites);
        if (engine === webkit) {
          const receiving = await chromium.launch();
          try {
            const receiver = await receiving.newPage();
            const asset = publishedEvidence.cloudRef.split('/').at(-1);
            await receiver.route(origin + '/published-evidence.png', route => route.fulfill({
              contentType:'image/png',body:images.get(asset),
            }));
            await receiver.goto(origin + '/published-evidence.png');
            assert.equal(await receiver.locator('img').evaluate(img => img.complete && img.naturalWidth > 0),true);
          } finally {
            await receiving.close();
          }
        }
        assert.equal(await page.evaluate(async userId => {
          const original = await window.membershipFixture.local.exportLocalJournal(userId);
          return original.data.accounts[0].trades[0].screenshots.entry[0].src;
        },userId),screenshot);
      }

      membership = 'owner';
      assert.equal((await page.evaluate(async () => (await import('/src/membership.js')).resolveJournalMembership({authenticated:true}))).cloudWritesAllowed,enabled ? true : undefined);
      // Exercise the same Auth events as a real account switch/sign-out, so a
      // fixture fix cannot hide owner-isolation or cache invalidation failures.
      await page.evaluate(async userId => {
        const cloud = await import('/src/caseStudyEvidenceCloud.js');
        const ref = `tj-case-study-storage:${userId}/sample.png`;
        const image = await cloud.resolveCaseStudyEvidenceCloudBlob(ref,{userId});
        if (!image.blob) throw new Error('Authenticated image warm-up failed: ' + image.code);
      },userId);
      const beforeAuthSwitch = calls.length;
      const authCheck = await page.evaluate(async ({userId,secondId}) => {
        const client = (await import('/src/supabaseClient.js')).supabase;
        const cloud = await import('/src/caseStudyEvidenceCloud.js');
        const {auth,user} = window.membershipFixture;
        const events = [];
        const {data:{subscription}} = client.auth.onAuthStateChange((event,session) => events.push([event,session?.user?.id ?? null]));
        await Promise.resolve();
        auth.transition({...user,id:secondId});
        const ref = `tj-case-study-storage:${userId}/sample.png`;
        const switched = await cloud.resolveCaseStudyEvidenceCloudBlob(ref,{userId});
        const cacheCleared = !cloud.peekCaseStudyEvidenceCloudBlob(ref,userId);
        const switchedUser = (await client.auth.getUser()).data.user.id;
        auth.transition(null);
        const signedOut = await cloud.resolveCaseStudyEvidenceCloudBlob(ref,{userId});
        const session = (await client.auth.getSession()).data.session;
        const signedOutUser = (await client.auth.getUser()).data.user;
        auth.transition(user);
        subscription.unsubscribe();
        auth.transition(user);
        return {events,cacheCleared,switchedUser,session,signedOutUser,switched:switched.code,signedOut:signedOut.code};
      },{userId,secondId});
      assert.deepEqual(authCheck,{
        events:[['INITIAL_SESSION',userId],['SIGNED_IN',secondId],['SIGNED_OUT',null],['SIGNED_IN',userId]],
        cacheCleared:true,switchedUser:secondId,session:null,signedOutUser:null,
        switched:'signed-url-authorization-failed',signedOut:'signed-url-authorization-failed',
      });
      assert.equal(calls.length,beforeAuthSwitch,'another account or signed-out session must not request the original image');
      assert.deepEqual(calls.filter(call => call.method !== 'GET' && !['tj_current_entitlements','tj_current_membership','tj_sync_journal','tj_sync_backtests','tj_backtest_media','tj_list_membership_accounts','tj_change_membership','sample.png','tj_publish_device_journal'].includes(call.endpoint)),[]);
      await context.close();
      console.log(`Passed browser checks with preview ${enabled ? 'enabled' : 'disabled'}.`);
    } finally {
      await server.close();
    }
  }
} finally {
  await browser.close();
}
