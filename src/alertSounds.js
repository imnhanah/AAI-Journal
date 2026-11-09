import {playSynthSound,stopSynthSound,unlockSynthSounds} from './synthSounds.js';
import {readSavingsSoundChoice} from './savingsSoundSettings.js';
const base=import.meta.env?.BASE_URL || '/';
// News keeps its recording. Savings and challenge alerts are synthesised (synthSounds.js),
// after aaicorefx-desktop-finance-challenge-popups.html.
const urls={news:`${base}audio/news-alert.mp3`};
const SYNTH={savings:()=>readSavingsSoundChoice(),challenge:()=>'challenge'};
let context;
const buffers=new Map();
const playing=new Map();
function audioContext(){
  const Audio=window.AudioContext || window.webkitAudioContext;
  if(!Audio)throw new Error('Audio unavailable');
  if(!context || context.state==='closed'){context=new Audio();buffers.clear();}
  return context;
}
async function load(kind){
  const ctx=audioContext();
  if(!buffers.has(kind)){
    const pending=fetch(urls[kind]).then(response=>{if(!response.ok)throw new Error('Audio unavailable');return response.arrayBuffer();}).then(bytes=>ctx.decodeAudioData(bytes));
    buffers.set(kind,pending);
    pending.catch(()=>buffers.delete(kind));
  }
  return buffers.get(kind);
}
export async function unlockAlertSounds(){
  try{
    const ctx=audioContext();
    await ctx.resume();
    await Promise.allSettled([load('news'),unlockSynthSounds()]);
    return ctx.state==='running';
  }catch{return false;}
}

export function stopAlertSound(kind){
  if(SYNTH[kind]){stopSynthSound(kind);return;}
  playing.get(kind)?.stop();
  playing.delete(kind);
}
export async function playAlertSound(kind){
  if(SYNTH[kind])return playSynthSound(SYNTH[kind](),kind);
  try{
    const ctx=audioContext();
    // Try automatic savings audio when browser policy permits it. A blocked
    // resume must not hang the popup's fallback button indefinitely.
    if(kind==='savings' && ctx.state==='suspended'){
      let timer;
      try { await Promise.race([ctx.resume(),new Promise(resolve=>{timer=setTimeout(resolve,250);})]); }
      finally { clearTimeout(timer); }
    }
    if(ctx.state!=='running')return false;
    const buffer=await load(kind);
    // Replay restarts the same clip, rather than layering multiple copies.
    playing.get(kind)?.stop();
    const source=ctx.createBufferSource();
    source.buffer=buffer;source.loop=false;source.connect(ctx.destination);
    playing.set(kind,source);
    source.onended=()=>{source.disconnect();if(playing.get(kind)===source)playing.delete(kind);};
    source.start(); // No duration argument: play the complete, untrimmed recording.
    return true;
  }catch{return false;}
}

// Short two-note tones for news alerts (Soft, Chime, Pulse). "app" plays the recorded clip.
const ALERT_TONE_NOTES={soft:[660,880],chime:[784,1175],pulse:[520,520]};
export async function playAlertTone(tone='app'){
  if(!ALERT_TONE_NOTES[tone])return playAlertSound('news');
  try{
    const ctx=audioContext();
    if(ctx.state!=='running'){try{await ctx.resume();}catch{}}
    if(ctx.state!=='running')return false;
    ALERT_TONE_NOTES[tone].forEach((frequency,index)=>{
      const oscillator=ctx.createOscillator(),gain=ctx.createGain(),start=ctx.currentTime+index*.16;
      oscillator.type='sine';oscillator.frequency.value=frequency;
      oscillator.connect(gain);gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(.12,start+.02);gain.gain.exponentialRampToValueAtTime(.0001,start+.5);
      oscillator.start(start);oscillator.stop(start+.55);
    });
    return true;
  }catch{return false;}
}
