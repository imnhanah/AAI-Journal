import test from 'node:test';
import assert from 'node:assert/strict';

// A small Web Audio stand-in: records every node so the tests can see what played and what stopped.
function fakeAudio() {
  const made = { sources: [], oscillators: [], gains: [] };
  let audio;
  globalThis.window = { AudioContext: class {
    constructor() { audio = this; }
    state = 'suspended'; destination = {}; currentTime = 0; sampleRate = 8000;
    async resume() { this.state = 'running'; }
    async decodeAudioData(bytes) { return { bytes, duration: 22 }; }
    createBufferSource() { const source = { starts: [], stopped: false, connect() {}, disconnect() {}, start(...args) { this.starts.push(args); }, stop() { this.stopped = true; } }; made.sources.push(source); return source; }
    createOscillator() { const osc = { type: 'sine', frequency: { value: 0 }, connect() {}, start() {}, stop() {} }; made.oscillators.push(osc); return osc; }
    createGain() { const gain = { context: audio, disconnected: false, gain: { value: 1, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime(v) { this.value = v; } }, connect() {}, disconnect() { this.disconnected = true; } }; made.gains.push(gain); return gain; }
    createBiquadFilter() { return { type: '', frequency: { value: 0 }, Q: { value: 0 }, connect() {} }; }
    createBuffer(channels, length) { const data = new Float32Array(length); return { getChannelData: () => data }; }
  } };
  globalThis.localStorage = { values: new Map(), getItem(key) { return this.values.get(key) ?? null; }, setItem(key, value) { this.values.set(key, value); } };
  return { made, get audio() { return audio; } };
}

test('news keeps its recording; savings and challenge are synthesised and stop cleanly', async () => {
  const fake = fakeAudio();
  const requests = [];
  globalThis.fetch = async (url) => { requests.push(url); return { ok: true, arrayBuffer: async () => new ArrayBuffer(1) }; };
  const { unlockAlertSounds, playAlertSound, stopAlertSound } = await import('./alertSounds.js');
  assert.equal(await playAlertSound('news'), false);
  assert.equal(await unlockAlertSounds(), true);
  assert.equal(await playAlertSound('news'), true);
  assert.deepEqual(fake.made.sources[0].starts, [[]]);
  assert.deepEqual(requests, ['/audio/news-alert.mp3']);

  const before = fake.made.oscillators.length;
  assert.equal(await playAlertSound('challenge'), true);
  assert.ok(fake.made.oscillators.length - before > 20, 'the fanfare is built from many tones');

  // The savings reminder plays the sound chosen in its speaker menu (Vault click by default).
  const vault = fake.made.oscillators.length;
  assert.equal(await playAlertSound('savings'), true);
  const vaultTones = fake.made.oscillators.length - vault;
  globalThis.localStorage.setItem('tj-savings-alert-sound-choice', 'ledger');
  const ledger = fake.made.oscillators.length;
  assert.equal(await playAlertSound('savings'), true);
  assert.equal(fake.made.oscillators.length - ledger, 8, 'four marimba notes with one overtone each');
  assert.notEqual(vaultTones, 8);
  const out = fake.made.gains.at(-1 - 8);
  stopAlertSound('savings');
  assert.equal(out.gain.value, 0, 'stopping fades the savings sound out');
  assert.deepEqual(requests, ['/audio/news-alert.mp3'], 'no recordings are fetched for savings or challenge');
});
