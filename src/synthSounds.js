// Synthesised alert sounds from aaicorefx-desktop-finance-challenge-popups.html. They replace the
// recorded savings and challenge clips (alertSounds.js still plays the recorded news clip).
// Each sound plays through its own gain node, so stopping one cuts it off cleanly.
let context;
const live = new Map();

function audio() {
  const Audio = window.AudioContext || window.webkitAudioContext;
  if (!Audio) throw new Error('Audio unavailable');
  if (!context || context.state === 'closed') context = new Audio();
  return context;
}

// One tone with optional overtones. Higher partials fade sooner, like a struck bell.
function tone(out, f, t, d, g, type = 'sine', partials = [[1, 1]], attack = .008, damp = true) {
  const ctx = out.context;
  partials.forEach(([m, a]) => {
    const osc = ctx.createOscillator(), env = ctx.createGain();
    osc.type = type; osc.frequency.value = f * m;
    const end = t + (damp ? d / m ** .4 : d);
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(g * a, t + attack);
    env.gain.exponentialRampToValueAtTime(.0001, end);
    osc.connect(env); env.connect(out);
    osc.start(t); osc.stop(end + .1);
  });
}

function noise(out, t, d, f, g, q = 1) {
  const ctx = out.context, buffer = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * d)), ctx.sampleRate), data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 3);
  const src = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
  src.buffer = buffer; filter.type = 'bandpass'; filter.frequency.value = f; filter.Q.value = q; gain.gain.value = g;
  src.connect(filter); filter.connect(gain); gain.connect(out); src.start(t);
}

const BELL = [[1, 1], [2.76, .35], [5.4, .12]];
export const SAVINGS_SOUNDS = [
  { id: 'coin', name: 'Coin chime', note: 'Two bright bell notes, rising' },
  { id: 'vault', name: 'Vault click', note: 'Soft latch, warm low thud' },
  { id: 'ledger', name: 'Ledger ping', note: 'Quick 4-note marimba climb' },
];
const PATTERNS = {
  coin(out, t) { tone(out, 1318.5, t, 1.1, .16, 'sine', BELL); tone(out, 1975.5, t + .13, 1.5, .15, 'sine', BELL); return 1.8; },
  vault(out, t) {
    noise(out, t, .04, 2600, .5, 1.2);
    tone(out, 150, t + .02, .28, .4); tone(out, 75, t + .02, .3, .35);
    [659.3, 987.8, 1318.5].forEach((f, i) => tone(out, f, t + .16 + i * .02, 1.2, .07));
    return 1.5;
  },
  ledger(out, t) { [523.3, 659.3, 784, 1046.5].forEach((f, i) => tone(out, f, t + i * .085, .55, .17, 'triangle', [[1, 1], [4, .18]])); return .9; },
  // Challenge complete: a rising brass line, a low hit, a held chord and a shimmer of bells.
  challenge(out, t) {
    const brass = [[1, 1], [2, .5], [3, .3], [4, .15]], shimmer = [[1, 1], [2.76, .3], [5.4, .1]];
    [[262, 0], [330, .16], [392, .32], [523, .5]].forEach(([f, d]) => tone(out, f, t + d, .5, .15, 'sawtooth', [[1, .5]], .02, false));
    tone(out, 95, t + .5, .5, .5, 'sine', [[1, 1]], .02, false); noise(out, t + .5, .2, 5000, .12);
    [262, 330, 392, 523, 659].forEach(f => tone(out, f, t + .75, 2.6, .1, 'triangle', brass, .02, false));
    for (let i = 0; i < 14; i++) tone(out, 2093 * (1 + (i % 4) * .2), t + .9 + i * .09, .6, .045, 'sine', shimmer, .02, false);
    [1046.5, 1318.5, 1568, 2093].forEach((f, i) => tone(out, f, t + 2.1 + i * .05, 2.2, .09, 'sine', shimmer, .02, false));
    return 4.5;
  },
};

export function stopSynthSound(kind) {
  const out = live.get(kind);
  if (!out) return;
  live.delete(kind);
  try { out.gain.setTargetAtTime(0, out.context.currentTime, .03); setTimeout(() => out.disconnect(), 200); } catch { /* already gone */ }
}

// Resolves true when the sound started, false when the browser blocked or lacks audio.
// slot: the name a sound is stopped by (the savings reminder uses 'savings' for every pattern).
export async function playSynthSound(kind, slot = kind) {
  if (!PATTERNS[kind]) return false;
  try {
    const ctx = audio();
    if (ctx.state !== 'running') {
      let timer;
      try { await Promise.race([ctx.resume(), new Promise(resolve => { timer = setTimeout(resolve, 250); })]); }
      finally { clearTimeout(timer); }
    }
    if (ctx.state !== 'running') return false;
    stopSynthSound(slot);
    const out = ctx.createGain();
    out.connect(ctx.destination);
    live.set(slot, out);
    const length = PATTERNS[kind](out, ctx.currentTime + .03);
    setTimeout(() => { if (live.get(slot) === out) { live.delete(slot); out.disconnect(); } }, (length + .5) * 1000);
    return true;
  } catch { return false; }
}

export async function unlockSynthSounds() {
  try { const ctx = audio(); await ctx.resume(); return ctx.state === 'running'; } catch { return false; }
}
