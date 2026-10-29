const base=import.meta.env?.BASE_URL || '/';
const urls={news:`${base}audio/news-alert.mp3`,challenge:`${base}audio/challenge-complete.mp3`,savings:`${base}audio/savings-alert.mp3`};
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
    await Promise.allSettled([load('news'),load('challenge'),load('savings')]);
    return ctx.state==='running';
  }catch{return false;}
}

export function stopAlertSound(kind){
  playing.get(kind)?.stop();
  playing.delete(kind);
}
export async function playAlertSound(kind){
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
