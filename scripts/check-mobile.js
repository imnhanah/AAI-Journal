import {spawn} from 'node:child_process';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {auditMobile} from './mobile-audit.js';
import {fileURLToPath} from 'node:url';
process.env.PLAYWRIGHT_BROWSERS_PATH ||= fileURLToPath(new URL('../.cache/playwright',import.meta.url));
const {chromium}=await import('playwright');
const themeSource=await readFile(new URL('../src/siteTheme.js',import.meta.url),'utf8');
const accentIds=[...themeSource.split('export const ACCENT_OPTIONS = [')[1].split('];')[0].matchAll(/id: '([^']+)'/g)].map(x=>x[1]);
const arg=name=>process.argv.find(x=>x.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
const routes=(arg('routes')||'dashboard,calendar,trade-log,markups,review,finance,backtest,analytics,psychology,news,challenge,management').split(',');
const widths=(arg('widths')||'360,390,430').split(',').map(Number),themes=(arg('themes')||'dark,light').split(',');
const accents=arg('accents')==='all'?['default',...accentIds]:(arg('accents')||'default').split(',');
const base=arg('base')||'http://127.0.0.1:4174',output=arg('output')||'artifacts/mobile-report.json';
const includeSheets=arg('sheets')!=='false',longFigures=arg('long-figures')==='true';
let server,browser;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
try{
 if(!arg('base')){server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4174','--strictPort'],{cwd:process.cwd(),env:{...process.env,VITE_SUPABASE_URL:base+'/mock',VITE_SUPABASE_ANON_KEY:'synthetic-layout-fixture'},stdio:'ignore'});for(let i=0;i<80;i++){try{if((await fetch(base)).ok)break;}catch{}if(server.exitCode!==null)throw new Error('The isolated fixture server exited.');await sleep(250);}}
 browser=await chromium.launch();const results=[];
 for(const theme of themes)for(const accent of accents){const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce',timezoneId:'Africa/Accra'});
  await context.route('**/*',async route=>{const url=new URL(route.request().url());if(url.pathname.startsWith('/mock'))return route.fulfill({json:{cloud_sync_enabled:false}});if(url.origin!==base)return route.abort();return route.continue();});
  await context.addInitScript(()=>{const fixed=Date.parse('2026-10-12T09:00:00Z'),NativeDate=Date;window.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:[fixed]));}static now(){return fixed;}};});
  const page=await context.newPage();
  const inspect=async(route,state='page')=>{await page.evaluate(()=>document.fonts.ready);const result=await page.evaluate(auditMobile);results.push({route,state,theme,accent,longFigures,...result});console.log(`${theme}/${accent} ${result.width} /${route} ${state}: ${result.issues.length} problems`);};
  for(const width of widths){
   await page.setViewportSize({width,height:844});
   for(const route of routes){
    await page.goto(`${base}/${route}?mobileFixture=1&theme=${theme}&accent=${accent}&longFigures=${longFigures?'1':'0'}`);
    await page.locator('.tj-page-title').waitFor();await page.locator('.tj-content .tj-loading').waitFor({state:'hidden'});
    if(await page.locator('.tj-page-title').innerText()==='Dashboard'&&route!=='dashboard')throw new Error(`Route ${route} fell back to Dashboard`);
    await inspect(route);
    if(includeSheets&&route==='dashboard'){
     await page.getByRole('button',{name:/^Start Day Daily routine/}).click();
     const popup=page.locator('.tj-routine-popup');await popup.waitFor();
     await inspect(route,'routine-open');
     const boxes=popup.locator('input[type="checkbox"]'),count=await boxes.count(),partial=Math.ceil(count*2/3);
     for(let index=0;index<partial;index++)await boxes.nth(index).check();
     await inspect(route,'routine-progress');
     for(let index=partial;index<count;index++)await boxes.nth(index).check();
     await inspect(route,'routine-complete');
     await popup.locator('.tj-routine-close').click();await popup.waitFor({state:'hidden'});
     if(await page.locator('.tj-markup-composer-modal').isVisible())throw new Error('Closing the routine unexpectedly opened markup.');
     await page.getByRole('button',{name:'Add to your day',exact:true}).click();
     const menu=page.getByRole('dialog',{name:'Add to your day',exact:true});await menu.waitFor();await inspect(route,'add-menu');
     await menu.getByRole('button',{name:/^Start Day Daily routine/}).click();await popup.waitFor();await inspect(route,'routine-from-add');
     await popup.locator('.tj-routine-close').click();await popup.waitFor({state:'hidden'});
    }
    if(includeSheets&&route==='calendar')for(const date of ['2026-10-02','2026-10-06','2026-10-08']){
     await page.getByRole('button',{name:new RegExp(`^${date},`)}).click();await page.locator('.tj-calendar-day-modal').waitFor();
     await inspect(route,`day-${date}`);await page.getByRole('button',{name:'Close day details',exact:true}).click();await page.locator('.tj-calendar-day-modal').waitFor({state:'hidden'});
    }
   }
  }
  await context.close();
 }
 await mkdir(output.substring(0,output.lastIndexOf('/'))||'.',{recursive:true});await writeFile(output,JSON.stringify(results,null,2));const count=results.reduce((sum,r)=>sum+r.issues.length,0);
 for(const result of results)for(const issue of result.issues)console.error(`${result.theme}/${result.accent} ${result.width} /${result.route}: ${issue.kind} ${issue.selector} (${issue.amount}px)${issue.detail?' · '+issue.detail:''}`);
 console.log(`\n${results.length} route/viewport/theme/accent checks; ${count} problems. ${output}`);process.exitCode=count?1:0;
}catch(error){console.error(error);process.exitCode=2;}finally{await browser?.close();server?.kill('SIGTERM');}
