import test from 'node:test';
import assert from 'node:assert/strict';
import { LANGUAGES, normalizeLanguage, translate, translateTemplate, getLanguage, setLanguage, subscribeLanguage, loadLanguage } from './localization.js';
import { messages } from './translations.js';
import { auditMessages } from './auditTranslations.js';
import { collectPageCopy } from '../scripts/page-copy.mjs';
import { fileURLToPath } from 'node:url';
import { localizationPlugin } from '../scripts/localize-jsx.mjs';

test('ISO language catalog includes English fallback and Arabic RTL', () => {
  assert.equal(LANGUAGES.length, 14);
  assert.ok(LANGUAGES.every(item => /^[a-z]{2}$/.test(item.code)));
  assert.equal(LANGUAGES.find(item=>item.code==='ar').dir,'rtl');
  assert.equal(normalizeLanguage('unknown'),'en');
  assert.equal(translate('Dashboard','en'),'Dashboard');
  assert.equal(translate('Dashboard','ar'),'لوحة التحكم');
  assert.equal(translate('MY PRIVATE NOTE','ar'),'MY PRIVATE NOTE');
  assert.equal(translate('AAICOREFX','ar'),'AAICOREFX');
  assert.equal(translate('  SESSION  ','ar'),'  الجلسة  ');
  assert.equal(translate('Instrument *','fr'),'Instrument *');
});
test('every dictionary entry has all 13 translated locales', () => {
  for(const [source, translations] of Object.entries({...messages,...auditMessages}))for(const locale of LANGUAGES.filter(item=>item.code!=='en'))assert.ok(translations[locale.code]?.trim(),`${source}: ${locale.code}`);
});
test('page-copy extraction retains user-facing labels and excludes implementation details', async () => {
  const sources=collectPageCopy(fileURLToPath(new URL('.',import.meta.url)));
  const curated=new Set(Object.keys({...messages,...auditMessages}).map(key=>key.toLowerCase()));
  for(const source of ['% at risk','Account results','Close menu'])assert.ok(sources.includes(source),source);
  assert.ok(curated.has('% at risk'));
  for(const {code} of LANGUAGES.filter(item=>item.code!=='en'))assert.notEqual(translate('% at risk',code),'% at risk',code);
  for(const internal of ['aria-label','tj-root','period-reflection-tab-{0}'])assert.ok(!sources.includes(internal),internal);
});
test('language subscriptions update without remounting or changing data', async () => {
  const previous=getLanguage();let changes=0;
  const unsubscribe=subscribeLanguage(()=>changes++);
  await setLanguage('ar');assert.equal(getLanguage(),'ar');assert.equal(changes,1);
  unsubscribe();await setLanguage(previous);assert.equal(changes,1);
});
test('compiler translates presentation text, not handlers, component identifiers or user data', async () => {
  const source=`const Test=()=> <><Field label="Account"/><button onClick={()=>save("Account")}>Save</button><p>{trade.notes}</p><input placeholder="Search"/><option>Buy</option></>`;
  const result=await localizationPlugin().transform(source,'/project/src/Test.jsx');
  assert.match(result.code,/label="Account"/);
  assert.match(result.code,/save\("Account"\)/);
  assert.match(result.code,/\{trade.notes\}/);
  assert.match(result.code,/__tjTranslate\("Save"\)/);
  assert.match(result.code,/placeholder=\{__tjTranslate\("Search"\)\}/);
  assert.match(result.code,/<option value="Buy">/);
});
test('page headings, descriptions, months and dynamic counts translate in every locale', async () => {
  for(const {code} of LANGUAGES.filter(item=>item.code!=='en')){
    await loadLanguage(code);
    for(const source of ['ALL-TIME EQUITY','Turn records into lessons.','Close the review gap.','Review Library','Monthly Review','January','No trades'])assert.notEqual(translate(source,code),source,`${code}: ${source}`);
    const sentence='6 of 256 trades have no saved review. Capture the decision, not just the result.';
    const result=translate(sentence,code);
    assert.notEqual(result,sentence,code);
    assert.ok(result.includes('6')&&result.includes('256'));
  }
});
test('calendar labels use locale dates and template parameters remain unchanged', async () => {
  await loadLanguage('de');
  assert.equal(translate('Sun','de'),'So');
  assert.equal(translate('January','de'),'Januar');
  assert.equal(translateTemplate('{0} private {1}',['My account','note'],'de'),'My account private note');
  assert.equal(translateTemplate('{0} private {1}',['My account',''],'de'),'My account private ');
  const output=await localizationPlugin().transform('const Test=()=> <p>{`${count} trades`}</p>','/project/src/Test.jsx');
  assert.match(output.code,/__tjTemplate/);
});
test('dashboard chart sample labels use localized templates', async () => {
  await loadLanguage('fr');
  assert.equal(translateTemplate('{0} recorded trades this month',[3],'fr'),'3 opérations enregistrées ce mois-ci');
  assert.equal(translateTemplate('{0} trading days',[4],'fr'),'4 journées de trading');
});

