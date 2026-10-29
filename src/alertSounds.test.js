import test from 'node:test';
import assert from 'node:assert/strict';
import {unlockAlertSounds,playAlertSound} from './alertSounds.js';
test('news, challenge and savings recordings play once, untrimmed, with isolated clips',async()=>{
  const sources=[],requests=[];
  let audio;
  globalThis.window={AudioContext:class {
    constructor(){audio=this;}
    state='suspended';destination={};
    async resume(){this.state='running';}
    async decodeAudioData(bytes){return {bytes,duration:22};}
    createBufferSource(){const source={starts:[],stopped:false,connect(){},disconnect(){},start(...args){this.starts.push(args);},stop(){this.stopped=true;}};sources.push(source);return source;}
  }};
  globalThis.fetch=async(url)=>{requests.push(url);return {ok:true,arrayBuffer:async()=>new ArrayBuffer(url.includes('news')?1:2)};};
  assert.equal(await playAlertSound('news'),false);
  assert.equal(await unlockAlertSounds(),true);
  assert.equal(await playAlertSound('news'),true);
  assert.deepEqual(sources[0].starts,[[]]);
  assert.equal(sources[0].loop,false);
  assert.equal(sources[0].buffer.bytes.byteLength,1);
  assert.equal(await playAlertSound('challenge'),true);
  assert.equal(sources[1].buffer.bytes.byteLength,2);
  assert.deepEqual(sources[1].starts,[[]]);
  await playAlertSound('news');
  assert.equal(sources[0].stopped,true);
  assert.equal(sources[1].stopped,false);
  assert.deepEqual(requests,['/audio/news-alert.mp3','/audio/challenge-complete.mp3','/audio/savings-alert.mp3']);
  audio.state='suspended';
  assert.equal(await playAlertSound('savings'),true);
  audio.state='suspended';
  audio.resume=async()=>{};
  assert.equal(await playAlertSound('savings'),false);
  audio.state='running';
  assert.equal(await playAlertSound('savings'),true);
  const savings=sources.at(-1);
  assert.deepEqual(savings.starts,[[]]);
  assert.equal(savings.loop,false);
  assert.equal(savings.buffer.bytes.byteLength,2);
  await playAlertSound('savings');
  assert.equal(savings.stopped,true);
  assert.deepEqual(requests,['/audio/news-alert.mp3','/audio/challenge-complete.mp3','/audio/savings-alert.mp3']);
});
