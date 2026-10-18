// Synthesised sound effects (Web Audio). No audio files to ship.
export type Sfx = 'bell' | 'bid' | 'tick' | 'hammer' | 'sold' | 'round' | 'card' | 'win' | 'closed' | 'event' | 'unsold';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let volume = 0.7;

function ac() {
  if (!ctx) {
    const C = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    ctx = new C();
    master = ctx.createGain();
    master.gain.value = volume;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

export function unlockAudio() {
  ac();
}

export function setVolume(v: number) {
  volume = v;
  if (master) master.gain.value = v;
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', gain = 0.3, slideTo?: number) {
  const c = ac();
  if (!c || !master) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, c.currentTime + start);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, c.currentTime + start + dur);
  g.gain.setValueAtTime(0.0001, c.currentTime + start);
  g.gain.exponentialRampToValueAtTime(gain, c.currentTime + start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + dur);
  o.connect(g).connect(master);
  o.start(c.currentTime + start);
  o.stop(c.currentTime + start + dur + 0.05);
}

function noise(start: number, dur: number, gain = 0.4, filterFreq = 1200) {
  const c = ac();
  if (!c || !master) return;
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = filterFreq;
  const g = c.createGain();
  g.gain.value = gain;
  src.connect(f).connect(g).connect(master);
  src.start(c.currentTime + start);
}

export function play(s: Sfx) {
  try {
    switch (s) {
      case 'bell':
        [0, 0.18].forEach((t) => { tone(1318, t, 1.2, 'sine', 0.25); tone(2637, t, 0.6, 'sine', 0.08); tone(659, t, 1.4, 'triangle', 0.1); });
        break;
      case 'bid':
        tone(660, 0, 0.09, 'square', 0.12);
        tone(990, 0.07, 0.14, 'square', 0.12);
        break;
      case 'tick':
        tone(1800, 0, 0.04, 'square', 0.1);
        break;
      case 'closed':
        tone(440, 0, 0.25, 'sawtooth', 0.15, 220);
        tone(330, 0.2, 0.4, 'sawtooth', 0.15, 160);
        break;
      case 'hammer':
        noise(0, 0.18, 0.9, 900);
        tone(110, 0, 0.25, 'sine', 0.6, 50);
        break;
      case 'sold':
        noise(0, 0.18, 0.9, 900);
        tone(110, 0, 0.25, 'sine', 0.6, 50);
        [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.25 + i * 0.09, 0.5, 'triangle', 0.18));
        tone(1047, 0.65, 0.9, 'sine', 0.15);
        break;
      case 'unsold':
        tone(392, 0, 0.3, 'triangle', 0.18);
        tone(311, 0.22, 0.5, 'triangle', 0.18);
        break;
      case 'round':
        noise(0, 0.9, 0.15, 3000);
        [196, 262, 330, 392].forEach((f, i) => tone(f, i * 0.12, 0.9, 'sawtooth', 0.07));
        tone(784, 0.5, 0.8, 'triangle', 0.15);
        break;
      case 'card':
        [880, 1175, 1568].forEach((f, i) => tone(f, i * 0.06, 0.3, 'sine', 0.15));
        tone(200, 0, 0.4, 'sine', 0.2, 600);
        break;
      case 'event':
        tone(220, 0, 0.6, 'sawtooth', 0.12, 880);
        tone(330, 0.1, 0.6, 'sawtooth', 0.08, 1320);
        noise(0, 0.5, 0.2, 2500);
        break;
      case 'win':
        [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.13, 0.5, 'triangle', 0.2));
        noise(0.9, 1.4, 0.15, 6000);
        break;
    }
  } catch {
    /* audio unavailable */
  }
}
