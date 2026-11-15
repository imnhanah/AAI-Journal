import test from 'node:test';
import assert from 'node:assert/strict';
import {preserveMarkupScreenshots,preserveTradeScreenshots,additionalScreenshotImages} from './legacyScreenshotMedia.js';
const image=n=>'tj-image:'+JSON.stringify({user:'owner',table:'premarket_markups',id:'row',version:'v1',path:[n]});
const slots=['preHTF','preH4','preM15','postH4','postM15'];

test('Markup recovery retains unknown groups, captions, nested paths and original references without mutation',()=>{
 const raw={entry:[{src:image(1),caption:'Original caption'}],custom:{file:{dataUrl:image(2)},notes:'Preserve me'},sessionReview:{marketOutcome:'Original'}};
 const before=structuredClone(raw),next=preserveMarkupScreenshots(raw);
 assert.deepEqual(raw,before);assert.deepEqual(next.entry,raw.entry);assert.deepEqual(next.custom,raw.custom);
 assert.deepEqual(additionalScreenshotImages(next,slots).map(x=>x.src),[image(1),image(2)]);
 assert.equal(additionalScreenshotImages(next,slots)[0].caption,'Original caption');
 assert.deepEqual(preserveMarkupScreenshots(next),next);
});
test('known legacy aliases remain readable without duplicate recovered-image cards',()=>{
 const next=preserveMarkupScreenshots({postD1:[{src:image(1)}],pre:[{src:image(2)}]});
 assert.equal(next.preHTF[0].src,image(1));assert.equal(next.preM15[0].src,image(2));
 assert.deepEqual(additionalScreenshotImages(next,slots),[]);
});
test('legacy Trade arrays retain images beyond the original four-slot projection',()=>{
 const raw=Array.from({length:7},(_,n)=>({src:image(n),caption:String(n)}));const before=structuredClone(raw);
 const next=preserveTradeScreenshots(raw);
 assert.deepEqual([...next.entry,...next.exit,...next.legacyAttachments],raw);
 assert.deepEqual(additionalScreenshotImages(next,['entry','exit']).map(x=>x.src),[image(4),image(5),image(6)]);
 assert.deepEqual(raw,before);assert.deepEqual(preserveTradeScreenshots(next),next);
});
test('non-array groups normalize safely while retaining their complete original structure',()=>{
 const raw={preM15:{first:{src:image(1)},second:{image:image(2)}}};
 const next=preserveMarkupScreenshots(raw);
 assert.deepEqual(next.legacyOriginal,raw);assert.deepEqual(next.preM15,[]);
 assert.deepEqual(additionalScreenshotImages(next,slots).map(x=>x.src),[image(1),image(2)]);
});
test('root image strings and unknown reference schemes survive recovery for explicit resolution/error reporting',()=>{
 for(const value of ['data:image/png;base64,AA==','tj-unknown-legacy:original','blob:original']){
  assert.equal(additionalScreenshotImages(preserveMarkupScreenshots(value),slots)[0].src,value);
 }
 assert.deepEqual(additionalScreenshotImages(preserveMarkupScreenshots({notes:'https://example.test/private-note'}),slots),[]);
});
